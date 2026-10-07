import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret, secretStatus } from "@/lib/provider-secrets";
import { assembleDocuSignCredentials, openDocuSignEnvelope } from "@/lib/signing/docusign";
import { classifyStripeKey, stripePayoutRouteReady } from "@/lib/stripe-admin";

export const AI_FUNCTIONS = [
  {
    key: "profile_topic_classification",
    label: "Profile topic classification",
    description: "Suggest specialties from a profile. Nothing is published until a person confirms the suggestion.",
    fallback: "Taxonomy keyword match",
  },
  {
    key: "collaboration_match_explanation",
    label: "Collaboration match explanation",
    description: "Suggest why two creators match. The published explanation stays the stored factor list until it is confirmed.",
    fallback: "Deterministic match scorer",
  },
  {
    key: "business_creator_match",
    label: "Business creator match",
    description: "Rank creators for a business brief. Unassigned, this stays a platform rule rather than an AI provider.",
    fallback: "Platform fit rule",
  },
  {
    key: "profile_draft_extraction",
    label: "Profile draft extraction",
    description: "Draft a profile from a public handle. If the provider fails, claim continues with an empty suggestion.",
    fallback: "Manual admin entry",
  },
] as const;

export type AiFunctionKey = (typeof AI_FUNCTIONS)[number]["key"];

export const AI_CALL_HOSTS = ["api.openai.com", "api.anthropic.com"] as const;

export const DEFAULT_PAYMENT_ROUTES: { countryCode: string; name: string; currency: string; gateway: "stripe" | "flutterwave" }[] = [
  { countryCode: "US", name: "United States", currency: "USD", gateway: "stripe" },
  { countryCode: "GB", name: "United Kingdom", currency: "GBP", gateway: "stripe" },
  { countryCode: "CA", name: "Canada", currency: "CAD", gateway: "stripe" },
  { countryCode: "DE", name: "Germany", currency: "EUR", gateway: "stripe" },
  { countryCode: "FR", name: "France", currency: "EUR", gateway: "stripe" },
  { countryCode: "NL", name: "Netherlands", currency: "EUR", gateway: "stripe" },
  { countryCode: "AU", name: "Australia", currency: "AUD", gateway: "stripe" },
  { countryCode: "AE", name: "United Arab Emirates", currency: "AED", gateway: "stripe" },
  { countryCode: "NG", name: "Nigeria", currency: "NGN", gateway: "flutterwave" },
  { countryCode: "GH", name: "Ghana", currency: "GHS", gateway: "flutterwave" },
  { countryCode: "KE", name: "Kenya", currency: "KES", gateway: "flutterwave" },
  { countryCode: "ZA", name: "South Africa", currency: "ZAR", gateway: "flutterwave" },
  { countryCode: "UG", name: "Uganda", currency: "UGX", gateway: "flutterwave" },
  { countryCode: "RW", name: "Rwanda", currency: "RWF", gateway: "flutterwave" },
  { countryCode: "TZ", name: "Tanzania", currency: "TZS", gateway: "flutterwave" },
  { countryCode: "CM", name: "Cameroon", currency: "XAF", gateway: "flutterwave" },
];

export type GatewayReadiness = {
  countryCode: string;
  providerCode: string | null;
  providerName: string | null;
  enabled: boolean;
  hasSecret: boolean;
  ready: boolean;
  reason: "ready" | "no_route" | "inactive" | "disabled" | "missing_secret";
  /** When the country route gateway is not ready, the admin default/backup may serve instead. */
  backupProviderCode?: string | null;
  backupProviderName?: string | null;
  usingBackup?: boolean;
};

export type GatewayRemovalImpact = {
  providerId: string;
  providerCode: string;
  providerName: string;
  isDefaultBackup: boolean;
  countries: { countryCode: string; countryName: string }[];
  blocked: boolean;
  blockers: string[];
};

export type ProviderExtra = {
  model?: string;
  isDefaultBackup?: boolean;
  lastWebhookAt?: string;
  holdingAccountId?: string;
  operationsAccountId?: string;
  integrationKey?: string;
  userId?: string;
  oauthBaseUrl?: string;
};

