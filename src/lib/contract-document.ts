/**
 * Collaboration agreements: admin template, filled document, PDF, and who may read a message.
 * Native in-app signing is primary; DocuSign is an optional channel when enabled with credentials.
 */
import { prisma } from "@/lib/db";
import {
  asciiForPdf as asciiForPdfImpl,
  classifyContractPdfLines as classifyContractPdfLinesImpl,
  renderContractPdf as renderContractPdfImpl,
  endorsementSlotsFromParties,
  signaturesFromParties,
  wrapContractLines as wrapContractLinesImpl,
  type ContractPdfLine,
  type ContractPdfLineStyle,
  type ContractPdfOptions,
  type ContractPdfSignature,
} from "@/lib/contract-pdf";
import { assembleDocuSignCredentials, openDocuSignEnvelope } from "@/lib/signing/docusign";
import {
  applyNativeSignatureAnchor,
  formatNativeAttestation,
  isNativeSigningCode,
  nativeEnvelopeId,
} from "@/lib/signing/native";
import { resolveSigningMode } from "@/lib/signing";
import { activeSigningProvider } from "@/lib/providers";
import { decryptSecret } from "@/lib/provider-secrets";
import { SERVICE_LEVEL_LABELS, type ServiceLevel } from "@/lib/collaboration-fees";

export const CONTRACT_TEMPLATE_ID = "collaboration";
export const CONTRACT_TEMPLATE_VERSION = "influrios-collab-v1";

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
  "usage_block",
  "esign_provider",
] as const;

export type ContractVariable = (typeof CONTRACT_VARIABLES)[number];

/**
 * Approved Influrios collaboration agreement template (structured for PDF layout).
 * Placeholders map through buildContractValues; optional rows stay blank-safe.
 */
