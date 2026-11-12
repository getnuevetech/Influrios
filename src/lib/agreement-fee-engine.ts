/**
 * New-agreement fee split. The existing business fee is the envelope.
 * Activation is an allocation inside that envelope, not a second minimum.
 * Collaboration fees follow the signed milestone weights. Activation does not.
 */
import { serviceLevelForFeeResolution } from "@/lib/attribution";
import {
  explainFeeApplication,
  feeRuleSide,
  getFeeStore,
  matchesRule,
  pickWinningRule,
  ruleSpecificity,
  type CollaborationFeeRule,
  type FeeResolveContext,
} from "@/lib/collaboration-fees";

export type MilestoneFeeAllocation = {
  grossCents: number;
  businessCollaborationFeeCents: number;
  influencerFeeCents: number;
  influencerNetCents: number;
};

export type NewAgreementQuote = {
  ok: true;
  grossInfluencerCompensationCents: number;
  activationFeeCents: number;
  businessCollaborationFeeCents: number;
  businessPlatformFeeCents: number;
  influencerPlatformFeeCents: number;
  platformFeesTotalCents: number;
  businessPaysCents: number;
  influencerReceivesCents: number;
  envelopeRule: CollaborationFeeRule;
  activationRule: CollaborationFeeRule;
  influencerRule: CollaborationFeeRule;
  allocations: MilestoneFeeAllocation[];
  businessFloorApplied: boolean;
  businessCapApplied: boolean;
  influencerFloorApplied: boolean;
  influencerCapApplied: boolean;
} | {
  ok: false;
  error: string;
};