function extraString(raw: Record<string, unknown>, key: string) {
  return typeof raw[key] === "string" && raw[key].trim() ? raw[key].trim() : undefined;
}

export function readProviderExtra(extraJson: unknown): ProviderExtra {
  if (!extraJson || typeof extraJson !== "object" || Array.isArray(extraJson)) return {};
  const raw = extraJson as Record<string, unknown>;
  return {
    model: extraString(raw, "model"),
    isDefaultBackup: raw.isDefaultBackup === true ? true : undefined,
    lastWebhookAt: extraString(raw, "lastWebhookAt"),
    holdingAccountId: extraString(raw, "holdingAccountId"),
    operationsAccountId: extraString(raw, "operationsAccountId"),
    integrationKey: extraString(raw, "integrationKey"),
    userId: extraString(raw, "userId"),
    oauthBaseUrl: extraString(raw, "oauthBaseUrl"),
  };
}

function putExtraString(next: ProviderExtra, key: keyof ProviderExtra, value: string | undefined) {
  if (value === undefined) return;
  const trimmed = value.trim();
  if (trimmed) (next as Record<string, unknown>)[key] = trimmed;
  else delete (next as Record<string, unknown>)[key];
}

/** Keep stored extra fields when a later save only patches one of them. */
export function mergeProviderExtra(existing: unknown, patch: Partial<ProviderExtra>): ProviderExtra | undefined {
  const next: ProviderExtra = { ...readProviderExtra(existing) };
  if (patch.model !== undefined) putExtraString(next, "model", patch.model);
  if (patch.isDefaultBackup !== undefined) {
    if (patch.isDefaultBackup) next.isDefaultBackup = true;
    else delete next.isDefaultBackup;
  }
  if (patch.lastWebhookAt !== undefined) putExtraString(next, "lastWebhookAt", patch.lastWebhookAt);
  if (patch.holdingAccountId !== undefined) putExtraString(next, "holdingAccountId", patch.holdingAccountId);
  if (patch.operationsAccountId !== undefined) putExtraString(next, "operationsAccountId", patch.operationsAccountId);
  if (patch.integrationKey !== undefined) putExtraString(next, "integrationKey", patch.integrationKey);
  if (patch.userId !== undefined) putExtraString(next, "userId", patch.userId);
  if (patch.oauthBaseUrl !== undefined) putExtraString(next, "oauthBaseUrl", patch.oauthBaseUrl);
  if (
    !next.model &&
    !next.isDefaultBackup &&
    !next.lastWebhookAt &&
    !next.holdingAccountId &&
    !next.operationsAccountId &&
    !next.integrationKey &&
    !next.userId &&
    !next.oauthBaseUrl
  ) {
    return undefined;
  }
  return next;
}

export function assessGateway(input: {
  countryCode: string;
  providerCode?: string | null;
  providerName?: string | null;
  routeActive?: boolean;
  providerEnabled?: boolean;
  hasSecret?: boolean;
}): GatewayReadiness {
  const countryCode = input.countryCode.trim().toUpperCase();
  if (!input.providerCode || input.routeActive === false) {
    return {
      countryCode,
      providerCode: input.providerCode ?? null,
      providerName: input.providerName ?? null,
      enabled: false,
      hasSecret: false,
      ready: false,
      reason: input.providerCode && input.routeActive === false ? "inactive" : "no_route",
    };
  }
  if (!input.providerEnabled) {
    return {
      countryCode,
      providerCode: input.providerCode,
      providerName: input.providerName ?? input.providerCode,
      enabled: false,
      hasSecret: Boolean(input.hasSecret),
      ready: false,
      reason: "disabled",
    };
  }
  if (!input.hasSecret) {
    return {
      countryCode,
      providerCode: input.providerCode,
      providerName: input.providerName ?? input.providerCode,
      enabled: true,
      hasSecret: false,
      ready: false,
      reason: "missing_secret",
    };
  }
  return {
    countryCode,
    providerCode: input.providerCode,
    providerName: input.providerName ?? input.providerCode,
    enabled: true,
    hasSecret: true,
    ready: true,
    reason: "ready",
  };
}

export type AiRouteDecision = { mode: "fallback"; functionKey: string } | { mode: "provider"; functionKey: string; providerCode: string };

