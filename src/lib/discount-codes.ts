/**
 * One discount code applies to one charge. Influrios funds the discount from
 * the price or fee it earns. Previewing a code does not move money, and a
 * redemption is consumed only after the provider confirms settlement.
 */
import { SERVICE_LEVEL_LABELS, type ServiceLevel } from "@/lib/collaboration-fees";
import { calculateCountryTax, collaborationCheckout, partialRefundTax, type CountryTaxRule } from "@/lib/country-tax";

export const PRODUCT_CHARGES = ["subscription", "business_collaboration_fee", "influencer_collaboration_fee"] as const;
export type ProductCharge = (typeof PRODUCT_CHARGES)[number];

export const DISCOUNT_KINDS = ["percentage", "fixed"] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];

export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const DISCOUNT_STATUSES = ["draft", "scheduled", "active", "paused", "expired", "exhausted"] as const;
export type DiscountStatus = (typeof DISCOUNT_STATUSES)[number];

export const LAUNCH_APPLIES_TO = "First invoice only";

export type DiscountOffer = {
  id: string;
  version: number;
  normalizedCode: string;
  displayCode: string;
  productCharge: ProductCharge;
  kind: DiscountKind;
  percentBps: number | null;
  fixedCents: number | null;
  currency: string;
  countryCode: string;
  planCode: string;
  planName: string;
  billingInterval: BillingInterval | "";
  serviceLevel: string;
  startsAt: string;
  endsAt: string;
  totalUses: number;
  usesPerCustomer: number;
  lifecycle: "draft" | "active" | "paused";
  reservedCount: number;
  redeemedCount: number;
  refundedCount: number;
};

export type DiscountAdjustment = {
  charge: ProductCharge;
  code: string;
  offerId: string;
  version: number;
  currency: string;
  payerAccountId: string;
  originalCents: number;
  discountCents: number;
  netCents: number;
  quoteRef: string;
  line: string;
};

export type QuoteContext = {
  charge: ProductCharge;
  countryCode: string;
  currency: string;
  planCode?: string;
  planName?: string;
  billingInterval?: BillingInterval;
  serviceLevel?: string;
  accountId: string;
  now: string;
  priorUses: number;
};

const CHARGE_LABEL: Record<ProductCharge, string> = {
  subscription: "a subscription",
  business_collaboration_fee: "the business collaboration fee",
  influencer_collaboration_fee: "the influencer collaboration fee",
};

export function normalizeDiscountCode(raw: string) {
  return raw.trim().toUpperCase();
}

export function offerStatus(offer: DiscountOffer, now: string): DiscountStatus {
  if (offer.lifecycle === "draft") return "draft";
  if (offer.lifecycle === "paused") return "paused";
  if (now < offer.startsAt) return "scheduled";
  if (now > offer.endsAt) return "expired";
  if (offer.reservedCount + offer.redeemedCount >= offer.totalUses) return "exhausted";
  return "active";
}

export function statusLabel(status: DiscountStatus) {
  if (status === "draft") return "Draft";
  if (status === "scheduled") return "Scheduled";
  if (status === "active") return "Active";
  if (status === "paused") return "Paused";
  if (status === "expired") return "Expired";
  return "Exhausted";
}

/** Half away from zero for a positive minor amount, matching fee rounding. */
export function discountCents(input: {
  kind: DiscountKind;
  percentBps: number | null;
  fixedCents: number | null;
  baseCents: number;
}): { ok: true; discountCents: number } | { ok: false; error: string } {
  if (!Number.isInteger(input.baseCents) || input.baseCents < 0) {
    return { ok: false, error: "The charge amount is not a valid minor amount." };
  }
  let raw = 0;
  if (input.kind === "percentage") {
    if (input.percentBps == null || !Number.isInteger(input.percentBps) || input.percentBps <= 0 || input.percentBps > 10_000) {
      return { ok: false, error: "Percentage values must be above zero and at most 100%." };
    }
    raw = Math.round((input.baseCents * input.percentBps) / 10_000);
  } else {
    if (input.fixedCents == null || !Number.isInteger(input.fixedCents) || input.fixedCents <= 0) {
      return { ok: false, error: "Enter a fixed discount above zero." };
    }
    raw = input.fixedCents;
  }
  return { ok: true, discountCents: Math.min(raw, input.baseCents) };
}

function countryName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function intervalAdjective(interval: BillingInterval | "") {
  return interval === "year" ? "annual" : "monthly";
}

function serviceLabel(level: string) {
  if (level in SERVICE_LEVEL_LABELS) return SERVICE_LEVEL_LABELS[level as ServiceLevel];
  return level || "this service level";
}

