import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret, secretStatus } from "@/lib/provider-secrets";

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
};

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
  for (const shell of GATEWAY_SHELLS) {
    const existing = await prisma.integrationProvider.findUnique({
      where: { kind_code: { kind: "payment", code: shell.code } },
    });
    if (existing) continue;
    try {
      await prisma.integrationProvider.create({
        data: { kind: "payment", code: shell.code, name: shell.name, enabled: false },
      });
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code !== "P2002") throw error;
    }
  }
  const gateways = await prisma.integrationProvider.findMany({ where: { kind: "payment" } });
  const byCode = new Map(gateways.map((row) => [row.code, row]));
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

export async function listProviders(kind: "ai" | "payment" | "signing" | "connect") {
  await ensureIntegrationCatalog();
  const rows = await prisma.integrationProvider.findMany({ where: { kind }, orderBy: { name: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    code: row.code,
    name: row.name,
    enabled: row.enabled,
    baseUrl: row.baseUrl ?? "",
    publicKey: row.publicKey ?? "",
    secret: secretStatus(row.secretCipher),
    webhook: secretStatus(row.webhookCipher),
    model: typeof row.extraJson === "object" && row.extraJson && "model" in row.extraJson ? String((row.extraJson as { model?: string }).model ?? "") : "",
  }));
}

export async function saveProvider(input: {
  id?: string;
  kind: "ai" | "payment" | "signing" | "connect";
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
}) {
  const code = providerCode(input.code);
  if (!code) throw new Error("A provider code is required.");
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("A provider name is required.");
  const baseUrl = input.baseUrl.trim().slice(0, 200);
  if (baseUrl && input.kind === "ai" && !aiEndpointAllowed(baseUrl)) {
    throw new Error("AI calls are limited to https://api.openai.com and https://api.anthropic.com.");
  }
  if (baseUrl && !baseUrl.startsWith("https://")) throw new Error("The API base URL must start with https://.");

  const data = {
    name,
    enabled: input.enabled,
    baseUrl: baseUrl || null,
    publicKey: input.publicKey.trim().slice(0, 200) || null,
    extraJson: input.model.trim() ? { model: input.model.trim().slice(0, 80) } : undefined,
  };

  const existing = input.id
    ? await prisma.integrationProvider.findUnique({ where: { id: input.id } })
    : await prisma.integrationProvider.findUnique({ where: { kind_code: { kind: input.kind, code } } });

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
      data: { ...data, secretCipher, webhookCipher },
    });
  }
  return prisma.integrationProvider.create({
    data: { kind: input.kind, code, ...data, secretCipher: secretCipher ?? null, webhookCipher: webhookCipher ?? null },
  });
}

export async function paymentRoutes() {
  await ensureIntegrationCatalog();
  const routes = await prisma.paymentCountryRoute.findMany({
    include: { provider: true },
    orderBy: { countryCode: "asc" },
  });
  return routes.map((route) =>
    assessGateway({
      countryCode: route.countryCode,
      providerCode: route.provider.code,
      providerName: route.provider.name,
      routeActive: route.active,
      providerEnabled: route.provider.enabled,
      hasSecret: Boolean(route.provider.secretCipher),
    }),
  );
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
  return {
    id: provider.id,
    name: provider.name,
    code: provider.code,
    hasSecret: Boolean(provider.secretCipher),
    enabled: provider.enabled,
    baseUrl: provider.baseUrl ?? "",
    secretCipher: provider.secretCipher,
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
  const asked = await askSigningProvider({
    baseUrl: provider!.baseUrl,
    secret: secret ?? "",
    title: input.title.slice(0, 160),
    collaborationId: input.collaborationId,
  });
  if (!asked.ok) return asked;
  const row = await prisma.signatureRequest.create({
    data: {
      collaborationId: input.collaborationId,
      providerId: provider!.id,
      status: "queued",
      title: input.title.slice(0, 160),
      externalId: asked.externalId,
      lastError: null,
    },
  });
  return { ok: true as const, id: row.id, status: row.status, providerName: provider!.name };
}
