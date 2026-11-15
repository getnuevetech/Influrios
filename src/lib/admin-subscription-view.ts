/**
 * Display model for the admin subscription screens.
 * Estimates read a saved country rule. Checkout rows are labels only:
 * nothing here starts, completes, or cancels a charge.
 */
import { subscriptionPricePreview, type CountryTaxRule } from "@/lib/country-tax";

export type PlanEstimateMethod = "free" | "percentage" | "location" | "missing" | "conflict";

export type PlanEstimate = {
  baseCents: number;
  taxCents: number | null;
  totalCents: number | null;
  ratePercent: number | null;
  method: PlanEstimateMethod;
};

export function formatPlanMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function formatRate(rate: number) {
  if (!Number.isFinite(rate)) return "";
  return String(rate);
}

/** Price one plan from the country rule that covers it. A free plan stays free. */
export function estimatePlanPrice(input: {
  amountCents: number;
  countryCode: string;
  keys: string[];
  rules: CountryTaxRule[];
}): PlanEstimate {
  const amount = Number.isInteger(input.amountCents) ? input.amountCents : 0;
  if (amount <= 0) {
    return { baseCents: Math.max(0, amount), taxCents: 0, totalCents: Math.max(0, amount), ratePercent: null, method: "free" };
  }
  const country = input.countryCode.trim().toUpperCase();
  const keys = new Set(input.keys.map((key) => key.trim()).filter(Boolean));
  const applicable = input.rules.filter(
    (rule) => rule.effective && rule.countryCode === country && rule.family === "subscription",
  );
  const exact = applicable.filter((rule) => rule.chargeId && keys.has(rule.chargeId));
  const family = applicable.filter((rule) => !rule.chargeId);
  const pool = exact.length > 0 ? exact : family;
  if (pool.length === 0) {
    return { baseCents: amount, taxCents: null, totalCents: null, ratePercent: null, method: "missing" };
  }
  if (pool.length > 1 || pool.some((rule) => rule.conflict)) {
    return { baseCents: amount, taxCents: null, totalCents: null, ratePercent: null, method: "conflict" };
  }
  const rule = pool[0]!;
  const preview = subscriptionPricePreview({
    rules: input.rules,
    planId: rule.chargeId || [...keys][0] || "",
    countryCode: country,
    baseCents: amount,
    currency: "USD",
  });
  const priced = preview.status === "calculated" || preview.status === "zero";
  if (!priced || preview.taxCents == null || preview.totalCents == null) {
    return {
      baseCents: amount,
      taxCents: null,
      totalCents: null,
      ratePercent: null,
      method: rule.method === "location" ? "location" : "missing",
    };
  }
  return {
    baseCents: preview.baseCents ?? amount,
    taxCents: preview.taxCents,
    totalCents: preview.totalCents,
    ratePercent: rule.method === "percentage" ? rule.ratePercent : null,
    method: rule.method === "location" ? "location" : "percentage",
  };
}

/** The purple rate chip. Empty when this country has no single saved percentage. */
export function previewRateChip(estimates: Pick<PlanEstimate, "method" | "ratePercent">[]) {
  const paid = estimates.filter((estimate) => estimate.method !== "free");
  const rates = [
    ...new Set(
      paid
        .filter((estimate) => estimate.method === "percentage" && estimate.ratePercent != null)
        .map((estimate) => estimate.ratePercent),
    ),
  ];
  if (rates.length === 1 && rates[0] != null) return `${formatRate(rates[0])}% preview`;
  if (rates.length > 1 || paid.some((estimate) => estimate.method === "conflict")) return "Saved tax rules";
  if (paid.some((estimate) => estimate.method === "location")) return "Location rule";
  return null;
}

