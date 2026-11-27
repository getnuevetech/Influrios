/**
 * Influrios plan prices are set in admin (monthly and yearly, USD). Stripe needs a Price object for
 * subscriptions, yearly billing and plan changes, so the app creates and reuses them here: one Stripe
 * Product per plan and one Price per (plan, interval, amount). Stripe prices cannot be edited, so a new
 * amount gets a new price; existing subscribers keep theirs until they change plan.
 */
import { stripeApiRequest, stripeCredentials, stripeGet } from "@/lib/stripe-admin";

export type PlanPriceSync =
  | { ok: true; monthlyPriceId: string; annualPriceId: string }
  | { ok: false; error: string };

export function planProductId(code: string) {
  return `influrios_plan_${code.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_")}`;
}

export function planPriceLookupKey(code: string, interval: "month" | "year", cents: number) {
  return `influrios_${code.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_")}_${interval}_${cents}`;
}

/** Body for POST /v1/prices. */
export function planPriceBody(input: { productId: string; code: string; interval: "month" | "year"; cents: number }) {
  const body = new URLSearchParams();
  body.set("product", input.productId);
  body.set("currency", "usd");
  body.set("unit_amount", String(input.cents));
  body.set("recurring[interval]", input.interval);
  body.set("lookup_key", planPriceLookupKey(input.code, input.interval, input.cents));
  body.set("metadata[planCode]", input.code);
  body.set("metadata[interval]", input.interval);
  return body;
}

async function ensureProduct(secret: string, input: { code: string; name: string; description: string }) {
  const id = planProductId(input.code);
  const found = await stripeGet(`/v1/products/${id}`, secret);
  const body = new URLSearchParams();
  body.set("name", input.name.slice(0, 250) || input.code);
  if (input.description.trim()) body.set("description", input.description.trim().slice(0, 500));
  body.set("metadata[planCode]", input.code);
  if (found.ok) {
    const sameName = found.payload.name === body.get("name");
    if (!sameName || found.payload.active === false) {
      body.set("active", "true");
      const updated = await stripeApiRequest({ method: "POST", path: `/v1/products/${id}`, secret, body });
      if (!updated.ok) return { ok: false as const, error: updated.error };
    }
    return { ok: true as const, id };
  }
  body.set("id", id);
  const created = await stripeApiRequest({ method: "POST", path: "/v1/products", secret, body, idempotencyKey: `plan-product-${id}` });
  if (!created.ok) return { ok: false as const, error: created.error };
  return { ok: true as const, id };
}

async function ensurePrice(secret: string, input: { productId: string; code: string; interval: "month" | "year"; cents: number }) {
  const key = planPriceLookupKey(input.code, input.interval, input.cents);
  const listed = await stripeGet(`/v1/prices?active=true&lookup_keys[]=${encodeURIComponent(key)}`, secret);
  if (listed.ok && Array.isArray(listed.payload.data)) {
    const match = (listed.payload.data as { id?: string; unit_amount?: number; product?: string; recurring?: { interval?: string } }[]).find(
      (row) => row.unit_amount === input.cents && row.recurring?.interval === input.interval && row.product === input.productId,
    );
    if (match?.id) return { ok: true as const, id: match.id };
  }
  const created = await stripeApiRequest({
    method: "POST",
    path: "/v1/prices",
    secret,
    body: planPriceBody(input),
    idempotencyKey: `plan-price-${key}`,
  });
  if (!created.ok) return { ok: false as const, error: created.error };
  return { ok: true as const, id: created.id };
}

/**
 * Make sure Stripe has prices for this plan's monthly and yearly amounts and return their ids.
 * A zero amount means no price for that interval (empty id).
 */