export function ineligibilityReason(offer: DiscountOffer, context: QuoteContext): string | null {
  if (offer.productCharge !== context.charge) {
    return `This code is valid for ${CHARGE_LABEL[offer.productCharge]}.`;
  }
  if (context.charge === "subscription") {
    const plan = offer.planName || offer.planCode || "the selected plan";
    const interval = intervalAdjective(offer.billingInterval);
    if (context.planCode !== offer.planCode || context.billingInterval !== offer.billingInterval) {
      return `This code is valid for ${interval} ${plan} subscriptions.`;
    }
  } else if (context.serviceLevel !== offer.serviceLevel) {
    return `This code is valid for ${serviceLabel(offer.serviceLevel)}.`;
  }
  if (context.countryCode.trim().toUpperCase() !== offer.countryCode) {
    return `This code is valid in ${countryName(offer.countryCode)}.`;
  }
  if (context.currency.trim().toUpperCase() !== offer.currency) {
    return `This code is valid for ${offer.currency}.`;
  }
  const status = offerStatus(offer, context.now);
  if (status === "draft") return "This code is not active.";
  if (status === "paused") return "This code is paused.";
  if (status === "scheduled") return `This code starts on ${offer.startsAt.slice(0, 10)}.`;
  if (status === "expired") return `This code expired on ${offer.endsAt.slice(0, 10)}.`;
  if (status === "exhausted" || offer.reservedCount + offer.redeemedCount >= offer.totalUses) {
    return "This code has no uses left.";
  }
  if (context.priorUses >= offer.usesPerCustomer) return "You have already used this code.";
  return null;
}

export function renewalOn(checkoutAt: string, interval: BillingInterval) {
  const next = new Date(checkoutAt);
  if (Number.isNaN(next.getTime())) return "";
  if (interval === "year") next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next.toISOString().slice(0, 10);
}

function taxOn(rules: CountryTaxRule[], input: { family: CountryTaxRule["family"]; chargeId: string; baseCents: number; countryCode: string; currency: string; at: string }) {
  return calculateCountryTax({
    rules,
    family: input.family,
    chargeId: input.chargeId,
    countryCode: input.countryCode,
    baseCents: input.baseCents,
    currency: input.currency,
    at: input.at,
  });
}

export function quoteSubscription(input: {
  typedCode: string;
  offer: DiscountOffer | null;
  plan: { code: string; name: string; amountCents: number; interval: BillingInterval };
  countryCode: string;
  currency: string;
  accountId: string;
  checkoutAt: string;
  rules: CountryTaxRule[];
  priorUses: number;
}) {
  const typedCode = input.typedCode;
  if (!normalizeDiscountCode(typedCode)) {
    return { ok: false as const, typedCode, reason: "Enter a discount code.", moneyMoved: false as const, payoutPaid: false as const };
  }
  if (!input.offer || input.offer.normalizedCode !== normalizeDiscountCode(typedCode)) {
    return { ok: false as const, typedCode, reason: "This code is not valid.", moneyMoved: false as const, payoutPaid: false as const };
  }
  const reason = ineligibilityReason(input.offer, {
    charge: "subscription",
    countryCode: input.countryCode,
    currency: input.currency,
    planCode: input.plan.code,
    planName: input.plan.name,
    billingInterval: input.plan.interval,
    accountId: input.accountId,
    now: input.checkoutAt,
    priorUses: input.priorUses,
  });
  if (reason) return { ok: false as const, typedCode, reason, moneyMoved: false as const, payoutPaid: false as const };
  const discount = discountCents({
    kind: input.offer.kind,
    percentBps: input.offer.percentBps,
    fixedCents: input.offer.fixedCents,
    baseCents: input.plan.amountCents,
  });
  if (!discount.ok) return { ok: false as const, typedCode, reason: discount.error, moneyMoved: false as const, payoutPaid: false as const };
  const subtotalCents = input.plan.amountCents - discount.discountCents;
  const taxed = taxOn(input.rules, {
    family: "subscription",
    chargeId: input.plan.code,
    baseCents: subtotalCents,
    countryCode: input.countryCode,
    currency: input.currency,
    at: input.checkoutAt,
  });
  if (!taxed.ok || taxed.taxCents == null || taxed.totalCents == null) {
    return { ok: false as const, typedCode, reason: taxed.reason, moneyMoved: false as const, payoutPaid: false as const };
  }
  const renewalPriceCents = input.plan.amountCents;
  const renewalTax = taxOn(input.rules, {
    family: "subscription",
    chargeId: input.plan.code,
    baseCents: renewalPriceCents,
    countryCode: input.countryCode,
    currency: input.currency,
    at: input.checkoutAt,
  });
  return {
    ok: true as const,
    typedCode,
    code: input.offer.normalizedCode,
    offerId: input.offer.id,
    version: input.offer.version,
    discountCents: discount.discountCents,
    subtotalCents,
    taxCents: taxed.taxCents,
    dueTodayCents: taxed.totalCents,
    renewalOn: renewalOn(input.checkoutAt, input.plan.interval),
    renewalPriceCents,
    renewalDiscountCents: 0,
    renewalTaxCents: renewalTax.ok ? renewalTax.taxCents : null,
    appliesTo: LAUNCH_APPLIES_TO,
    invoiceKind: subtotalCents === 0 ? ("zero_total" as const) : ("standard" as const),
    accessGranted: false as const,
    moneyMoved: false as const,
    payoutPaid: false as const,
    charged: false as const,
  };
}

