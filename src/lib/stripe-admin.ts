import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/provider-secrets";
import { productSwitch } from "@/lib/product-switches";
import { parseProviderTaxCalculation, parseRegistrationList } from "@/lib/tax-configuration";

const STRIPE_HOST = "https://api.stripe.com";
const STRIPE_VERSION = "2025-02-24.acacia";

let transport: typeof fetch = globalThis.fetch;

/** Tests replace the Stripe call without writing a shared secret. */
export function setStripeTransportForTests(next: typeof fetch | null) {
  transport = next ?? globalThis.fetch;
}

export type StripeKeyMode = "sandbox" | "live";

export type StripeCredentialFailure = "missing" | "rejected" | "unreadable";

/**
 * Stripe secret keys are sk_/rk_/rkcs_ + test|live + opaque material.
 * Hyphens and underscores appear in some restricted-key bodies.
 */
export function classifyStripeKey(secret: string): StripeKeyMode | null {
  const key = secret.trim();
  if (/^(sk|rk|rkcs)_test_[A-Za-z0-9_-]+$/.test(key)) return "sandbox";
  if (/^(sk|rk|rkcs)_live_[A-Za-z0-9_-]+$/.test(key)) return "live";
  return null;
}

export function stripeCredentialError(reason: StripeCredentialFailure, action: "charged" | "opened") {
  if (reason === "missing") {
    return action === "charged"
      ? "Stripe is not ready. Nothing was charged."
      : "Stripe is not ready. Nothing was opened.";
  }
  if (reason === "unreadable") {
    return action === "charged"
      ? "The saved Stripe secret could not be read. Re-save it on Payment gateways. Nothing was charged."
      : "The saved Stripe secret could not be read. Re-save it on Payment gateways. Nothing was opened.";
  }
  return action === "charged"
    ? "Use a valid Stripe secret key (sk_test_… or sk_live_…). Nothing was charged."
    : "Use a valid Stripe secret key (sk_test_… or sk_live_…). Nothing was opened.";
}

export async function stripeCredentials(): Promise<
  | { ok: true; secret: string; mode: StripeKeyMode }
  | { ok: false; reason: StripeCredentialFailure }
> {
  const fromEnv = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (fromEnv) {
    const mode = classifyStripeKey(fromEnv);
    // A malformed env value must not block the admin-saved payment gateway key.
    if (mode) return { ok: true, secret: fromEnv, mode };
  }
  let row: { enabled: boolean; secretCipher: string | null } | null = null;
  try {
    row = await prisma.integrationProvider.findUnique({
      where: { kind_code: { kind: "payment", code: "stripe" } },
    });
  } catch {
    return { ok: false, reason: fromEnv ? "rejected" : "missing" };
  }
  if (!row?.enabled || !row.secretCipher) {
    return { ok: false, reason: fromEnv ? "rejected" : "missing" };
  }
  const secret = decryptSecret(row.secretCipher);
  if (!secret) return { ok: false, reason: "unreadable" };
  const mode = classifyStripeKey(secret);
  if (!mode) return { ok: false, reason: "rejected" };
  return { ok: true, secret, mode };
}

export async function stripeBillingMode(): Promise<"sandbox" | "live" | "demo" | "rejected"> {
  const creds = await stripeCredentials();
  if (!creds.ok) return creds.reason === "missing" ? "demo" : "rejected";
  return creds.mode;
}

export const STRIPE_STABLE_API_VERSION = STRIPE_VERSION;