export const DEFAULT_CONTRACT_TEMPLATE = `COLLABORATION AGREEMENT
{{title}}

Agreement ID Status Generated Jurisdiction
{{agreement_id}} {{agreement_status}} {{generated_at}} {{jurisdiction}}

Agreement purpose
This Collaboration Agreement sets out the campaign scope, commercial terms, milestone payments, content rights, approvals, obligations and signatures between the Business and the Influencer(s) identified below. Influrios provides the platform workflow and records associated with the collaboration.

Commercial Summary
Item  Agreed Terms
Campaign  {{title}}
Business  {{business_name}}
Service Level  {{service_level}}
Currency  {{currency}}
Gross Contract Value  {{gross}}
Influrios Platform Fee  {{platform_fee}}
Influencer Compensation Pool  {{creator_compensation}}
Campaign Period  {{campaign_period}}

1. Parties
This Collaboration Agreement (the "Agreement") is entered into by and between the following parties for the campaign identified above.

Party Type  Legal / Display Name  Email
Business  {{business_name}}  {{business_email}}
{{parties_block}}

Multiple Influencers. If more than one Influencer participates, each listed Influencer is a party to this Agreement only to the extent of that Influencer's assigned deliverables, compensation share, rights and obligations.

2. Campaign Scope and Deliverables
Field  Agreement Detail
Campaign Objective  {{commercial}}
Scope of Work  {{scope}}
Creative Requirements  Per campaign record
Usage / Licensing Package  {{usage_block}}
Exclusivity, if any  {{exclusivity}}

The Influencer will create and submit the agreed deliverables in accordance with this Agreement, the campaign brief, applicable law, platform rules and any written brand requirements incorporated into the campaign record.

3. Compensation and Platform Fee
The Business agrees to fund the Gross Contract Value shown in the Commercial Summary. The Gross Contract Value consists of the Influencer compensation and the applicable Influrios platform fee allocated under the milestone schedule.

Commercial Item  Amount / Rule
Gross Contract Value  {{gross}}
Influrios Platform Fee  {{platform_fee}}
Influencer Compensation Pool  {{creator_compensation}}
Fee Rule  {{fee_disclosure}}

Fee Earning Rule. The applicable portion of the platform fee is earned only when the corresponding milestone is released or otherwise becomes earned under the campaign rules.

No retroactive fee change. The fee rule recorded when this Agreement becomes binding controls this collaboration. A later Admin or platform pricing change will not retroactively alter the fee terms of this Agreement unless all required parties agree to an amendment.

4. Milestone Schedule
{{milestones_block}}

For collaborations with more or fewer milestones, Influrios will render the complete milestone schedule from the campaign record. The milestone percentages should total 100% unless the campaign explicitly uses a different approved structure.

5. Influencer Share Allocation
{{party_shares_block}}

If multiple Influencers participate, the compensation pool is allocated according to the percentages shown above. Influrios may generate a single funding instruction while maintaining separate ledger allocations for each Influencer.

6. Funding, Release and Payout
- The Business must fund the collaboration through the payment method or provider made available by Influrios before any milestone that requires funded status may begin.
- Amounts designated for the collaboration remain separate from Influrios operating revenue until the applicable fee or other amount becomes earned under the campaign and platform rules.
- Influencer compensation associated with a milestone becomes payable only after the milestone is approved, auto-approved under the configured campaign rule, or otherwise released following the applicable dispute process.
- The corresponding allocated portion of the Influrios platform fee becomes earned when the milestone is released or otherwise satisfies the applicable earning rule.
- Payment-provider processing, payout, foreign exchange, tax, withholding or similar charges may apply where disclosed in the campaign or provider flow.
- A failed payout does not cancel an earned Influencer amount. The payable remains subject to verification, compliance review and successful payout processing.

7. Submission, Review and Revisions
- The Influencer will submit each deliverable through the method specified in the campaign record.
- The Business will review submitted work within {{approval_period}}.
- The Business may request revisions reasonably within the agreed campaign scope and revision allowance: {{revision_allowance}}.
- A request that materially expands scope, channels, usage rights or deliverables may require a written amendment and additional compensation.
- If the campaign uses auto-approval, the applicable timer and conditions will be displayed in the campaign record.

8. Content Rights and Usage
Unless the campaign expressly provides for a buyout or assignment, the Influencer retains ownership of the Influencer's original content. The Influencer grants the Business only the usage rights expressly selected for this campaign:

{{usage_block}}

No usage right not expressly stated in this Agreement is granted. Expanded use, extended term, new territory, paid-media use, sublicensing or ownership transfer outside the agreed rights requires a separate written agreement or amendment.

9. Advertising Disclosure and Platform Compliance
Each Influencer is responsible for making clear and conspicuous advertising, sponsorship or material-connection disclosures required by applicable law and the rules of the social platform on which content is published. The Business will not instruct an Influencer to conceal a required disclosure.
- Influencers must use campaign-required disclosures, hashtags, labels or platform tools.
- Content must not contain unlawful, knowingly false, defamatory or infringing material.
- The Business is responsible for the accuracy and substantiation of factual claims or product information it supplies to the Influencer.
- The Influencer remains responsible for the Influencer's own statements, conduct and compliance with applicable platform rules.

10. Confidentiality
A party receiving non-public business, campaign, product, pricing, customer, technical or personal information from another party will use that information only for this collaboration and will not disclose it except to personnel or advisers who need it and are subject to appropriate confidentiality obligations, or where disclosure is required by law.

11. Representations and Warranties
Each party represents that:
- it has authority to enter into this Agreement and perform its obligations;
- its performance will not knowingly violate another binding agreement;
- materials it supplies for the campaign are owned by it or properly licensed for the intended use; and
- information it supplies for payment, tax, verification and contracting purposes is materially accurate.

The Influencer additionally represents that original content supplied by the Influencer will not knowingly infringe third-party intellectual-property or publicity rights, except to the extent the allegedly infringing element was supplied or specifically required by the Business.

12. Cancellation and Termination
Cancellation and termination will be handled according to the campaign status, completed work, earned fees, approved milestones and applicable refund rules. Unless a campaign-specific term states otherwise:
- unearned future milestone amounts should remain refundable to the funding party, subject to provider limitations and legitimate deductions;
- completed or approved work and earned platform fees remain payable and are not automatically reversed by cancellation;
- a material breach reasonably capable of cure should be given the applicable cure period: {{cure_period}};
- Influrios may suspend or restrict a collaboration where fraud, sanctions, prohibited activity, material security risk or payment abuse is reasonably suspected.

13. Disputes
A party disputing a milestone, deliverable, release or payment must use the collaboration dispute process within {{dispute_window}}. The disputed amount may remain on hold while the dispute is reviewed. Undisputed amounts should continue through the normal release process where operationally possible.

Influrios may provide administrative tools, records and workflow support for a dispute but does not guarantee a particular legal outcome unless a separate written service expressly states otherwise.

14. Platform Role
Influrios provides technology and operational workflow for discovery, collaboration administration, records, payment orchestration and related services. Unless Influrios is expressly named as a contracting service provider for a separate managed service, Influrios is not the employer, agent, partner or joint venturer of the Business or Influencer, and it does not control the manner and means by which the Influencer creates content.

Nothing in this Agreement should be interpreted as describing collaboration funds as bank deposits or regulated escrow unless the applicable licensed payment arrangement expressly provides that status.

15. Indemnification and Liability
Each party is responsible for losses arising from its own breach of this Agreement, unlawful conduct, fraud, willful misconduct or infringement caused by materials it supplied. Any broader indemnity, liability cap or exclusion of consequential damages should follow the governing Influrios Terms and any campaign-specific enterprise terms incorporated by reference.

Platform terms. The current Influrios Terms of Service, Privacy Policy and any applicable payment/provider terms are incorporated by reference to the extent they govern account use, payment processing, platform conduct, privacy or limitations not specifically addressed here.

16. Governing Law and Venue
This Agreement is governed by the law stated in the campaign record: {{jurisdiction}}. Any court venue, arbitration requirement or dispute forum applicable to this collaboration is: {{dispute_forum}}.

17. Notices, Records and Electronic Communications
- Influrios will store the executed agreement and relevant audit record on the account of each party, subject to account access and retention rules.
- Campaign messages, notices and approvals recorded in Influrios may form part of the collaboration record.
- System timestamps should be shown in a human-readable format with the applicable timezone.
- A party should promptly update its contact information if the email or account information used for notices changes.

18. Amendments, Assignment and Entire Agreement
Material changes to the parties, compensation, milestone amounts, usage rights, service level or core scope require a written amendment or replacement agreement accepted by all affected parties. No party may assign this Agreement in a manner that materially increases another party's obligations without any consent required by applicable law or the governing terms. This Agreement, together with incorporated campaign records and applicable Influrios terms, constitutes the agreement of the parties regarding this collaboration and supersedes inconsistent prior campaign communications.

19. Electronic Signature
This Agreement becomes executed when all required signers complete the electronic-signature process through {{esign_provider}} and the signature provider confirms completion. Each party signs by typing their legal name; Influrios converts that name into a handwritten signature mark and stamps page-endorsement initials on every page of this Agreement.

Party  Signer  Email  Signature Status
{{signature_block}}

Signature Audit Record
Field  Recorded Value
E-sign Provider  {{esign_provider}}
Template Version  ${CONTRACT_TEMPLATE_VERSION}
Agreement Status  {{agreement_status}}

END OF COLLABORATION AGREEMENT
`;

