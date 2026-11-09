/**
 * Dual platform fees. One existing matrix rule per payer side.
 * A legacy split rule is not copied onto either side.
 * Reservation, earning, and provider settlement stay separate.
 * These functions do not seed example rates.
 */
import { serviceLevelForFeeResolution } from "@/lib/attribution";
import {
  explainFeeApplication,
  getFeeStore,
  matchesRule,
  feeRuleSide,
  pickWinningRule,
  ruleSpecificity,
  SERVICE_LEVEL_LABELS,
  type CollaborationFeeRule,
  type FeeResolveContext,
} from "@/lib/collaboration-fees";
import type { FeeDisclosureInput } from "@/lib/fee-disclosure";
import { collaborationLaunchBlockers } from "@/lib/payment-engine";

export const LIVE_FUNDING_OFF =
  "Live funding stays off until the fee schedules, tax treatment, fee earning and refund policy, and provider route are approved. Both fees stay reserved. Nothing was charged.";

export type FeeSide = "business" | "influencer";

export type SideFee = {
  rule: CollaborationFeeRule;
  feeCents: number;
  waived: boolean;
  floorApplied: boolean;
  capApplied: boolean;
  rounding: "half_away_from_zero";
};

export type FeeReservation = {
  status: "reserved";
  earnedAt: null;
  providerSettledAt: null;
  businessRuleId: string;
  businessRuleVersion: number;
  influencerRuleId: string;
  influencerRuleVersion: number;
  grossInfluencerCompensationCents: number;
  businessPlatformFeeCents: number;
  influencerPlatformFeeCents: number;
  businessPaysCents: number;
  influencerReceivesCents: number;
};

export type DualPlatformQuote = {
  ok: true;
  grossInfluencerCompensationCents: number;
  businessPlatformFeeCents: number;
  influencerPlatformFeeCents: number;
  platformFeesTotalCents: number;
  businessPaysCents: number;
  influencerReceivesCents: number;
  business: SideFee;
  influencer: SideFee;
  reservation: FeeReservation;
  explanation: string;
} | {
  ok: false;
  error: string;
};

export function payerSide(rule: { payer?: string | null; purpose?: string | null }): FeeSide | null {
  return feeRuleSide(rule);
}

function sideName(side: FeeSide) {
  return side === "business" ? "business" : "influencer";
}

function resolveSide(
  rules: CollaborationFeeRule[],
  ctx: FeeResolveContext,
  side: FeeSide,
  asOf: string,
): { ok: true; side: SideFee } | { ok: false; error: string } {
  const candidates = pickWinningRule(
    rules.filter((rule) => payerSide(rule) === side),
    ctx,
    asOf,
  );
  const winner = candidates[0];
  if (!winner) {
    return {
      ok: false,
      error: `No ${sideName(side)} platform fee rule matches ${ctx.serviceLevel || "this service level"}. Add that rule in Collaboration fees before signing.`,
    };
  }
  const winningSpecificity = ruleSpecificity(winner);
  const tied = candidates.filter(
    (rule) => rule.priority === winner.priority && ruleSpecificity(rule) === winningSpecificity,
  );
  if (tied.length > 1) {
    return {
      ok: false,
      error: `More than one ${sideName(side)} platform fee rule ties at the winning precedence. Signing is blocked.`,
    };
  }
  const applied = explainFeeApplication(winner, ctx.grossValueCents);
  return {
    ok: true,
    side: {
      rule: winner,
      feeCents: applied.feeCents,
      waived: winner.method === "waived",
      floorApplied: applied.floorApplied,
      capApplied: applied.capApplied,
      rounding: applied.rounding,
    },
  };
}

export type PartyPlatformQuote = {
  ok: true;
  side: FeeSide;
  grossInfluencerCompensationCents: number;
  feeCents: number;
  totalCents: number;
  rule: CollaborationFeeRule;
  waived: boolean;
  floorApplied: boolean;
  capApplied: boolean;
  rounding: "half_away_from_zero";
} | {
  ok: false;
  error: string;
};

function serviceLevelName(serviceLevel: string) {
  return SERVICE_LEVEL_LABELS[serviceLevel as keyof typeof SERVICE_LEVEL_LABELS] ?? "this service level";
}