export function routeAiFunction(input: {
  functionKey: string;
  providerCode?: string | null;
  providerEnabled?: boolean;
  hasSecret?: boolean;
  routeEnabled?: boolean;
}): AiRouteDecision {
  if (!input.providerCode || input.routeEnabled === false || !input.providerEnabled || !input.hasSecret) {
    return { mode: "fallback", functionKey: input.functionKey };
  }
  return { mode: "provider", functionKey: input.functionKey, providerCode: input.providerCode };
}

export function aiEndpointAllowed(baseUrl: string | null | undefined): boolean {
  if (!baseUrl) return false;
  try {
    const url = new URL(baseUrl);
    return url.protocol === "https:" && (AI_CALL_HOSTS as readonly string[]).includes(url.hostname);
  } catch {
    return false;
  }
}

export function providerCode(value: string): string | null {
  const code = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return code || null;
}

export function signingEndpointAllowed(baseUrl: string | null | undefined) {
  if (!baseUrl) return false;
  try {
    const url = new URL(baseUrl);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function providerNeedsConnectedAccount(code: string | null | undefined) {
  return (code ?? "").trim().toLowerCase() === "airwallex";
}

/** Stripe corridors need acct_. This rail needs the stored connected-account reference. */
export function collectionPayoutReady(input: {
  providerCode?: string | null;
  routeReady: boolean;
  stripeConnectAccountId?: string | null;
  providerConnectedAccountId?: string | null;
}) {
  if (
    !stripePayoutRouteReady({
      providerCode: input.providerCode,
      routeReady: input.routeReady,
      stripeConnectAccountId: input.stripeConnectAccountId,
    })
  ) {
    return false;
  }
  if (providerNeedsConnectedAccount(input.providerCode)) {
    return Boolean(input.providerConnectedAccountId?.trim());
  }
  return true;
}

export function signingCanQueue(input: { enabled: boolean; hasSecret: boolean; collaborationStatus: string }): { ok: true } | { ok: false; error: string } {
  if (input.collaborationStatus !== "accepted") {
    return { ok: false, error: "A proposal can be sent for signature after it is accepted." };
  }
  if (!input.enabled || !input.hasSecret) {
    return { ok: false, error: "Document signing is not connected. Add the API details in admin and enable the provider." };
  }
  return { ok: true };
}

const GATEWAY_SHELLS = [
  { code: "stripe", name: "Stripe" },
  { code: "flutterwave", name: "Flutterwave" },
  { code: "mpesa", name: "M-Pesa" },
] as const;

export function gatewayCredentialLabels(code: string): { publicKey: string; secret: string; note: string } {
  switch (code) {
    case "airwallex":
      return {
        publicKey: "Client id",
        secret: "API key",
        note: "Save the holding account id and the operations account id. Milestone splits pay the creator connected account. The fee stays in holding until the release webhook.",
      };
    case "mpesa":
      return {
        publicKey: "Business short code",
        secret: "Access token",
        note: "The short code is BusinessShortCode. The access token is the Daraja bearer token. The webhook secret verifies x-mpesa-signature.",
      };
    case "flutterwave":
      return {
        publicKey: "Public key",
        secret: "Secret key",
        note: "Checkout uses the secret key. The webhook secret is the verif-hash value.",
      };
    case "stripe":
      return {
        publicKey: "Publishable key",
        secret: "Secret key",
        note: "Save a sandbox secret key (sk_test_, rk_test_, or rkcs_test_). A live key is refused.",
      };
    default:
      return { publicKey: "Public key", secret: "Secret", note: "" };
  }
}

async function ensureProviderShell(kind: string, code: string, name: string) {
  const existing = await prisma.integrationProvider.findUnique({
    where: { kind_code: { kind, code } },
  });
  if (existing) return;
  try {
    await prisma.integrationProvider.create({
      data: { kind, code, name, enabled: false },
    });
  } catch (error) {
    const prismaCode = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (prismaCode !== "P2002") throw error;
  }
}

let catalogTask: Promise<void> | null = null;

export function ensureIntegrationCatalog() {
  if (!catalogTask) {
    catalogTask = seedIntegrationCatalog().catch((error) => {
      catalogTask = null;
      throw error;
    });
  }
  return catalogTask;
}

async function seedIntegrationCatalog() {
  const connect = await prisma.integrationProvider.findUnique({
    where: { kind_code: { kind: "connect", code: "stripe" } },
  });
  if (!connect) {
    try {
      await prisma.integrationProvider.create({
        data: { kind: "connect", code: "stripe", name: "Stripe Connect", enabled: false },
      });
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code !== "P2002") throw error;
    }
  }
  await ensureProviderShell("payment", "airwallex", "Airwallex");
  await ensureProviderShell("search", "meilisearch", "Meilisearch");
  await ensureProviderShell("signing", "docusign", "DocuSign");
  const gateways = await prisma.integrationProvider.findMany({ where: { kind: "payment" } });
  // Do not recreate shells after an admin removed one; only seed shells on an empty catalog.
  if (gateways.length === 0) {
    for (const shell of GATEWAY_SHELLS) {
      try {
        await prisma.integrationProvider.create({
          data: { kind: "payment", code: shell.code, name: shell.name, enabled: false },
        });
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        if (code !== "P2002") throw error;
      }
    }
  }
  const paymentGateways =
    gateways.length === 0
      ? await prisma.integrationProvider.findMany({ where: { kind: "payment" } })
      : gateways;
  const byCode = new Map(paymentGateways.map((row) => [row.code, row]));
  for (const country of DEFAULT_PAYMENT_ROUTES) {
    await prisma.country.upsert({
      where: { code: country.countryCode },
      update: {},
      create: { code: country.countryCode, name: country.name, currency: country.currency, locale: "en", enabled: true },
    });
    const provider = byCode.get(country.gateway);
    if (!provider) continue;
    const existing = await prisma.paymentCountryRoute.findUnique({ where: { countryCode: country.countryCode } });
    if (existing) continue;
    try {
      await prisma.paymentCountryRoute.create({
        data: { countryCode: country.countryCode, providerId: provider.id, active: true },
      });
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code !== "P2002") throw error;
    }
  }
  for (const fn of AI_FUNCTIONS) {
    await prisma.aiFunctionRoute.upsert({
      where: { functionKey: fn.key },
      update: {},
      create: { functionKey: fn.key, enabled: true },
    });
  }
}

