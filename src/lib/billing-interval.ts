/**
 * Annual and monthly offers are different prices. A yearly checkout never
 * substitutes the monthly Stripe price. Browsing a period does not change a
 * subscription. A change is recorded only after the provider confirms it.
 */

export type BillingInterval = "month" | "year";

export const CHECKOUT_TAX_NOTE = "Applicable tax shown at checkout.";

const PLAN_ALIASES: Record<string, string> = {
  plus: "plus",
  creator_plus: "plus",
  pro: "pro",
  creator_pro: "pro",
  business_pro: "business_pro",
  agency: "agency",
  starter: "starter",
  creator_starter: "starter",
  business_free: "business_free",
};

export function parseBillingInterval(value: unknown): BillingInterval {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "year" || text === "annual" || text === "yearly") return "year";
  return "month";
}

export function intervalFromProvider(value: unknown): BillingInterval | null {
  if (value === "year") return "year";
  if (value === "month") return "month";
  return null;
}

export function canonicalPlanCode(value: string) {
  const key = value.trim().toLowerCase();
  return PLAN_ALIASES[key] ?? key;
}

export function samePlan(left: string, right: string) {
  const a = canonicalPlanCode(left);
  const b = canonicalPlanCode(right);
  return a !== "" && a === b;
}

export function skuForPlanCode(planCode: string): string | null {
  const code = canonicalPlanCode(planCode);
  if (code === "plus") return "creator_plus";
  if (code === "pro") return "creator_pro";
  if (code === "business_pro") return "business_pro";
  if (code === "agency") return "agency";
  return null;
}