/** One party's fee. The other party's rule is not consulted and is not named. */
export function quotePartyPlatformFee(
  rules: CollaborationFeeRule[],
  ctx: FeeResolveContext,
  side: FeeSide,
): PartyPlatformQuote {
  if (!Number.isInteger(ctx.grossValueCents) || ctx.grossValueCents <= 0) {
    return { ok: false, error: "Enter the gross compensation." };
  }
  const asOf = ctx.asOf ?? new Date().toISOString();
  const resolved = resolveSide(rules, ctx, side, asOf);
  if (!resolved.ok) {
    const level = serviceLevelName(ctx.serviceLevel);
    return {
      ok: false,
      error: resolved.error.includes("ties")
        ? `More than one platform fee rule ties for ${level}. Signing is blocked.`
        : `No platform fee rule matches ${level}. Add your fee rule in Collaboration fees before continuing.`,
    };
  }
  if (side === "influencer" && resolved.side.feeCents > ctx.grossValueCents) {
    return { ok: false, error: "Your platform fee is larger than the gross compensation. Signing is blocked." };
  }
  return {
    ok: true,
    side,
    grossInfluencerCompensationCents: ctx.grossValueCents,
    feeCents: resolved.side.feeCents,
    totalCents: side === "business" ? ctx.grossValueCents + resolved.side.feeCents : ctx.grossValueCents - resolved.side.feeCents,
    rule: resolved.side.rule,
    waived: resolved.side.waived,
    floorApplied: resolved.side.floorApplied,
    capApplied: resolved.side.capApplied,
    rounding: resolved.side.rounding,
  };
}