export type MilestoneTransfer = {
  grossCents: number;
  businessFeeCents: number;
  influencerFeeCents: number;
  influencerNetCents: number;
};

/** Earlier milestones take the floor. The final milestone takes the remainder. */
export function allocateRemainderToFinal(totalCents: number, weightsBps: number[]): number[] | null {
  if (!Number.isInteger(totalCents) || totalCents < 0) return null;
  if (weightsBps.length === 0) return null;
  if (weightsBps.some((weight) => !Number.isInteger(weight) || weight < 0)) return null;
  if (weightsBps.reduce((sum, weight) => sum + weight, 0) !== 10_000) return null;
  if (totalCents === 0) return weightsBps.map(() => 0);
  const amounts: number[] = [];
  let used = 0;
  for (let index = 0; index < weightsBps.length; index += 1) {
    if (index === weightsBps.length - 1) {
      amounts.push(totalCents - used);
      continue;
    }
    const part = Math.floor((totalCents * weightsBps[index]!) / 10_000);
    amounts.push(part);
    used += part;
  }
  if (amounts.some((amount) => amount < 0)) return null;
  if (amounts.reduce((sum, amount) => sum + amount, 0) !== totalCents) return null;
  return amounts;
}

export function discountedMilestoneTransfers(input: {
  grossCents: number;
  netBusinessFeeCents: number;
  netInfluencerFeeCents: number;
  weightsBps: number[];
}): { ok: true; rows: MilestoneTransfer[] } | { ok: false; error: string } {
  const gross = allocateRemainderToFinal(input.grossCents, input.weightsBps);
  const business = allocateRemainderToFinal(input.netBusinessFeeCents, input.weightsBps);
  const influencer = allocateRemainderToFinal(input.netInfluencerFeeCents, input.weightsBps);
  if (!gross || !business || !influencer) {
    return { ok: false, error: "Milestone weights must add up to 100% before the discounted fee can be allocated." };
  }
  const rows = gross.map((grossCents, index) => {
    const influencerFeeCents = influencer[index] ?? 0;
    return {
      grossCents,
      businessFeeCents: business[index] ?? 0,
      influencerFeeCents,
      influencerNetCents: grossCents - influencerFeeCents,
    };
  });
  if (rows.some((row) => row.influencerNetCents < 0)) {
    return { ok: false, error: "A milestone fee is larger than that milestone's gross. Nothing was quoted." };
  }
  return { ok: true, rows };
}

function sideDiscount(
  offer: DiscountOffer | null,
  typed: string,
  context: QuoteContext,
  baseCents: number,
) {
  if (!typed.trim()) return { ok: true as const, applied: null, discountCents: 0, netCents: baseCents };
  if (!offer || offer.normalizedCode !== normalizeDiscountCode(typed)) {
    return { ok: false as const, typedCode: typed, reason: "This code is not valid." };
  }
  const reason = ineligibilityReason(offer, context);
  if (reason) return { ok: false as const, typedCode: typed, reason };
  const discount = discountCents({
    kind: offer.kind,
    percentBps: offer.percentBps,
    fixedCents: offer.fixedCents,
    baseCents,
  });
  if (!discount.ok) return { ok: false as const, typedCode: typed, reason: discount.error };
  return {
    ok: true as const,
    applied: offer,
    discountCents: discount.discountCents,
    netCents: baseCents - discount.discountCents,
  };
}