export function formatOfferAmount(cents: number) {
  const amount = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatRenewalDate(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

export type RecurringPrice = { amountCents: number; priceId: string; currency: string };

export function resolveRecurringOffer(input: {
  sku: string;
  interval: BillingInterval;
  monthly: RecurringPrice | null;
  annual: RecurringPrice | null;
}) {
  if (input.interval === "month") {
    if (!input.monthly || input.monthly.amountCents <= 0) {
      return { ok: false as const, reason: "This plan has no monthly price.", monthlyAvailable: false };
    }
    return {
      ok: true as const,
      offer: {
        sku: input.sku,
        interval: "month" as const,
        amountCents: input.monthly.amountCents,
        currency: input.monthly.currency,
        priceId: input.monthly.priceId,
      },
      usedMonthlyFallback: false as const,
    };
  }
  if (!input.annual || input.annual.amountCents <= 0 || !input.annual.priceId) {
    return {
      ok: false as const,
      reason: "Annual billing is not available for this plan. You can stay on monthly.",
      monthlyAvailable: Boolean(input.monthly && input.monthly.amountCents > 0),
    };
  }
  if (input.monthly?.priceId && input.annual.priceId === input.monthly.priceId) {
    return {
      ok: false as const,
      reason: "Annual billing is not available for this plan. You can stay on monthly.",
      monthlyAvailable: true,
    };
  }
  return {
    ok: true as const,
    offer: {
      sku: input.sku,
      interval: "year" as const,
      amountCents: input.annual.amountCents,
      currency: input.annual.currency,
      priceId: input.annual.priceId,
    },
    usedMonthlyFallback: false as const,
  };
}

export function annualSavingsCents(input: {
  monthlyAmountCents: number | null;
  annualAmountCents: number | null;
  monthlyCurrency: string;
  annualCurrency: string;
}) {
  if (input.monthlyAmountCents == null || input.annualAmountCents == null) return null;
  if (input.monthlyAmountCents <= 0 || input.annualAmountCents <= 0) return null;
  if (input.monthlyCurrency.trim().toUpperCase() !== input.annualCurrency.trim().toUpperCase()) return null;
  const saved = input.monthlyAmountCents * 12 - input.annualAmountCents;
  return saved > 0 ? saved : null;
}

export function carryPlanSelection(input: {
  returnTo: string;
  sku: string;
  planCode: string;
  interval: BillingInterval;
}) {
  const params = new URLSearchParams();
  if (input.interval === "year") params.set("interval", "year");
  if (input.sku) params.set("sku", input.sku);
  if (input.planCode) params.set("plan", input.planCode);
  const query = params.toString();
  return query ? `${input.returnTo}?${query}` : input.returnTo;
}

export function viewInterval(input: { subscribedInterval: BillingInterval | null; viewedInterval: BillingInterval }) {
  return {
    subscriptionChanged: false as const,
    subscribedInterval: input.subscribedInterval,
    viewedInterval: input.viewedInterval,
  };
}

export function newPurchaseIntent(offer: { sku: string; interval: BillingInterval; priceId: string; amountCents: number }) {
  return {
    mode: "checkout" as const,
    sku: offer.sku,
    interval: offer.interval,
    priceId: offer.priceId,
    amountCents: offer.amountCents,
    markedPaid: false as const,
    createsSubscription: true as const,
  };
}

export function sameTierSwitchPreview(input: {
  sameTier: boolean;
  fromInterval: BillingInterval;
  toInterval: BillingInterval;
  periodEnd: string | null;
  annualAmountCents: number;
  taxCents: number | null;
}) {
  if (!input.sameTier || input.fromInterval !== "month" || input.toInterval !== "year") {
    return { applies: false as const, subscriptionCount: 1 as const, createsSubscription: false as const, markedPaid: false as const };
  }
  const effectiveOn = input.periodEnd ? input.periodEnd.slice(0, 10) : null;
  return {
    applies: true as const,
    timing: "next_renewal" as const,
    dueTodayCents: 0 as const,
    effectiveOn,
    annualAmountCents: input.annualAmountCents,
    firstChargeCents: input.taxCents == null ? null : input.annualAmountCents + input.taxCents,
    taxKnown: input.taxCents != null,
    subscriptionCount: 1 as const,
    entitlementsChangeNow: false as const,
    createsSubscription: false as const,
    markedPaid: false as const,
  };
}

/** Local subscription rows change only after Stripe has confirmed the operation. */
export function recordChangeDecision(input: { providerConfirmed: boolean }) {
  return { recorded: input.providerConfirmed, markedPaid: false as const };
}

export function renewalScheduleFields(input: {
  currentPriceId: string;
  nextPriceId: string;
  phaseStart: number;
  phaseEnd: number;
  quantity: number;
}) {
  const quantity = String(Math.max(1, input.quantity));
  return {
    "phases[0][items][0][price]": input.currentPriceId,
    "phases[0][items][0][quantity]": quantity,
    "phases[0][start_date]": String(input.phaseStart),
    "phases[0][end_date]": String(input.phaseEnd),
    "phases[0][proration_behavior]": "none",
    "phases[1][items][0][price]": input.nextPriceId,
    "phases[1][items][0][quantity]": quantity,
    "phases[1][proration_behavior]": "none",
    end_behavior: "release",
  };
}

export function tierUpdateFields(input: { itemId: string; priceId: string; quantity: number }) {
  return {
    "items[0][id]": input.itemId,
    "items[0][price]": input.priceId,
    "items[0][quantity]": String(Math.max(1, input.quantity)),
    proration_behavior: "create_prorations",
    payment_behavior: "pending_if_incomplete",
  };
}

export function tierPreviewQuery(input: { subscriptionId: string; itemId: string; priceId: string }) {
  return {
    subscription: input.subscriptionId,
    "subscription_details[items][0][id]": input.itemId,
    "subscription_details[items][0][price]": input.priceId,
    "subscription_details[proration_behavior]": "create_prorations",
  };
}

function rateMatches(baseCents: number, taxCents: number, ratePercent: number) {
  if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) return false;
  const bps = Math.round(ratePercent * 100);
  return Math.round((baseCents * bps) / 10_000) === taxCents;
}

export type PriceBreakdown =
  | { kind: "unknown"; baseCents: number; note: string; taxLineCount: 0 }
  | { kind: "unavailable"; baseCents: number; note: string; taxLineCount: 0 }
  | {
      kind: "exclusive" | "inclusive";
      baseCents: number;
      taxCents: number;
      totalCents: number;
      ratePercent: number | null;
      taxLineCount: 1;
      ignoredClaimedTotal: boolean;
    };

/**
 * One tax line. The total is the base plus that line for exclusive prices.
 * A claimed total that does not add up is not shown.
 */
export function displayedPriceBreakdown(input: {
  locationKnown: boolean;
  baseCents: number;
  taxCents?: number | null;
  ratePercent?: number | null;
  inclusive?: boolean;
  claimedTotalCents?: number | null;
  inclusiveTotalCents?: number | null;
}): PriceBreakdown {
  if (!input.locationKnown) {
    return { kind: "unknown", baseCents: input.baseCents, note: CHECKOUT_TAX_NOTE, taxLineCount: 0 };
  }
  if (input.taxCents == null || !Number.isInteger(input.taxCents) || input.taxCents < 0 || !Number.isInteger(input.baseCents)) {
    return { kind: "unavailable", baseCents: input.baseCents, note: "We couldn't calculate tax. Nothing was charged.", taxLineCount: 0 };
  }
  if (input.inclusive) {
    const total = input.inclusiveTotalCents ?? input.baseCents;
    const rate = input.ratePercent != null && rateMatches(total - input.taxCents, input.taxCents, input.ratePercent) ? input.ratePercent : null;
    return {
      kind: "inclusive",
      baseCents: total - input.taxCents,
      taxCents: input.taxCents,
      totalCents: total,
      ratePercent: rate,
      taxLineCount: 1,
      ignoredClaimedTotal: input.claimedTotalCents != null && input.claimedTotalCents !== total,
    };
  }
  const total = input.baseCents + input.taxCents;
  const rate = input.ratePercent != null && rateMatches(input.baseCents, input.taxCents, input.ratePercent) ? input.ratePercent : null;
  return {
    kind: "exclusive",
    baseCents: input.baseCents,
    taxCents: input.taxCents,
    totalCents: total,
    ratePercent: rate,
    taxLineCount: 1,
    ignoredClaimedTotal: input.claimedTotalCents != null && input.claimedTotalCents !== total,
  };
}

export function exclusiveDue(input: { baseCents: number; discountCents: number; taxCents: number }) {
  const subtotalCents = input.baseCents - input.discountCents;
  return {
    subtotalCents,
    taxCents: input.taxCents,
    dueTodayCents: subtotalCents + input.taxCents,
    taxLineCount: 1 as const,
  };
}

export function annualCodeOnMonthly(input: {
  typedCode: string;
  planCode: string;
  planName: string;
  annualPurchasable: boolean;
  offer: { planCode: string; planName: string; billingInterval: BillingInterval; eligible: boolean } | null;
  choice: "review-annual" | "continue-monthly" | null;
}) {
  const typedCode = input.typedCode;
  if (!input.offer) {
    return {
      typedCode,
      appliedCode: "",
      interval: "month" as const,
      message: "This code is not valid.",
      offerReviewAnnual: false,
      offerContinueMonthly: false,
    };
  }
  const same = samePlan(input.offer.planCode, input.planCode);
  const annualOffer = same && input.offer.billingInterval === "year";
  if (!annualOffer || !input.offer.eligible) {
    const name = input.offer.planName || input.planName;
    const when = input.offer.billingInterval === "year" ? "annual" : "monthly";
    return {
      typedCode,
      appliedCode: "",
      interval: "month" as const,
      message: same ? "This code is not valid." : `This code is valid for ${when} ${name} subscriptions.`,
      offerReviewAnnual: false,
      offerContinueMonthly: false,
    };
  }
  if (!input.annualPurchasable) {
    return {
      typedCode,
      appliedCode: "",
      interval: "month" as const,
      message: `${typedCode.trim() || "This code"} is valid for ${input.planName} annual, and annual billing is not available for this plan yet.`,
      offerReviewAnnual: false,
      offerContinueMonthly: true,
    };
  }
  if (input.choice === "continue-monthly") {
    return {
      typedCode: "",
      appliedCode: "",
      interval: "month" as const,
      message: "",
      offerReviewAnnual: false,
      offerContinueMonthly: false,
    };
  }
  if (input.choice === "review-annual") {
    return {
      typedCode,
      appliedCode: typedCode.trim(),
      interval: "year" as const,
      message: "",
      offerReviewAnnual: false,
      offerContinueMonthly: false,
    };
  }
  return {
    typedCode,
    appliedCode: "",
    interval: "month" as const,
    message: `${typedCode.trim()} is valid for ${input.planName} annual.`,
    offerReviewAnnual: true,
    offerContinueMonthly: true,
  };
}

const PRICE_ID = /^price_[A-Za-z0-9]+$/;

export function parseAnnualOfferInput(input: { amount: string; priceId: string; monthlyPriceId?: string }) {
  const amount = input.amount.trim();
  const priceId = input.priceId.trim();
  if (!amount && !priceId) return { ok: true as const, offer: null };
  if (!amount || !priceId) return { ok: false as const, error: "Save both the annual amount and the yearly Stripe price." };
  if (!/^\d+(\.\d{1,2})?$/.test(amount.replace(/^\$/, "").replace(/,/g, ""))) {
    return { ok: false as const, error: "Enter the annual amount in dollars." };
  }
  const cents = Math.round(Number(amount.replace(/^\$/, "").replace(/,/g, "")) * 100);
  if (!Number.isInteger(cents) || cents <= 0) return { ok: false as const, error: "Enter an annual amount above zero." };
  if (!PRICE_ID.test(priceId)) return { ok: false as const, error: "A Stripe price id starts with price_." };
  if (input.monthlyPriceId && priceId === input.monthlyPriceId.trim()) {
    return { ok: false as const, error: "The annual price has to be a yearly Stripe price, not the monthly price." };
  }
  return { ok: true as const, offer: { amountCents: cents, priceId, currency: "USD" as const } };
}

const PLAN_ANNUAL_SKU: Record<string, string> = {
  PLUS: "creator_plus",
  PRO: "creator_pro",
  BUSINESS_PRO: "business_pro",
  AGENCY: "agency",
};

const BILLING_ANNUAL_SKUS = new Set(Object.values(PLAN_ANNUAL_SKU));

/** Catalog plans and billing SKUs share one annual-offer key. A new plan uses its own code. */
export function annualOfferKey(planOrSku: string): string {
  const trimmed = planOrSku.trim();
  if (!trimmed) return "";
  const upper = trimmed.toUpperCase().replace(/[\s-]+/g, "_");
  if (PLAN_ANNUAL_SKU[upper]) return PLAN_ANNUAL_SKU[upper];
  const lower = trimmed.toLowerCase();
  if (BILLING_ANNUAL_SKUS.has(lower)) return lower;
  return upper;
}

export function dollarInputFromCents(cents: number): string {
  if (!Number.isFinite(cents)) return "";
  return (Math.round(cents) / 100).toFixed(2);
}

export function centsFromMonthlyDollarInput(amount: string): { ok: true; cents: number } | { ok: false; error: string } {
  const cleaned = amount.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!cleaned) return { ok: false, error: "Enter the monthly price in dollars." };
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return { ok: false, error: "Enter the monthly price in dollars, such as 19.00." };
  }
  const cents = Math.round(Number(cleaned) * 100);
  if (!Number.isInteger(cents) || cents < 0 || cents > 10_000_000) {
    return { ok: false, error: "Enter the monthly price in dollars." };
  }
  return { ok: true, cents };
}