export function asciiForPdf(value: string): string {
  return asciiForPdfImpl(value);
}

export function displayServiceLevel(value: string): string {
  const key = value.trim().toLowerCase() as ServiceLevel;
  if (key in SERVICE_LEVEL_LABELS) return SERVICE_LEVEL_LABELS[key];
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatContractDisplayDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : "—";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

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
  agreementId?: string;
  agreementStatus?: string;
  campaignPeriod?: string;
  usageSummary?: string;
  exclusivity?: string;
  approvalPeriod?: string;
  revisionAllowance?: string;
  curePeriod?: string;
  disputeWindow?: string;
  disputeForum?: string;
  esignProvider?: string;
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
      const role = party.role === "business" ? "Business" : "Influencer";
      return `${role}  ${party.name}  ${party.email}  Pending Signature\n[[SIG_INK:${index + 1}]]\n/sig${index + 1}/`;
    })
    .join("\n\n");
}

export function buildContractValues(input: ContractRenderInput): Record<string, string> {
  const influencers = input.parties.filter((party) => party.role === "creator");
  const partiesBlock = influencers
    .map((party) => {
      const handle = party.creatorSlug ? `@${party.creatorSlug}` : "—";
      return `Influencer  ${party.name} (${handle})  ${party.email}`;
    })
    .join("\n");
  const milestonesBlock =
    input.milestones.length === 0
      ? "Milestone  Share  Gross Amount  Platform Fee  Influencer Amount\n(None scheduled.)"
      : [
          "Milestone  Share  Gross Amount  Platform Fee  Influencer Amount",
          ...input.milestones.map(
            (row, index) =>
              `${index + 1}. ${row.title}  ${row.shareLabel}  ${row.grossLabel}  ${row.feeLabel}  ${row.creatorShares}`,
          ),
        ].join("\n");
  const sharesBlock =
    influencers.length === 0
      ? "Influencer  Platform Handle  Share of Influencer Compensation\n(No influencer shares listed.)"
      : [
          "Influencer  Platform Handle  Share of Influencer Compensation",
          ...influencers.map((party) => {
            const handle = party.creatorSlug ? `@${party.creatorSlug}` : "—";
            return `${party.name}  ${handle}  ${((party.shareBps ?? 0) / 100).toFixed(2)}%`;
          }),
        ].join("\n");
  const usage =
    input.usageSummary?.trim() ||
    "Usage Field  Agreed Right\nOrganic Brand Use  Per campaign record\nPaid Advertising / Whitelisting  Not granted unless stated in the campaign record\nTerritory  Per campaign record\nDuration  Per campaign record\nEditing / Adaptation  Per campaign record\nOwnership / Buyout  Influencer retains ownership; license only as stated";
  return {
    title: input.title,
    scope: input.scope,
    commercial: input.commercial,
    jurisdiction: input.jurisdiction,
    service_level: displayServiceLevel(input.serviceLevel),
    currency: input.currency,
    gross: input.grossLabel,
    platform_fee: input.platformFeeLabel,
    creator_compensation: input.creatorCompensationLabel,
    business_name: input.businessName,
    business_email: input.businessEmail,
    parties_block: partiesBlock || "Influencer  (listed in campaign record)  —",
    milestones_block: milestonesBlock,
    party_shares_block: sharesBlock,
    fee_disclosure: input.feeDisclosure,
    generated_at: formatContractDisplayDate(input.generatedAt),
    signature_block: signatureBlock(input.parties),
    agreement_id: input.agreementId?.trim() || "Pending assignment",
    agreement_status: input.agreementStatus?.trim() || "Ready for Signature",
    campaign_period: input.campaignPeriod?.trim() || "Per campaign record",
    usage_block: usage,
    exclusivity: input.exclusivity?.trim() || "None",
    approval_period: input.approvalPeriod?.trim() || "Per campaign workflow",
    revision_allowance: input.revisionAllowance?.trim() || "Per campaign workflow",
    cure_period: input.curePeriod?.trim() || "Per campaign workflow",
    dispute_window: input.disputeWindow?.trim() || "Per campaign workflow",
    dispute_forum: input.disputeForum?.trim() || input.jurisdiction || "Per campaign record",
    esign_provider: input.esignProvider?.trim() || "Influrios in-app signing",
  };
}