export function priceCollaboration(input: {
  grossCents: number;
  businessFeeCents: number;
  influencerFeeCents: number;
  weightsBps: number[];
  businessTyped?: string;
  influencerTyped?: string;
  businessOffer: DiscountOffer | null;
  influencerOffer: DiscountOffer | null;
  countryCode: string;
  currency: string;
  serviceLevel: string;
  accountId: string;
  at: string;
  rules: CountryTaxRule[];
  priorBusinessUses?: number;
  priorInfluencerUses?: number;
  quoteRef?: string;
}) {
  const shared = {
    countryCode: input.countryCode,
    currency: input.currency,
    serviceLevel: input.serviceLevel,
    accountId: input.accountId,
    now: input.at,
  };
  const business = sideDiscount(input.businessOffer, input.businessTyped ?? "", {
    ...shared,
    charge: "business_collaboration_fee",
    priorUses: input.priorBusinessUses ?? 0,
  }, input.businessFeeCents);
  if (!business.ok) return { ...business, moneyMoved: false as const, payoutPaid: false as const };
  const influencer = sideDiscount(input.influencerOffer, input.influencerTyped ?? "", {
    ...shared,
    charge: "influencer_collaboration_fee",
    priorUses: input.priorInfluencerUses ?? 0,
  }, input.influencerFeeCents);
  if (!influencer.ok) return { ...influencer, moneyMoved: false as const, payoutPaid: false as const };
  if (business.applied && influencer.applied && business.applied.normalizedCode === influencer.applied.normalizedCode) {
    return { ok: false as const, typedCode: input.influencerTyped ?? "", reason: "Each code applies to one charge.", moneyMoved: false as const, payoutPaid: false as const };
  }
  const checkout = collaborationCheckout({
    rules: input.rules,
    countryCode: input.countryCode,
    currency: input.currency,
    compensationCents: input.grossCents,
    businessFeeCents: business.netCents,
    influencerFeeCents: influencer.netCents,
    at: input.at,
  });
  if (!checkout.ok) {
    return { ok: false as const, typedCode: input.businessTyped || input.influencerTyped || "", reason: checkout.error, moneyMoved: false as const, payoutPaid: false as const };
  }
  const businessFeeTax = checkout.details.find((line) => line.label === "Business collaboration fee");
  const milestones = discountedMilestoneTransfers({
    grossCents: input.grossCents,
    netBusinessFeeCents: business.netCents,
    netInfluencerFeeCents: influencer.netCents,
    weightsBps: input.weightsBps,
  });
  if (!milestones.ok) return { ...milestones, moneyMoved: false as const, payoutPaid: false as const };
  const quoteRef = input.quoteRef ?? "";
  const adjustments: DiscountAdjustment[] = [];
  if (business.applied) {
    adjustments.push({
      charge: "business_collaboration_fee",
      code: business.applied.normalizedCode,
      offerId: business.applied.id,
      version: business.applied.version,
      currency: input.currency,
      payerAccountId: input.accountId,
      originalCents: input.businessFeeCents,
      discountCents: business.discountCents,
      netCents: business.netCents,
      quoteRef,
      line: "business_collaboration_fee",
    });
  }
  if (influencer.applied) {
    adjustments.push({
      charge: "influencer_collaboration_fee",
      code: influencer.applied.normalizedCode,
      offerId: influencer.applied.id,
      version: influencer.applied.version,
      currency: input.currency,
      payerAccountId: input.accountId,
      originalCents: input.influencerFeeCents,
      discountCents: influencer.discountCents,
      netCents: influencer.netCents,
      quoteRef,
      line: "influencer_collaboration_fee",
    });
  }
  const beforeTaxBusinessPaysCents = input.grossCents + business.netCents;
  const influencerReceivesBeforeTaxCents = input.grossCents - influencer.netCents;
  return {
    ok: true as const,
    grossCents: input.grossCents,
    businessFeeCents: input.businessFeeCents,
    businessDiscountCents: business.discountCents,
    netBusinessFeeCents: business.netCents,
    influencerFeeCents: input.influencerFeeCents,
    influencerSavingsCents: influencer.discountCents,
    netInfluencerFeeCents: influencer.netCents,
    beforeTaxBusinessPaysCents,
    influencerReceivesBeforeTaxCents,
    businessFeeTaxCents: businessFeeTax?.taxCents ?? checkout.businessTaxCents,
    businessPaysCents: checkout.businessPaysCents,
    influencerNetCents: checkout.influencerNetCents,
    operationsCents: checkout.operationsCents,
    adjustments,
    milestones: milestones.rows,
    checkout,
    moneyMoved: false as const,
    payoutPaid: false as const,
    charged: false as const,
  };
}

export function rejectDiscountChange(input: { signedPartyCount: number }) {
  if (input.signedPartyCount > 0) {
    return {
      ok: false as const,
      readOnly: true as const,
      reason: "This code is part of the signed agreement. Changing it needs a new agreement and fresh signatures.",
    };
  }
  return { ok: true as const, readOnly: false as const };
}

export function presentPartyDiscount(input: {
  role: "business" | "influencer";
  signedPartyCount: number;
  adjustments: DiscountAdjustment[];
}) {
  const charge = input.role === "business" ? "business_collaboration_fee" : "influencer_collaboration_fee";
  const adjustment = input.adjustments.find((row) => row.charge === charge) ?? null;
  return {
    editable: input.signedPartyCount === 0,
    readOnly: input.signedPartyCount > 0,
    code: adjustment?.code ?? "",
    savingsCents: adjustment?.discountCents ?? 0,
    adjustment,
  };
}

export type ReservationRecord = {
  id: string;
  offerId: string;
  version: number;
  accountId: string;
  idempotencyKey: string;
  status: "reserved" | "consumed" | "released";
  amountCents: number;
  settlementId: string;
  refundedAt: string;
  providerOutcome: "none" | "unknown" | "abandoned" | "confirmed" | "cancelled";
};

export function reserveDecision(input: {
  offer: DiscountOffer;
  now: string;
  accountId: string;
  priorUses: number;
  idempotencyKey: string;
  existing: ReservationRecord | null;
  context: Omit<QuoteContext, "priorUses" | "accountId" | "now">;
}) {
  if (input.existing) {
    return { ok: true as const, kind: "replay" as const, reservation: input.existing };
  }
  const reason = ineligibilityReason(input.offer, {
    ...input.context,
    accountId: input.accountId,
    now: input.now,
    priorUses: input.priorUses,
  });
  if (reason) return { ok: false as const, reason };
  return { ok: true as const, kind: "created" as const };
}

