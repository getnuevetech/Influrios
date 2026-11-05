import { createHmac, timingSafeEqual } from "crypto";
import { getAppOrigin } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret, secretStatus } from "@/lib/provider-secrets";

const META_KIND = "webhook";
const META_CODE = "meta";
const INSTAGRAM_KIND = "social";
const INSTAGRAM_CODE = "instagram";

export function metaWebhookPath() {
  return "/api/social/meta/webhook";
}

export function metaWebhookAbsoluteUrl(origin = getAppOrigin()) {
  return `${origin.replace(/\/$/, "")}${metaWebhookPath()}`;
}

async function ensureMetaWebhookProvider() {
  const existing = await prisma.integrationProvider.findUnique({
    where: { kind_code: { kind: META_KIND, code: META_CODE } },
  });
  if (existing) return existing;
  try {
    return await prisma.integrationProvider.create({
      data: {
        kind: META_KIND,
        code: META_CODE,
        name: "Meta webhooks",
        enabled: true,
      },
    });
  } catch {
    return prisma.integrationProvider.findUniqueOrThrow({
      where: { kind_code: { kind: META_KIND, code: META_CODE } },
    });
  }
}

function envVerifyToken() {
  return (process.env.META_WEBHOOK_VERIFY_TOKEN ?? "").trim();
}

function envAppSecret() {
  return (process.env.META_APP_SECRET ?? "").trim();
}

/** Verify token + app secret used for Meta Instagram/Facebook webhook ingestion. */
export async function getMetaWebhookConfig() {
  const [meta, instagram] = await Promise.all([
    ensureMetaWebhookProvider(),
    prisma.integrationProvider.findUnique({
      where: { kind_code: { kind: INSTAGRAM_KIND, code: INSTAGRAM_CODE } },
    }),
  ]);
  const verifyToken =
    (meta.webhookCipher ? decryptSecret(meta.webhookCipher) : "") || envVerifyToken();
  const appSecret =
    (meta.secretCipher ? decryptSecret(meta.secretCipher) : "") ||
    (instagram?.secretCipher ? decryptSecret(instagram.secretCipher) : "") ||
    envAppSecret();
  const verifyTokenStatus: "saved" | "missing" =
    secretStatus(meta.webhookCipher) === "saved" || Boolean(envVerifyToken()) ? "saved" : "missing";
  const appSecretStatus: "saved" | "missing" =
    secretStatus(meta.secretCipher) === "saved" ||
    secretStatus(instagram?.secretCipher) === "saved" ||
    Boolean(envAppSecret())
      ? "saved"
      : "missing";
  return {
    verifyToken,
    appSecret,
    verifyTokenStatus,
    appSecretStatus,
    usingInstagramAppSecret: Boolean(!meta.secretCipher && !envAppSecret() && instagram?.secretCipher),
    webhookUrl: metaWebhookAbsoluteUrl(),
  };
}

export async function saveMetaWebhookConfig(input: {
  verifyToken?: string;
  clearVerifyToken?: boolean;
  appSecret?: string;
  clearAppSecret?: boolean;
}) {
  const existing = await ensureMetaWebhookProvider();
  const webhookCipher = input.clearVerifyToken
    ? null
    : input.verifyToken?.trim()
      ? encryptSecret(input.verifyToken.trim().slice(0, 500))
      : existing.webhookCipher;
  const secretCipher = input.clearAppSecret
    ? null
    : input.appSecret?.trim()
      ? encryptSecret(input.appSecret.trim().slice(0, 500))
      : existing.secretCipher;
  return prisma.integrationProvider.update({
    where: { id: existing.id },
    data: {
      enabled: true,
      webhookCipher,
      secretCipher,
      name: "Meta webhooks",
    },
  });
}

