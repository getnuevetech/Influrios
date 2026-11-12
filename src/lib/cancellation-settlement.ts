/**
 * A cancellation settlement is a proposal. It does not move money.
 * Accepted work keeps its frozen net and fees. Activation stays only after it is eligible.
 */

export type FrozenMilestoneAllocation = {
  grossCents: number;
  businessCollaborationFeeCents: number;
  influencerFeeCents: number;
  influencerNetCents: number;
};

export type SettlementProposal = {
  version: 1;
  influencerNetCents: number;
  retainedActivationCents: number;
  retainedBusinessCollaborationCents: number;
  retainedInfluencerFeeCents: number;
  platformRetainedCents: number;
  businessRefundCents: number;
  /** Activation already moved to operations. The refund is not sent until that amount is recovered. */
  activationRecoveryCents: number;
  /** False when an in-progress milestone has no accepted amount, or settled activation must be recovered. Nothing is sent to the provider. */
  automatic: boolean;
};

function portion(amountCents: number, acceptedGrossCents: number, grossCents: number) {
  if (acceptedGrossCents <= 0 || grossCents <= 0) return 0;
  if (acceptedGrossCents >= grossCents) return amountCents;
  return Math.floor((amountCents * acceptedGrossCents) / grossCents);
}

export function settlementProposal(input: {
  businessPaysCents: number;
  activationFeeCents: number;
  activationEligible: boolean;
  activationException: boolean;
  /** True when a fee has already settled to operations, so the activation portion is no longer held. */
  activationSettled?: boolean;
  milestones: (FrozenMilestoneAllocation & { acceptedGrossCents: number })[];
  review: boolean;
}): { ok: true; proposal: SettlementProposal } | { ok: false; error: string } {
  if (!Number.isInteger(input.businessPaysCents) || input.businessPaysCents < 0) {
    return { ok: false, error: "The signed business payment is missing." };
  }
  if (!Number.isInteger(input.activationFeeCents) || input.activationFeeCents < 0) {
    return { ok: false, error: "The activation amount is missing." };
  }
  if (input.milestones.length === 0) return { ok: false, error: "The frozen milestone allocation is missing." };
  let gross = 0;
  let collaboration = 0;
  let influencerNet = 0;
  let retainedCollaboration = 0;
  let retainedInfluencerFee = 0;
  for (const row of input.milestones) {
    if (
      !Number.isInteger(row.grossCents) ||
      !Number.isInteger(row.businessCollaborationFeeCents) ||
      !Number.isInteger(row.influencerFeeCents) ||
      !Number.isInteger(row.influencerNetCents) ||
      !Number.isInteger(row.acceptedGrossCents) ||
      row.grossCents < 0 ||
      row.acceptedGrossCents < 0 ||
      row.acceptedGrossCents > row.grossCents ||
      row.influencerNetCents !== row.grossCents - row.influencerFeeCents
    ) {
      return { ok: false, error: "The frozen milestone allocation does not reconcile." };
    }
    gross += row.grossCents;
    collaboration += row.businessCollaborationFeeCents;
    const acceptedGross = row.acceptedGrossCents;
    const acceptedFee = portion(row.influencerFeeCents, acceptedGross, row.grossCents);
    const acceptedCollaboration = portion(row.businessCollaborationFeeCents, acceptedGross, row.grossCents);
    const acceptedNet = acceptedGross - acceptedFee;
    if (acceptedNet < 0) return { ok: false, error: "A milestone fee is larger than the accepted gross." };
    influencerNet += acceptedNet;
    retainedCollaboration += acceptedCollaboration;
    retainedInfluencerFee += acceptedFee;
  }
  if (gross + input.activationFeeCents + collaboration !== input.businessPaysCents) {
    return { ok: false, error: "The frozen schedule does not match the signed business payment." };
  }
  const retainedActivation =
    input.activationEligible && !input.activationException ? input.activationFeeCents : 0;
  const platformRetained = retainedActivation + retainedCollaboration + retainedInfluencerFee;
  const businessRefund = input.businessPaysCents - influencerNet - platformRetained;
  if (businessRefund < 0 || influencerNet + platformRetained + businessRefund !== input.businessPaysCents) {
    return { ok: false, error: "The settlement does not reconcile. Nothing was refunded." };
  }
  const activationRecoveryCents =
    input.activationException && input.activationSettled ? input.activationFeeCents : 0;
  return {
    ok: true,
    proposal: {
      version: 1,
      influencerNetCents: influencerNet,
      retainedActivationCents: retainedActivation,
      retainedBusinessCollaborationCents: retainedCollaboration,
      retainedInfluencerFeeCents: retainedInfluencerFee,
      platformRetainedCents: platformRetained,
      businessRefundCents: businessRefund,
      activationRecoveryCents,
      automatic: !input.review && activationRecoveryCents === 0,
    },
  };
}