export function canReleaseReservation(reservation: ReservationRecord) {
  if (reservation.status !== "reserved") return { ok: false as const, reason: "This use is not an open reservation." };
  if (reservation.providerOutcome === "unknown") {
    return { ok: false as const, reason: "Reconcile the provider before releasing this reservation." };
  }
  if (reservation.providerOutcome === "confirmed") {
    return { ok: false as const, reason: "A confirmed settlement keeps the reservation." };
  }
  return { ok: true as const };
}

export function consumeDecision(input: {
  reservation: ReservationRecord | null;
  settlementId: string;
  providerConfirmed: boolean;
}) {
  if (!input.providerConfirmed) {
    return {
      ok: false as const,
      reason: "Paid is recorded only after the provider confirms settlement.",
      moneyMoved: false as const,
      payoutPaid: false as const,
    };
  }
  if (!input.reservation) return { ok: false as const, reason: "There is no reservation to consume.", moneyMoved: false as const, payoutPaid: false as const };
  if (!input.settlementId.trim()) {
    return { ok: false as const, reason: "A confirmed settlement needs an id.", moneyMoved: false as const, payoutPaid: false as const };
  }
  if (input.reservation.status === "consumed") {
    if (input.reservation.settlementId === input.settlementId) {
      return { ok: true as const, kind: "replay" as const, reservation: input.reservation, payoutPaid: false as const, moneyMoved: false as const };
    }
    return { ok: false as const, reason: "This reservation was already consumed.", moneyMoved: false as const, payoutPaid: false as const };
  }
  if (input.reservation.status !== "reserved") {
    return { ok: false as const, reason: "This reservation is not open.", moneyMoved: false as const, payoutPaid: false as const };
  }
  return { ok: true as const, kind: "consumed" as const, payoutPaid: false as const, moneyMoved: false as const };
}

export function refundDecision(input: {
  reservation: ReservationRecord | null;
  providerConfirmed: boolean;
  originalBaseCents: number;
  refundBaseCents: number;
  taxCents: number;
  reason: string;
}) {
  if (!input.providerConfirmed) {
    return { ok: false as const, reason: "A refund waits for provider confirmation.", moneyMoved: false as const, payoutPaid: false as const };
  }
  if (!input.reservation || input.reservation.status !== "consumed") {
    return { ok: false as const, reason: "A refund uses a consumed redemption.", moneyMoved: false as const, payoutPaid: false as const };
  }
  const tax = partialRefundTax({
    originalBaseCents: input.originalBaseCents,
    refundBaseCents: input.refundBaseCents,
    taxCents: input.taxCents,
    reason: input.reason,
  });
  if (!tax.ok) return { ok: false as const, reason: tax.error, moneyMoved: false as const, payoutPaid: false as const };
  return {
    ok: true as const,
    useConsumed: true as const,
    restoredUse: false as const,
    tax,
    moneyMoved: false as const,
    payoutPaid: false as const,
  };
}

type LedgerOffer = DiscountOffer & { reservations: ReservationRecord[] };

