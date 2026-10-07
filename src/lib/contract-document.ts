/**
 * Collaboration agreements: admin template, filled document, PDF, and who may read a message.
 * A contract is signed only when DocuSign reports every party complete.
 */
import { prisma } from "@/lib/db";
import { assembleDocuSignCredentials, openDocuSignEnvelope } from "@/lib/signing/docusign";
import { activeSigningProvider } from "@/lib/providers";
import { decryptSecret } from "@/lib/provider-secrets";

export const CONTRACT_TEMPLATE_ID = "collaboration";

export const CONTRACT_VARIABLES = [
  "title",
  "scope",
  "commercial",
  "jurisdiction",
  "service_level",
  "currency",
  "gross",
  "platform_fee",
  "creator_compensation",
  "business_name",
  "business_email",
  "parties_block",
  "milestones_block",
  "party_shares_block",
  "fee_disclosure",
  "generated_at",
  "signature_block",
] as const;

export type ContractVariable = (typeof CONTRACT_VARIABLES)[number];

export const DEFAULT_CONTRACT_TEMPLATE = `COLLABORATION AGREEMENT

Generated: {{generated_at}}

1. Parties
This agreement is made for the campaign "{{title}}" between the business and every creator named below. Each person is a party. Removing a party after this document is sent requires a new agreement.

Business: {{business_name}} ({{business_email}})

{{parties_block}}

2. Campaign
Scope: {{scope}}
Commercial terms: {{commercial}}
Jurisdiction: {{jurisdiction}}
Service level: {{service_level}}

3. Money
Currency: {{currency}}
Gross contract value: {{gross}}
Platform fee: {{platform_fee}}
Creator compensation: {{creator_compensation}}

The platform fee is earned only when a milestone is released. Creator compensation is split by the shares in this document. One funding instruction pays those shares. A later change to a fee rule does not change this agreement.

{{fee_disclosure}}

4. Milestones
{{milestones_block}}

5. Creator shares
{{party_shares_block}}

6. Records
Influrios stores this agreement, including this PDF, on the account of every party. Each party can open it from their account. Messages about this agreement stay on the agreement.

7. Signatures
A button inside Influrios does not sign this agreement. It is signed only when DocuSign reports that every party below has completed the envelope. Until then the agreement stays unsigned and funding cannot start.

{{signature_block}}
`;

export type ContractPartyInput = {
  role: "business" | "creator";
  name: string;
  email: string;
  userId?: string | null;
  creatorSlug?: string | null;
  shareBps?: number;
};

export type ContractRenderInput = {
  title: string;
  scope: string;
  commercial: string;
  jurisdiction: string;
  serviceLevel: string;
  currency: string;
  grossLabel: string;
  platformFeeLabel: string;
  creatorCompensationLabel: string;
  businessName: string;
  businessEmail: string;
  parties: ContractPartyInput[];
  milestones: { title: string; shareLabel: string; grossLabel: string; feeLabel: string; creatorShares: string }[];
  feeDisclosure: string;
  generatedAt: string;
};

export function renderContractTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) return match;
    const value = values[key]?.trim();
    return value ? value : "—";
  });
}

export function signatureBlock(parties: ContractPartyInput[]): string {
  return parties
    .map((party, index) => {
      const share = party.shareBps ? ` · ${(party.shareBps / 100).toFixed(2)}%` : "";
      return `${index + 1}. ${party.role} — ${party.name} — ${party.email}${share}\n/sig${index + 1}/`;
    })
    .join("\n\n");
}