/** Quote both platform fees from gross influencer compensation. */
export function quoteDualPlatformFees(
  rules: CollaborationFeeRule[],
  ctx: FeeResolveContext,
  options?: { routeMinimumPayoutCents?: number | null },
): DualPlatformQuote {
  if (!Number.isInteger(ctx.grossValueCents) || ctx.grossValueCents <= 0) {
    return { ok: false, error: "Enter the gross influencer compensation." };
  }
  const asOf = ctx.asOf ?? new Date().toISOString();
  const business = resolveSide(rules, ctx, "business", asOf);
  if (!business.ok) return business;
  const influencer = resolveSide(rules, ctx, "influencer", asOf);
  if (!influencer.ok) return influencer;
  if (influencer.side.feeCents > ctx.grossValueCents) {
    return {
      ok: false,
      error: "The influencer platform fee is larger than the gross influencer compensation. Signing is blocked.",
    };
  }
  const influencerReceivesCents = ctx.grossValueCents - influencer.side.feeCents;
  const routeMinimum = options?.routeMinimumPayoutCents;
  if (routeMinimum != null && influencerReceivesCents < routeMinimum) {
    return {
      ok: false,
      error: "The influencer payout is below the approved route minimum. Signing is blocked.",
    };
  }
  const businessPlatformFeeCents = business.side.feeCents;
  const influencerPlatformFeeCents = influencer.side.feeCents;
  const businessPaysCents = ctx.grossValueCents + businessPlatformFeeCents;
  const ignoredSplit = rules.some(
    (rule) => rule.payer === "split" && matchesRule(rule, ctx, asOf),
  );
  const reservation: FeeReservation = {
    status: "reserved",
    earnedAt: null,
    providerSettledAt: null,
    businessRuleId: business.side.rule.id,
    businessRuleVersion: business.side.rule.version,
    influencerRuleId: influencer.side.rule.id,
    influencerRuleVersion: influencer.side.rule.version,
    grossInfluencerCompensationCents: ctx.grossValueCents,
    businessPlatformFeeCents,
    influencerPlatformFeeCents,
    businessPaysCents,
    influencerReceivesCents,
  };
  return {
    ok: true,
    grossInfluencerCompensationCents: ctx.grossValueCents,
    businessPlatformFeeCents,
    influencerPlatformFeeCents,
    platformFeesTotalCents: businessPlatformFeeCents + influencerPlatformFeeCents,
    businessPaysCents,
    influencerReceivesCents,
    business: business.side,
    influencer: influencer.side,
    reservation,
    explanation: [
      `Business “${business.side.rule.name}” reserves ${businessPlatformFeeCents} cents on top.`,
      `Influencer “${influencer.side.rule.name}” reserves ${influencerPlatformFeeCents} cents from the gross.`,
      "Both fees are reserved. Neither is earned, and neither is settled to Influrios.",
      ignoredSplit ? "A legacy split rule matched and was not applied to either side." : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

/** Finds the gross whose business total equals the all-in budget. An inexact budget is refused. */
export function quoteFromAllInBudget(
  rules: CollaborationFeeRule[],
  ctx: Omit<FeeResolveContext, "grossValueCents">,
  budgetCents: number,
): PartyPlatformQuote {
  if (!Number.isInteger(budgetCents) || budgetCents <= 0) {
    return { ok: false, error: "Enter the all-in budget." };
  }
  const probe = quotePartyPlatformFee(rules, { ...ctx, grossValueCents: budgetCents }, "business");
  if (!probe.ok) return probe;
  let low = 1;
  let high = budgetCents;
  while (low <= high) {
    const gross = Math.floor((low + high) / 2);
    const quote = quotePartyPlatformFee(rules, { ...ctx, grossValueCents: gross }, "business");
    if (!quote.ok) return quote;
    if (quote.totalCents === budgetCents) return quote;
    if (quote.totalCents < budgetCents) low = gross + 1;
    else high = gross - 1;
  }
  return { ok: false, error: "That all-in budget does not match a gross amount under the fee rules." };
}

export async function resolveDualPlatformFees(ctx: FeeResolveContext): Promise<DualPlatformQuote> {
  const store = await getFeeStore();
  const serviceLevel = serviceLevelForFeeResolution({
    requestedServiceLevel: ctx.serviceLevel,
    attributionStatus: ctx.attributionStatus,
  });
  return quoteDualPlatformFees(store.rules, { ...ctx, serviceLevel });
}

export async function resolvePartyPlatformFee(
  ctx: FeeResolveContext,
  side: FeeSide,
): Promise<PartyPlatformQuote> {
  const store = await getFeeStore();
  const serviceLevel = serviceLevelForFeeResolution({
    requestedServiceLevel: ctx.serviceLevel,
    attributionStatus: ctx.attributionStatus,
  });
  return quotePartyPlatformFee(store.rules, { ...ctx, serviceLevel }, side);
}

export async function resolveAllInBudget(
  ctx: Omit<FeeResolveContext, "grossValueCents">,
  budgetCents: number,
): Promise<PartyPlatformQuote> {
  const store = await getFeeStore();
  const serviceLevel = serviceLevelForFeeResolution({
    requestedServiceLevel: ctx.serviceLevel,
    attributionStatus: ctx.attributionStatus,
  });
  return quoteFromAllInBudget(store.rules, { ...ctx, serviceLevel }, budgetCents);
}

/** Lock the influencer fee onto terms the business already sent. Business amounts stay as they were. */
export function applyInfluencerFeeToTerms(
  terms: unknown,
  quote: Extract<PartyPlatformQuote, { ok: true }>,
): { ok: true; terms: Record<string, unknown> } | { ok: false; error: string } {
  if (quote.side !== "influencer") return { ok: false, error: "Your platform fee could not be locked." };
  if (!terms || typeof terms !== "object") return { ok: false, error: "This agreement has no commercial terms." };
  const root = terms as { financialPlan?: unknown };
  if (!root.financialPlan || typeof root.financialPlan !== "object") {
    return { ok: false, error: "This agreement has no commercial terms." };
  }
  const plan = { ...(root.financialPlan as Record<string, unknown>) };
  const signed =
    plan.signedQuote && typeof plan.signedQuote === "object"
      ? { ...(plan.signedQuote as Record<string, unknown>) }
      : null;
  if (!signed) return { ok: false, error: "This agreement has no commercial terms." };
  const gross = signed.grossInfluencerCompensationCents;
  if (gross !== quote.grossInfluencerCompensationCents) {
    return { ok: false, error: "Your platform fee does not match this agreement." };
  }
  if (typeof signed.influencerRuleId === "string" && signed.influencerRuleId && typeof signed.influencerPlatformFeeCents === "number") {
    return { ok: true, terms: terms as Record<string, unknown> };
  }
  signed.influencerPlatformFeeCents = quote.feeCents;
  signed.influencerReceivesCents = quote.totalCents;
  signed.influencerRuleId = quote.rule.id;
  signed.influencerRuleVersion = quote.rule.version;
  signed.influencerRateBps =
    quote.rule.method === "percent" || quote.rule.method === "percent_plus_fixed" ? quote.rule.percentBps : null;
  signed.influencerFloorApplied = quote.floorApplied;
  signed.influencerCapApplied = quote.capApplied;
  const businessFee = typeof signed.businessPlatformFeeCents === "number" ? signed.businessPlatformFeeCents : 0;
  signed.platformFeesTotalCents = businessFee + quote.feeCents;
  plan.signedQuote = signed;
  plan.influencerPlatformFeeCents = quote.feeCents;
  plan.totalCreatorCompensationCents = quote.totalCents;
  return { ok: true, terms: { ...(terms as Record<string, unknown>), financialPlan: plan } };
}

export function disclosureFromPartyQuote(
  quote: Extract<PartyPlatformQuote, { ok: true }>,
  input: { jurisdiction: string; serviceLevel: string },
): FeeDisclosureInput {
  return {
    feeCents: quote.feeCents,
    ruleId: quote.rule.id,
    ruleName: quote.rule.name,
    ruleVersion: quote.rule.version,
    feeType: quote.rule.feeType,
    method: quote.rule.method,
    percentBps: quote.rule.percentBps,
    fixedCents: quote.rule.fixedCents,
    payer: quote.side === "business" ? "brand" : "creator",
    jurisdiction: input.jurisdiction,
    serviceLevel: input.serviceLevel,
    grossCents: quote.grossInfluencerCompensationCents,
    businessFeeCents: quote.side === "business" ? quote.feeCents : null,
    influencerFeeCents: quote.side === "influencer" ? quote.feeCents : null,
    businessPaysCents: quote.side === "business" ? quote.totalCents : null,
    influencerReceivesCents: quote.side === "influencer" ? quote.totalCents : null,
    feeState: "reserved",
  };
}

export function disclosureFromDualQuote(
  quote: Extract<DualPlatformQuote, { ok: true }>,
  input: { jurisdiction: string; serviceLevel: string },
): FeeDisclosureInput {
  return {
    feeCents: quote.platformFeesTotalCents,
    ruleId: quote.business.rule.id,
    ruleName: quote.business.rule.name,
    ruleVersion: quote.business.rule.version,
    feeType: quote.business.rule.feeType,
    method: quote.business.rule.method,
    percentBps: quote.business.rule.percentBps,
    fixedCents: quote.business.rule.fixedCents,
    payer: "brand",
    jurisdiction: input.jurisdiction,
    serviceLevel: input.serviceLevel,
    grossCents: quote.grossInfluencerCompensationCents,
    explanation: quote.explanation,
    businessFeeCents: quote.businessPlatformFeeCents,
    influencerFeeCents: quote.influencerPlatformFeeCents,
    businessPaysCents: quote.businessPaysCents,
    influencerReceivesCents: quote.influencerReceivesCents,
    influencerRuleId: quote.influencer.rule.id,
    influencerRuleVersion: quote.influencer.rule.version,
    feeState: "reserved",
  };
}

/** A signed dual-fee quote does not open a provider charge until Finance approvals and a reconciled trace exist. */
export function liveFundingBlockReason(
  plan: unknown,
  gate?: { approvals?: import("@/lib/payment-engine").LaunchApprovals; traceReady?: boolean } | null,
): string | null {
  if (!plan || typeof plan !== "object") return null;
  const reservation = (plan as { feeReservation?: { status?: unknown }; signedQuote?: { taxStatus?: string } }).feeReservation;
  if (reservation?.status !== "reserved") return null;
  const taxStatus = (plan as { signedQuote?: { taxStatus?: "unresolved" | "approved_zero" | "approved" } }).signedQuote?.taxStatus;
  const blockers = collaborationLaunchBlockers(
    gate?.approvals,
    taxStatus ? { status: taxStatus, lines: [] } : undefined,
  );
  if (!gate?.traceReady) blockers.push("The provider staging trace is not recorded.");
  if (blockers.length === 0) return null;
  return `${blockers.join(" ")} ${LIVE_FUNDING_OFF}`;
}
