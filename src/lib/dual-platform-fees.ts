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
  pickWinningRule,
  ruleSpecificity,
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
  if (rule.purpose === "business_platform_fee" && rule.payer === "brand") return "business";
  if (rule.purpose === "influencer_platform_fee" && rule.payer === "creator") return "influencer";
  return null;
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
      error: `No ${sideName(side)} platform fee rule matched this collaboration. Signing is blocked.`,
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

export async function resolveDualPlatformFees(ctx: FeeResolveContext): Promise<DualPlatformQuote> {
  const store = await getFeeStore();
  const serviceLevel = serviceLevelForFeeResolution({
    requestedServiceLevel: ctx.serviceLevel,
    attributionStatus: ctx.attributionStatus,
  });
  return quoteDualPlatformFees(store.rules, { ...ctx, serviceLevel });
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

/** A signed dual-fee quote does not open a provider charge. */
export function liveFundingBlockReason(plan: unknown): string | null {
  if (!plan || typeof plan !== "object") return null;
  const reservation = (plan as { feeReservation?: { status?: unknown } }).feeReservation;
  if (reservation?.status === "reserved") {
    return `${collaborationLaunchBlockers().join(" ")} ${LIVE_FUNDING_OFF}`;
  }
  return null;
}