/** Meta subscription verification: return hub.challenge as plain text when the token matches. */
export function verifyMetaSubscriptionChallenge(input: {
  mode: string | null;
  token: string | null;
  challenge: string | null;
  expectedToken: string;
}): { ok: true; challenge: string } | { ok: false; status: number; error: string } {
  if (input.mode !== "subscribe") {
    return { ok: false, status: 400, error: "hub.mode must be subscribe." };
  }
  if (!input.expectedToken) {
    return { ok: false, status: 503, error: "Meta webhook verify token is not configured." };
  }
  if (!input.token || input.token !== input.expectedToken) {
    return { ok: false, status: 403, error: "Verify token did not match." };
  }
  if (!input.challenge) {
    return { ok: false, status: 400, error: "hub.challenge is required." };
  }
  return { ok: true, challenge: input.challenge };
}

/**
 * Meta signs the raw body with the app secret as sha256=<hex>.
 * Missing/invalid signatures are rejected so forged POSTs never touch accounts.
 */
export function verifyMetaWebhookSignature(rawBody: string, signatureHeader: string | null, appSecret: string) {
  if (!appSecret) return false;
  if (!signatureHeader) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type MetaWebhookChange = {
  object: string;
  entryId: string;
  field: string;
  value: unknown;
};

/** Pull object/entry/field triples Meta may send for Instagram or Facebook pages. */
export function parseMetaWebhookPayload(body: unknown): MetaWebhookChange[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  const root = body as { object?: unknown; entry?: unknown };
  const object = typeof root.object === "string" ? root.object : "";
  if (!Array.isArray(root.entry)) return [];
  const changes: MetaWebhookChange[] = [];
  for (const entry of root.entry) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as { id?: unknown; changes?: unknown };
    const entryId = typeof row.id === "string" || typeof row.id === "number" ? String(row.id) : "";
    if (!Array.isArray(row.changes)) continue;
    for (const change of row.changes) {
      if (!change || typeof change !== "object" || Array.isArray(change)) continue;
      const item = change as { field?: unknown; value?: unknown };
      const field = typeof item.field === "string" ? item.field : "";
      if (!field) continue;
      changes.push({ object, entryId, field, value: item.value });
    }
  }
  return changes;
}

function externalIdsFromChange(change: MetaWebhookChange): string[] {
  const ids = new Set<string>();
  if (change.entryId) ids.add(change.entryId);
  const value = change.value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of ["id", "from", "media_id", "comment_id", "user_id", "instagram_business_account"]) {
      const child = record[key];
      if (typeof child === "string" && child.trim()) ids.add(child.trim());
      if (typeof child === "number" && Number.isFinite(child)) ids.add(String(child));
      if (child && typeof child === "object" && !Array.isArray(child)) {
        const nested = child as { id?: unknown };
        if (typeof nested.id === "string" && nested.id.trim()) ids.add(nested.id.trim());
        if (typeof nested.id === "number" && Number.isFinite(nested.id)) ids.add(String(nested.id));
      }
    }
  }
  return [...ids];
}

/**
 * Best-effort: queue a metrics refresh for connected Instagram/Facebook accounts
 * matching Meta entry or nested ids. Unknown events stay acknowledged.
 */
export async function applyMetaWebhookChanges(changes: MetaWebhookChange[]) {
  const ids = [...new Set(changes.flatMap(externalIdsFromChange))].filter(Boolean);
  if (!ids.length) return { matched: 0, refreshed: 0 };

  const connections = await prisma.socialConnection.findMany({
    where: {
      platform: { in: ["INSTAGRAM", "FACEBOOK"] },
      status: "connected",
      externalId: { in: ids },
    },
    include: { creator: { select: { slug: true } } },
    take: 25,
  });

  let refreshed = 0;
  if (connections.length) {
    const { refreshSocialConnection } = await import("@/lib/social-connect");
    const origin = getAppOrigin();
    for (const connection of connections) {
      const result = await refreshSocialConnection({
        slug: connection.creator.slug,
        platform: connection.platform,
        origin,
      }).catch(() => ({ ok: false as const }));
      if (result.ok) refreshed += 1;
    }
  }

  return { matched: connections.length, refreshed };
}
