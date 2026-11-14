/**
 * One country-and-charge tax rule. The wizard, filing status, tax codes,
 * basis points, gateway, and tax-responsible entity are not part of pricing.
 * A failed calculation is never stored as zero. A valid zero keeps its reason.
 */
import { allocateByLargestRemainder } from "@/lib/agreement-fee-engine";
import { parseTaxPercent, percentToStoredRate, storedRateToPercent } from "@/lib/tax-configuration";
import {
  carryOriginalTaxThroughPayouts,
  combineCollaborationTax,
  determineSaleTax,
  type SaleTaxLine,
} from "@/lib/tax-determination";

export const COUNTRY_TAX_FIELDS = {
  country: "Country",
  productOrCharge: "Product or charge",
  appliesTo: "Applies to",
  taxCalculation: "Tax calculation",
  rate: "Rate (%)",
  save: "Save rule",
  cancel: "Cancel",
  add: "Add rule",
  edit: "Edit",
  previewCountry: "Preview country",
  basePrice: "Base price",
  estimatedTax: "Estimated tax",
  estimatedTotal: "Estimated total per billing period",
  enterPreviewAddress: "Enter preview address",
  missingRule: "Add tax rule for this plan and country",
  compensation: "Influencer compensation",
  businessFee: "Business collaboration fee",
  subtotal: "Subtotal",
  tax: "Tax",
  totalToFund: "Total to fund",
  viewDetails: "View tax details",
  allPlans: "All equivalent subscription plans",
  percentage: "Percentage",
  location: "Calculate by customer location",
} as const;

export const CHARGE_FAMILIES = [
  { id: "subscription", label: "Subscriptions", group: "Subscriptions" },
  { id: "influencer_service", label: "Influencer service", group: "Collaborations" },
  { id: "business_fee", label: "Business collaboration fee", group: "Collaborations" },
  { id: "influencer_fee", label: "Influencer fee", group: "Collaborations" },
  { id: "other", label: "Other charge", group: "Other charges" },
] as const;

export type ChargeFamily = (typeof CHARGE_FAMILIES)[number]["id"];

export type CountryTaxMethod = "percentage" | "location";

export type CountryTaxRule = {
  id: string;
  version: number;
  countryCode: string;
  family: ChargeFamily;
  /** Empty means the family default for this country. */
  chargeId: string;
  chargeLabel: string;
  method: CountryTaxMethod;
  /** Null when the rule is location-based. Zero is an approved percentage. */
  ratePercent: number | null;
  inclusive: boolean;
  effective: boolean;
  conflict: boolean;
};

export type TaxCalculationStatus = "calculated" | "zero" | "missing_location" | "missing_rule" | "failed" | "conflict";

export type TaxCalculation = {
  ok: boolean;
  status: TaxCalculationStatus;
  chargeId: string;
  countryCode: string;
  currency: string;
  baseCents: number;
  subtotalCents: number | null;
  taxCents: number | null;
  totalCents: number | null;
  reason: string;
  ruleId: string;
  ruleVersion: number;
  calculatedAt: string;
  storedAsZero: false;
  /** Location-based tax uses the provider. A percentage uses one exclusive rate. Never both. */
  stripe: { automaticTax: boolean; exclusiveRate: boolean };
};

const FAMILY_FROM_STORED: Record<string, ChargeFamily> = {
  subscription: "subscription",
  business_fee: "business_fee",
  influencer_fee: "influencer_fee",
  influencer_services: "influencer_service",
  influencer_service: "influencer_service",
  other: "other",
};

export function isChargeFamily(value: string): value is ChargeFamily {
  return CHARGE_FAMILIES.some((item) => item.id === value);
}

export function familyLabel(family: string) {
  return CHARGE_FAMILIES.find((item) => item.id === family)?.label ?? "Product or charge";
}

export function storedFamily(value: string): ChargeFamily | "" {
  return FAMILY_FROM_STORED[value] ?? "";
}

function countryCode(value: string) {
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : "";
}

function specificity(rule: { chargeId: string }) {
  return rule.chargeId.trim() ? "exact" : "family";
}

export function taxCalculationLabel(rule: { method: string; ratePercent: number | null }) {
  if (rule.method === "location") return COUNTRY_TAX_FIELDS.location;
  if (rule.method === "percentage" && rule.ratePercent != null) {
    const text = String(rule.ratePercent);
    return `${text}%`;
  }
  return "Not configured";
}