export type AnnualOfferRecord = { amountCents: number; priceId: string; currency: "USD" };

export function parsePlanAnnualDraft(input: { amount: string; priceId: string; monthlyPriceIds?: string[] }) {
  const ids = (input.monthlyPriceIds ?? []).map((id) => id.trim()).filter(Boolean);
  const parsed = parseAnnualOfferInput({
    amount: input.amount,
    priceId: input.priceId,
    monthlyPriceId: ids[0],
  });
  if (!parsed.ok || !parsed.offer) return parsed;
  for (const id of ids.slice(1)) {
    if (parsed.offer.priceId === id) {
      return { ok: false as const, error: "The annual price has to be a yearly Stripe price, not the monthly price." };
    }
  }
  return parsed;
}

export function applyAnnualOffer(
  store: Record<string, AnnualOfferRecord>,
  key: string,
  offer: AnnualOfferRecord | null,
): Record<string, AnnualOfferRecord> {
  const next: Record<string, AnnualOfferRecord> = {};
  for (const [sku, saved] of Object.entries(store)) {
    if (sku !== key && saved) next[sku] = saved;
  }
  if (offer) next[key] = offer;
  return next;
}

/** Write one plan's annual draft onto the shared billing.annualOffers record. A blank draft removes it. */
export function writeSharedAnnualOffer(
  store: Record<string, AnnualOfferRecord>,
  planOrSku: string,
  draft: { amount: string; priceId: string; monthlyPriceIds?: string[] },
) {
  const key = annualOfferKey(planOrSku);
  if (!key) return { ok: false as const, error: "Unknown plan" };
  const parsed = parsePlanAnnualDraft(draft);
  if (!parsed.ok) return parsed;
  return {
    ok: true as const,
    key,
    offer: parsed.offer,
    store: applyAnnualOffer(store, key, parsed.offer),
  };
}