/** Deterministic largest-remainder split. Equal fractions go to the earlier milestone. */
export function allocateByLargestRemainder(totalCents: number, weightsBps: number[]): number[] | null {
  if (!Number.isInteger(totalCents) || totalCents < 0) return null;
  if (weightsBps.length === 0) return null;
  if (weightsBps.some((weight) => !Number.isInteger(weight) || weight < 0)) return null;
  if (weightsBps.reduce((sum, weight) => sum + weight, 0) !== 10_000) return null;
  if (totalCents === 0) return weightsBps.map(() => 0);
  const amounts = weightsBps.map((weight) => Math.floor((totalCents * weight) / 10_000));
  let left = totalCents - amounts.reduce((sum, amount) => sum + amount, 0);
  const order = weightsBps
    .map((weight, index) => ({ index, remainder: (totalCents * weight) % 10_000 }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const row of order) {
    if (left <= 0) break;
    amounts[row.index] += 1;
    left -= 1;
  }
  if (left !== 0 || amounts.reduce((sum, amount) => sum + amount, 0) !== totalCents) return null;
  return amounts;
}

export function allocateAgreementMilestones(input: {
  grossCents: number;
  businessCollaborationFeeCents: number;
  influencerFeeCents: number;
  weightsBps: number[];
}): { ok: true; rows: MilestoneFeeAllocation[] } | { ok: false; error: string } {
  const gross = allocateByLargestRemainder(input.grossCents, input.weightsBps);
  const collaboration = allocateByLargestRemainder(input.businessCollaborationFeeCents, input.weightsBps);
  const influencer = allocateByLargestRemainder(input.influencerFeeCents, input.weightsBps);
  if (!gross || !collaboration || !influencer) {
    return { ok: false, error: "Milestone weights must add up to 100% before the fees can be allocated." };
  }
  const rows = gross.map((grossCents, index) => {
    const influencerFeeCents = influencer[index] ?? 0;
    return {
      grossCents,
      businessCollaborationFeeCents: collaboration[index] ?? 0,
      influencerFeeCents,
      influencerNetCents: grossCents - influencerFeeCents,
    };
  });
  if (rows.some((row) => row.influencerNetCents < 0)) {
    return { ok: false, error: "A milestone fee is larger than that milestone's gross. Nothing was quoted." };
  }
  return { ok: true, rows };
}

function oneWinner(
  rules: CollaborationFeeRule[],
  ctx: FeeResolveContext,
  asOf: string,
  label: string,
): { ok: true; rule: CollaborationFeeRule } | { ok: false; error: string } {
  const candidates = pickWinningRule(rules, ctx, asOf);
  const winner = candidates[0];
  if (!winner) return { ok: false, error: `No ${label} rule matches this agreement. Signing is blocked.` };
  const specificity = ruleSpecificity(winner);
  const tied = candidates.filter((rule) => rule.priority === winner.priority && ruleSpecificity(rule) === specificity);
  if (tied.length > 1) {
    return { ok: false, error: `More than one ${label} rule ties. Signing is blocked.` };
  }
  return { ok: true, rule: winner };
}

/** Quote a new agreement from the envelope, one activation rule, and the influencer rule. */
export function quoteNewAgreementFees(
  rules: CollaborationFeeRule[],
  ctx: FeeResolveContext,
  weightsBps: number[],
): NewAgreementQuote {
  if (!Number.isInteger(ctx.grossValueCents) || ctx.grossValueCents <= 0) {
    return { ok: false, error: "Enter the gross influencer compensation." };
  }
  const asOf = ctx.asOf ?? new Date().toISOString();
  if (
    rules.some(
      (rule) =>
        rule.purpose === "platform_activation" &&
        rule.payer !== "brand" &&
        matchesRule(rule, ctx, asOf),
    )
  ) {
    return { ok: false, error: "Influencer activation is not part of this agreement. Signing is blocked." };
  }
  const envelope = oneWinner(
    rules.filter((rule) => feeRuleSide(rule) === "business"),
    ctx,
    asOf,
    "business fee",
  );
  if (!envelope.ok) return envelope;
  const activation = oneWinner(
    rules.filter((rule) => rule.purpose === "platform_activation" && rule.payer === "brand"),
    ctx,
    asOf,
    "platform activation fee",
  );
  if (!activation.ok) return activation;
  const influencer = oneWinner(
    rules.filter((rule) => feeRuleSide(rule) === "influencer"),
    ctx,
    asOf,
    "influencer collaboration fee",
  );
  if (!influencer.ok) return influencer;

  const envelopeApplied = explainFeeApplication(envelope.rule, ctx.grossValueCents);
  const activationApplied = explainFeeApplication(activation.rule, ctx.grossValueCents);
  const influencerApplied = explainFeeApplication(influencer.rule, ctx.grossValueCents);
  const envelopeCents = envelopeApplied.feeCents;
  let activationFeeCents = activationApplied.feeCents;
  if (activation.rule.method === "fixed" || activation.rule.method === "waived") {
    activationFeeCents = Math.min(activationFeeCents, envelopeCents);
  } else if (activationFeeCents > envelopeCents) {
    return { ok: false, error: "The activation allocation is larger than the business fee. Nothing was quoted." };
  }
  const businessCollaborationFeeCents = envelopeCents - activationFeeCents;
  if (influencerApplied.feeCents > ctx.grossValueCents) {
    return { ok: false, error: "The influencer platform fee is larger than the gross compensation. Signing is blocked." };
  }
  const businessPaysCents = ctx.grossValueCents + envelopeCents;
  const influencerReceivesCents = ctx.grossValueCents - influencerApplied.feeCents;
  if (businessPaysCents !== influencerReceivesCents + activationFeeCents + businessCollaborationFeeCents + influencerApplied.feeCents) {
    return { ok: false, error: "The fee split does not reconcile. Nothing was quoted." };
  }
  const allocated = allocateAgreementMilestones({
    grossCents: ctx.grossValueCents,
    businessCollaborationFeeCents,
    influencerFeeCents: influencerApplied.feeCents,
    weightsBps,
  });
  if (!allocated.ok) return allocated;
  return {
    ok: true,
    grossInfluencerCompensationCents: ctx.grossValueCents,
    activationFeeCents,
    businessCollaborationFeeCents,
    businessPlatformFeeCents: envelopeCents,
    influencerPlatformFeeCents: influencerApplied.feeCents,
    platformFeesTotalCents: activationFeeCents + businessCollaborationFeeCents + influencerApplied.feeCents,
    businessPaysCents,
    influencerReceivesCents,
    envelopeRule: envelope.rule,
    activationRule: activation.rule,
    influencerRule: influencer.rule,
    allocations: allocated.rows,
    businessFloorApplied: envelopeApplied.floorApplied,
    businessCapApplied: envelopeApplied.capApplied,
    influencerFloorApplied: influencerApplied.floorApplied,
    influencerCapApplied: influencerApplied.capApplied,
  };
}

export async function resolveNewAgreementFees(
  ctx: FeeResolveContext,
  weightsBps: number[],
): Promise<NewAgreementQuote> {
  const store = await getFeeStore();
  const serviceLevel = serviceLevelForFeeResolution({
    requestedServiceLevel: ctx.serviceLevel,
    attributionStatus: ctx.attributionStatus,
  });
  return quoteNewAgreementFees(store.rules, { ...ctx, serviceLevel }, weightsBps);
}