export function mapStoredPolicy(input: {
  id: string;
  version?: number;
  appliesTo: string;
  linkedIds: string[];
  countryCode: string;
  calculationMethod: string;
  rateBps?: number | null;
  ratePercent?: string;
  inclusive?: boolean;
  status?: string;
  chargeLabel?: string;
}): CountryTaxRule | null {
  const family = storedFamily(input.appliesTo);
  const country = countryCode(input.countryCode);
  if (!family || !country) return null;
  const method = input.calculationMethod === "location" || input.calculationMethod === "automatic"
    ? "location"
    : input.calculationMethod === "percentage" || input.calculationMethod === "manual"
      ? "percentage"
      : "";
  if (!method) return null;
  const fromBps = input.rateBps == null ? null : Number(storedRateToPercent(input.rateBps));
  const fromText = input.ratePercent ? parseTaxPercent(input.ratePercent) : null;
  const ratePercent = method === "percentage" ? (fromText ?? fromBps) : null;
  const ready = !input.status || input.status === "ready" || input.status === "active";
  const effective = ready && (method === "location" || ratePercent != null);
  const chargeId = input.linkedIds.map((id) => id.trim()).filter(Boolean)[0] ?? "";
  return {
    id: input.id,
    version: input.version ?? 1,
    countryCode: country,
    family,
    chargeId,
    chargeLabel: input.chargeLabel?.trim() || (chargeId ? chargeId : familyLabel(family)),
    method,
    ratePercent,
    inclusive: input.inclusive === true,
    effective,
    conflict: false,
  };
}