export async function listProviders(kind: "ai" | "payment" | "signing" | "connect" | "search") {
  await ensureIntegrationCatalog();
  const rows = await prisma.integrationProvider.findMany({ where: { kind }, orderBy: { name: "asc" } });
  return rows.map((row) => {
    const extra = readProviderExtra(row.extraJson);
    return {
      id: row.id,
      kind: row.kind,
      code: row.code,
      name: row.name,
      enabled: row.enabled,
      baseUrl: row.baseUrl ?? "",
      publicKey: row.publicKey ?? "",
      secret: secretStatus(row.secretCipher),
      webhook: secretStatus(row.webhookCipher),
      model: extra.model ?? "",
      isDefaultBackup: kind === "payment" ? Boolean(extra.isDefaultBackup) : false,
      lastWebhookAt: extra.lastWebhookAt ?? "",
      holdingAccountId: extra.holdingAccountId ?? "",
      operationsAccountId: extra.operationsAccountId ?? "",
      integrationKey: extra.integrationKey ?? "",
      userId: extra.userId ?? "",
      oauthBaseUrl: extra.oauthBaseUrl ?? "",
    };
  });
}

export async function saveProvider(input: {
  id?: string;
  kind: "ai" | "payment" | "signing" | "connect" | "search";
  code: string;
  name: string;
  enabled: boolean;
  baseUrl: string;
  publicKey: string;
  secret: string;
  webhook: string;
  model: string;
  clearSecret?: boolean;
  clearWebhook?: boolean;
  holdingAccountId?: string;
  operationsAccountId?: string;
  integrationKey?: string;
  userId?: string;
  oauthBaseUrl?: string;
}) {
  const code = providerCode(input.code);
  if (!code) throw new Error("A provider code is required.");
  if (input.kind === "payment" && code === "stripe" && input.secret.trim() && classifyStripeKey(input.secret) !== "sandbox") {
    throw new Error("Save a Stripe sandbox key. Nothing was charged.");
  }
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("A provider name is required.");
  const baseUrl = input.baseUrl.trim().slice(0, 200);
  if (baseUrl && input.kind === "ai" && !aiEndpointAllowed(baseUrl)) {
    throw new Error("AI calls are limited to https://api.openai.com and https://api.anthropic.com.");
  }
  if (baseUrl && input.kind === "search") {
    let allowed = false;
    try {
      const url = new URL(baseUrl);
      allowed = (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
    } catch {
      allowed = false;
    }
    if (!allowed) throw new Error("The Meilisearch host must be an http or https URL.");
  } else if (baseUrl && !baseUrl.startsWith("https://")) {
    throw new Error("The API base URL must start with https://.");
  }

  const existing = input.id
    ? await prisma.integrationProvider.findUnique({ where: { id: input.id } })
    : await prisma.integrationProvider.findUnique({ where: { kind_code: { kind: input.kind, code } } });

  const extraJson = mergeProviderExtra(existing?.extraJson, {
    model: input.model.trim().slice(0, 80),
    ...(input.holdingAccountId !== undefined ? { holdingAccountId: input.holdingAccountId.slice(0, 120) } : {}),
    ...(input.operationsAccountId !== undefined ? { operationsAccountId: input.operationsAccountId.slice(0, 120) } : {}),
    ...(input.integrationKey !== undefined ? { integrationKey: input.integrationKey.slice(0, 120) } : {}),
    ...(input.userId !== undefined ? { userId: input.userId.slice(0, 120) } : {}),
    ...(input.oauthBaseUrl !== undefined ? { oauthBaseUrl: input.oauthBaseUrl.slice(0, 200) } : {}),
  });

  const data = {
    name,
    enabled: input.enabled,
    baseUrl: baseUrl || null,
    publicKey: input.publicKey.trim().slice(0, 200) || null,
    extraJson: extraJson ?? undefined,
  };

  const secretCipher = input.clearSecret
    ? null
    : input.secret.trim()
      ? encryptSecret(input.secret.trim())
      : existing?.secretCipher;
  const webhookCipher = input.clearWebhook
    ? null
    : input.webhook.trim()
      ? encryptSecret(input.webhook.trim())
      : existing?.webhookCipher;

  if (existing) {
    return prisma.integrationProvider.update({
      where: { id: existing.id },
      data: { ...data, secretCipher, webhookCipher, extraJson: extraJson ?? undefined },
    });
  }
  return prisma.integrationProvider.create({
    data: { kind: input.kind, code, ...data, secretCipher: secretCipher ?? null, webhookCipher: webhookCipher ?? null },
  });
}

export async function paymentRoutes() {
  await ensureIntegrationCatalog();
  const [routes, backup] = await Promise.all([
    prisma.paymentCountryRoute.findMany({
      include: { provider: true },
      orderBy: { countryCode: "asc" },
    }),
    getDefaultBackupGateway(),
  ]);
  return routes.map((route) => {
    const primary = assessGateway({
      countryCode: route.countryCode,
      providerCode: route.provider.code,
      providerName: route.provider.name,
      routeActive: route.active,
      providerEnabled: route.provider.enabled,
      hasSecret: Boolean(route.provider.secretCipher),
    });
    if (!backup || backup.id === route.providerId) return primary;
    return {
      ...primary,
      backupProviderCode: backup.code,
      backupProviderName: backup.name,
      usingBackup: !primary.ready && backup.enabled && Boolean(backup.hasSecret),
    };
  });
}

export async function setCountryGateway(countryCode: string, providerId: string) {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new Error("Use a two-letter country code.");
  const provider = await prisma.integrationProvider.findFirst({ where: { id: providerId, kind: "payment" } });
  if (!provider) throw new Error("Choose a payment gateway.");
  await prisma.country.upsert({
    where: { code },
    update: {},
    create: { code, name: code, currency: "USD", locale: "en", enabled: true },
  });
  return prisma.paymentCountryRoute.upsert({
    where: { countryCode: code },
    update: { providerId: provider.id, active: true },
    create: { countryCode: code, providerId: provider.id, active: true },
  });
}

export async function getDefaultBackupGateway() {
  await ensureIntegrationCatalog();
  const rows = await prisma.integrationProvider.findMany({ where: { kind: "payment" } });
  const row = rows.find((item) => readProviderExtra(item.extraJson).isDefaultBackup);
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    enabled: row.enabled,
    hasSecret: Boolean(row.secretCipher),
  };
}