export function presentPlanPrice(estimate: PlanEstimate) {
  const note =
    estimate.method === "missing"
      ? "Add tax rule for this plan and country"
      : estimate.method === "location"
        ? "Calculated from the customer address"
        : estimate.method === "conflict"
          ? "More than one tax rule covers this plan"
          : "";
  return {
    base: formatPlanMoney(estimate.baseCents),
    tax: estimate.taxCents == null ? "—" : formatPlanMoney(estimate.taxCents),
    total: estimate.totalCents == null ? "—" : formatPlanMoney(estimate.totalCents),
    note,
  };
}

export type CheckoutDisplayStatus = "completed" | "open" | "expired";

export const CHECKOUT_STATUS_LABEL: Record<CheckoutDisplayStatus, string> = {
  completed: "Completed",
  open: "Open",
  expired: "Expired",
};

/** Stored checkout status stays put. Canceled is the unfinished display state. */
export function checkoutDisplayStatus(stored: string): CheckoutDisplayStatus {
  if (stored === "completed") return "completed";
  if (stored === "canceled") return "expired";
  return "open";
}

export function formatActivityDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

export function checkoutEnvironment(input: {
  mode: "stripe" | "demo";
  stripeSessionId?: string;
  stripeMode: "sandbox" | "live" | "demo" | "rejected";
}) {
  const reference = input.stripeSessionId ?? "";
  if (reference.startsWith("cs_test_")) return "Sandbox";
  if (reference.startsWith("cs_live_")) return "Live";
  if (input.mode === "demo") return "Demo";
  if (input.stripeMode === "live") return "Live";
  if (input.stripeMode === "sandbox") return "Sandbox";
  return "Not configured";
}

export function checkoutAccountLabel(input: {
  accountName?: string;
  customerEmail?: string;
  creatorSlug?: string;
}) {
  const name = input.accountName?.trim();
  if (name) return name;
  const email = input.customerEmail?.trim();
  if (email) return email;
  const slug = input.creatorSlug?.trim();
  if (slug) return slug;
  return "Account";
}

export type CheckoutActivityRow = {
  id: string;
  createdAt: string;
  dateLabel: string;
  account: string;
  plan: string;
  displayStatus: CheckoutDisplayStatus;
  environment: string;
  /** Provider reference exactly as stored. */
  reference: string;
  search: string;
};

export function presentCheckoutSession(input: {
  id: string;
  sku: string;
  mode: "stripe" | "demo";
  status: "open" | "completed" | "canceled";
  customerEmail?: string;
  userId?: string;
  creatorSlug?: string;
  stripeSessionId?: string;
  createdAt: string;
  accountName?: string;
  planName: string;
  stripeMode: "sandbox" | "live" | "demo" | "rejected";
}): CheckoutActivityRow {
  const reference = input.stripeSessionId?.trim() ? input.stripeSessionId : input.id;
  const account = checkoutAccountLabel(input);
  const search = [account, input.customerEmail, input.creatorSlug, input.userId, input.planName, input.sku, reference, input.id]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .toLowerCase();
  return {
    id: input.id,
    createdAt: input.createdAt,
    dateLabel: formatActivityDate(input.createdAt),
    account,
    plan: input.planName,
    displayStatus: checkoutDisplayStatus(input.status),
    environment: checkoutEnvironment(input),
    reference,
    search,
  };
}

export type ActivityFilter = {
  query: string;
  status: "all" | CheckoutDisplayStatus;
  range: "all" | "7" | "30" | "90";
  now: number;
};

export function filterCheckoutActivity(rows: CheckoutActivityRow[], filter: ActivityFilter) {
  const query = filter.query.trim().toLowerCase();
  const windowMs = filter.range === "all" ? null : Number(filter.range) * 86_400_000;
  return rows.filter((row) => {
    if (filter.status !== "all" && row.displayStatus !== filter.status) return false;
    if (windowMs != null) {
      const time = Date.parse(row.createdAt);
      if (!Number.isFinite(time) || time < filter.now - windowMs) return false;
    }
    if (!query) return true;
    return row.search.includes(query);
  });
}
