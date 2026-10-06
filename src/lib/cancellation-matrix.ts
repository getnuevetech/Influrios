/**
 * W3.6 — Cancellation / kill-fee matrix (Product Addendum §11; Dev Addendum §14).
 * Pure calculate_cancellation: completed stay payable; current applies kill/partial; future refunds.
 */
export type CancellationMilestone = {
  id: string;
  title: string;
  amountCents: number;
  status: string;
  /** True when the influencer has started work (submitted / approved / in progress). */
  workBegan?: boolean;
};

export type KillFeeRule = {
  /** Basis points of the current milestone amount paid to the influencer when work began. */
  killFeeBps: number;
  /** Optional fixed cents added to the kill-fee (capped by milestone amount). */
  killFeeFixedCents: number;
};

export type CancellationReason =
  | "brand_before_start"
  | "brand_after_start"
  | "creator_without_cause"
  | "partial_delivery_accepted"
  | "chargeback";

export const DEFAULT_KILL_FEE_RULE: KillFeeRule = {
  killFeeBps: 2_500, // 25% of current milestone when work began
  killFeeFixedCents: 0,
};

export const CANCELLATION_REASON_LABELS: Record<CancellationReason, string> = {
  brand_before_start: "Brand cancels before influencer begins",
  brand_after_start: "Brand cancels after accepted work begins",
  creator_without_cause: "Influencer cancels without permitted cause",
  partial_delivery_accepted: "Partial delivery accepted",
  chargeback: "Chargeback / payment reversal",
};

export function isCompletedMilestoneStatus(status: string) {
  return status === "approved" || status === "released";
}

export function isFutureMilestoneStatus(status: string) {
  return status === "pending" || status === "submitted";
}

export function applyKillFeeOrPartial(input: {
  milestoneAmountCents: number;
  workBegan: boolean;
  rule: KillFeeRule;
  /** Explicit partial amount when parties agreed (partial_delivery_accepted). */
  acceptedPartialCents?: number | null;
}): { payableToCreatorCents: number; explanation: string } {
  const amount = Math.max(0, Math.floor(input.milestoneAmountCents));
  if (input.acceptedPartialCents != null) {
    const partial = Math.max(0, Math.min(amount, Math.floor(input.acceptedPartialCents)));
    return {
      payableToCreatorCents: partial,
      explanation: `Partial delivery accepted for ${partial}¢ of ${amount}¢.`,
    };
  }
  if (!input.workBegan) {
    return { payableToCreatorCents: 0, explanation: "Work had not begun — current milestone is refundable." };
  }
  const bps = Math.max(0, Math.min(10_000, Math.floor(input.rule.killFeeBps)));
  const fixed = Math.max(0, Math.floor(input.rule.killFeeFixedCents));
  const fromBps = Math.round((amount * bps) / 10_000);
  const payable = Math.min(amount, fromBps + fixed);
  return {
    payableToCreatorCents: payable,
    explanation: `Kill fee ${bps} bps + ${fixed}¢ fixed → ${payable}¢ of ${amount}¢ current milestone.`,
  };
}

/**
 * Dev Addendum §14 calculate_cancellation.
 * Does not move money — returns payout/refund instructions + audit explanation.
 */