export async function setDefaultBackupGateway(providerId: string) {
  const id = providerId.trim();
  if (!id) throw new Error("Choose a payment gateway to set as the default backup.");
  const provider = await prisma.integrationProvider.findFirst({ where: { id, kind: "payment" } });
  if (!provider) throw new Error("Choose a payment gateway.");
  const paymentProviders = await prisma.integrationProvider.findMany({ where: { kind: "payment" } });
  await prisma.$transaction(
    paymentProviders.map((row) =>
      prisma.integrationProvider.update({
        where: { id: row.id },
        data: {
          extraJson: mergeProviderExtra(row.extraJson, {
            isDefaultBackup: row.id === provider.id,
          }) ?? undefined,
        },
      }),
    ),
  );
  return { id: provider.id, code: provider.code, name: provider.name };
}

export async function clearDefaultBackupGateway() {
  const paymentProviders = await prisma.integrationProvider.findMany({ where: { kind: "payment" } });
  await prisma.$transaction(
    paymentProviders
      .filter((row) => readProviderExtra(row.extraJson).isDefaultBackup)
      .map((row) =>
        prisma.integrationProvider.update({
          where: { id: row.id },
          data: { extraJson: mergeProviderExtra(row.extraJson, { isDefaultBackup: false }) ?? undefined },
        }),
      ),
  );
}