export function createUsageLedger(seed: DiscountOffer[] = []) {
  const offers = new Map<string, LedgerOffer>(seed.map((offer) => [offer.id, { ...offer, reservations: [] }]));
  let chain: Promise<void> = Promise.resolve();
  let sequence = 0;

  function priorUses(offer: LedgerOffer, accountId: string) {
    return offer.reservations.filter((row) => row.accountId === accountId && row.status !== "released").length;
  }

  function syncCounts(offer: LedgerOffer) {
    offer.reservedCount = offer.reservations.filter((row) => row.status === "reserved").length;
    offer.redeemedCount = offer.reservations.filter((row) => row.status === "consumed").length;
    offer.refundedCount = offer.reservations.filter((row) => row.status === "consumed" && row.refundedAt).length;
  }

  function reserve(input: {
    offerId: string;
    accountId: string;
    idempotencyKey: string;
    now: string;
    amountCents: number;
    context: Omit<QuoteContext, "priorUses" | "accountId" | "now">;
  }) {
    const run = chain.then(() => {
      const offer = offers.get(input.offerId);
      if (!offer) return { ok: false as const, reason: "This code is not valid." };
      const existing = offer.reservations.find((row) => row.idempotencyKey === input.idempotencyKey) ?? null;
      const decision = reserveDecision({
        offer,
        now: input.now,
        accountId: input.accountId,
        priorUses: priorUses(offer, input.accountId),
        idempotencyKey: input.idempotencyKey,
        existing,
        context: input.context,
      });
      if (!decision.ok || decision.kind === "replay") return decision;
      sequence += 1;
      const reservation: ReservationRecord = {
        id: `rsv_${sequence}`,
        offerId: offer.id,
        version: offer.version,
        accountId: input.accountId,
        idempotencyKey: input.idempotencyKey,
        status: "reserved",
        amountCents: input.amountCents,
        settlementId: "",
        refundedAt: "",
        providerOutcome: "none",
      };
      offer.reservations.push(reservation);
      syncCounts(offer);
      return { ok: true as const, kind: "created" as const, reservation };
    });
    chain = run.then(() => undefined, () => undefined);
    return run;
  }

  function markOutcome(id: string, outcome: ReservationRecord["providerOutcome"]) {
    for (const offer of offers.values()) {
      const row = offer.reservations.find((item) => item.id === id);
      if (row) row.providerOutcome = outcome;
    }
  }

  function release(id: string) {
    const run = chain.then(() => {
      for (const offer of offers.values()) {
        const row = offer.reservations.find((item) => item.id === id);
        if (!row) continue;
        const allowed = canReleaseReservation(row);
        if (!allowed.ok) return allowed;
        row.status = "released";
        syncCounts(offer);
        return { ok: true as const, reservation: row };
      }
      return { ok: false as const, reason: "This reservation was not found." };
    });
    chain = run.then(() => undefined, () => undefined);
    return run;
  }

  function consume(input: { id: string; settlementId: string; providerConfirmed: boolean }) {
    const run = chain.then(() => {
      for (const offer of offers.values()) {
        const row = offer.reservations.find((item) => item.id === input.id);
        if (!row) continue;
        const decision = consumeDecision({ reservation: row, settlementId: input.settlementId, providerConfirmed: input.providerConfirmed });
        if (!decision.ok || decision.kind === "replay") return decision;
        row.status = "consumed";
        row.settlementId = input.settlementId;
        row.providerOutcome = "confirmed";
        syncCounts(offer);
        return { ok: true as const, kind: "consumed" as const, reservation: row, payoutPaid: false as const, moneyMoved: false as const };
      }
      return consumeDecision({ reservation: null, settlementId: input.settlementId, providerConfirmed: input.providerConfirmed });
    });
    chain = run.then(() => undefined, () => undefined);
    return run;
  }

  function refund(input: {
    id: string;
    providerConfirmed: boolean;
    originalBaseCents: number;
    refundBaseCents: number;
    taxCents: number;
    reason: string;
    at: string;
  }) {
    const run = chain.then(() => {
      for (const offer of offers.values()) {
        const row = offer.reservations.find((item) => item.id === input.id);
        if (!row) continue;
        const decision = refundDecision({ ...input, reservation: row });
        if (!decision.ok) return decision;
        if (!row.refundedAt) {
          row.refundedAt = input.at;
          syncCounts(offer);
        }
        return { ...decision, reservation: row, redeemedCount: offer.redeemedCount };
      }
      return { ok: false as const, reason: "This reservation was not found.", moneyMoved: false as const, payoutPaid: false as const };
    });
    chain = run.then(() => undefined, () => undefined);
    return run;
  }

  return {
    offers,
    reserve,
    release,
    consume,
    refund,
    markOutcome,
    snapshot(id: string) {
      const offer = offers.get(id);
      return offer ? { ...offer, reservations: offer.reservations.map((row) => ({ ...row })) } : null;
    },
  };
}

export function subscriptionProviderCharge(input: { amountCents: number; discountCents: number; couponId: string }) {
  return {
    unitAmountCents: input.amountCents,
    couponId: input.couponId,
    duration: "once" as const,
    subtractedFromPrice: false as const,
    moneyMoved: false as const,
  };
}

export type DiscountReportRow = {
  charge: ProductCharge;
  currency: string;
  state: "issued" | "reserved" | "redeemed" | "refunded";
  amountCents: number;
};

export function discountReport(rows: DiscountReportRow[]) {
  const groups = new Map<string, { charge: ProductCharge; currency: string; issuedCents: number; reservedCents: number; redeemedCents: number; refundedCents: number }>();
  for (const row of rows) {
    const key = `${row.charge}:${row.currency}`;
    const current = groups.get(key) ?? { charge: row.charge, currency: row.currency, issuedCents: 0, reservedCents: 0, redeemedCents: 0, refundedCents: 0 };
    if (row.state === "issued") current.issuedCents += row.amountCents;
    if (row.state === "reserved") current.reservedCents += row.amountCents;
    if (row.state === "redeemed") current.redeemedCents += row.amountCents;
    if (row.state === "refunded") current.refundedCents += row.amountCents;
    groups.set(key, current);
  }
  return [...groups.values()];
}

export function reviseOffer(current: DiscountOffer, patch: Partial<DiscountOffer>, hasRedemptions: boolean): DiscountOffer {
  if (!hasRedemptions) return { ...current, ...patch, id: current.id, version: current.version };
  return {
    ...current,
    ...patch,
    id: `${current.id}_v${current.version + 1}`,
    version: current.version + 1,
    normalizedCode: current.normalizedCode,
    reservedCount: 0,
    redeemedCount: 0,
    refundedCount: 0,
  };
}