export function calculateCancellation(input: {
  milestones: CancellationMilestone[];
  currentMilestoneId: string | null;
  reason: CancellationReason;
  fundedCents: number;
  alreadyReleasedCents: number;
  killFeeRule?: KillFeeRule;
  acceptedPartialCents?: number | null;
  /** Platform fee already earned on released milestones (Operations). */
  earnedFeeCents?: number;
}):
  | {
      ok: true;
      payableCompletedCents: number;
      currentAdjustmentCents: number;
      refundableFutureCents: number;
      earnedFeeCents: number;
      paymentRisk: boolean;
      explanation: string;
      lines: string[];
    }
  | { ok: false; error: string } {
  const funded = Math.max(0, Math.floor(input.fundedCents));
  const released = Math.max(0, Math.floor(input.alreadyReleasedCents));
  if (!Array.isArray(input.milestones) || input.milestones.length === 0) {
    return { ok: false, error: "Cancellation needs a milestone schedule." };
  }
  if (input.reason === "chargeback") {
    const held = Math.max(0, funded - released);
    return {
      ok: true,
      payableCompletedCents: released,
      currentAdjustmentCents: 0,
      refundableFutureCents: 0,
      earnedFeeCents: Math.max(0, Math.floor(input.earnedFeeCents ?? 0)),
      paymentRisk: true,
      explanation: "Chargeback / payment reversal — collaboration enters payment-risk workflow; no automatic refund.",
      lines: [
        `Already released/payable: ${released}¢`,
        `Held amount paused for payment-risk: ${held}¢`,
      ],
    };
  }

  const completed = input.milestones.filter((m) => isCompletedMilestoneStatus(m.status));
  const payableCompleted = completed.reduce((sum, m) => sum + Math.max(0, m.amountCents), 0);

  const current =
    input.currentMilestoneId != null
      ? input.milestones.find((m) => m.id === input.currentMilestoneId) ?? null
      : input.milestones.find((m) => m.status === "submitted" || (m.status === "pending" && m.workBegan)) ?? null;

  let currentAdjustment = 0;
  let currentLine = "No current in-progress milestone.";
  if (current && !isCompletedMilestoneStatus(current.status)) {
    const workBegan =
      current.workBegan === true ||
      current.status === "submitted" ||
      input.reason === "brand_after_start" ||
      input.reason === "partial_delivery_accepted";
    if (input.reason === "brand_before_start" && !workBegan) {
      currentAdjustment = 0;
      currentLine = `Current “${current.title}” refundable — brand cancelled before start.`;
    } else if (input.reason === "creator_without_cause" && !isCompletedMilestoneStatus(current.status)) {
      currentAdjustment = 0;
      currentLine = `Current “${current.title}” returns to brand — influencer cancelled without permitted cause.`;
    } else {
      const kill = applyKillFeeOrPartial({
        milestoneAmountCents: current.amountCents,
        workBegan: workBegan || input.reason === "brand_after_start",
        rule: input.killFeeRule ?? DEFAULT_KILL_FEE_RULE,
        acceptedPartialCents:
          input.reason === "partial_delivery_accepted" ? input.acceptedPartialCents ?? null : null,
      });
      currentAdjustment = kill.payableToCreatorCents;
      currentLine = `Current “${current.title}”: ${kill.explanation}`;
    }
  }

  const scheduled = input.milestones.reduce((sum, m) => sum + Math.max(0, m.amountCents), 0);
  const remainingFunded = Math.max(0, funded - released);
  const refundableFuture = Math.max(
    0,
    remainingFunded - currentAdjustment - Math.max(0, payableCompleted - released),
  );
  // Cap refund so we never exceed remaining held funds.
  const cappedRefund = Math.min(remainingFunded, refundableFuture);
  const earnedFee = Math.max(0, Math.floor(input.earnedFeeCents ?? 0));

  return {
    ok: true,
    payableCompletedCents: payableCompleted,
    currentAdjustmentCents: currentAdjustment,
    refundableFutureCents: cappedRefund,
    earnedFeeCents: earnedFee,
    paymentRisk: false,
    explanation: CANCELLATION_REASON_LABELS[input.reason],
    lines: [
      `Completed/approved payable: ${payableCompleted}¢ (schedule total ${scheduled}¢)`,
      currentLine,
      `Refundable held remainder: ${cappedRefund}¢`,
      `Earned platform fee (unchanged): ${earnedFee}¢`,
    ],
  };
}

/** Jurisdiction gate: cancellations that move money require protected payments on. */
export function cancellationAllowedForJurisdiction(input: {
  protectedPaymentsEnabled: boolean;
  fundingStatus: string;
}): { ok: true } | { ok: false; error: string } {
  if (input.fundingStatus === "awaiting_provider") {
    return { ok: true };
  }
  if (!input.protectedPaymentsEnabled && input.fundingStatus === "held") {
    return {
      ok: false,
      error: "Protected payments are off for this jurisdiction — cancelation of held funds is unavailable.",
    };
  }
  if (input.fundingStatus !== "held" && input.fundingStatus !== "payment_risk") {
    return { ok: false, error: "Cancellation applies to awaiting, held, or payment-risk fundings." };
  }
  return { ok: true };
}