function allocationRows(value: unknown): FrozenMilestoneAllocation[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const rows: FrozenMilestoneAllocation[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const grossCents = row.grossCents;
    const businessCollaborationFeeCents = row.businessCollaborationFeeCents;
    const influencerFeeCents = row.influencerFeeCents;
    const influencerNetCents = row.influencerNetCents;
    if (
      !Number.isInteger(grossCents) ||
      !Number.isInteger(businessCollaborationFeeCents) ||
      !Number.isInteger(influencerFeeCents) ||
      !Number.isInteger(influencerNetCents)
    ) {
      return null;
    }
    rows.push({
      grossCents: Number(grossCents),
      businessCollaborationFeeCents: Number(businessCollaborationFeeCents),
      influencerFeeCents: Number(influencerFeeCents),
      influencerNetCents: Number(influencerNetCents),
    });
  }
  return rows;
}

/** Uses the frozen snapshot when this agreement has milestone allocations. Otherwise the older matrix stands. */
export function settlementFromSnapshot(input: {
  feeSnapshot: unknown;
  milestones: { id: string; status: string }[];
  activationEligible: boolean;
  activationException?: boolean;
  activationSettled?: boolean;
  currentMilestoneId?: string | null;
  acceptedPartialCents?: number | null;
}): { ok: true; proposal: SettlementProposal } | { ok: false; error: string } | null {
  const plan =
    input.feeSnapshot && typeof input.feeSnapshot === "object"
      ? (input.feeSnapshot as { financialPlan?: unknown }).financialPlan
      : null;
  const quote =
    plan && typeof plan === "object" ? (plan as { signedQuote?: unknown; activationFeeCents?: unknown; businessPaysCents?: unknown }).signedQuote : null;
  const rows = allocationRows(
    quote && typeof quote === "object" ? (quote as { milestoneAllocations?: unknown }).milestoneAllocations : null,
  );
  if (!rows) return null;
  if (rows.length !== input.milestones.length) {
    return { ok: false, error: "The frozen milestone allocation does not match this schedule." };
  }
  const quoteRecord = quote as { businessPaysCents?: unknown; activationFeeCents?: unknown };
  const planRecord = plan as { businessPaysCents?: unknown; activationFeeCents?: unknown };
  const businessPays = Number.isInteger(quoteRecord.businessPaysCents)
    ? Number(quoteRecord.businessPaysCents)
    : Number(planRecord.businessPaysCents);
  const activation = Number.isInteger(quoteRecord.activationFeeCents)
    ? Number(quoteRecord.activationFeeCents)
    : Number.isInteger(planRecord.activationFeeCents)
      ? Number(planRecord.activationFeeCents)
      : 0;
  let review = false;
  const milestones = rows.map((row, index) => {
    const milestone = input.milestones[index];
    const accepted = milestone?.status === "approved" || milestone?.status === "released";
    if (accepted) return { ...row, acceptedGrossCents: row.grossCents };
    const isCurrent = input.currentMilestoneId != null && milestone?.id === input.currentMilestoneId;
    const inProgress = milestone?.status === "submitted" || isCurrent;
    if (inProgress && input.acceptedPartialCents != null && Number.isInteger(input.acceptedPartialCents)) {
      return { ...row, acceptedGrossCents: Math.max(0, Math.min(row.grossCents, input.acceptedPartialCents)) };
    }
    if (milestone?.status === "submitted") review = true;
    return { ...row, acceptedGrossCents: 0 };
  });
  return settlementProposal({
    businessPaysCents: businessPays,
    activationFeeCents: activation,
    activationEligible: input.activationEligible,
    activationException: input.activationException === true,
    activationSettled: input.activationSettled === true,
    milestones,
    review,
  });
}

/** The platform-service failure is the activation refund exception. Other reasons keep an eligible activation. */
export function activationExceptionForReason(reason: string) {
  return reason === "platform_cannot_serve";
}
