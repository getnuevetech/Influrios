import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/provider-secrets";
import { productSwitch } from "@/lib/product-switches";

const STRIPE_HOST = "https://api.stripe.com";
const STRIPE_VERSION = "2025-02-24.acacia";

let transport: typeof fetch = globalThis.fetch;

/** Tests replace the Stripe call without writing a shared secret. */
export function setStripeTransportForTests(next: typeof fetch | null) {
  transport = next ?? globalThis.fetch;
}

export type StripeKeyMode = "sandbox" | "live";

/** Sandbox keys are sk_test_, rk_test_, or a claimable rkcs_test_ key. */
export function classifyStripeKey(secret: string): StripeKeyMode | null {
  const key = secret.trim();
  if (/^(sk|rk|rkcs)_test_[A-Za-z0-9]+$/.test(key)) return "sandbox";
  if (/^(sk|rk|rkcs)_live_[A-Za-z0-9]+$/.test(key)) return "live";
  return null;
}

export async function stripeCredentials(): Promise<
  | { ok: true; secret: string; mode: StripeKeyMode }
  | { ok: false; reason: "missing" | "rejected" }
> {
  const fromEnv = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (fromEnv) {
    const mode = classifyStripeKey(fromEnv);
    return mode ? { ok: true, secret: fromEnv, mode } : { ok: false, reason: "rejected" };
  }
  const row = await prisma.integrationProvider.findUnique({
    where: { kind_code: { kind: "payment", code: "stripe" } },
  });
  if (!row?.enabled || !row.secretCipher) return { ok: false, reason: "missing" };
  const secret = decryptSecret(row.secretCipher);
  if (!secret) return { ok: false, reason: "rejected" };
  return classifyStripeKey(secret) === "sandbox"
    ? { ok: true, secret, mode: "sandbox" }
    : { ok: false, reason: "rejected" };
}

export async function stripeBillingMode(): Promise<"sandbox" | "live" | "demo" | "rejected"> {
  const creds = await stripeCredentials();
  if (!creds.ok) return creds.reason === "rejected" ? "rejected" : "demo";
  return creds.mode;
}