export function renderContractBody(template: string, input: ContractRenderInput): string {
  const values = buildContractValues(input);
  const rendered = renderContractTemplate(template, values).trim();
  if (template.includes("{{signature_block}}")) return rendered;
  return `${rendered}\n\n${values.signature_block}`;
}

export type { ContractPdfLine, ContractPdfLineStyle, ContractPdfOptions, ContractPdfSignature };

export function wrapContractLines(text: string, width = 88): string[] {
  return wrapContractLinesImpl(text, width);
}

export function classifyContractPdfLines(text: string): ContractPdfLine[] {
  return classifyContractPdfLinesImpl(text);
}

/** Multi-page PDF with title/heading hierarchy, signature ink, and page endorsements. */
export function renderContractPdf(text: string, options: ContractPdfOptions = {}): Buffer {
  return renderContractPdfImpl(text, options);
}

/** True when the stored body predates the approved Influrios chrome template. */
export function isLegacyContractBody(body: string): boolean {
  const text = body ?? "";
  if (!text.trim()) return true;
  const hasChrome =
    text.includes("19. Electronic Signature") &&
    text.includes("Commercial Summary") &&
    text.includes("[[SIG_INK:");
  return !hasChrome;
}

function fieldFromLegacy(body: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = body.match(new RegExp(`${escaped}:\\s*(.+)`, "i"));
  return match?.[1]?.trim() ?? "";
}

function parseLegacyMilestones(body: string): ContractRenderInput["milestones"] {
  const section = body.split(/\n\s*4\.\s+Milestones\b/i)[1]?.split(/\n\s*5\.\s+/i)[0] ?? "";
  if (!section.trim() || /none scheduled/i.test(section)) return [];
  const blocks = section.split(/\n(?=\d+\.\s+)/).map((block) => block.trim()).filter(Boolean);
  const rows: ContractRenderInput["milestones"] = [];
  for (const block of blocks) {
    const title = block.match(/^\d+\.\s+(.+)/)?.[1]?.trim() ?? "";
    if (!title || /none scheduled/i.test(title)) continue;
    rows.push({
      title: title.split("\n")[0].trim(),
      shareLabel: fieldFromLegacy(block, "Share") || "—",
      grossLabel: fieldFromLegacy(block, "Gross") || "—",
      feeLabel: fieldFromLegacy(block, "Platform fee") || "—",
      creatorShares: fieldFromLegacy(block, "Creator payout") || "—",
    });
  }
  return rows;
}

export type ContractChromeDocument = {
  id: string;
  title: string;
  status: string;
  renderedBody: string;
  signingChannel?: string | null;
  createdAt?: Date | string | null;
  parties: {
    role: string;
    name: string;
    email: string;
    userId?: string | null;
    creatorSlug?: string | null;
    shareBps?: number | null;
    status: string;
    attestation?: string | null;
    signedAt?: Date | string | null;
  }[];
};

/**
 * Rebuild a legacy agreement into the approved Influrios template chrome,
 * preserving commercial fields parsed from the old body and re-stamping
 * any signatures already recorded on party rows.
 */
export function upgradeLegacyContractBody(document: ContractChromeDocument): string {
  const body = document.renderedBody || "";
  if (!isLegacyContractBody(body)) return body;

  const business = document.parties.find((party) => party.role === "business");
  const creators = document.parties.filter((party) => party.role === "creator" || party.role === "influencer");
  const parties: ContractPartyInput[] = [
    ...(business
      ? [
          {
            role: "business" as const,
            name: business.name,
            email: business.email,
            userId: business.userId,
            shareBps: business.shareBps ?? 0,
          },
        ]
      : []),
    ...creators.map((party) => ({
      role: "creator" as const,
      name: party.name,
      email: party.email,
      userId: party.userId,
      creatorSlug: party.creatorSlug,
      shareBps: party.shareBps ?? 0,
    })),
  ];

  const statusLabel =
    document.status === "signed"
      ? "Fully Executed"
      : document.status === "sent"
        ? "Ready for Signature"
        : document.status === "draft"
          ? "Draft"
          : document.status;

  const input: ContractRenderInput = {
    title: document.title || fieldFromLegacy(body, "campaign") || "Collaboration agreement",
    scope: fieldFromLegacy(body, "Scope") || "Per campaign record",
    commercial: fieldFromLegacy(body, "Commercial terms") || "Per campaign record",
    jurisdiction: fieldFromLegacy(body, "Jurisdiction") || "Per campaign record",
    serviceLevel: fieldFromLegacy(body, "Service level") || "contracted",
    currency: fieldFromLegacy(body, "Currency") || "USD",
    grossLabel: fieldFromLegacy(body, "Gross contract value") || "—",
    platformFeeLabel: fieldFromLegacy(body, "Platform fee") || "—",
    creatorCompensationLabel: fieldFromLegacy(body, "Creator compensation") || "—",
    businessName: business?.name || fieldFromLegacy(body, "Business")?.replace(/\s*\(.*\)$/, "") || "Business",
    businessEmail: business?.email || "",
    parties,
    milestones: parseLegacyMilestones(body),
    feeDisclosure: body.match(/Fee rule[^\n]*/i)?.[0]?.trim() || "Per campaign fee disclosure",
    generatedAt:
      (typeof document.createdAt === "string" ? document.createdAt : document.createdAt?.toISOString()) ||
      fieldFromLegacy(body, "Generated") ||
      new Date().toISOString(),
    agreementId: document.id,
    agreementStatus: statusLabel,
    esignProvider:
      document.signingChannel === "docusign" ? "DocuSign" : "Influrios in-app signing",
  };

  let next = renderContractBody(DEFAULT_CONTRACT_TEMPLATE, input);

  // Re-apply recorded signatures onto the new ink anchors.
  document.parties.forEach((party, index) => {
    if (party.status !== "signed") return;
    const typedName = (party.attestation || party.name || "").trim();
    if (!typedName) return;
    const signedAt =
      party.signedAt instanceof Date
        ? party.signedAt
        : party.signedAt
          ? new Date(party.signedAt)
          : new Date();
    const attestation = formatNativeAttestation({
      role: party.role === "influencer" ? "creator" : party.role,
      typedName,
      email: party.email,
      signedAt: Number.isNaN(signedAt.getTime()) ? new Date() : signedAt,
    });
    next = applyNativeSignatureAnchor(next, index + 1, attestation);
  });

  return next;
}

