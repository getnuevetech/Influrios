import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/provider-secrets";
import { productSwitch } from "@/lib/product-switches";
import { renewalScheduleFields, tierPreviewQuery, tierUpdateFields } from "@/lib/billing-interval";
import { subscriptionRenewalUpdateFields } from "@/lib/subscription-renewal";
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

/** A first-invoice coupon. The plan price stays the renewal price. */
export function stripeOnceCouponBody(input: {
  code: string;
  version: number;
  currency: string;
  percentBps: number | null;
  amountOffCents: number | null;
}) {
  const body = new URLSearchParams({
    duration: "once",
    name: input.code.slice(0, 40),
  });
  body.set("metadata[influrios_code]", input.code);
  body.set("metadata[influrios_version]", String(input.version));
  if (input.percentBps != null) body.set("percent_off", (input.percentBps / 100).toFixed(2));
  else if (input.amountOffCents != null) {
    body.set("amount_off", String(input.amountOffCents));
    body.set("currency", input.currency.toLowerCase());
  }
  return body;
}

export async function createStripeOnceCoupon(input: {
  secret: string;
  code: string;
  version: number;
  currency: string;
  percentBps: number | null;
  amountOffCents: number | null;
  idempotencyKey: string;
}) {
  const payload = await stripeCall(
    "POST",
    "/v1/coupons",
    input.secret,
    stripeOnceCouponBody(input),
    input.idempotencyKey,
  );
  const id = typeof payload?.id === "string" ? payload.id : "";
  if (!id || payload?.duration !== "once") {
    return { ok: false as const, error: "The subscription discount could not be mapped to the provider. Nothing was charged." };
  }
  return { ok: true as const, id };
}