export function parseOfferDraft(input: {
  code: string;
  productCharge: string;
  kind: string;
  value: string;
  currency: string;
  countryCode: string;
  planCode: string;
  planName: string;
  billingInterval: string;
  serviceLevel: string;
  startsAt: string;
  endsAt: string;
  totalUses: string;
  usesPerCustomer: string;
}): { ok: true; draft: Omit<DiscountOffer, "id" | "version" | "lifecycle" | "reservedCount" | "redeemedCount" | "refundedCount" | "displayCode"> & { displayCode: string } } | { ok: false; error: string } {
  const normalizedCode = normalizeDiscountCode(input.code);
  if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(normalizedCode)) {
    return { ok: false, error: "Use 2 to 40 letters, numbers, hyphens, or underscores." };
  }
  if (!(PRODUCT_CHARGES as readonly string[]).includes(input.productCharge)) {
    return { ok: false, error: "Choose the charge this code applies to." };
  }
  const productCharge = input.productCharge as ProductCharge;
  if (!(DISCOUNT_KINDS as readonly string[]).includes(input.kind)) {
    return { ok: false, error: "Choose a percentage or a fixed amount." };
  }
  const kind = input.kind as DiscountKind;
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: "Fixed amounts require one currency." };
  const countryCode = input.countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) return { ok: false, error: "Choose a country." };
  let percentBps: number | null = null;
  let fixedCents: number | null = null;
  if (kind === "percentage") {
    const percent = Number(input.value.trim().replace(/%$/, ""));
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      return { ok: false, error: "Percentage values must be above zero and at most 100%." };
    }
    percentBps = Math.round(percent * 100);
    if (percentBps <= 0 || percentBps > 10_000) {
      return { ok: false, error: "Percentage values must be above zero and at most 100%." };
    }
  } else {
    const amount = Number(input.value.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter a fixed discount above zero." };
    fixedCents = Math.round(amount * 100);
    if (fixedCents <= 0) return { ok: false, error: "Enter a fixed discount above zero." };
  }
  const startsAt = input.startsAt.trim();
  const endsAt = input.endsAt.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsAt) || !/^\d{4}-\d{2}-\d{2}$/.test(endsAt) || startsAt > endsAt) {
    return { ok: false, error: "The end date has to be on or after the start date." };
  }
  const totalUses = Number(input.totalUses);
  const usesPerCustomer = Number(input.usesPerCustomer || "1");
  if (!Number.isInteger(totalUses) || totalUses < 1) return { ok: false, error: "Enter the total uses." };
  if (!Number.isInteger(usesPerCustomer) || usesPerCustomer < 1) return { ok: false, error: "Enter the uses per customer." };
  let planCode = "";
  let planName = "";
  let billingInterval: BillingInterval | "" = "";
  let serviceLevel = "";
  if (productCharge === "subscription") {
    planCode = input.planCode.trim();
    planName = input.planName.trim() || planCode;
    if (!planCode) return { ok: false, error: "Choose the eligible plan." };
    if (!(BILLING_INTERVALS as readonly string[]).includes(input.billingInterval)) {
      return { ok: false, error: "Choose the billing interval. Monthly and annual first invoices are different offers." };
    }
    billingInterval = input.billingInterval as BillingInterval;
  } else {
    serviceLevel = input.serviceLevel.trim();
    if (!serviceLevel) return { ok: false, error: "Choose the eligible service level." };
  }
  return {
    ok: true,
    draft: {
      normalizedCode,
      displayCode: normalizedCode,
      productCharge,
      kind,
      percentBps,
      fixedCents,
      currency,
      countryCode,
      planCode,
      planName,
      billingInterval,
      serviceLevel,
      startsAt: `${startsAt}T00:00:00.000Z`,
      endsAt: `${endsAt}T23:59:59.999Z`,
      totalUses,
      usesPerCustomer,
    },
  };
}

export function sampleDiscount(input: { kind: DiscountKind; percentBps: number | null; fixedCents: number | null; baseCents: number }) {
  return discountCents({ ...input, baseCents: input.baseCents });
}

export function readDiscountAdjustments(plan: unknown): DiscountAdjustment[] {
  if (!plan || typeof plan !== "object") return [];
  const quote = (plan as { signedQuote?: { discountAdjustments?: unknown } }).signedQuote;
  const rows = quote?.discountAdjustments;
  if (!Array.isArray(rows)) return [];
  return rows.filter((row): row is DiscountAdjustment => {
    if (!row || typeof row !== "object") return false;
    const item = row as DiscountAdjustment;
    return typeof item.code === "string" && Number.isInteger(item.discountCents) && Number.isInteger(item.originalCents);
  });
}