export function countryDisplayName(countryCode: string, countryName?: string | null) {
  const code = countryCode.trim().toUpperCase();
  if (countryName?.trim()) return countryName.trim();
  const seeded = DEFAULT_PAYMENT_ROUTES.find((row) => row.countryCode === code);
  return seeded?.name ?? code;
}

export function buildGatewayRemovalBlockers(input: {
  countries: { countryCode: string; countryName: string }[];
  isDefaultBackup: boolean;
}): string[] {
  const blockers: string[] = [];
  if (input.countries.length > 0) {
    const labels = input.countries.map((c) => `${c.countryName} (${c.countryCode})`).join(", ");
    blockers.push(
      `This gateway is assigned to ${labels}. Replace each country with another gateway before removing it.`,
    );
  }
  if (input.isDefaultBackup) {
    blockers.push(
      "This gateway is the default backup for failed country gateways. Set another default backup before removing it.",
    );
  }
  return blockers;
}

export async function gatewayRemovalImpact(providerId: string): Promise<GatewayRemovalImpact> {
  const provider = await prisma.integrationProvider.findFirst({
    where: { id: providerId, kind: "payment" },
    include: { countryRoutes: true },
  });
  if (!provider) {
    throw new Error("Choose a payment gateway.");
  }
  const isDefaultBackup = readProviderExtra(provider.extraJson).isDefaultBackup;
  const countryCodes = provider.countryRoutes.map((route) => route.countryCode);
  const countryRows =
    countryCodes.length > 0
      ? await prisma.country.findMany({ where: { code: { in: countryCodes } } })
      : [];
  const nameByCode = new Map(countryRows.map((row) => [row.code, row.name]));
  const countries = provider.countryRoutes.map((route) => ({
    countryCode: route.countryCode,
    countryName: countryDisplayName(route.countryCode, nameByCode.get(route.countryCode)),
  }));
  const blockers = buildGatewayRemovalBlockers({ countries, isDefaultBackup: Boolean(isDefaultBackup) });
  return {
    providerId: provider.id,
    providerCode: provider.code,
    providerName: provider.name,
    isDefaultBackup: Boolean(isDefaultBackup),
    countries,
    blocked: blockers.length > 0,
    blockers,
  };
}

/**
 * Reassign affected countries (and optionally move the default backup), then delete the gateway.
 * Refuses deletion while any country still points at this gateway or while it remains the default backup.
 */
