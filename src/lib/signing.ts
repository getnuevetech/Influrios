/**
 * Document signing lifecycle — demo adapter by default; DocuSign when env/credentials are ready.
 * Status stays a free-form string on SignatureRequest (no Prisma enum).
 */
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/provider-secrets";
import { activeSigningProvider, queueSignatureRequest, signingCanQueue } from "@/lib/providers";
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

/** Demo only when that provider is selected. DocuSign stays unconfigured until the saved or env credentials are complete. */
export function resolveSigningMode(
  providerCode: string,
  credentials?: SigningIdentity | null,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): "demo" | "docusign" | "unconfigured" {
  const code = providerCode.trim().toLowerCase();
  if (code === "demo" || code === "demo_sign") return "demo";
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
  if (mode === "demo") return "Demo signing";
  return "DocuSign credentials are not saved";
}

/**
 * Create an envelope with the active adapter.
 * Demo returns demosign_* external ids with no network call.
 * DocuSign stub posts to provider baseUrl when configured; otherwise falls back to demo.
 */
export async function createSigningEnvelope(input: {
  title: string;
  collaborationId: string;
  requestId: string;
  providerCode: string;
  baseUrl: string;
  secret: string;
}): Promise<{ ok: true; externalId: string; mode: "demo" | "docusign" } | { ok: false; error: string }> {
  const mode = resolveSigningMode(input.providerCode, { baseUrl: input.baseUrl, privateKey: input.secret });
  if (mode === "unconfigured") {
    return {
      ok: false,
      error: "Add the DocuSign integration key, user id, account id, private key, and API base URL in admin. Nothing was signed.",
    };
  }
  if (mode === "demo" || !input.baseUrl) {
    return {
      ok: true,
      externalId: `demosign_${input.requestId.slice(0, 24)}`,
      mode: "demo",
    };
  }
  try {
    const response = await fetch(input.baseUrl, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${input.secret}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: input.title,
        collaborationId: input.collaborationId,
        requestId: input.requestId,
        provider: "docusign",
      }),
    });
    if (response.status < 200 || response.status >= 300) {
      return { ok: false, error: "The signing API did not accept the request. Nothing was signed." };
    }
    const payload = (await response.json().catch(() => null)) as { id?: unknown; envelopeId?: unknown } | null;
    const externalIdRaw =
      payload && typeof payload.envelopeId === "string"
        ? payload.envelopeId
        : payload && typeof payload.id === "string"
          ? payload.id
          : `docusign_${input.requestId.slice(0, 20)}`;
    return { ok: true, externalId: externalIdRaw.slice(0, 120), mode: "docusign" };
  } catch {
    return { ok: false, error: "The signing API did not accept the request. Nothing was signed." };
  }
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
  if (!secret) return true; // demo providers may omit webhook secret
  if (!signature) return false;
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

/** Ensure a demo signing provider exists and is enabled with a placeholder secret. */
export async function ensureDemoSigningProvider() {
  const existing = await prisma.integrationProvider.findUnique({
    where: { kind_code: { kind: "signing", code: "demo" } },
  });
  if (existing) {
    if (!existing.enabled || !existing.secretCipher) {
      return prisma.integrationProvider.update({
        where: { id: existing.id },
        data: {
          enabled: true,
          name: existing.name || "Demo signing (swappable)",
          secretCipher: existing.secretCipher || encryptSecret("demo-signing-secret"),
          webhookCipher: existing.webhookCipher || encryptSecret("demo-signing-webhook"),
        },
      });
    }
    return existing;
  }
  try {
    return await prisma.integrationProvider.create({
      data: {
        kind: "signing",
        code: "demo",
        name: "Demo signing (swappable)",
        enabled: true,
        secretCipher: encryptSecret("demo-signing-secret"),
        webhookCipher: encryptSecret("demo-signing-webhook"),
      },
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code !== "P2002") throw error;
    return prisma.integrationProvider.findUniqueOrThrow({
      where: { kind_code: { kind: "signing", code: "demo" } },
    });
  }
}

/** Seed a signature request on the latest accepted collaboration for E2E. */
export async function seedDemoSignatureRequest(): Promise<
  { ok: true; id: string; status: string; collaborationId: string } | { ok: false; error: string }
> {
  await ensureDemoSigningProvider();
  const collab = await prisma.collaboration.findFirst({
    where: { status: "accepted" },
    orderBy: { updatedAt: "desc" },
  });
  if (!collab) {
    return {
      ok: false,
      error: "No accepted collaboration found. Accept a contract first, then seed a signature request.",
    };
  }
  const provider = await activeSigningProvider();
  const gate = signingCanQueue({
    enabled: Boolean(provider?.enabled),
    hasSecret: Boolean(provider?.hasSecret),
    collaborationStatus: collab.status,
  });
  if (!gate.ok) return gate;
  const queued = await queueSignatureRequest({
    collaborationId: collab.id,
    collaborationStatus: collab.status,
    title: `Demo signature · ${collab.title || collab.id}`.slice(0, 160),
  });
  if (!queued.ok) return queued;
  return { ok: true, id: queued.id, status: queued.status, collaborationId: collab.id };
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
