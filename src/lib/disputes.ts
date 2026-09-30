export const OPEN_DISPUTE_STATUSES = ["open", "under_review", "refund_requested"] as const;

export function disputeIsOpen(status: string) {
  return (OPEN_DISPUTE_STATUSES as readonly string[]).includes(status);
}

export function canOpenMilestoneDispute(input: {
  fundingStatus: string;
  milestoneStatus: string;
  alreadyOpen: boolean;
  hasReason: boolean;
}) {
  if (!input.hasReason) return { ok: false as const, error: "Choose a dispute reason." };
  if (input.alreadyOpen) return { ok: false as const, error: "That milestone already has an open dispute." };
  if (input.fundingStatus !== "held") {
    return { ok: false as const, error: "Open a dispute after the provider confirms the prefund." };
  }
  if (input.milestoneStatus === "released" || input.milestoneStatus === "refunded") {
    return { ok: false as const, error: "That milestone is already settled." };
  }
  return { ok: true as const };
}

export function canCancelUnconfirmed(input: { fundingStatus: string; cancelUnconfirmed: boolean }) {
  if (!input.cancelUnconfirmed) {
    return { ok: false as const, error: "Cancelling an unconfirmed prefund is turned off." };
  }
  if (input.fundingStatus !== "awaiting_provider") {
    return {
      ok: false as const,
      error: "This prefund is already with the provider. Open a dispute to request a refund.",
    };
  }
  return { ok: true as const };
}

export type DisputeDecision = "review" | "release" | "refund" | "partial" | "withdraw";

/** A decision records what ops asked for. It does not move provider-held money. */
export function decideDispute(input: {
  status: string;
  action: DisputeDecision;
  requestedCents: number;
  heldCents: number;
  milestoneCents: number;
}):
  | { ok: true; status: string; requestedRefundCents: number | null }
  | { ok: false; error: string } {
  if (!disputeIsOpen(input.status)) return { ok: false, error: "That dispute is already closed." };
  if (input.action === "review") {
    if (input.status !== "open") return { ok: false, error: "Only an open dispute can move to review." };
    return { ok: true, status: "under_review", requestedRefundCents: null };
  }
  if (input.action === "withdraw") {
    return { ok: true, status: "withdrawn", requestedRefundCents: null };
  }
  if (input.action === "release") {
    if (input.status === "refund_requested") {
      return { ok: false, error: "Withdraw the refund request before releasing this milestone." };
    }
    return { ok: true, status: "resolved_release", requestedRefundCents: null };
  }
  const cap = Math.min(input.heldCents, input.milestoneCents);
  if (input.action === "refund") {
    if (cap <= 0) return { ok: false, error: "Nothing is held for a refund." };
    return { ok: true, status: "refund_requested", requestedRefundCents: cap };
  }
  if (input.requestedCents <= 0 || input.requestedCents > cap) {
    return { ok: false, error: "A partial refund must be greater than zero and within the held milestone amount." };
  }
  return { ok: true, status: "refund_requested", requestedRefundCents: input.requestedCents };
}

export function disputeStatusAfterRefund(input: { requestedCents: number | null; refundedCents: number; milestoneCents: number }) {
  if (input.requestedCents == null || input.refundedCents <= 0 || input.refundedCents > input.requestedCents) return null;
  if (input.refundedCents >= input.milestoneCents) return "resolved_refund" as const;
  return "resolved_partial" as const;
}