export function writeBillingAnnualOffers(
  store: Record<string, AnnualOfferRecord>,
  drafts: Partial<Record<string, { amount: string; priceId: string }>>,
  monthlyPriceIds: Partial<Record<string, string>>,
  skus: readonly string[],
) {
  let next = store;
  for (const sku of skus) {
    const draft = drafts[sku] ?? { amount: "", priceId: "" };
    const written = writeSharedAnnualOffer(next, sku, {
      amount: draft.amount,
      priceId: draft.priceId,
      monthlyPriceIds: monthlyPriceIds[sku] ? [monthlyPriceIds[sku]] : [],
    });
    if (!written.ok) return written;
    next = written.store;
  }
  return { ok: true as const, store: next };
}

export function planPriceFieldsFromStored(input: {
  amountCents: number;
  annual: { amountCents: number; priceId: string } | null;
}) {
  return {
    monthlyDollars: dollarInputFromCents(input.amountCents),
    annualDollars: input.annual ? dollarInputFromCents(input.annual.amountCents) : "",
    annualPriceId: input.annual?.priceId ?? "",
  };
}

export function sharedAnnualFields(store: Record<string, AnnualOfferRecord>, planOrSku: string) {
  const offer = store[annualOfferKey(planOrSku)];
  if (!offer) return { amount: "", priceId: "" };
  return { amount: dollarInputFromCents(offer.amountCents), priceId: offer.priceId };
}

/** Cents public annual pricing reads, or null when that plan has no published annual offer. */
export function annualPricingCents(store: Record<string, AnnualOfferRecord>, planOrSku: string): number | null {
  const offer = store[annualOfferKey(planOrSku)];
  if (!offer || offer.amountCents <= 0 || !offer.priceId) return null;
  return offer.amountCents;
}

export function annualCodesMissingPrice(input: {
  offers: { id: string; code: string; planCode: string; planName: string; billingInterval: string; lifecycle?: string }[];
  pricedSkus: string[];
}) {
  return input.offers.filter((offer) => {
    if (offer.billingInterval !== "year") return false;
    if (offer.lifecycle === "paused" || offer.lifecycle === "expired") return false;
    const sku = skuForPlanCode(offer.planCode);
    const candidates = [sku, offer.planCode.trim(), offer.planCode.trim().toUpperCase()].filter(
      (key): key is string => Boolean(key),
    );
    return !candidates.some((key) => input.pricedSkus.includes(key));
  });
}