export async function removePaymentGateway(input: {
  providerId: string;
  replacements?: { countryCode: string; providerId: string }[];
  newDefaultProviderId?: string | null;
}) {
  const impact = await gatewayRemovalImpact(input.providerId);
  const replacements = input.replacements ?? [];

  for (const replacement of replacements) {
    if (replacement.providerId === input.providerId) {
      throw new Error("Choose a different gateway for each affected country.");
    }
    await setCountryGateway(replacement.countryCode, replacement.providerId);
  }

  if (impact.isDefaultBackup) {
    const nextDefault = (input.newDefaultProviderId ?? "").trim();
    if (!nextDefault || nextDefault === input.providerId) {
      throw new Error("Set another gateway as the default backup before removing this one.");
    }
    await setDefaultBackupGateway(nextDefault);
  }

  const refreshed = await gatewayRemovalImpact(input.providerId);
  if (refreshed.blocked) {
    throw new Error(refreshed.blockers[0] ?? "Reassign affected countries before removing this gateway.");
  }

  await prisma.integrationProvider.delete({ where: { id: input.providerId } });
  return { removed: true as const, code: impact.providerCode, name: impact.providerName };
}

/** Prefer the country route when ready; otherwise fall back to the admin default backup gateway. */
export async function resolvePaymentGatewayForCountry(countryCode: string) {
  const code = countryCode.trim().toUpperCase();
  const route = await prisma.paymentCountryRoute.findUnique({
    where: { countryCode: code },
    include: { provider: true },
  });
  const primary = assessGateway({
    countryCode: code,
    providerCode: route?.provider.code,
    providerName: route?.provider.name,
    routeActive: route?.active,
    providerEnabled: route?.provider.enabled,
    hasSecret: Boolean(route?.provider.secretCipher),
  });
  if (primary.ready && route) {
    return {
      ...primary,
      providerId: route.providerId,
      usingBackup: false as const,
    };
  }
  const backup = await getDefaultBackupGateway();
  if (!backup || backup.id === route?.providerId) {
    return { ...primary, providerId: route?.providerId ?? null, usingBackup: false as const };
  }
  const backupReady = backup.enabled && backup.hasSecret;
  if (!backupReady) {
    return {
      ...primary,
      providerId: route?.providerId ?? null,
      backupProviderCode: backup.code,
      backupProviderName: backup.name,
      usingBackup: false as const,
    };
  }
  return {
    countryCode: code,
    providerId: backup.id,
    providerCode: backup.code,
    providerName: backup.name,
    enabled: true,
    hasSecret: true,
    ready: true,
    reason: "ready" as const,
    backupProviderCode: backup.code,
    backupProviderName: backup.name,
    usingBackup: true as const,
  };
}

export async function aiFunctionRoutes() {
  await ensureIntegrationCatalog();
  const routes = await prisma.aiFunctionRoute.findMany({ include: { provider: true } });
  const byKey = new Map(routes.map((route) => [route.functionKey, route]));
  return AI_FUNCTIONS.map((fn) => {
    const route = byKey.get(fn.key);
    const decision = routeAiFunction({
      functionKey: fn.key,
      providerCode: route?.provider?.code,
      providerEnabled: route?.provider?.enabled,
      hasSecret: Boolean(route?.provider?.secretCipher),
      routeEnabled: route?.enabled,
    });
    return { ...fn, providerId: route?.providerId ?? "", decision };
  });
}

export async function assignAiFunction(functionKey: string, providerId: string) {
  if (!AI_FUNCTIONS.some((fn) => fn.key === functionKey)) throw new Error("Unknown AI function.");
  const provider = providerId
    ? await prisma.integrationProvider.findFirst({ where: { id: providerId, kind: "ai" } })
    : null;
  if (providerId && !provider) throw new Error("Choose an AI provider.");
  return prisma.aiFunctionRoute.upsert({
    where: { functionKey },
    update: { providerId: provider?.id ?? null, enabled: true },
    create: { functionKey, providerId: provider?.id ?? null, enabled: true },
  });
}

