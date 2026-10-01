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
  partialAllowed?: boolean;
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
  if (input.partialAllowed === false) {
    return { ok: false, error: "Partial refunds are turned off. Nothing was refunded." };
  }
  if (input.requestedCents <= 0 || input.requestedCents > cap) {
    return { ok: false, error: "A partial refund must be greater than zero and within the held milestone amount." };
  }
  return { ok: true, status: "refund_requested", requestedRefundCents: input.requestedCents };
}

/** Extra evidence is allowed only while the dispute is open and under the copied cap. */
export function canAddEvidence(input: { status: string; evidenceCount: number; evidenceLimit: number }) {
  if (!disputeIsOpen(input.status)) return { ok: false as const, error: "That dispute is closed." };
  if (!Number.isInteger(input.evidenceCount) || input.evidenceCount < 0) {
    return { ok: false as const, error: "That dispute cannot take more evidence." };
  }
  if (!Number.isInteger(input.evidenceLimit) || input.evidenceLimit < 0) {
    return { ok: false as const, error: "That dispute cannot take more evidence." };
  }
  if (input.evidenceCount >= input.evidenceLimit) {
    return { ok: false as const, error: "This dispute has used its evidence limit." };
  }
  return { ok: true as const };
}

/** A stored link is https only. An empty value means the note has no link. The server does not fetch it. */
export function evidenceLink(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const text = raw.trim();
  if (!text) return { ok: true, url: "" };
  if (text.length > 300) return { ok: false, error: "That link is too long." };
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return { ok: false, error: "Use an https link." };
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || !parsed.hostname) {
    return { ok: false, error: "Use an https link." };
  }
  return { ok: true, url: parsed.toString() };
}

export function disputeStatusAfterRefund(input: { requestedCents: number | null; refundedCents: number; milestoneCents: number }) {
  if (input.requestedCents == null || input.refundedCents <= 0 || input.refundedCents > input.requestedCents) return null;
  if (input.refundedCents >= input.milestoneCents) return "resolved_refund" as const;
  return "resolved_partial" as const;
}