/** Always return chrome-ready body text (upgrades legacy stores in memory). */
export function resolveContractBodyForChrome(document: ContractChromeDocument): {
  body: string;
  upgraded: boolean;
} {
  if (!isLegacyContractBody(document.renderedBody)) {
    return { body: document.renderedBody, upgraded: false };
  }
  return { body: upgradeLegacyContractBody(document), upgraded: true };
}

/**
 * Build the downloadable chrome PDF for any contract (legacy or new).
 * Always upgrades legacy bodies and always stamps page endorsements / signature ink.
 */
export function buildContractChromePdf(document: ContractChromeDocument): {
  body: string;
  upgraded: boolean;
  pdf: Buffer;
} {
  const { body, upgraded } = resolveContractBodyForChrome(document);
  const pdf = renderContractPdf(body, {
    title: document.title,
    agreementId: document.id,
    signatures: signaturesFromParties(
      document.parties.map((party) => ({
        role: party.role,
        email: party.email,
        attestation: party.attestation ?? null,
        signedAt:
          party.signedAt instanceof Date
            ? party.signedAt
            : party.signedAt
              ? new Date(party.signedAt)
              : null,
        status: party.status,
        name: party.name,
      })),
    ),
    endorsementSlots: endorsementSlotsFromParties(
      document.parties.map((party) => ({
        role: party.role,
        attestation: party.attestation ?? null,
        status: party.status,
        name: party.name,
      })),
    ),
    pageEndorsements: true,
  });
  return { body, upgraded, pdf };
}

export function fundingAllowedBySignature(status: string): { ok: true } | { ok: false; error: string } {
  if (status === "signed") return { ok: true };
  return {
    ok: false,
    error: "The contract is signed when every party has completed their signature. Nothing was funded.",
  };
}

export type MessageAudience = "party" | "all_parties" | "admin" | "contract_manager";

export function isMessageAudience(value: string): value is MessageAudience {
  return value === "party" || value === "all_parties" || value === "admin" || value === "contract_manager";
}

/** Match a logged-in account to a contract party by user id, then by email (case-insensitive). */
export function resolveContractPartyForAccount<T extends { id: string; userId: string | null; email: string }>(
  parties: T[],
  account: { id: string; email: string },
): T | undefined {
  const byUser = parties.find((party) => party.userId && party.userId === account.id);
  if (byUser) return byUser;
  const email = account.email.trim().toLowerCase();
  if (!email) return undefined;
  return parties.find((party) => party.email.trim().toLowerCase() === email);
}

/**
 * Recipients who should be notified when a contract message is posted.
 * Admin / contract_manager audiences stay in-app for staff (no party email blast).
 */