async function stripeCall(method: "GET" | "POST", path: string, secret: string, body?: URLSearchParams) {
  const response = await transport(`${STRIPE_HOST}${path}`, {
    method,
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
    headers: {
      Authorization: `Bearer ${secret}`,
      "Stripe-Version": STRIPE_VERSION,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
  });
  if (response.status < 200 || response.status >= 300) return null;
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return payload && typeof payload === "object" ? payload : null;
}

function httpsUrl(value: unknown) {
  return typeof value === "string" && value.startsWith("https://") ? value : null;
}

function checkoutId(value: unknown) {
  return typeof value === "string" && /^cs_(test|live)_[A-Za-z0-9]+$/.test(value) ? value : null;
}

export async function probeStripeSandbox() {
  const creds = await stripeCredentials();
  if (!creds.ok) {
    return {
      ok: false as const,
      error: creds.reason === "missing" ? "Stripe is not ready. Nothing was charged." : "Use a Stripe sandbox key. Nothing was charged.",
    };
  }
  if (creds.mode !== "sandbox") return { ok: false as const, error: "Use a Stripe sandbox key. Nothing was charged." };
  try {
    const payload = await stripeCall("GET", "/v1/checkout/sessions?limit=1", creds.secret);
    const rows = payload && Array.isArray(payload.data) ? payload.data : null;
    if (!payload || !rows) return { ok: false as const, error: "Stripe sandbox did not confirm. Nothing was charged." };
    if (rows.some((row) => row && typeof row === "object" && (row as { livemode?: unknown }).livemode === true)) {
      return { ok: false as const, error: "This Stripe key is live. Nothing was charged." };
    }
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Stripe sandbox did not confirm. Nothing was charged." };
  }
}

export async function openStripeCheckout(input: {
  secret: string;
  mode: StripeKeyMode;
  priceId: string;
  amountCents: number;
  name: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata: Record<string, string>;
}) {
  const body = new URLSearchParams({
    mode: "subscription",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    "line_items[0][quantity]": "1",
  });
  if (input.priceId) {
    body.set("line_items[0][price]", input.priceId);
  } else {
    body.set("line_items[0][price_data][currency]", "usd");
    body.set("line_items[0][price_data][unit_amount]", String(input.amountCents));
    body.set("line_items[0][price_data][recurring][interval]", "month");
    body.set("line_items[0][price_data][product_data][name]", input.name);
    body.set("line_items[0][price_data][product_data][description]", input.description);
  }
  for (const [key, value] of Object.entries(input.metadata)) body.set(`metadata[${key}]`, value);
  if (input.customerEmail) body.set("customer_email", input.customerEmail);
  try {
    const payload = await stripeCall("POST", "/v1/checkout/sessions", input.secret, body);
    const id = checkoutId(payload?.id);
    const url = httpsUrl(payload?.url);
    const livemode = payload?.livemode;
    if (!payload || !id || !url) return { ok: false as const, error: "Stripe did not open checkout. Nothing was charged." };
    if (input.mode === "sandbox" && livemode !== false) {
      return { ok: false as const, error: "Stripe did not open a sandbox checkout. Nothing was charged." };
    }
    if (input.mode === "live" && livemode !== true) {
      return { ok: false as const, error: "Stripe did not open checkout. Nothing was charged." };
    }
    return { ok: true as const, id, url };
  } catch {
    return { ok: false as const, error: "Stripe did not open checkout. Nothing was charged." };
  }
}

export async function confirmStripeCheckout(input: {
  secret: string;
  mode: StripeKeyMode;
  checkoutSessionId: string;
  localId: string;
}) {
  if (!checkoutId(input.checkoutSessionId)) {
    return { ok: false as const, error: "Stripe has not confirmed this payment. Nothing was changed." };
  }
  try {
    const payload = await stripeCall("GET", `/v1/checkout/sessions/${input.checkoutSessionId}`, input.secret);
    const metadata = payload?.metadata && typeof payload.metadata === "object" ? (payload.metadata as { localSessionId?: unknown }) : {};
    const paid = payload?.payment_status === "paid" || payload?.payment_status === "no_payment_required";
    const livemodeOk = input.mode === "sandbox" ? payload?.livemode === false : payload?.livemode === true;
    if (!payload || payload.status !== "complete" || !paid || !livemodeOk || metadata.localSessionId !== input.localId) {
      return { ok: false as const, error: "Stripe has not confirmed this payment. Nothing was changed." };
    }
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Stripe has not confirmed this payment. Nothing was changed." };
  }
}

export async function stripeWebhookSecret() {
  if (process.env.STRIPE_WEBHOOK_SECRET) return process.env.STRIPE_WEBHOOK_SECRET;
  const row = await prisma.integrationProvider.findUnique({
    where: { kind_code: { kind: "payment", code: "stripe" } },
  });
  if (!row?.webhookCipher) return null;
  return decryptSecret(row.webhookCipher);
}

export function stripeAccountId(value: string) {
  const id = value.trim();
  return /^acct_[A-Za-z0-9]+$/.test(id) ? id : null;
}

export function stripeCustomerId(value: string) {
  const id = value.trim();
  return /^cus_[A-Za-z0-9]+$/.test(id) ? id : null;
}

async function stripeForm(path: string, secret: string, body: URLSearchParams) {
  const payload = await stripeCall("POST", path, secret, body);
  return payload as { url?: string } | null;
}

export async function openCustomerPortal(input: { customerId: string; returnUrl: string }) {
  const enabled = await productSwitch("customer_portal");
  if (!enabled) return { ok: false as const, error: "The billing portal is turned off. Nothing was opened." };
  const customer = stripeCustomerId(input.customerId);
  if (!customer) return { ok: false as const, error: "Enter a Stripe customer id. Nothing was opened." };
  const creds = await stripeCredentials();
  if (!creds.ok) {
    return {
      ok: false as const,
      error: creds.reason === "missing" ? "Stripe is not ready. Nothing was opened." : "Use a Stripe sandbox key. Nothing was opened.",
    };
  }
  const secret = creds.secret;
  try {
    const payload = await stripeForm(
      "/v1/billing_portal/sessions",
      secret,
      new URLSearchParams({ customer, return_url: input.returnUrl }),
    );
    if (!payload?.url || !payload.url.startsWith("https://")) {
      return { ok: false as const, error: "Stripe did not open the billing portal. Nothing was opened." };
    }
    return { ok: true as const, url: payload.url };
  } catch {
    return { ok: false as const, error: "Stripe did not open the billing portal. Nothing was opened." };
  }
}

export async function openConnectLink(input: { accountId: string; refreshUrl: string; returnUrl: string }) {
  const enabled = await productSwitch("stripe_connect");
  if (!enabled) return { ok: false as const, error: "Stripe Connect is turned off. Nothing was opened." };
  const account = stripeAccountId(input.accountId);
  if (!account) return { ok: false as const, error: "Enter a Stripe account id. Nothing was opened." };
  const row = await prisma.integrationProvider.findUnique({
    where: { kind_code: { kind: "connect", code: "stripe" } },
  });
  if (!row?.enabled || !row.secretCipher) {
    return { ok: false as const, error: "Stripe Connect is not ready. Nothing was opened." };
  }
  const secret = decryptSecret(row.secretCipher);
  if (!secret) return { ok: false as const, error: "Stripe Connect is not ready. Nothing was opened." };
  try {
    const payload = await stripeForm(
      "/v1/account_links",
      secret,
      new URLSearchParams({
        account,
        refresh_url: input.refreshUrl,
        return_url: input.returnUrl,
        type: "account_onboarding",
      }),
    );
    if (!payload?.url || !payload.url.startsWith("https://")) {
      return { ok: false as const, error: "Stripe did not open an account link. Nothing was opened." };
    }
    return { ok: true as const, url: payload.url };
  } catch {
    return { ok: false as const, error: "Stripe did not open an account link. Nothing was opened." };
  }
}