export async function activeSigningProvider() {
  await ensureIntegrationCatalog();
  const provider = await prisma.integrationProvider.findFirst({
    where: { kind: "signing", enabled: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!provider) return null;
  const extra = readProviderExtra(provider.extraJson);
  return {
    id: provider.id,
    name: provider.name,
    code: provider.code,
    hasSecret: Boolean(provider.secretCipher),
    enabled: provider.enabled,
    baseUrl: provider.baseUrl ?? "",
    publicKey: provider.publicKey ?? "",
    secretCipher: provider.secretCipher,
    integrationKey: extra.integrationKey ?? "",
    userId: extra.userId ?? "",
    oauthBaseUrl: extra.oauthBaseUrl ?? "",
  };
}

async function askSigningProvider(input: { baseUrl: string; secret: string; title: string; collaborationId: string }) {
  if (!input.baseUrl) return { ok: true as const, externalId: "" };
  if (!signingEndpointAllowed(input.baseUrl)) {
    return { ok: false as const, error: "The signing API must be https. Nothing was signed." };
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
      body: JSON.stringify({ title: input.title, collaborationId: input.collaborationId }),
    });
    if (response.status < 200 || response.status >= 300) {
      return { ok: false as const, error: "The signing API did not accept the request. Nothing was signed." };
    }
    const payload = (await response.json().catch(() => null)) as { id?: unknown } | null;
    const externalId = payload && typeof payload.id === "string" ? payload.id.slice(0, 120) : "";
    return { ok: true as const, externalId };
  } catch {
    return { ok: false as const, error: "The signing API did not accept the request. Nothing was signed." };
  }
}

export async function queueSignatureRequest(input: { collaborationId: string; title: string; collaborationStatus: string }) {
  const provider = await activeSigningProvider();
  const gate = signingCanQueue({
    enabled: Boolean(provider?.enabled),
    hasSecret: Boolean(provider?.hasSecret),
    collaborationStatus: input.collaborationStatus,
  });
  if (!gate.ok) return gate;
  const secret = provider!.secretCipher ? decryptSecret(provider!.secretCipher) : null;
  const code = provider!.code.trim().toLowerCase();
  let externalId = "";
  if (code === "demo" || code === "demo_sign") {
    externalId = `demosign_${Date.now().toString(36)}`;
  } else if (code === "docusign" || code.includes("docusign")) {
    const collab = await prisma.collaboration.findUnique({
      where: { id: input.collaborationId },
      include: { initiatorUser: true, decidedByUser: true },
    });
    const parties = [collab?.initiatorUser, collab?.decidedByUser]
      .filter((user): user is NonNullable<typeof user> => Boolean(user?.email))
      .filter((user, index, all) => all.findIndex((row) => row.email === user.email) === index)
      .map((user) => ({ name: user.name?.trim() || user.email, email: user.email }));
    if (parties.length < 1) {
      return { ok: false as const, error: "Add an email on each signer before sending the envelope. Nothing was signed." };
    }
    const credentials = assembleDocuSignCredentials({
      stored: {
        integrationKey: provider!.integrationKey,
        userId: provider!.userId,
        accountId: provider!.publicKey,
        privateKey: secret ?? "",
        baseUrl: provider!.baseUrl,
        oauthBaseUrl: provider!.oauthBaseUrl,
      },
    });
    if (!credentials.ok) return credentials;
    const opened = await openDocuSignEnvelope({
      credentials,
      request: {
        collaborationId: input.collaborationId,
        title: input.title.slice(0, 160),
        documentHtml: `<h1>${input.title.slice(0, 160)}</h1><p>${collab?.scope ?? ""}</p>`,
        parties,
      },
    });
    if (!opened.ok) return opened;
    externalId = opened.envelopeId;
  } else if (!provider!.baseUrl) {
    return { ok: false as const, error: "Add the signing API base URL in admin. Nothing was signed." };
  } else {
    const asked = await askSigningProvider({
      baseUrl: provider!.baseUrl,
      secret: secret ?? "",
      title: input.title.slice(0, 160),
      collaborationId: input.collaborationId,
    });
    if (!asked.ok) return asked;
    externalId = asked.externalId || `sign_${Date.now().toString(36)}`;
  }
  const row = await prisma.signatureRequest.create({
    data: {
      collaborationId: input.collaborationId,
      providerId: provider!.id,
      status: "sent",
      title: input.title.slice(0, 160),
      externalId,
      lastError: null,
    },
  });
  return { ok: true as const, id: row.id, status: row.status, providerName: provider!.name };
}