async function stripeCall(
  method: "GET" | "POST",
  path: string,
  secret: string,
  body?: URLSearchParams,
  idempotencyKey?: string,
  context?: { stripeAccount?: string; apiVersion?: string },
) {
  const version = context?.apiVersion?.trim() || STRIPE_VERSION;
  const account = context?.stripeAccount?.trim() ?? "";
  if (account && !/^acct_[A-Za-z0-9]+$/.test(account)) return null;
  if (body && version === STRIPE_VERSION) {
    for (const key of body.keys()) {
      if (key.startsWith("allocated_funds")) return null;
    }
  }
  const response = await transport(`${STRIPE_HOST}${path}`, {
    method,
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
    headers: {
      Authorization: `Bearer ${secret}`,
      "Stripe-Version": version,
      ...(account ? { "Stripe-Account": account } : {}),
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
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

export type StripeCheckoutPayment = {
  id: string;
  paymentStatus: string;
  amountTotal: number | null;
  currency: string | null;
  url: string | null;
  metadata: Record<string, string>;
};

/** Reads the payment Stripe actually recorded. A return URL is not this object. */
export function stripeCheckoutPayment(payload: Record<string, unknown> | null): StripeCheckoutPayment | null {
  if (!payload) return null;
  const id = checkoutId(payload.id);
  const paymentStatus = typeof payload.payment_status === "string" ? payload.payment_status : "";
  if (!id || !paymentStatus) return null;
  const amountTotal = typeof payload.amount_total === "number" && Number.isInteger(payload.amount_total) ? payload.amount_total : null;
  const currency = typeof payload.currency === "string" ? payload.currency.trim().toUpperCase() : "";
  const url = typeof payload.url === "string" && payload.url.startsWith("https://") ? payload.url : null;
  const raw = payload.metadata && typeof payload.metadata === "object" ? (payload.metadata as Record<string, unknown>) : {};
  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value.trim()) metadata[key] = value.trim();
  }
  return { id, paymentStatus, amountTotal, currency: /^[A-Z]{3}$/.test(currency) ? currency : null, url, metadata };
}

export async function expireStripeCheckoutSession(secret: string, sessionId: string) {
  const id = checkoutId(sessionId);
  if (!id) return false;
  try {
    const payload = await stripeCall("POST", `/v1/checkout/sessions/${id}/expire`, secret);
    return payload?.status === "expired";
  } catch {
    return false;
  }
}

export async function readStripeCheckoutSession(secret: string, sessionId: string): Promise<StripeCheckoutPayment | null> {
  const id = checkoutId(sessionId);
  if (!id) return null;
  try {
    const payload = await stripeCall("GET", `/v1/checkout/sessions/${id}`, secret);
    return stripeCheckoutPayment(payload);
  } catch {
    return null;
  }
}

/** A Stripe Identity session is used only when Stripe returned an id and an https URL. */
export function stripeIdentitySession(payload: Record<string, unknown> | null): { id: string; url: string } | null {
  if (!payload) return null;
  const id = typeof payload.id === "string" && /^vs_[A-Za-z0-9]+$/.test(payload.id) ? payload.id : "";
  const url = typeof payload.url === "string" && payload.url.startsWith("https://") ? payload.url : "";
  if (!id || !url) return null;
  return { id, url };
}

export async function openStripeIdentitySession(input: { slug: string; countryCode: string; returnUrl: string }) {
  const creds = await stripeCredentials();
  if (!creds.ok) {
    return { ok: false as const, error: "Stripe is not ready. No identity session was opened." };
  }
  const body = new URLSearchParams({
    type: "document",
    "metadata[creator_slug]": input.slug.trim().slice(0, 80),
    "metadata[country]": input.countryCode.trim().slice(0, 8),
  });
  const returnUrl = input.returnUrl.trim();
  if (returnUrl.startsWith("https://")) body.set("return_url", returnUrl);
  try {
    const payload = await stripeCall("POST", "/v1/identity/verification_sessions", creds.secret, body);
    const session = stripeIdentitySession(payload);
    if (!session) return { ok: false as const, error: "Stripe did not open an identity session. Nothing was opened." };
    return { ok: true as const, id: session.id, url: session.url };
  } catch {
    return { ok: false as const, error: "Stripe did not open an identity session. Nothing was opened." };
  }
}

export async function probeStripeSandbox() {
  const creds = await stripeCredentials();
  if (!creds.ok) {
    return {
      ok: false as const,
      error: stripeCredentialError(creds.reason, "charged"),
    };
  }
  if (creds.mode !== "sandbox") {
    return { ok: false as const, error: "Use a Stripe sandbox key (sk_test_…) to probe checkout. Nothing was charged." };
  }
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
  automaticTax?: boolean;
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
  if (input.automaticTax) {
    body.set("automatic_tax[enabled]", "true");
    body.set("billing_address_collection", "required");
  }
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

/** One-time Checkout. This is not a subscription and does not create collaboration funding. */
export function stripeOneTimeCheckoutBody(input: {
  amountCents: number;
  name: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata: Record<string, string>;
}) {
  const body = new URLSearchParams({
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer_creation: "always",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(input.amountCents),
    "line_items[0][price_data][product_data][name]": input.name,
  });
  for (const [key, value] of Object.entries(input.metadata)) body.set(`metadata[${key}]`, value);
  if (input.customerEmail) body.set("customer_email", input.customerEmail);
  return body;
}

/** One-time collaboration deposit. Card and online ACH use different Stripe method types. */
export function stripeFundingCheckoutBody(input: {
  amountCents: number;
  currency: string;
  name: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  paymentMethod: "card" | "us_bank_account";
  metadata: Record<string, string>;
}) {
  const body = new URLSearchParams({
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    "payment_method_types[0]": input.paymentMethod,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": input.currency.trim().toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(input.amountCents),
    "line_items[0][price_data][product_data][name]": input.name.slice(0, 120),
  });
  for (const [key, value] of Object.entries(input.metadata)) body.set(`metadata[${key}]`, value);
  if (input.customerEmail) body.set("customer_email", input.customerEmail);
  return body;
}

export async function openStripeFundingCheckout(input: {
  secret: string;
  mode: StripeKeyMode;
  amountCents: number;
  currency: string;
  name: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  paymentMethod: "card" | "us_bank_account";
  metadata: Record<string, string>;
}) {
  try {
    const payload = await stripeCall(
      "POST",
      "/v1/checkout/sessions",
      input.secret,
      stripeFundingCheckoutBody(input),
      input.metadata.fundingId
        ? `funding-deposit:${input.metadata.fundingId}:${input.paymentMethod}`
        : undefined,
    );
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

export async function openStripeOneTimeCheckout(input: {
  secret: string;
  mode: StripeKeyMode;
  amountCents: number;
  name: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata: Record<string, string>;
}) {
  try {
    const payload = await stripeCall("POST", "/v1/checkout/sessions", input.secret, stripeOneTimeCheckoutBody(input));
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

export async function rememberStripeCustomer(userId: string | null | undefined, customerId: string | null | undefined) {
  const id = userId?.trim();
  const customer = customerId ? stripeCustomerId(customerId) : null;
  if (!id || !customer) return;
  await prisma.user.update({ where: { id }, data: { stripeCustomerId: customer } }).catch(() => undefined);
}

/** A Stripe corridor is ready only when the payout profile stores an acct_ id. */
export function stripePayoutRouteReady(input: {
  providerCode?: string | null;
  routeReady: boolean;
  stripeConnectAccountId?: string | null;
}) {
  if (!input.routeReady) return false;
  if ((input.providerCode ?? "").toLowerCase() === "stripe") {
    return Boolean(stripeAccountId(input.stripeConnectAccountId ?? ""));
  }
  return true;
}

/**
 * Connect onboarding uses the platform Stripe secret (Payment gateways / STRIPE_SECRET_KEY).
 * A separate connect IntegrationProvider row is optional and no longer required.
 */
async function connectSecret(): Promise<string | null> {
  const creds = await stripeCredentials();
  return creds.ok ? creds.secret : null;
}

/** True when the product switch is on and a usable Stripe secret is saved. */
export async function stripeConnectReady() {
  if (!(await productSwitch("stripe_connect").catch(() => false))) return false;
  return (await stripeCredentials()).ok;
}

export async function createStripeExpressAccount(input: { secret: string; email?: string }) {
  const body = new URLSearchParams({ type: "express", "capabilities[transfers][requested]": "true" });
  if (input.email) body.set("email", input.email);
  try {
    const payload = await stripeCall("POST", "/v1/accounts", input.secret, body);
    const id = typeof payload?.id === "string" ? stripeAccountId(payload.id) : null;
    if (!id) return { ok: false as const, error: "Stripe did not create a Connect account. Nothing was stored." };
    return { ok: true as const, accountId: id };
  } catch {
    return { ok: false as const, error: "Stripe did not create a Connect account. Nothing was stored." };
  }
}

/** Opens Connect onboarding for the signed-in creator and stores acct_ on the payout profile. */
export async function openCreatorConnectOnboarding(input: {
  userId: string;
  email?: string;
  refreshUrl: string;
  returnUrl: string;
}) {
  const enabled = await productSwitch("stripe_connect");
  if (!enabled) return { ok: false as const, error: "Stripe Connect is turned off. Nothing was opened." };
  const creator = await prisma.creator.findUnique({
    where: { userId: input.userId },
    include: { payoutProfile: true },
  });
  if (!creator) {
    return { ok: false as const, error: "Create your Influencer Card before opening payout setup. Nothing was opened." };
  }
  let accountId = stripeAccountId(creator.payoutProfile?.stripeConnectAccountId ?? "");
  if (!accountId) {
    const secret = await connectSecret();
    if (!secret) return { ok: false as const, error: "Stripe Connect is not ready. Nothing was opened." };
    const created = await createStripeExpressAccount({ secret, email: input.email });
    if (!created.ok) return created;
    accountId = created.accountId;
    await prisma.influencerPayoutProfile.upsert({
      where: { creatorId: creator.id },
      create: { creatorId: creator.id, stripeConnectAccountId: accountId },
      update: { stripeConnectAccountId: accountId },
    });
  }
  return openConnectLink({ accountId, refreshUrl: input.refreshUrl, returnUrl: input.returnUrl });
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
      error: stripeCredentialError(creds.reason, "opened"),
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

/** A provider object id is the only submission. A timeout stays unknown and is not sent again from this call. */
export async function stripeApiRequest(input: {
  method: "GET" | "POST";
  path: string;
  secret: string;
  body?: URLSearchParams;
  idempotencyKey?: string;
  stripeAccount?: string;
  apiVersion?: string;
}): Promise<
  | { ok: true; submitted: true; id: string; payload: Record<string, unknown> }
  | { ok: false; submitted: false; state: "unknown" | "blocked"; error: string }
> {
  const version = input.apiVersion?.trim() || STRIPE_VERSION;
  if (input.body && version === STRIPE_VERSION) {
    for (const key of input.body.keys()) {
      if (key.startsWith("allocated_funds")) {
        return {
          ok: false,
          submitted: false,
          state: "blocked",
          error: "Preview allocated-funds fields are not sent on the 2025-02-24.acacia client. Nothing was sent.",
        };
      }
    }
  }
  try {
    const payload = await stripeCall(input.method, input.path, input.secret, input.body, input.idempotencyKey, {
      stripeAccount: input.stripeAccount,
      apiVersion: version,
    });
    const id = typeof payload?.id === "string" ? payload.id.trim() : "";
    if (!payload || !id) {
      return { ok: false, submitted: false, state: "unknown", error: "Stripe did not return an object id. Nothing was marked submitted." };
    }
    return { ok: true, submitted: true, id, payload };
  } catch {
    return { ok: false, submitted: false, state: "unknown", error: "The provider result is unknown. Nothing was marked submitted." };
  }
}

async function stripeJson(method: "GET" | "POST", path: string, secret: string, body?: URLSearchParams) {
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
  const payload = (await response.json().catch(() => null)) as unknown;
  return { status: response.status, payload };
}

/** Asks Stripe Tax for a calculation. A failed call has no tax amount. */
export async function requestStripeTaxCalculation(input: {
  secret: string;
  amountCents: number;
  currency: string;
  taxCode: string;
  country: string;
  region: string;
  postalCode: string;
  inclusive: boolean;
}) {
  const body = new URLSearchParams({
    currency: input.currency.trim().toLowerCase() || "usd",
    "line_items[0][amount]": String(input.amountCents),
    "line_items[0][reference]": "tax-preview",
    "line_items[0][tax_code]": input.taxCode,
    "line_items[0][tax_behavior]": input.inclusive ? "inclusive" : "exclusive",
    "customer_details[address][country]": input.country.trim().toUpperCase(),
    "customer_details[address][postal_code]": input.postalCode.trim(),
    "customer_details[address_source]": "billing",
  });
  if (input.region.trim()) body.set("customer_details[address][state]", input.region.trim());
  try {
    const result = await stripeJson("POST", "/v1/tax/calculations", input.secret, body);
    if (result.status < 200 || result.status >= 300) {
      const parsed = parseProviderTaxCalculation(result.payload);
      return parsed.ok ? { ok: false as const, detail: "The tax provider did not return a calculation." } : parsed;
    }
    return parseProviderTaxCalculation(result.payload);
  } catch {
    return { ok: false as const, detail: "The tax provider did not respond." };
  }
}

export async function requestStripeTaxRegistrations(secret: string) {
  try {
    const result = await stripeJson("GET", "/v1/tax/registrations?limit=20", secret);
    if (result.status < 200 || result.status >= 300) return "unavailable" as const;
    return parseRegistrationList(result.payload);
  } catch {
    return "unavailable" as const;
  }
}

export async function openConnectLink(input: { accountId: string; refreshUrl: string; returnUrl: string }) {
  const enabled = await productSwitch("stripe_connect");
  if (!enabled) return { ok: false as const, error: "Stripe Connect is turned off. Nothing was opened." };
  const account = stripeAccountId(input.accountId);
  if (!account) return { ok: false as const, error: "Enter a Stripe account id. Nothing was opened." };
  const creds = await stripeCredentials();
  if (!creds.ok) {
    return { ok: false as const, error: stripeCredentialError(creds.reason, "opened") };
  }
  try {
    const payload = await stripeForm(
      "/v1/account_links",
      creds.secret,
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