export function buildContractValues(input: ContractRenderInput): Record<string, string> {
  const partiesBlock = input.parties
    .map((party, index) => {
      const share = party.role === "creator" && party.shareBps ? ` · share ${(party.shareBps / 100).toFixed(2)}%` : "";
      const slug = party.creatorSlug ? ` · profile ${party.creatorSlug}` : "";
      return `${index + 1}. ${party.role}: ${party.name} <${party.email}>${slug}${share}`;
    })
    .join("\n");
  const milestonesBlock =
    input.milestones.length === 0
      ? "—"
      : input.milestones
          .map(
            (row, index) =>
              `${index + 1}. ${row.title} · ${row.shareLabel} · gross ${row.grossLabel} · fee ${row.feeLabel}\n   ${row.creatorShares}`,
          )
          .join("\n");
  const sharesBlock = input.parties
    .filter((party) => party.role === "creator")
    .map((party) => `${party.name} (${party.email}) · ${((party.shareBps ?? 0) / 100).toFixed(2)}%`)
    .join("\n");
  return {
    title: input.title,
    scope: input.scope,
    commercial: input.commercial,
    jurisdiction: input.jurisdiction,
    service_level: input.serviceLevel,
    currency: input.currency,
    gross: input.grossLabel,
    platform_fee: input.platformFeeLabel,
    creator_compensation: input.creatorCompensationLabel,
    business_name: input.businessName,
    business_email: input.businessEmail,
    parties_block: partiesBlock,
    milestones_block: milestonesBlock,
    party_shares_block: sharesBlock,
    fee_disclosure: input.feeDisclosure,
    generated_at: input.generatedAt,
    signature_block: signatureBlock(input.parties),
  };
}

export function renderContractBody(template: string, input: ContractRenderInput): string {
  const values = buildContractValues(input);
  const rendered = renderContractTemplate(template, values).trim();
  if (template.includes("{{signature_block}}")) return rendered;
  return `${rendered}\n\n${values.signature_block}`;
}

function pdfEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function toPdfText(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, "?");
}

export function wrapContractLines(text: string, width = 85): string[] {
  const lines: string[] = [];
  for (const raw of toPdfText(text).split("\n")) {
    if (!raw.trim()) {
      lines.push("");
      continue;
    }
    let rest = raw;
    while (rest.length > width) {
      let cut = rest.lastIndexOf(" ", width);
      if (cut < 20) cut = width;
      lines.push(rest.slice(0, cut).trimEnd());
      rest = rest.slice(cut).trimStart();
    }
    lines.push(rest);
  }
  return lines.length > 0 ? lines : [""];
}