export function businessQuoteLines(input: {
  grossCents: number;
  businessFeeCents: number;
  discountCents: number;
  taxCents: number;
  youPayCents: number;
}) {
  return [
    { label: "Gross compensation", amountCents: input.grossCents },
    { label: "Business fee", amountCents: input.businessFeeCents },
    ...(input.discountCents > 0 ? [{ label: "Fee discount", amountCents: input.discountCents, tone: "discount" as const }] : []),
    { label: "Tax", amountCents: input.taxCents },
    { label: "You pay", amountCents: input.youPayCents, emphasis: true },
  ];
}

export function applyPricedDiscountToPlan(
  plan: Record<string, unknown>,
  priced: {
    netBusinessFeeCents: number;
    netInfluencerFeeCents: number;
    beforeTaxBusinessPaysCents: number;
    influencerReceivesBeforeTaxCents: number;
    businessPaysCents: number;
    influencerNetCents: number;
    adjustments: DiscountAdjustment[];
    milestones: MilestoneTransfer[];
  },
  clearCharges: ProductCharge[] = [],
) {
  const quote = plan.signedQuote && typeof plan.signedQuote === "object" ? { ...(plan.signedQuote as Record<string, unknown>) } : null;
  if (!quote) return { ok: false as const, error: "This agreement has no commercial terms." };
  const previous = Array.isArray(quote.discountAdjustments) ? quote.discountAdjustments : [];
  const kept = previous.filter((row) => {
    if (!row || typeof row !== "object") return false;
    const charge = (row as { charge?: string }).charge;
    return !clearCharges.includes(charge as ProductCharge) && !priced.adjustments.some((next) => next.charge === charge);
  });
  quote.businessPlatformFeeCents = priced.netBusinessFeeCents;
  quote.influencerPlatformFeeCents = priced.netInfluencerFeeCents;
  quote.platformFeesTotalCents = priced.netBusinessFeeCents + priced.netInfluencerFeeCents;
  quote.businessPaysCents = priced.businessPaysCents;
  quote.influencerReceivesCents = priced.influencerNetCents;
  quote.businessTaxCents = priced.businessPaysCents - priced.beforeTaxBusinessPaysCents;
  quote.influencerTaxCents = priced.influencerReceivesBeforeTaxCents - priced.influencerNetCents;
  quote.discountAdjustments = [...kept, ...priced.adjustments];
  const activation = quote.activation && typeof quote.activation === "object" ? { ...(quote.activation as Record<string, unknown>) } : null;
  if (activation) {
    const activationFee = typeof activation.activationFeeCents === "number" ? activation.activationFeeCents : 0;
    const collaborationFee = typeof activation.businessCollaborationFeeCents === "number" ? activation.businessCollaborationFeeCents : 0;
    const originalFee = activationFee + collaborationFee;
    if (Number.isInteger(originalFee) && originalFee >= priced.netBusinessFeeCents && Number.isInteger(activationFee) && Number.isInteger(collaborationFee)) {
      const saved = originalFee - priced.netBusinessFeeCents;
      const collaborationNet = Math.max(0, collaborationFee - saved);
      activation.businessCollaborationFeeCents = collaborationNet;
      activation.activationFeeCents = priced.netBusinessFeeCents - collaborationNet;
      quote.activation = activation;
    }
  }
  quote.milestoneAllocations = priced.milestones.map((row) => ({
    grossCents: row.grossCents,
    businessCollaborationFeeCents: row.businessFeeCents,
    influencerFeeCents: row.influencerFeeCents,
    influencerNetCents: row.influencerNetCents,
  }));
  const milestones = Array.isArray(plan.milestones)
    ? plan.milestones.map((row, index) => {
        const share = priced.milestones[index];
        if (!row || typeof row !== "object" || !share) return row;
        return {
          ...(row as Record<string, unknown>),
          grossCents: share.grossCents,
          businessPlatformFeeCents: share.businessFeeCents,
          platformFeeCents: share.influencerFeeCents,
          creatorCents: share.influencerNetCents,
        };
      })
    : plan.milestones;
  return {
    ok: true as const,
    plan: {
      ...plan,
      businessPlatformFeeCents: priced.netBusinessFeeCents,
      influencerPlatformFeeCents: priced.netInfluencerFeeCents,
      businessPaysCents: priced.beforeTaxBusinessPaysCents,
      totalCreatorCompensationCents: priced.influencerReceivesBeforeTaxCents,
      totalPlatformFeeCents: priced.netBusinessFeeCents + priced.netInfluencerFeeCents,
      milestones,
      signedQuote: quote,
    },
  };
}

export function influencerQuoteLines(input: {
  grossCents: number;
  influencerFeeCents: number;
  savingsCents: number;
  taxCents: number;
  netCents: number;
}) {
  return [
    { label: "Gross compensation", amountCents: input.grossCents },
    { label: "Influencer fee", amountCents: input.influencerFeeCents, tone: "discount" as const },
    ...(input.savingsCents > 0 ? [{ label: "Fee savings", amountCents: input.savingsCents, tone: "savings" as const }] : []),
    { label: "Tax", amountCents: input.taxCents },
    { label: "Your net payout", amountCents: input.netCents, emphasis: true },
  ];
}