export async function syncPlanStripePrices(input: {
  code: string;
  name: string;
  description: string;
  monthlyCents: number;
  annualCents: number | null;
}): Promise<PlanPriceSync> {
  const needMonthly = input.monthlyCents > 0;
  const needAnnual = (input.annualCents ?? 0) > 0;
  if (!needMonthly && !needAnnual) return { ok: true, monthlyPriceId: "", annualPriceId: "" };
  const creds = await stripeCredentials().catch(() => null);
  if (!creds?.ok) {
    return { ok: false, error: "Stripe is not connected, so plan prices could not be set up in Stripe. Nothing was saved." };
  }
  const product = await ensureProduct(creds.secret, input);
  if (!product.ok) return { ok: false, error: `Stripe product: ${product.error}` };
  let monthlyPriceId = "";
  let annualPriceId = "";
  if (needMonthly) {
    const price = await ensurePrice(creds.secret, { productId: product.id, code: input.code, interval: "month", cents: input.monthlyCents });
    if (!price.ok) return { ok: false, error: `Stripe monthly price: ${price.error}` };
    monthlyPriceId = price.id;
  }
  if (needAnnual) {
    const price = await ensurePrice(creds.secret, { productId: product.id, code: input.code, interval: "year", cents: input.annualCents! });
    if (!price.ok) return { ok: false, error: `Stripe yearly price: ${price.error}` };
    annualPriceId = price.id;
  }
  return { ok: true, monthlyPriceId, annualPriceId };
}

/**
 * Set up Stripe prices for every active paid plan from its saved monthly and yearly amounts, and store
 * the price ids. Safe to run repeatedly: existing matching prices are reused.
 */
export async function syncAllPlanStripePrices(actor: string) {
  const { prisma } = await import("@/lib/db");
  const { listAnnualOffers, savePlanAnnualOffer } = await import("@/lib/billing");
  const { annualOfferKey } = await import("@/lib/billing-interval");
  const plans = await prisma.entitlementPlan.findMany({ where: { active: true, amountCents: { gt: 0 } } });
  const offers = await listAnnualOffers();
  const results: { code: string; ok: boolean; error?: string }[] = [];
  for (const plan of plans) {
    const offer = offers[annualOfferKey(plan.code) ?? ""] ?? null;
    const synced = await syncPlanStripePrices({
      code: plan.code,
      name: plan.name,
      description: plan.description ?? "",
      monthlyCents: plan.amountCents,
      annualCents: offer?.amountCents ?? null,
    });
    if (!synced.ok) {
      results.push({ code: plan.code, ok: false, error: synced.error });
      continue;
    }
    await prisma.entitlementPlan.update({ where: { id: plan.id }, data: { stripePriceId: synced.monthlyPriceId || null } });
    if (offer) {
      await savePlanAnnualOffer({
        planCode: plan.code,
        amount: (offer.amountCents / 100).toFixed(2),
        priceId: synced.annualPriceId,
        monthlyPriceId: synced.monthlyPriceId,
      });
    }
    results.push({ code: plan.code, ok: true });
  }
  await prisma.auditLog
    .create({ data: { actor, action: "plans.stripe_prices_synced", objectType: "EntitlementPlan", objectId: "all", after: { results } } })
    .catch(() => undefined);
  return results;
}

/** True when an active paid plan has a monthly or yearly amount without a Stripe price yet. */
export async function planStripePricesMissing() {
  const { prisma } = await import("@/lib/db");
  const { listAnnualOffers } = await import("@/lib/billing");
  const { annualOfferKey } = await import("@/lib/billing-interval");
  const plans = await prisma.entitlementPlan.findMany({ where: { active: true, amountCents: { gt: 0 } }, select: { code: true, stripePriceId: true } });
  const offers = await listAnnualOffers();
  return plans.some((plan) => {
    if (!plan.stripePriceId) return true;
    const offer = offers[annualOfferKey(plan.code) ?? ""];
    return Boolean(offer && offer.amountCents > 0 && !offer.priceId);
  });
}

let inFlight: Promise<unknown> | null = null;

/**
 * Create any missing Stripe prices from the saved Influrios plan amounts. Runs on server start and before a
 * checkout that needs a price, so no admin step is required. Does nothing when every price exists.
 */
export async function ensurePlanStripePrices(actor = "system") {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    if (!(await planStripePricesMissing().catch(() => false))) return [];
    return syncAllPlanStripePrices(actor);
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