/** Multi-page Helvetica PDF. Text is stored uncompressed so the agreement can be read back. */
export function renderContractPdf(text: string): Buffer {
  const lines = wrapContractLines(text);
  const pageSize = 46;
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += pageSize) {
    pages.push(lines.slice(index, index + pageSize));
  }
  if (pages.length === 0) pages.push([""]);

  const fontId = 3 + pages.length * 2;
  const parts: { id: number; body: string }[] = [];
  const kids: number[] = [];
  pages.forEach((pageLines, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    kids.push(pageId);
    const commands = ["BT", "/F1 11 Tf", "50 742 Td"];
    pageLines.forEach((line, lineIndex) => {
      if (lineIndex > 0) commands.push("0 -14 Td");
      commands.push(`(${pdfEscape(line)}) Tj`);
    });
    commands.push("ET");
    const stream = commands.join("\n");
    parts.push({
      id: contentId,
      body: `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    });
    parts.push({
      id: pageId,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    });
  });
  const objects = [
    { id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
    {
      id: 2,
      body: `<< /Type /Pages /Kids [${kids.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    },
    ...parts,
    { id: fontId, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" },
  ].sort((a, b) => a.id - b.id);

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const object of objects) {
    offsets[object.id] = Buffer.byteLength(out);
    out += `${object.id} 0 obj\n${object.body}\nendobj\n`;
  }
  const xrefAt = Buffer.byteLength(out);
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= objects.length; id += 1) {
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return Buffer.from(out + xref, "utf8");
}

export function fundingAllowedBySignature(status: string): { ok: true } | { ok: false; error: string } {
  if (status === "signed") return { ok: true };
  return {
    ok: false,
    error: "The contract is signed when DocuSign reports every party complete. Nothing was funded.",
  };
}

export type MessageAudience = "party" | "all_parties" | "admin" | "contract_manager";

export function isMessageAudience(value: string): value is MessageAudience {
  return value === "party" || value === "all_parties" || value === "admin" || value === "contract_manager";
}

export function messageVisible(input: {
  audience: string;
  recipientPartyId: string | null;
  senderUserId: string | null;
  senderAdminId: string | null;
  viewer:
    | { kind: "party"; userId: string; partyId: string }
    | { kind: "admin"; userId: string; roleId: string; permissions: string[] };
}): boolean {
  if (input.viewer.kind === "party" && input.senderUserId && input.senderUserId === input.viewer.userId) return true;
  if (input.viewer.kind === "admin" && input.senderAdminId && input.senderAdminId === input.viewer.userId) return true;
  if (input.viewer.kind === "admin") {
    if (input.viewer.roleId === "role_super" || input.viewer.permissions.includes("contracts.message")) return true;
    if (input.viewer.permissions.includes("contracts.manage") && input.audience === "contract_manager") return true;
    return false;
  }
  if (input.audience === "all_parties") return true;
  if (input.audience === "party" && input.recipientPartyId === input.viewer.partyId) return true;
  return false;
}

/** Admin message access is Super Admin, unless that role was granted contracts.message. */
export function adminCanOpenContractMessages(input: { roleId: string; permissions: string[] }): boolean {
  return input.roleId === "role_super" || input.permissions.includes("contracts.message");
}

export function applyEnvelopeToParties(
  parties: { status: string }[],
  envelope: "completed" | "declined" | "voided" | "sent",
): { documentStatus: "sent" | "signed" | "declined" | "voided"; partyStatus: "pending" | "signed" | "declined" } {
  if (envelope === "completed") return { documentStatus: "signed", partyStatus: "signed" };
  if (envelope === "declined") return { documentStatus: "declined", partyStatus: "declined" };
  if (envelope === "voided") return { documentStatus: "voided", partyStatus: "pending" };
  return {
    documentStatus: parties.every((party) => party.status === "signed") ? "signed" : "sent",
    partyStatus: "pending",
  };
}

export async function ensureContractTemplate() {
  const existing = await prisma.contractTemplate.findUnique({ where: { id: CONTRACT_TEMPLATE_ID } });
  if (existing) return existing;
  return prisma.contractTemplate.create({
    data: {
      id: CONTRACT_TEMPLATE_ID,
      name: "Collaboration agreement",
      body: DEFAULT_CONTRACT_TEMPLATE,
    },
  });
}

export async function saveContractTemplate(body: string) {
  const next = body.trim();
  if (next.length < 40) return { ok: false as const, error: "The template needs the agreement text." };
  await ensureContractTemplate();
  const row = await prisma.contractTemplate.update({
    where: { id: CONTRACT_TEMPLATE_ID },
    data: { body: next },
  });
  return { ok: true as const, body: row.body };
}

export async function resolveCreatorParties(
  members: { creatorSlug: string; shareBps: number }[],
): Promise<{ ok: true; parties: ContractPartyInput[] } | { ok: false; error: string }> {
  const parties: ContractPartyInput[] = [];
  for (const member of members) {
    const creator = await prisma.creator.findUnique({
      where: { slug: member.creatorSlug },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    const email = creator?.user?.email?.trim() ?? "";
    if (!creator || !email) {
      return {
        ok: false,
        error: `Add an account email for ${member.creatorSlug} before sending the contract. Nothing was signed.`,
      };
    }
    parties.push({
      role: "creator",
      name: creator.user?.name?.trim() || creator.displayName,
      email,
      userId: creator.user?.id ?? creator.userId,
      creatorSlug: creator.slug,
      shareBps: member.shareBps,
    });
  }
  return { ok: true, parties };
}

export async function sendCollaborationContract(input: {
  render: ContractRenderInput;
  workspaceId: string;
  collaborationId?: string | null;
  teamProposalId?: string | null;
  createdByUserId: string;
  source: Record<string, string>;
}) {
  const business = input.render.parties.find((party) => party.role === "business");
  const creators = input.render.parties.filter((party) => party.role === "creator");
  if (!business?.email || creators.length < 1) {
    return { ok: false as const, error: "The agreement needs the business and at least one creator email. Nothing was signed." };
  }
  const template = await ensureContractTemplate();
  const renderedBody = renderContractBody(template.body, input.render);
  const pdfBytes = renderContractPdf(renderedBody);
  const provider = await activeSigningProvider();
  if (!provider) {
    return { ok: false as const, error: "Save DocuSign in admin before sending the contract. Nothing was signed." };
  }
  const secret = provider.secretCipher ? decryptSecret(provider.secretCipher) : "";
  const credentials = assembleDocuSignCredentials({
    stored: {
      integrationKey: provider.integrationKey,
      userId: provider.userId,
      accountId: provider.publicKey,
      privateKey: secret ?? "",
      baseUrl: provider.baseUrl,
      oauthBaseUrl: provider.oauthBaseUrl,
    },
  });
  if (!credentials.ok) return credentials;
  const opened = await openDocuSignEnvelope({
    credentials,
    request: {
      collaborationId: input.collaborationId || input.workspaceId,
      title: input.render.title.slice(0, 160),
      documentHtml: renderedBody,
      documentPdf: pdfBytes,
      parties: input.render.parties.map((party) => ({ name: party.name, email: party.email })),
    },
  });
  if (!opened.ok) return { ok: false as const, error: `${opened.error} Nothing was signed.` };
  const document = await prisma.contractDocument.create({
    data: {
      workspaceId: input.workspaceId,
      collaborationId: input.collaborationId || null,
      teamProposalId: input.teamProposalId || null,
      title: input.render.title.slice(0, 160),
      renderedBody,
      pdfBytes: new Uint8Array(pdfBytes),
      status: "sent",
      envelopeId: opened.envelopeId,
      createdByUserId: input.createdByUserId,
      sourceJson: input.source,
      parties: {
        create: input.render.parties.map((party) => ({
          role: party.role,
          name: party.name,
          email: party.email,
          userId: party.userId || null,
          creatorSlug: party.creatorSlug || null,
          shareBps: party.shareBps ?? 0,
          status: "pending",
        })),
      },
    },
  });
  return { ok: true as const, id: document.id, envelopeId: opened.envelopeId };
}

export async function applyContractEnvelopeEvent(input: {
  envelopeId: string;
  status: "completed" | "declined" | "voided" | "sent";
}) {
  const document = await prisma.contractDocument.findFirst({
    where: { envelopeId: input.envelopeId },
    include: { parties: true },
  });
  if (!document) return { ok: true as const, applied: false };
  if (document.status === "signed" && input.status === "completed") {
    return { ok: true as const, applied: true, id: document.id, status: document.status };
  }
  const next = applyEnvelopeToParties(document.parties, input.status);
  await prisma.$transaction([
    prisma.contractDocument.update({
      where: { id: document.id },
      data: { status: next.documentStatus },
    }),
    ...(next.partyStatus === "pending"
      ? []
      : [
          prisma.contractParty.updateMany({
            where: { documentId: document.id },
            data: {
              status: next.partyStatus,
              signedAt: next.partyStatus === "signed" ? new Date() : null,
            },
          }),
        ]),
  ]);
  return { ok: true as const, applied: true, id: document.id, status: next.documentStatus };
}

export async function listContractsForUser(userId: string) {
  return prisma.contractDocument.findMany({
    where: { parties: { some: { userId } } },
    include: { parties: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}

export async function postContractMessage(input: {
  documentId: string;
  body: string;
  audience: MessageAudience;
  recipientPartyId?: string | null;
  senderName: string;
  senderUserId?: string | null;
  senderAdminId?: string | null;
  viewerPartyId?: string | null;
  admin?: { roleId: string; permissions: string[] } | null;
}) {
  const body = input.body.trim();
  if (!body) return { ok: false as const, error: "Write a message." };
  if (body.length > 2000) return { ok: false as const, error: "Keep the message under 2000 characters." };
  const document = await prisma.contractDocument.findUnique({
    where: { id: input.documentId },
    include: { parties: true },
  });
  if (!document) return { ok: false as const, error: "Contract not found." };
  const isParty = Boolean(input.viewerPartyId && document.parties.some((party) => party.id === input.viewerPartyId));
  const adminOpen = input.admin ? adminCanOpenContractMessages(input.admin) || input.admin.permissions.includes("contracts.manage") : false;
  if (!isParty && !adminOpen) return { ok: false as const, error: "You cannot message on this contract." };
  if (input.audience === "party") {
    const recipient = document.parties.find((party) => party.id === input.recipientPartyId);
    if (!recipient) return { ok: false as const, error: "Choose a party on this contract." };
  }
  const row = await prisma.contractMessage.create({
    data: {
      documentId: document.id,
      body: body.slice(0, 2000),
      audience: input.audience,
      recipientPartyId: input.audience === "party" ? input.recipientPartyId || null : null,
      senderName: input.senderName.slice(0, 120),
      senderUserId: input.senderUserId || null,
      senderAdminId: input.senderAdminId || null,
    },
  });
  return { ok: true as const, id: row.id };
}
