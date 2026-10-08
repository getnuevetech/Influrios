/**
 * Document signing lifecycle. A request is signed only when DocuSign reports it.
 * Status stays a free-form string on SignatureRequest (no Prisma enum).
 */
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/provider-secrets";
import { activeSigningProvider } from "@/lib/providers";
import { docuSignCredentialsReady } from "@/lib/signing/docusign";

export const SIGNATURE_STATUSES = [
  "queued",
  "sent",
  "viewed",
  "signed",
  "declined",
  "voided",
] as const;

export type SignatureStatus = (typeof SIGNATURE_STATUSES)[number];

const TERMINAL = new Set<SignatureStatus>(["signed", "declined", "voided"]);

const ALLOWED: Record<SignatureStatus, SignatureStatus[]> = {
  queued: ["sent", "voided"],
  sent: ["viewed", "signed", "declined", "voided"],
  viewed: ["signed", "declined", "voided"],
  signed: [],
  declined: [],
  voided: [],
};

export function canAdvanceSignatureStatus(from: string, to: string): boolean {
  if (!SIGNATURE_STATUSES.includes(from as SignatureStatus)) return false;
  if (!SIGNATURE_STATUSES.includes(to as SignatureStatus)) return false;
  return ALLOWED[from as SignatureStatus].includes(to as SignatureStatus);
}

export type SigningIdentity = {
  integrationKey?: string;
  userId?: string;
  accountId?: string;
  privateKey?: string;
  baseUrl?: string;
};

/** DocuSign stays unconfigured until the saved or env credentials are complete. A demo code does not send. */
export function resolveSigningMode(
  providerCode: string,
  credentials?: SigningIdentity | null,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): "docusign" | "unconfigured" {
  const code = providerCode.trim().toLowerCase();
  if (code === "demo" || code === "demo_sign") return "unconfigured";
  const ready = docuSignCredentialsReady({
    integrationKey: credentials?.integrationKey || env.DOCUSIGN_INTEGRATION_KEY || "",
    userId: credentials?.userId || env.DOCUSIGN_USER_ID || "",
    accountId: credentials?.accountId || env.DOCUSIGN_ACCOUNT_ID || "",
    privateKey: credentials?.privateKey || env.DOCUSIGN_PRIVATE_KEY || "",
    baseUrl: credentials?.baseUrl || env.DOCUSIGN_BASE_URL || "",
  });
  if (code === "docusign" || code.includes("docusign")) return ready ? "docusign" : "unconfigured";
  return "unconfigured";
}

export function signingModeLabel(providerCode?: string | null, credentials?: SigningIdentity | null) {
  if (!providerCode) return "No signing provider";
  const mode = resolveSigningMode(providerCode, credentials);
  if (mode === "docusign") return "DocuSign";
  return "DocuSign credentials are not saved";
}

export async function advanceSignatureRequest(input: {
  id: string;
  to: SignatureStatus;
  note?: string;
}): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  if (input.to === "signed") {
    return {
      ok: false,
      error: "A contract is signed when DocuSign reports every party complete. An admin form cannot sign it.",
    };
  }
  const row = await prisma.signatureRequest.findUnique({ where: { id: input.id } });
  if (!row) return { ok: false, error: "Signature request not found." };
  if (!canAdvanceSignatureStatus(row.status, input.to)) {
    return {
      ok: false,
      error: `Cannot move from “${row.status}” to “${input.to}”.`,
    };
  }
  const updated = await prisma.signatureRequest.update({
    where: { id: row.id },
    data: {
      status: input.to,
      lastError: input.note?.trim().slice(0, 400) || null,
    },
  });
  return { ok: true, status: updated.status };
}

export async function markSignatureFromWebhook(input: {
  requestId?: string;
  externalId?: string;
  event: "viewed" | "signed" | "declined" | "voided";
}): Promise<{ ok: true; status: string; id: string } | { ok: false; error: string }> {
  const requestId = (input.requestId || "").trim();
  const externalId = (input.externalId || "").trim();
  const row = requestId
    ? await prisma.signatureRequest.findUnique({ where: { id: requestId } })
    : externalId
      ? await prisma.signatureRequest.findFirst({
          where: { externalId },
          orderBy: { updatedAt: "desc" },
        })
      : null;
  if (!row) return { ok: false, error: "Signature request not found." };
  if (TERMINAL.has(row.status as SignatureStatus)) {
    return { ok: true, status: row.status, id: row.id };
  }
  const to = input.event as SignatureStatus;
  if (!canAdvanceSignatureStatus(row.status, to)) {
    // Allow jumping to terminal from queued/sent for provider webhooks
    if (TERMINAL.has(to) && (row.status === "queued" || row.status === "sent" || row.status === "viewed")) {
      const updated = await prisma.signatureRequest.update({
        where: { id: row.id },
        data: { status: to, lastError: null },
      });
      return { ok: true, status: updated.status, id: updated.id };
    }
    return { ok: false, error: `Cannot apply “${to}” from “${row.status}”.` };
  }
  const updated = await prisma.signatureRequest.update({
    where: { id: row.id },
    data: { status: to, lastError: null },
  });
  return { ok: true, status: updated.status, id: updated.id };
}

export function verifySigningWebhookSignature(body: string, signature: string | null, secret: string) {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const provided = signature.replace(/^sha256=/i, "").trim();
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(provided, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function activeSigningWebhookSecret() {
  const provider = await activeSigningProvider();
  if (!provider?.secretCipher && !provider) return { error: "missing" as const };
  const row = await prisma.integrationProvider.findFirst({
    where: { kind: "signing", enabled: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return { error: "missing" as const };
  const secret = row.webhookCipher ? decryptSecret(row.webhookCipher) : "";
  return { code: row.code, secret: secret || "" };
}