export function contractMessageNotifyEmails(input: {
  audience: MessageAudience;
  parties: { id: string; email: string; userId: string | null }[];
  recipientPartyId?: string | null;
  senderUserId?: string | null;
  senderEmail?: string | null;
}): string[] {
  const senderEmail = (input.senderEmail ?? "").trim().toLowerCase();
  const skip = (email: string, userId: string | null) => {
    const cleaned = email.trim().toLowerCase();
    if (!cleaned || !cleaned.includes("@")) return true;
    if (input.senderUserId && userId && userId === input.senderUserId) return true;
    if (senderEmail && cleaned === senderEmail) return true;
    return false;
  };
  if (input.audience === "all_parties") {
    return [
      ...new Set(
        input.parties
          .filter((party) => !skip(party.email, party.userId))
          .map((party) => party.email.trim().toLowerCase()),
      ),
    ];
  }
  if (input.audience === "party") {
    const recipient = input.parties.find((party) => party.id === input.recipientPartyId);
    if (!recipient || skip(recipient.email, recipient.userId)) return [];
    return [recipient.email.trim().toLowerCase()];
  }
  return [];
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
    // Contract managers see threads addressed to them and party-wide conversation.
    if (input.viewer.permissions.includes("contracts.manage")) {
      return input.audience === "contract_manager" || input.audience === "all_parties";
    }
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
  if (!existing) {
    return prisma.contractTemplate.create({
      data: {
        id: CONTRACT_TEMPLATE_ID,
        name: "Collaboration agreement",
        body: DEFAULT_CONTRACT_TEMPLATE,
      },
    });
  }
  // Upgrade legacy short templates to the approved Influrios layout (admin custom bodies are kept).
  const looksLegacy =
    !existing.body.includes("19. Electronic Signature") &&
    existing.body.includes("COLLABORATION AGREEMENT") &&
    existing.body.includes("{{signature_block}}");
  if (looksLegacy && existing.body.length < 2500) {
    return prisma.contractTemplate.update({
      where: { id: CONTRACT_TEMPLATE_ID },
      data: { body: DEFAULT_CONTRACT_TEMPLATE, name: "Collaboration agreement" },
    });
  }
  return existing;
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
  const renderedBody = renderContractBody(template.body, {
    ...input.render,
    agreementStatus: input.render.agreementStatus ?? "Ready for Signature",
    esignProvider: input.render.esignProvider,
  });
  const pdfBytes = renderContractPdf(renderedBody, {
    title: input.render.title,
    agreementId: input.render.agreementId,
    signatures: [],
    endorsementSlots: endorsementSlotsFromParties(
      input.render.parties.map((party) => ({
        role: party.role,
        attestation: null,
        status: "pending",
        name: party.name,
      })),
    ),
    pageEndorsements: true,
  });
  const provider = await activeSigningProvider();
  if (!provider) {
    return {
      ok: false as const,
      error:
        "Enable Influrios in-app signing or DocuSign in Admin → Document signing. Only one channel can be active. Nothing was signed.",
    };
  }
  const secret = provider.secretCipher ? decryptSecret(provider.secretCipher) : "";
  const mode = resolveSigningMode(provider.code, {
    integrationKey: provider.integrationKey,
    userId: provider.userId,
    accountId: provider.publicKey,
    privateKey: secret ?? "",
    baseUrl: provider.baseUrl,
  });

  let signingChannel: "native" | "docusign" = "native";
  let envelopeId = "";

  if (mode === "native") {
    signingChannel = "native";
  } else if (mode === "docusign") {
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
    signingChannel = "docusign";
    envelopeId = opened.envelopeId;
  } else if (isNativeSigningCode(provider.code)) {
    signingChannel = "native";
  } else {
    return {
      ok: false as const,
      error:
        "DocuSign credentials are incomplete. Finish DocuSign setup, or enable Influrios in-app signing instead (only one can be active). Nothing was signed.",
    };
  }

  const document = await prisma.contractDocument.create({
    data: {
      workspaceId: input.workspaceId,
      collaborationId: input.collaborationId || null,
      teamProposalId: input.teamProposalId || null,
      title: input.render.title.slice(0, 160),
      renderedBody,
      pdfBytes: new Uint8Array(pdfBytes),
      status: "sent",
      signingChannel,
      envelopeId,
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

  if (signingChannel === "native" && !envelopeId) {
    envelopeId = nativeEnvelopeId(document.id);
    await prisma.contractDocument.update({
      where: { id: document.id },
      data: { envelopeId },
    });
  }

  await notifyContractStage({
    documentId: document.id,
    title: input.render.title.slice(0, 160),
    stage: "sent",
    signingChannel,
    parties: input.render.parties.map((party) => ({ email: party.email, name: party.name })),
  }).catch(() => undefined);

  return { ok: true as const, id: document.id, envelopeId, signingChannel };
}

/**
 * Record an in-app signature for one party. Completes the document when every party has signed.
 */
export async function signNativeContractParty(input: {
  documentId: string;
  userId: string;
  email?: string | null;
  typedName: string;
}) {
  const typedName = input.typedName.trim();
  if (typedName.length < 2) {
    return { ok: false as const, error: "Type your legal name to sign. Nothing was signed." };
  }
  if (typedName.length > 160) {
    return { ok: false as const, error: "Keep the typed name under 160 characters. Nothing was signed." };
  }

  const document = await prisma.contractDocument.findUnique({
    where: { id: input.documentId },
    include: { parties: { orderBy: { createdAt: "asc" } } },
  });
  if (!document) return { ok: false as const, error: "Contract not found." };
  if (document.signingChannel !== "native") {
    return {
      ok: false as const,
      error: "This agreement was sent through DocuSign. Sign it there, or ask for a new in-app send. Nothing was signed.",
    };
  }
  if (document.status === "signed") {
    return { ok: true as const, id: document.id, status: "signed" as const, alreadyComplete: true };
  }
  if (document.status !== "sent" && document.status !== "draft") {
    return { ok: false as const, error: `This agreement cannot be signed while it is “${document.status}”.` };
  }

  const matched = resolveContractPartyForAccount(document.parties, {
    id: input.userId,
    email: input.email ?? "",
  });
  const partyIndex = matched ? document.parties.findIndex((row) => row.id === matched.id) : -1;
  if (partyIndex < 0 || !matched) {
    return { ok: false as const, error: "You are not a party on this agreement. Nothing was signed." };
  }
  if (matched.userId !== input.userId) {
    await prisma.contractParty.update({
      where: { id: matched.id },
      data: { userId: input.userId },
    });
  }
  const party = { ...matched, userId: input.userId };
  if (party.status === "signed") {
    const allDone = document.parties.every((row) => row.status === "signed" || row.id === party.id);
    return {
      ok: true as const,
      id: document.id,
      status: allDone ? ("signed" as const) : ("sent" as const),
      alreadySigned: true,
    };
  }
  if (party.status === "declined") {
    return { ok: false as const, error: "You declined this agreement. Nothing was signed." };
  }

  const signedAt = new Date();
  const attestation = formatNativeAttestation({
    role: party.role,
    typedName,
    email: party.email,
    signedAt,
  });
  // Upgrade legacy bodies first so /sigN/ and [[SIG_INK:N]] anchors match the new chrome.
  const chromeReady = resolveContractBodyForChrome({
    id: document.id,
    title: document.title,
    status: document.status,
    renderedBody: document.renderedBody,
    signingChannel: document.signingChannel,
    createdAt: document.createdAt,
    parties: document.parties,
  }).body;
  const nextBody = applyNativeSignatureAnchor(chromeReady, partyIndex + 1, attestation);
  const nextParties = document.parties.map((row) =>
    row.id === party.id
      ? { ...row, status: "signed", attestation: typedName.slice(0, 160), signedAt }
      : row,
  );
  const documentStatus = nextParties.every((row) => row.status === "signed") ? "signed" : "sent";
  const pdfBytes = renderContractPdf(nextBody, {
    title: document.title,
    agreementId: document.id,
    signatures: signaturesFromParties(nextParties),
    endorsementSlots: endorsementSlotsFromParties(nextParties),
    pageEndorsements: true,
  });

  await prisma.$transaction([
    prisma.contractParty.update({
      where: { id: party.id },
      data: { status: "signed", attestation: typedName.slice(0, 160), signedAt },
    }),
    prisma.contractDocument.update({
      where: { id: document.id },
      data: {
        status: documentStatus,
        renderedBody: nextBody,
        pdfBytes: new Uint8Array(pdfBytes),
        envelopeId: document.envelopeId || nativeEnvelopeId(document.id),
      },
    }),
  ]);

  const partyEmails = document.parties.map((row) => ({ email: row.email, name: row.name }));
  if (documentStatus === "signed") {
    await notifyContractStage({
      documentId: document.id,
      title: document.title,
      stage: "completed",
      signingChannel: "native",
      parties: partyEmails,
    }).catch(() => undefined);
  } else {
    await notifyContractStage({
      documentId: document.id,
      title: document.title,
      stage: "party_signed",
      signingChannel: "native",
      parties: partyEmails,
      actorName: typedName,
      excludeEmails: [party.email],
    }).catch(() => undefined);
    // Remind remaining pending parties to sign.
    const pending = document.parties.filter((row) => row.id !== party.id && row.status === "pending");
    if (pending.length > 0) {
      await notifyContractStage({
        documentId: document.id,
        title: document.title,
        stage: "signature_reminder",
        signingChannel: "native",
        parties: pending.map((row) => ({ email: row.email, name: row.name })),
        actorName: typedName,
      }).catch(() => undefined);
    }
  }

  return { ok: true as const, id: document.id, status: documentStatus as "sent" | "signed" };
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
  if (input.status === "completed" || input.status === "declined" || input.status === "voided") {
    await notifyContractStage({
      documentId: document.id,
      title: document.title,
      stage: input.status === "completed" ? "completed" : input.status,
      signingChannel: "docusign",
      parties: document.parties.map((row) => ({ email: row.email, name: row.name })),
    }).catch(() => undefined);
  }
  return { ok: true as const, applied: true, id: document.id, status: next.documentStatus };
}

export async function listContractsForUser(userId: string, email?: string | null) {
  const emailNorm = (email ?? "").trim().toLowerCase();
  const workspace = await prisma.businessWorkspace
    .findUnique({ where: { ownerUserId: userId }, select: { id: true } })
    .catch(() => null);
  return prisma.contractDocument.findMany({
    where: {
      OR: [
        { parties: { some: { userId } } },
        { createdByUserId: userId },
        ...(workspace ? [{ workspaceId: workspace.id }] : []),
        ...(emailNorm ? [{ parties: { some: { email: { equals: emailNorm, mode: "insensitive" as const } } } }] : []),
      ],
    },
    include: { parties: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
}

/** Shared status label for account + admin contract lists. */
export function contractPartyProgress(parties: { status: string }[]): {
  signed: number;
  total: number;
  label: string;
} {
  const total = parties.length;
  const signed = parties.filter((party) => party.status === "signed").length;
  if (total === 0) return { signed: 0, total: 0, label: "No parties" };
  if (signed >= total) return { signed, total, label: "Fully signed" };
  return { signed, total, label: `${signed}/${total} signed` };
}

/** Resolve the caller's party row and heal a stale/missing userId when email matches. */
export async function resolveContractPartyForSession(
  documentId: string,
  account: { id: string; email: string } | null | undefined,
) {
  if (!account) return null;
  const parties = await prisma.contractParty.findMany({ where: { documentId } });
  const party = resolveContractPartyForAccount(parties, account);
  if (!party) return null;
  if (party.userId !== account.id) {
    await prisma.contractParty.update({
      where: { id: party.id },
      data: { userId: account.id },
    });
    return { ...party, userId: account.id };
  }
  return party;
}

export async function postContractMessage(input: {
  documentId: string;
  body: string;
  audience: MessageAudience;
  recipientPartyId?: string | null;
  senderName: string;
  senderUserId?: string | null;
  senderAdminId?: string | null;
  senderEmail?: string | null;
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

  const notifyEmails = contractMessageNotifyEmails({
    audience: input.audience,
    parties: document.parties,
    recipientPartyId: input.recipientPartyId,
    senderUserId: input.senderUserId,
    senderEmail: input.senderEmail,
  });
  if (notifyEmails.length > 0) {
    await notifyContractStage({
      documentId: document.id,
      title: document.title,
      stage: "message",
      signingChannel: document.signingChannel === "docusign" ? "docusign" : "native",
      parties: notifyEmails.map((email) => ({ email, name: "" })),
      actorName: input.senderName,
      messageBody: body.slice(0, 400),
    }).catch(() => undefined);
  }

  return { ok: true as const, id: row.id, notified: notifyEmails.length };
}

export type ContractNotifyStage =
  | "sent"
  | "party_signed"
  | "signature_reminder"
  | "completed"
  | "declined"
  | "voided"
  | "message";

export function contractStageEmailCopy(input: {
  stage: ContractNotifyStage;
  title: string;
  link: string;
  signingChannel?: string;
  actorName?: string;
  messageBody?: string;
}): { subject: string; text: string; notificationKind: string } {
  const title = input.title.slice(0, 80);
  const actor = (input.actorName ?? "A party").trim() || "A party";
  const native = (input.signingChannel ?? "native") !== "docusign";
  switch (input.stage) {
    case "sent":
      return {
        subject: `Action needed: sign “${title}”`,
        text: native
          ? `You are a party on the collaboration agreement “${input.title}”.\n\nOpen the contract and sign with your legal name:\n${input.link}\n\nFunding cannot start until every party has signed.`
          : `You are a party on the collaboration agreement “${input.title}”.\n\nComplete your DocuSign envelope, then you can follow progress here:\n${input.link}\n\nFunding cannot start until every party has signed.`,
        notificationKind: "contract_sent",
      };
    case "party_signed":
      return {
        subject: `Signature progress on “${title}”`,
        text: `${actor} signed “${input.title}”.\n\nOpen the contract to see who still needs to sign:\n${input.link}`,
        notificationKind: "contract_party_signed",
      };
    case "signature_reminder":
      return {
        subject: `Still needed: your signature on “${title}”`,
        text: `${actor} signed “${input.title}”. Your signature is still needed.\n\nSign here:\n${input.link}`,
        notificationKind: "contract_signature_reminder",
      };
    case "completed":
      return {
        subject: `Fully signed: “${title}”`,
        text: `Every party has signed “${input.title}”. Funding can start.\n\nOpen the signed agreement:\n${input.link}`,
        notificationKind: "contract_completed",
      };
    case "declined":
      return {
        subject: `Contract declined: “${title}”`,
        text: `The agreement “${input.title}” was declined.\n\nView status:\n${input.link}`,
        notificationKind: "contract_declined",
      };
    case "voided":
      return {
        subject: `Contract voided: “${title}”`,
        text: `The agreement “${input.title}” was voided.\n\nView status:\n${input.link}`,
        notificationKind: "contract_voided",
      };
    case "message":
      return {
        subject: `New message on contract “${title}”`,
        text: `${actor} wrote on “${input.title}”:\n\n${input.messageBody ?? ""}\n\nOpen the contract to reply: ${input.link}`,
        notificationKind: "contract_message",
      };
  }
}

/** Email every listed party for a contract lifecycle stage (skips blank addresses). */
export async function notifyContractStage(input: {
  documentId: string;
  title: string;
  stage: ContractNotifyStage;
  signingChannel?: string;
  parties: { email: string; name?: string }[];
  actorName?: string;
  messageBody?: string;
  excludeEmails?: string[];
}) {
  const { getAppOrigin } = await import("@/lib/billing");
  const { processDueJobs } = await import("@/lib/jobs");
  const { mailReady } = await import("@/lib/mail");
  if (!(await mailReady())) return { queued: 0 };
  const exclude = new Set((input.excludeEmails ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean));
  const emails = [
    ...new Set(
      input.parties
        .map((party) => party.email.trim().toLowerCase())
        .filter((email) => email.includes("@") && !exclude.has(email)),
    ),
  ];
  if (emails.length === 0) return { queued: 0 };
  const link = `${getAppOrigin()}/collaboration/contracts/${input.documentId}`;
  const copy = contractStageEmailCopy({
    stage: input.stage,
    title: input.title,
    link,
    signingChannel: input.signingChannel,
    actorName: input.actorName,
    messageBody: input.messageBody,
  });
  for (const to of emails) {
    await prisma.job.create({
      data: {
        kind: "collab_notification",
        status: "queued",
        payload: {
          to,
          subject: copy.subject,
          text: copy.text,
          notificationKind: copy.notificationKind,
          documentId: input.documentId,
        },
      },
    });
  }
  await processDueJobs().catch(() => undefined);
  return { queued: emails.length };
}