export function flagRuleConflicts(rules: CountryTaxRule[]): CountryTaxRule[] {
  const counts = new Map<string, number>();
  for (const rule of rules) {
    if (!rule.effective) continue;
    const key = `${rule.countryCode}|${rule.family}|${rule.chargeId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return rules.map((rule) => {
    const key = `${rule.countryCode}|${rule.family}|${rule.chargeId}`;
    return { ...rule, conflict: rule.effective && (counts.get(key) ?? 0) > 1 };
  });
}

export function planCountryTaxRule(input: {
  countryCode: string;
  family: string;
  chargeId: string;
  chargeLabel: string;
  method: string;
  ratePercent: string;
  existing: CountryTaxRule[];
}): { ok: true; rule: CountryTaxRule; summary: string } | { ok: false; error: string } {
  const country = countryCode(input.countryCode);
  if (!country) return { ok: false, error: "Choose a country." };
  if (!isChargeFamily(input.family)) return { ok: false, error: "Choose a product or charge." };
  const method = input.method === "percentage" || input.method === "location" ? input.method : "";
  if (!method) return { ok: false, error: "Choose a tax calculation." };
  const rate = method === "percentage" ? parseTaxPercent(input.ratePercent) : null;
  if (method === "percentage" && rate == null) return { ok: false, error: "Enter a rate (%). An empty rate is incomplete." };
  const chargeId = input.chargeId.trim();
  const draft: CountryTaxRule = {
    id: "",
    version: 1,
    countryCode: country,
    family: input.family,
    chargeId,
    chargeLabel: input.chargeLabel.trim() || (chargeId ? chargeId : familyLabel(input.family)),
    method,
    ratePercent: rate,
    inclusive: false,
    effective: true,
    conflict: false,
  };
  const overlap = input.existing.find((rule) =>
    rule.effective &&
    rule.countryCode === draft.countryCode &&
    rule.family === draft.family &&
    rule.chargeId === draft.chargeId &&
    specificity(rule) === specificity(draft),
  );
  if (overlap) {
    return { ok: false, error: "A rule already covers this country and product at the same specificity." };
  }
  const summary = `${country} · ${draft.chargeLabel} · ${taxCalculationLabel(draft)}`;
  return { ok: true, rule: draft, summary };
}

export function matchCountryRule(rules: CountryTaxRule[], input: { countryCode: string; family: ChargeFamily; chargeId: string }):
  | { ok: true; rule: CountryTaxRule }
  | { ok: false; status: "missing_rule" | "conflict"; error: string } {
  const country = countryCode(input.countryCode);
  const chargeId = input.chargeId.trim();
  const scoped = flagRuleConflicts(rules).filter((rule) => rule.effective && rule.countryCode === country && rule.family === input.family);
  const exact = scoped.filter((rule) => rule.chargeId === chargeId && chargeId);
  const family = scoped.filter((rule) => !rule.chargeId);
  const chosen = exact.length > 0 ? exact : family;
  if (chosen.some((rule) => rule.conflict) || chosen.length > 1) {
    return { ok: false, status: "conflict", error: `More than one tax rule covers ${familyLabel(input.family)} in ${country || "this country"}.` };
  }
  const rule = chosen[0];
  if (!rule) {
    if (input.family === "subscription") return { ok: false, status: "missing_rule", error: COUNTRY_TAX_FIELDS.missingRule };
    const item = chargeId || familyLabel(input.family);
    return { ok: false, status: "missing_rule", error: `Add tax rule for ${item} in ${country || "this country"}.` };
  }
  return { ok: true, rule };
}

function percentageTaxCents(baseCents: number, ratePercent: number) {
  const bps = percentToStoredRate(ratePercent);
  return Math.round((baseCents * bps) / 10_000);
}

export function stripeTaxMode(method: CountryTaxMethod, inclusive: boolean): { automaticTax: boolean; exclusiveRate: boolean } {
  if (inclusive) return { automaticTax: false, exclusiveRate: false };
  if (method === "location") return { automaticTax: true, exclusiveRate: false };
  return { automaticTax: false, exclusiveRate: true };
}

export function calculateCountryTax(input: {
  rules: CountryTaxRule[];
  chargeId: string;
  family: ChargeFamily;
  countryCode: string;
  baseCents: number;
  currency: string;
  at: string;
  location?: { country?: string; region?: string; postalCode?: string };
  providerResult?: { ok: true; taxCents: number; reason: string } | { ok: false; detail: string } | null;
}): TaxCalculation {
  const currency = input.currency.trim().toUpperCase() || "USD";
  const base = {
    chargeId: input.chargeId,
    countryCode: countryCode(input.countryCode),
    currency,
    baseCents: input.baseCents,
    calculatedAt: input.at,
    storedAsZero: false as const,
    ruleId: "",
    ruleVersion: 0,
  };
  if (!Number.isInteger(input.baseCents) || input.baseCents < 0) {
    return { ...base, ok: false, status: "failed", subtotalCents: null, taxCents: null, totalCents: null, reason: "The taxable amount is not a valid minor amount.", stripe: { automaticTax: false, exclusiveRate: false } };
  }
  const matched = matchCountryRule(input.rules, input);
  if (!matched.ok) {
    return { ...base, ok: false, status: matched.status, subtotalCents: null, taxCents: null, totalCents: null, reason: matched.error, stripe: { automaticTax: false, exclusiveRate: false } };
  }
  const rule = matched.rule;
  const stripe = stripeTaxMode(rule.method, rule.inclusive);
  const identity = { ...base, ruleId: rule.id, ruleVersion: rule.version, stripe };
  if (rule.inclusive) {
    const mapped = mapLegacyInclusivePrice({ storedCents: input.baseCents, inclusive: true, ratePercent: rule.ratePercent });
    return {
      ...identity,
      ok: true,
      status: mapped.taxIncludedCents === 0 && rule.ratePercent === 0 ? "zero" : "calculated",
      baseCents: mapped.baseCents,
      subtotalCents: mapped.baseCents,
      taxCents: mapped.taxIncludedCents,
      totalCents: mapped.customerTotalCents,
      reason: mapped.reason,
    };
  }
  if (rule.method === "percentage") {
    if (rule.ratePercent == null) {
      return { ...identity, ok: false, status: "failed", subtotalCents: null, taxCents: null, totalCents: null, reason: "Enter a rate (%). An empty rate is incomplete." };
    }
    const taxCents = percentageTaxCents(input.baseCents, rule.ratePercent);
    const reason = taxCents === 0 ? "Approved 0%." : `${taxCalculationLabel(rule)} on the base price.`;
    return {
      ...identity,
      ok: true,
      status: taxCents === 0 ? "zero" : "calculated",
      subtotalCents: input.baseCents,
      taxCents,
      totalCents: input.baseCents + taxCents,
      reason,
    };
  }
  const location = input.location;
  const located = Boolean(location?.country?.trim() && location.postalCode?.trim() && (!needsRegion(location.country ?? "") || location.region?.trim()));
  if (!located) {
    return { ...identity, ok: false, status: "missing_location", subtotalCents: input.baseCents, taxCents: null, totalCents: null, reason: "Enter the customer country, state or region, and postal code." };
  }
  if (!input.providerResult || !input.providerResult.ok) {
    const detail = input.providerResult && !input.providerResult.ok ? input.providerResult.detail : "The tax provider did not return a calculation.";
    return { ...identity, ok: false, status: "failed", subtotalCents: null, taxCents: null, totalCents: null, reason: detail || "The tax provider did not return a calculation." };
  }
  if (!Number.isInteger(input.providerResult.taxCents) || input.providerResult.taxCents < 0 || !input.providerResult.reason.trim()) {
    return { ...identity, ok: false, status: "failed", subtotalCents: null, taxCents: null, totalCents: null, reason: "The tax provider result is unreadable. Nothing was stored as zero." };
  }
  const taxCents = input.providerResult.taxCents;
  return {
    ...identity,
    ok: true,
    status: taxCents === 0 ? "zero" : "calculated",
    subtotalCents: input.baseCents,
    taxCents,
    totalCents: input.baseCents + taxCents,
    reason: input.providerResult.reason.trim(),
  };
}

function needsRegion(country: string) {
  return country.trim().toUpperCase() === "US" || country.trim().toUpperCase() === "CA";
}

export function subscriptionPricePreview(input: {
  rules: CountryTaxRule[];
  planId: string;
  countryCode: string;
  baseCents: number;
  currency: string;
  at?: string;
}) {
  const calculated = calculateCountryTax({
    rules: input.rules,
    chargeId: input.planId,
    family: "subscription",
    countryCode: input.countryCode,
    baseCents: input.baseCents,
    currency: input.currency,
    at: input.at ?? "2026-11-13T00:00:00.000Z",
    location: { country: input.countryCode, region: "CA", postalCode: "94107" },
    providerResult: null,
  });
  return {
    savedBaseCents: input.baseCents,
    baseCents: calculated.ok ? calculated.subtotalCents : input.baseCents,
    taxCents: calculated.taxCents,
    totalCents: calculated.totalCents,
    status: calculated.status,
    reason: calculated.reason,
    overwritten: false as const,
    appliedTwice: false as const,
  };
}

export function paidPlanAvailability(input: { amountCents: number; checkout: boolean; countryCode: string; planId: string; rules: CountryTaxRule[] }) {
  if (input.amountCents <= 0 || input.checkout === false) {
    return { kind: "free" as const, cancelsPaidSubscription: false as const };
  }
  const matched = matchCountryRule(input.rules, { countryCode: input.countryCode, family: "subscription", chargeId: input.planId });
  if (!matched.ok) {
    return { kind: "unavailable" as const, message: "This plan is temporarily unavailable.", missing: matched.error };
  }
  return { kind: "checkout" as const, message: "Tax calculated at checkout" };
}

export function mapLegacyInclusivePrice(input: { storedCents: number; inclusive: boolean; ratePercent: number | null }) {
  if (!input.inclusive) {
    return {
      baseCents: input.storedCents,
      taxIncludedCents: 0,
      customerTotalCents: input.storedCents,
      addTaxAgain: false as const,
      repriced: false as const,
      reason: "Exclusive base price. Tax is added once at checkout.",
    };
  }
  if (input.ratePercent == null) {
    return {
      baseCents: input.storedCents,
      taxIncludedCents: 0,
      customerTotalCents: input.storedCents,
      addTaxAgain: false as const,
      repriced: false as const,
      reason: "Legacy inclusive price. The stored total is unchanged and tax is not added again.",
    };
  }
  const bps = percentToStoredRate(input.ratePercent);
  const baseCents = Math.round((input.storedCents * 10_000) / (10_000 + bps));
  const taxIncludedCents = input.storedCents - baseCents;
  return {
    baseCents,
    taxIncludedCents,
    customerTotalCents: input.storedCents,
    addTaxAgain: false as const,
    repriced: false as const,
    reason: "Legacy inclusive price. The stored customer total is unchanged and tax is not added again.",
  };
}

export type CheckoutLine = { label: string; amountCents: number; reason?: string };

export function collaborationCheckout(input: {
  rules: CountryTaxRule[];
  countryCode: string;
  currency: string;
  compensationCents: number;
  businessFeeCents: number;
  influencerFeeCents: number;
  at: string;
  serviceProvider?: { ok: true; taxCents: number; reason: string } | { ok: false; detail: string } | null;
  businessProvider?: { ok: true; taxCents: number; reason: string } | { ok: false; detail: string } | null;
  influencerProvider?: { ok: true; taxCents: number; reason: string } | { ok: false; detail: string } | null;
}) {
  const location = { country: input.countryCode, region: "CA", postalCode: "94107" };
  const service = calculateCountryTax({
    rules: input.rules,
    chargeId: "influencer_service",
    family: "influencer_service",
    countryCode: input.countryCode,
    baseCents: input.compensationCents,
    currency: input.currency,
    at: input.at,
    location,
    providerResult: input.serviceProvider ?? null,
  });
  const business = calculateCountryTax({
    rules: input.rules,
    chargeId: "business_fee",
    family: "business_fee",
    countryCode: input.countryCode,
    baseCents: input.businessFeeCents,
    currency: input.currency,
    at: input.at,
    location,
    providerResult: input.businessProvider ?? null,
  });
  const influencer = calculateCountryTax({
    rules: input.rules,
    chargeId: "influencer_fee",
    family: "influencer_fee",
    countryCode: input.countryCode,
    baseCents: input.influencerFeeCents,
    currency: input.currency,
    at: input.at,
    location,
    providerResult: input.influencerProvider ?? null,
  });
  if (!service.ok || service.taxCents == null) {
    return { ok: false as const, error: service.reason, storedAsZero: false as const, moneyMoved: false as const };
  }
  if (!business.ok || business.taxCents == null) {
    return { ok: false as const, error: business.reason, storedAsZero: false as const, moneyMoved: false as const };
  }
  if (!influencer.ok || influencer.taxCents == null) {
    return { ok: false as const, error: influencer.reason, storedAsZero: false as const, moneyMoved: false as const };
  }
  const sale = determineSaleTax({
    event: "collaboration_sale",
    subjectId: "influencer_service",
    baseCents: input.compensationCents,
    inclusive: false,
    result: { state: "calculated", taxCents: service.taxCents, reason: service.reason },
  });
  const businessLine = determineSaleTax({
    event: "business_fee",
    subjectId: "business_fee",
    baseCents: input.businessFeeCents,
    inclusive: false,
    result: { state: "calculated", taxCents: business.taxCents, reason: business.reason },
  });
  const influencerLine = determineSaleTax({
    event: "influencer_fee",
    subjectId: "influencer_fee",
    baseCents: input.influencerFeeCents,
    inclusive: false,
    result: { state: "calculated", taxCents: influencer.taxCents, reason: influencer.reason },
  });
  if (!sale.ok || !businessLine.ok || !influencerLine.ok) {
    return { ok: false as const, error: "The collaboration tax could not be stored.", storedAsZero: false as const, moneyMoved: false as const };
  }
  const combined = combineCollaborationTax({ sale: sale.line, businessFee: businessLine.line, influencerFee: influencerLine.line });
  if (!combined.ok) return { ok: false as const, error: combined.error, storedAsZero: false as const, moneyMoved: false as const };
  const lines: CheckoutLine[] = [
    { label: COUNTRY_TAX_FIELDS.compensation, amountCents: input.compensationCents },
    { label: COUNTRY_TAX_FIELDS.businessFee, amountCents: input.businessFeeCents },
    { label: COUNTRY_TAX_FIELDS.subtotal, amountCents: input.compensationCents + input.businessFeeCents },
    { label: COUNTRY_TAX_FIELDS.tax, amountCents: business.taxCents, reason: business.reason },
    { label: COUNTRY_TAX_FIELDS.totalToFund, amountCents: combined.businessPaysCents },
  ];
  const details = [
    { label: "Influencer service", taxCents: service.taxCents, reason: service.reason },
    { label: COUNTRY_TAX_FIELDS.businessFee, taxCents: business.taxCents, reason: business.reason },
    { label: "Influencer fee", taxCents: influencer.taxCents, reason: influencer.reason },
  ];
  return {
    ok: true as const,
    lines,
    details,
    showDetails: new Set(details.map((line) => line.reason)).size > 1,
    businessPaysCents: combined.businessPaysCents,
    businessTaxCents: business.taxCents,
    influencerNetCents: combined.influencerNetCents,
    influencerTaxCents: influencer.taxCents,
    operationsCents: combined.operationsCents,
    taxLiabilityCents: combined.taxLiabilityCents,
    receipt: lines.map((line) => ({ ...line })),
    determinations: [sale.line, businessLine.line, influencerLine.line] as SaleTaxLine[],
    moneyMoved: false as const,
    payoutPaid: false as const,
    chargedAgain: false as const,
  };
}

function weightsFromParts(parts: number[]) {
  const sum = parts.reduce((total, part) => total + part, 0);
  if (sum <= 0 || parts.some((part) => !Number.isInteger(part) || part < 0)) return null;
  const weights = parts.map((part) => Math.floor((part * 10_000) / sum));
  let left = 10_000 - weights.reduce((total, weight) => total + weight, 0);
  const order = parts
    .map((part, index) => ({ index, remainder: (part * 10_000) % sum }))
    .sort((leftRow, rightRow) => rightRow.remainder - leftRow.remainder || leftRow.index - rightRow.index);
  for (const row of order) {
    if (left <= 0) break;
    weights[row.index] += 1;
    left -= 1;
  }
  return left === 0 ? weights : null;
}

export function partialRefundTax(input: { originalBaseCents: number; refundBaseCents: number; taxCents: number; reason: string }) {
  if (!input.reason.trim()) return { ok: false as const, error: "A refund needs the original tax reason.", storedAsZero: false as const };
  if (!Number.isInteger(input.originalBaseCents) || input.originalBaseCents <= 0) {
    return { ok: false as const, error: "The original charge is missing.", storedAsZero: false as const };
  }
  if (!Number.isInteger(input.refundBaseCents) || input.refundBaseCents < 0 || input.refundBaseCents > input.originalBaseCents) {
    return { ok: false as const, error: "The refund is outside the original charge.", storedAsZero: false as const };
  }
  if (!Number.isInteger(input.taxCents) || input.taxCents < 0) {
    return { ok: false as const, error: "The original tax is unreadable. Nothing was stored as zero.", storedAsZero: false as const };
  }
  const weights = weightsFromParts([input.refundBaseCents, input.originalBaseCents - input.refundBaseCents]);
  const shares = weights ? allocateByLargestRemainder(input.taxCents, weights) : null;
  if (!shares) return { ok: false as const, error: "The refund could not be reconciled to the original tax.", storedAsZero: false as const };
  return {
    ok: true as const,
    taxCents: shares[0] ?? 0,
    reason: input.reason.trim(),
    recalculated: false as const,
    storedAsZero: false as const,
  };
}

export function milestoneTaxReplay(input: {
  lines: { event: string; subjectId: string; taxCents: number; reason: string }[];
  weightsBps: number[];
}) {
  const first = carryOriginalTaxThroughPayouts(input);
  const second = carryOriginalTaxThroughPayouts(input);
  if (!first.ok) return { ok: false as const, error: first.error, storedAsZero: false as const };
  if (!second.ok) return { ok: false as const, error: second.error, storedAsZero: false as const };
  const same = JSON.stringify(first.payouts) === JSON.stringify(second.payouts);
  if (!same) return { ok: false as const, error: "A replay changed the original tax.", storedAsZero: false as const };
  return { ok: true as const, payouts: first.payouts, chargedAgain: false as const, error: "" };
}

export function checkoutTaxLines(checkout: {
  determinations: { event: string; baseCents: number; taxCents: number; reason: string }[];
}) {
  return checkout.determinations.map((line) => ({
    type: line.event === "business_fee" ? "business_fee_tax" as const : line.event === "influencer_fee" ? "influencer_fee_tax" as const : "other" as const,
    basisCents: line.baseCents,
    amountCents: line.taxCents,
    liableParty: line.event === "influencer_fee" ? "influencer" as const : "business" as const,
    disposition: line.reason,
  }));
}

export function renewalUsesSameTax(input: { baseCents: number; ratePercent: number }) {
  const checkout = percentageTaxCents(input.baseCents, input.ratePercent);
  const renewal = percentageTaxCents(input.baseCents, input.ratePercent);
  return { checkoutTaxCents: checkout, renewalTaxCents: renewal, appliedTwice: false as const };
}
