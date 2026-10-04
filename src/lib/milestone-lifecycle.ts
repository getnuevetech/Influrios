/**
 * W3.5 — Milestone lifecycle depth (Dev Addendum §8, §22.5–6).
 * Review windows and revision limits are snapshotted onto milestones at prefund;
 * exhausting revisions requires a change order or dispute (never silent scope expansion).
 */

/** Internal ledger statuses ↔ Dev §8 commercial labels (display / audit). */
export const MILESTONE_LIFECYCLE_LABELS = {
  pending: "IN_PROGRESS",
  submitted: "SUBMITTED",
  approved: "APPROVED",
  released: "RELEASED",
  refunded: "CANCELLED",
} as const;

export type MilestoneLedgerStatus = keyof typeof MILESTONE_LIFECYCLE_LABELS;

export function milestoneLifecycleLabel(status: string): string {
  const key = status as MilestoneLedgerStatus;
  return MILESTONE_LIFECYCLE_LABELS[key] ?? status.toUpperCase();
}

export type LifecycleSnapshotInput = {
  /** Accepted financial plan override (highest priority). */
  planReviewWindowHours?: number | null;
  planRevisionLimit?: number | null;
  /** Jurisdiction override when set. */
  jurisdictionReviewWindowHours?: number | null;
  jurisdictionMaxRevisions?: number | null;
  /** Marketplace settings defaults. */
  settingsReviewWindowHours?: number | null;
  settingsMaxRevisions?: number | null;
};

export type LifecycleSnapshot = {
  reviewWindowHours: number;
  revisionLimit: number;
  source: "financial_plan" | "jurisdiction" | "marketplace_settings";
};

function positiveInt(value: number | null | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  const n = Math.round(value);
  return n >= 0 ? n : fallback;
}

/**
 * Resolve review window + revision limit for a new funding.
 * Priority: financial plan → jurisdiction → marketplace settings (Dev §8 snapshot rule).
 */
export function resolveLifecycleSnapshot(input: LifecycleSnapshotInput): LifecycleSnapshot {
  const settingsWindow = positiveInt(input.settingsReviewWindowHours, 72);
  const settingsRevisions = positiveInt(input.settingsMaxRevisions, 2);

  const planWindow =
    input.planReviewWindowHours != null && Number.isFinite(input.planReviewWindowHours)
      ? Math.round(input.planReviewWindowHours)
      : null;
  const planRevisions =
    input.planRevisionLimit != null && Number.isFinite(input.planRevisionLimit)
      ? Math.round(input.planRevisionLimit)
      : null;

  if (planWindow != null && planWindow >= 0 && planRevisions != null && planRevisions >= 0) {
    return {
      reviewWindowHours: planWindow || settingsWindow,
      revisionLimit: planRevisions,
      source: "financial_plan",
    };
  }

  const jurWindow =
    input.jurisdictionReviewWindowHours != null && Number.isFinite(input.jurisdictionReviewWindowHours)
      ? Math.round(input.jurisdictionReviewWindowHours)
      : null;
  const jurRevisions =
    input.jurisdictionMaxRevisions != null && Number.isFinite(input.jurisdictionMaxRevisions)
      ? Math.round(input.jurisdictionMaxRevisions)
      : null;

  if (jurWindow != null || jurRevisions != null) {
    return {
      reviewWindowHours: jurWindow != null && jurWindow >= 0 ? jurWindow || settingsWindow : settingsWindow,
      revisionLimit: jurRevisions != null && jurRevisions >= 0 ? jurRevisions : settingsRevisions,
      source: "jurisdiction",
    };
  }

  return {
    reviewWindowHours: settingsWindow,
    revisionLimit: settingsRevisions,
    source: "marketplace_settings",
  };
}

export const REVISION_EXHAUSTED_MESSAGE =
  "This milestone has used its revision limit. Open a dispute or request a change order — revisions cannot silently expand scope.";

export type RevisionExhaustedNext = "change_order_or_dispute";

/** §22.6 — extra revisions after the limit require change order or dispute. */
export function revisionLimitExhausted(input: {
  revisionCount: number;
  revisionLimit: number;
}): { exhausted: true; next: RevisionExhaustedNext; error: string } | { exhausted: false } {
  if (!Number.isInteger(input.revisionCount) || !Number.isInteger(input.revisionLimit)) {
    return { exhausted: false };
  }
  if (input.revisionCount >= input.revisionLimit) {
    return { exhausted: true, next: "change_order_or_dispute", error: REVISION_EXHAUSTED_MESSAGE };
  }
  return { exhausted: false };
}
