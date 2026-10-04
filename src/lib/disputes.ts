export const OPEN_DISPUTE_STATUSES = ["open", "under_review", "refund_requested", "escalated_provider", "escalated_legal"] as const;

export function disputeIsOpen(status: string) {
  return (OPEN_DISPUTE_STATUSES as readonly string[]).includes(status);
}

/** Dev Addendum §13 reason codes — catalog synced into DisputeReason. */
export const DISPUTE_REASON_CATALOG = [
  { code: "non_delivery", label: "Non-delivery", sortOrder: 1 },
  { code: "quality_scope", label: "Quality / scope mismatch", sortOrder: 2 },
  { code: "missed_deadline", label: "Missed deadline", sortOrder: 3 },
  { code: "unauthorized_revision", label: "Unauthorized revision", sortOrder: 4 },
  { code: "publication_issue", label: "Publication issue", sortOrder: 5 },
  { code: "payment_fraud", label: "Payment / fraud concern", sortOrder: 6 },
  { code: "other", label: "Other", sortOrder: 7 },
] as const;

export type DisputeReasonCode = (typeof DISPUTE_REASON_CATALOG)[number]["code"];

/** Dev Addendum §13 resolution outcomes. */
export const DISPUTE_RESOLUTION_OUTCOMES = [
  "creator_release",
  "brand_refund",
  "split_amount",
  "mutual_settlement",
  "escalate_provider",
  "escalate_legal",
  "withdrawn",
] as const;

export type DisputeResolutionOutcome = (typeof DISPUTE_RESOLUTION_OUTCOMES)[number];

export const DISPUTE_RESOLUTION_OUTCOME_LABELS: Record<DisputeResolutionOutcome, string> = {
  creator_release: "Creator release",
  brand_refund: "Brand refund",
  split_amount: "Split amount",
  mutual_settlement: "Mutual settlement",
  escalate_provider: "Provider escalation",
  escalate_legal: "Legal escalation",
  withdrawn: "Withdrawn",
};

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

export type DisputeDecision =
  | "review"
  | "release"
  | "refund"
  | "partial"
  | "withdraw"
  | "settle"
  | "escalate_provider"
  | "escalate_legal";

export function outcomeForDecision(
  action: DisputeDecision,
): DisputeResolutionOutcome | null {
  if (action === "release") return "creator_release";
  if (action === "refund") return "brand_refund";
  if (action === "partial") return "split_amount";
  if (action === "settle") return "mutual_settlement";
  if (action === "escalate_provider") return "escalate_provider";
  if (action === "escalate_legal") return "escalate_legal";
  if (action === "withdraw") return "withdrawn";
  return null;
}

/** A decision records what ops asked for. It does not move provider-held money. */
export function decideDispute(input: {
  status: string;
  action: DisputeDecision;
  requestedCents: number;
  heldCents: number;
  milestoneCents: number;
  partialAllowed?: boolean;
}):
  | {
      ok: true;
      status: string;
      requestedRefundCents: number | null;
      outcome: DisputeResolutionOutcome | null;
    }
  | { ok: false; error: string } {
  if (!disputeIsOpen(input.status)) return { ok: false, error: "That dispute is already closed." };
  if (input.action === "review") {
    if (input.status !== "open" && input.status !== "escalated_provider" && input.status !== "escalated_legal") {
      return { ok: false, error: "Only an open or escalated dispute can move to review." };
    }
    return { ok: true, status: "under_review", requestedRefundCents: null, outcome: null };
  }
  if (input.action === "withdraw") {
    return { ok: true, status: "withdrawn", requestedRefundCents: null, outcome: "withdrawn" };
  }
  if (input.action === "settle") {
    return {
      ok: true,
      status: "resolved_settlement",
      requestedRefundCents: null,
      outcome: "mutual_settlement",
    };
  }
  if (input.action === "escalate_provider") {
    return {
      ok: true,
      status: "escalated_provider",
      requestedRefundCents: null,
      outcome: "escalate_provider",
    };
  }
  if (input.action === "escalate_legal") {
    return {
      ok: true,
      status: "escalated_legal",
      requestedRefundCents: null,
      outcome: "escalate_legal",
    };
  }
  if (input.action === "release") {
    if (input.status === "refund_requested") {
      return { ok: false, error: "Withdraw the refund request before releasing this milestone." };
    }
    return {
      ok: true,
      status: "resolved_release",
      requestedRefundCents: null,
      outcome: "creator_release",
    };
  }
  const cap = Math.min(input.heldCents, input.milestoneCents);
  if (input.action === "refund") {
    if (cap <= 0) return { ok: false, error: "Nothing is held for a refund." };
    return {
      ok: true,
      status: "refund_requested",
      requestedRefundCents: cap,
      outcome: "brand_refund",
    };
  }
  if (input.partialAllowed === false) {
    return { ok: false, error: "Partial refunds are turned off. Nothing was refunded." };
  }
  if (input.requestedCents <= 0 || input.requestedCents > cap) {
    return { ok: false, error: "A partial refund must be greater than zero and within the held milestone amount." };
  }
  return {
    ok: true,
    status: "refund_requested",
    requestedRefundCents: input.requestedCents,
    outcome: "split_amount",
  };
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