export async function openStripeCheckout(input: {
  secret: string;
  mode: StripeKeyMode;
  priceId: string;
  interval?: "month" | "year";
  amountCents: number;
  name: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata: Record<string, string>;
  automaticTax?: boolean;
  taxRateId?: string;
  couponId?: string;
  /** Influrios Collection sub-account (acct_). Every invoice of this subscription is transferred there. */
  collectionAccountId?: string | null;
}) {
  const interval = input.interval === "year" ? "year" : "month";
  if (interval === "year" && !input.priceId) {
    return { ok: false as const, error: "Annual billing is not available for this plan. Nothing was charged." };
  }
  const body = new URLSearchParams({
    mode: "subscription",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    "line_items[0][quantity]": "1",
  });
  body.set("metadata[billingInterval]", interval);
  body.set("subscription_data[metadata][billingInterval]", interval);
  if (input.collectionAccountId && /^acct_[A-Za-z0-9]+$/.test(input.collectionAccountId)) {
    body.set("subscription_data[transfer_data][destination]", input.collectionAccountId);
  }
  if (input.priceId) {
    body.set("line_items[0][price]", input.priceId);
  } else {
    body.set("line_items[0][price_data][currency]", "usd");
    body.set("line_items[0][price_data][unit_amount]", String(input.amountCents));
    body.set("line_items[0][price_data][recurring][interval]", interval);
    body.set("line_items[0][price_data][product_data][name]", input.name);
    body.set("line_items[0][price_data][product_data][description]", input.description);
  }
  for (const [key, value] of Object.entries(input.metadata)) body.set(`metadata[${key}]`, value);
  if (input.customerEmail) body.set("customer_email", input.customerEmail);
  if (input.couponId) body.set("discounts[0][coupon]", input.couponId);
  if (input.taxRateId) {
    body.set("line_items[0][tax_rates][0]", input.taxRateId);
  } else if (input.automaticTax) {
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

function asStripeRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function parseStripeSubscription(payload: Record<string, unknown> | null) {
  if (!payload || typeof payload.id !== "string" || !/^sub_[A-Za-z0-9]+$/.test(payload.id)) return null;
  const items = asStripeRecord(payload.items);
  const data = Array.isArray(items?.data) ? items.data : [];
  const first = asStripeRecord(data[0]);
  const price = asStripeRecord(first?.price);
  const recurring = asStripeRecord(price?.recurring);
  return {
    id: payload.id,
    itemId: typeof first?.id === "string" ? first.id : "",
    priceId: typeof price?.id === "string" ? price.id : "",
    interval: recurring?.interval === "year" ? ("year" as const) : recurring?.interval === "month" ? ("month" as const) : null,
    quantity: typeof first?.quantity === "number" && first.quantity > 0 ? first.quantity : 1,
    periodStart: typeof payload.current_period_start === "number" ? payload.current_period_start : null,
    periodEnd: typeof payload.current_period_end === "number" ? payload.current_period_end : null,
    cancelAtPeriodEnd: payload.cancel_at_period_end === true,
    scheduleId: typeof payload.schedule === "string" ? payload.schedule : "",
    status: typeof payload.status === "string" ? payload.status : "",
  };
}

export async function readStripeSubscription(secret: string, subscriptionId: string) {
  if (!/^sub_[A-Za-z0-9]+$/.test(subscriptionId)) {
    return { ok: false as const, error: "Stripe did not return the current subscription. Nothing was changed." };
  }
  try {
    const subscription = parseStripeSubscription(await stripeCall("GET", `/v1/subscriptions/${subscriptionId}`, secret));
    if (!subscription) return { ok: false as const, error: "Stripe did not return the current subscription. Nothing was changed." };
    return { ok: true as const, subscription };
  } catch {
    return { ok: false as const, error: "Stripe did not return the current subscription. Nothing was changed." };
  }
}

/** Same-tier monthly to annual: the current item stays until period end, then the yearly price renews. */
export async function schedulePriceAtRenewal(input: {
  secret: string;
  subscriptionId: string;
  nextPriceId: string;
  idempotencyKey: string;
}) {
  const current = await readStripeSubscription(input.secret, input.subscriptionId);
  if (!current.ok || !current.subscription.itemId || !current.subscription.priceId || current.subscription.periodStart == null || current.subscription.periodEnd == null) {
    return { ok: false as const, error: "Stripe did not return the current subscription. Nothing was changed." };
  }
  if (current.subscription.priceId === input.nextPriceId) {
    return { ok: false as const, error: "That price is already on the subscription. Nothing was changed." };
  }
  let scheduleId = current.subscription.scheduleId;
  try {
    if (!scheduleId) {
      const created = await stripeCall(
        "POST",
        "/v1/subscription_schedules",
        input.secret,
        new URLSearchParams({ from_subscription: input.subscriptionId }),
        input.idempotencyKey,
      );
      scheduleId = typeof created?.id === "string" ? created.id : "";
    }
    if (!/^sub_sched_[A-Za-z0-9]+$/.test(scheduleId)) {
      return { ok: false as const, error: "Stripe did not schedule the change. Nothing was changed." };
    }
    const updated = await stripeCall(
      "POST",
      `/v1/subscription_schedules/${scheduleId}`,
      input.secret,
      new URLSearchParams(
        renewalScheduleFields({
          currentPriceId: current.subscription.priceId,
          nextPriceId: input.nextPriceId,
          phaseStart: current.subscription.periodStart,
          phaseEnd: current.subscription.periodEnd,
          quantity: current.subscription.quantity,
        }),
      ),
      `${input.idempotencyKey}:phases`,
    );
    if (!updated || updated.id !== scheduleId) {
      return { ok: false as const, error: "Stripe did not schedule the change. Nothing was changed." };
    }
    return {
      ok: true as const,
      scheduleId,
      effectiveAt: new Date(current.subscription.periodEnd * 1000).toISOString(),
      currentPriceId: current.subscription.priceId,
    };
  } catch {
    return { ok: false as const, error: "Stripe did not schedule the change. Nothing was changed." };
  }
}

export async function releaseSubscriptionSchedule(input: { secret: string; scheduleId: string }) {
  if (!/^sub_sched_[A-Za-z0-9]+$/.test(input.scheduleId)) {
    return { ok: false as const, error: "Stripe did not cancel the scheduled change. Nothing was changed." };
  }
  try {
    const released = await stripeCall("POST", `/v1/subscription_schedules/${input.scheduleId}/release`, input.secret, new URLSearchParams());
    if (!released) return { ok: false as const, error: "Stripe did not cancel the scheduled change. Nothing was changed." };
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Stripe did not cancel the scheduled change. Nothing was changed." };
  }
}

export async function previewSubscriptionUpdate(input: { secret: string; subscriptionId: string; itemId: string; priceId: string }) {
  const query = new URLSearchParams(tierPreviewQuery(input));
  try {
    const payload = await stripeCall("GET", `/v1/invoices/upcoming?${query.toString()}`, input.secret);
    const amount = payload?.amount_due;
    if (!payload || typeof amount !== "number" || !Number.isInteger(amount) || amount < 0) {
      return { ok: false as const, error: "Stripe did not preview this change. Nothing was changed." };
    }
    return { ok: true as const, amountDueCents: amount };
  } catch {
    return { ok: false as const, error: "Stripe did not preview this change. Nothing was changed." };
  }
}

export async function updateSubscriptionPrice(input: {
  secret: string;
  subscriptionId: string;
  itemId: string;
  priceId: string;
  quantity: number;
  idempotencyKey: string;
}) {
  if (!/^sub_[A-Za-z0-9]+$/.test(input.subscriptionId)) {
    return { ok: false as const, error: "Stripe did not update the subscription. Nothing was changed." };
  }
  try {
    const payload = await stripeCall(
      "POST",
      `/v1/subscriptions/${input.subscriptionId}`,
      input.secret,
      new URLSearchParams(tierUpdateFields({ itemId: input.itemId, priceId: input.priceId, quantity: input.quantity })),
      input.idempotencyKey,
    );
    const subscription = parseStripeSubscription(payload);
    if (!payload || !subscription) return { ok: false as const, error: "Stripe did not update the subscription. Nothing was changed." };
    return { ok: true as const, pending: Boolean(payload.pending_update), priceId: subscription.priceId };
  } catch {
    return { ok: false as const, error: "Stripe did not update the subscription. Nothing was changed." };
  }
}

/**
 * Turn renewal off or on. Off sets cancel_at_period_end. On clears it.
 * The current price is left alone. An immediate cancel is not requested.
 */
export async function updateSubscriptionCancelAtPeriodEnd(input: {
  secret: string;
  subscriptionId: string;
  cancelAtPeriodEnd: boolean;
  idempotencyKey: string;
}) {
  if (!/^sub_[A-Za-z0-9]+$/.test(input.subscriptionId)) {
    return { ok: false as const, error: "Stripe did not update the subscription. Nothing was changed." };
  }
  try {
    const payload = await stripeCall(
      "POST",
      `/v1/subscriptions/${input.subscriptionId}`,
      input.secret,
      new URLSearchParams(subscriptionRenewalUpdateFields({ cancelAtPeriodEnd: input.cancelAtPeriodEnd })),
      input.idempotencyKey,
    );
    const subscription = parseStripeSubscription(payload);
    if (!payload || !subscription || subscription.cancelAtPeriodEnd !== input.cancelAtPeriodEnd) {
      return { ok: false as const, error: "Stripe did not update the subscription. Nothing was changed." };
    }
    if (subscription.status === "canceled" || subscription.status === "incomplete_expired") {
      return { ok: false as const, error: "Stripe did not keep the subscription until the renewal date. Nothing was changed." };
    }
    return {
      ok: true as const,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      periodStart: subscription.periodStart,
      periodEnd: subscription.periodEnd,
    };
  } catch {
    return { ok: false as const, error: "Stripe did not update the subscription. Nothing was changed." };
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

export async function createStripeExpressAccount(input: { secret: string; email?: string; country?: string | null }) {
  const body = new URLSearchParams({ type: "express", "capabilities[transfers][requested]": "true", business_type: "individual" });
  if (input.email) body.set("email", input.email);
  // The influencer's profile country decides which identity checks Stripe runs.
  if (input.country && /^[A-Z]{2}$/.test(input.country)) body.set("country", input.country);
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
    const { countryCodeFromLocation } = await import("@/lib/contract-wizard");
    const created = await createStripeExpressAccount({
      secret,
      email: input.email,
      country: countryCodeFromLocation(creator.locationCountry),
    });
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

export async function readStripeCheckoutStatus(input: { secret: string; checkoutSessionId: string }) {
  if (!checkoutId(input.checkoutSessionId)) {
    return { ok: false as const, error: "Stripe has not confirmed this payment. Nothing was changed." };
  }
  try {
    const payload = await stripeCall("GET", `/v1/checkout/sessions/${input.checkoutSessionId}`, input.secret);
    const status = payload?.status === "complete" || payload?.status === "expired" || payload?.status === "open" ? payload.status : "";
    const paymentStatus = typeof payload?.payment_status === "string" ? payload.payment_status : "";
    if (!status) return { ok: false as const, error: "Stripe has not confirmed this payment. Nothing was changed." };
    return { ok: true as const, status, paymentStatus };
  } catch {
    return { ok: false as const, error: "Stripe has not confirmed this payment. Nothing was changed." };
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

/**
 * Capability-probe retrieve with HTTP status.
 * Distinguishes verification failure (401/timeout) from a successful empty/unsupported payload.
 */
export async function stripeRetrieveResult(input: {
  method: "GET" | "POST";
  path: string;
  secret: string;
  apiVersion?: string;
}): Promise<
  | { ok: true; httpStatus: number; payload: Record<string, unknown> }
  | { ok: false; httpStatus: number | null; error: string }
> {
  const version = input.apiVersion?.trim() || STRIPE_VERSION;
  try {
    const response = await transport(`${STRIPE_HOST}${input.path}`, {
      method: input.method,
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${input.secret}`,
        "Stripe-Version": version,
      },
    });
    if (response.status < 200 || response.status >= 300) {
      return {
        ok: false,
        httpStatus: response.status,
        error: `Stripe account probe failed (HTTP ${response.status}). Verification stays unknown. Nothing was enabled.`,
      };
    }
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload || typeof payload !== "object") {
      return {
        ok: false,
        httpStatus: response.status,
        error: "Stripe account probe returned an invalid payload. Verification stays unknown. Nothing was enabled.",
      };
    }
    return { ok: true, httpStatus: response.status, payload };
  } catch {
    return {
      ok: false,
      httpStatus: null,
      error: "Stripe account probe timed out or failed. Verification stays unknown. Nothing was enabled.",
    };
  }
}

/** Raw Stripe JSON for capability probes. Prefer stripeRetrieveResult when failure must be distinguished. */
export async function stripeRetrievePayload(input: {
  method: "GET" | "POST";
  path: string;
  secret: string;
  apiVersion?: string;
}): Promise<Record<string, unknown> | null> {
  const result = await stripeRetrieveResult(input);
  return result.ok ? result.payload : null;
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

/** One exclusive percentage for a checkout line. A failure does not invent a zero rate. */
export async function exclusiveStripeTaxRate(secret: string, percent: number) {
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
    return { ok: false as const, error: "The tax rate could not be attached. Nothing was charged." };
  }
  const listed = await stripeJson("GET", "/v1/tax_rates?active=true&inclusive=false&limit=100", secret);
  const rows = listed.payload && typeof listed.payload === "object" && "data" in listed.payload ? (listed.payload as { data?: unknown }).data : null;
  if (Array.isArray(rows)) {
    const found = rows.find((row) => row && typeof row === "object" && Number((row as { percentage?: unknown }).percentage) === percent && typeof (row as { id?: unknown }).id === "string");
    const id = found && typeof found === "object" ? String((found as { id: string }).id) : "";
    if (id.startsWith("txr_")) return { ok: true as const, id };
  }
  const created = await stripeJson("POST", "/v1/tax_rates", secret, new URLSearchParams({
    display_name: "Tax",
    inclusive: "false",
    percentage: String(percent),
    description: `Exclusive ${percent}%`,
  }));
  const id = created.payload && typeof created.payload === "object" && "id" in created.payload ? String((created.payload as { id?: unknown }).id ?? "") : "";
  if (!id.startsWith("txr_")) return { ok: false as const, error: "The tax rate could not be attached. Nothing was charged." };
  return { ok: true as const, id };
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

/** Read-only GET for list and balance objects, which carry no object id. */
export async function stripeGet(path: string, secret: string): Promise<{ ok: true; payload: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const { status, payload } = await stripeJson("GET", path, secret);
    if (status >= 200 && status < 300 && payload && typeof payload === "object") {
      return { ok: true, payload: payload as Record<string, unknown> };
    }
    const message = (payload as { error?: { message?: string } } | null)?.error?.message;
    return { ok: false, error: message || `Stripe answered ${status}.` };
  } catch {
    return { ok: false, error: "Stripe could not be reached." };
  }
}
