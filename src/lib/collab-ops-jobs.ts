/**
 * Dev Addendum §16–17 — dispute SLA reminders, provider hold-period warnings,
 * failed payout retry eligibility, funding reconciliation flags, and scheduled release.
 * Pure eligibility helpers; sweeps live in jobs.ts and notify via W3.11 templates.
 */

export const DEFAULT_DISPUTE_SLA_HOURS = 72;
export const DEFAULT_PROVIDER_HOLD_WARN_HOURS = 168; // 7 days
export const DEFAULT_FAILED_PAYOUT_BACKOFF_HOURS = [1, 6, 24, 72] as const;
export const DEFAULT_FAILED_PAYOUT_MAX_ATTEMPTS = 4;
export const DEFAULT_STALE_FUNDING_HOURS = 48;

export const RELEASE_READY_STATUSES = ["approved", "release_scheduled", "release_requested", "payout_failed"] as const;

export function shouldRemindDisputeSla(input: {
  status: string;
  openedAt: Date | string;
  now?: Date;
  slaHours?: number;
}): boolean {
  if (!["open", "under_review", "escalated_provider", "escalated_legal"].includes(input.status)) {
    return false;
  }
  const opened = input.openedAt instanceof Date ? input.openedAt : new Date(input.openedAt);
  if (Number.isNaN(opened.getTime())) return false;
  const now = input.now ?? new Date();
  const hours = input.slaHours ?? DEFAULT_DISPUTE_SLA_HOURS;
  if (!Number.isFinite(hours) || hours <= 0) return false;
  return now.getTime() - opened.getTime() >= hours * 60 * 60 * 1000;
}

export function shouldWarnProviderHold(input: {
  fundingStatus: string;
  heldAt: Date | string | null | undefined;
  now?: Date;
  warnHours?: number;
}): boolean {
  if (input.fundingStatus !== "held") return false;
  if (!input.heldAt) return false;
  const held = input.heldAt instanceof Date ? input.heldAt : new Date(input.heldAt);
  if (Number.isNaN(held.getTime())) return false;
  const now = input.now ?? new Date();
  const hours = input.warnHours ?? DEFAULT_PROVIDER_HOLD_WARN_HOURS;
  if (!Number.isFinite(hours) || hours <= 0) return false;
  return now.getTime() - held.getTime() >= hours * 60 * 60 * 1000;
}

/** Provider-safe: only retry payout_failed milestones with no release booked yet. */
export function shouldRetryFailedPayout(input: {
  milestoneStatus: string;
  hasReleaseLedgerEntry: boolean;
  payoutFailedAt: Date | string | null | undefined;
  payoutRetryCount: number;
  now?: Date;
  backoffHours?: readonly number[];
  maxAttempts?: number;
}): boolean {
  if (input.milestoneStatus !== "payout_failed") return false;
  if (input.hasReleaseLedgerEntry) return false;
  if (!input.payoutFailedAt) return false;
  const failedAt =
    input.payoutFailedAt instanceof Date ? input.payoutFailedAt : new Date(input.payoutFailedAt);
  if (Number.isNaN(failedAt.getTime())) return false;
  const max = input.maxAttempts ?? DEFAULT_FAILED_PAYOUT_MAX_ATTEMPTS;
  if (!Number.isInteger(input.payoutRetryCount) || input.payoutRetryCount < 0) return false;
  if (input.payoutRetryCount >= max) return false;
  const backoff = input.backoffHours ?? DEFAULT_FAILED_PAYOUT_BACKOFF_HOURS;
  const idx = Math.min(input.payoutRetryCount, backoff.length - 1);
  const waitHours = backoff[idx] ?? backoff[backoff.length - 1];
  if (!Number.isFinite(waitHours) || waitHours <= 0) return false;
  const now = input.now ?? new Date();
  return now.getTime() - failedAt.getTime() >= waitHours * 60 * 60 * 1000;
}

export function shouldFlagStaleFundingIntent(input: {
  fundingStatus: string;
  createdAt: Date | string;
  now?: Date;
  staleHours?: number;
}): boolean {
  if (input.fundingStatus !== "awaiting_provider") return false;
  const created = input.createdAt instanceof Date ? input.createdAt : new Date(input.createdAt);
  if (Number.isNaN(created.getTime())) return false;
  const hours = input.staleHours ?? DEFAULT_STALE_FUNDING_HOURS;
  if (!Number.isFinite(hours) || hours <= 0) return false;
  const now = input.now ?? new Date();
  return now.getTime() - created.getTime() >= hours * 60 * 60 * 1000;
}

export function shouldFlagLedgerMismatch(input: {
  balanced: boolean;
  fundingStatus: string;
}): boolean {
  if (!["held", "payment_risk"].includes(input.fundingStatus)) return false;
  return !input.balanced;
}

/** Dev §8 — approve → release_scheduled when authorized and not disputed. */
export function canScheduleMilestoneRelease(input: {
  milestoneStatus: string;
  fundingStatus: string;
  disputeOpen?: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (input.disputeOpen) return { ok: false, error: "Resolve the open dispute before authorizing release." };
  if (input.fundingStatus === "payment_risk") {
    return { ok: false, error: "Payment-risk fundings cannot schedule a release." };
  }
  if (input.fundingStatus !== "held") {
    return { ok: false, error: "Release can be scheduled only while the provider is holding funds." };
  }
  if (input.milestoneStatus !== "approved" && input.milestoneStatus !== "payout_failed") {
    return { ok: false, error: "Only approved milestones can be scheduled for release." };
  }
  return { ok: true };
}

/** True when a release_scheduled milestone is due for provider request. */
export function shouldRequestScheduledRelease(input: {
  milestoneStatus: string;
  releaseScheduledAt: Date | string | null | undefined;
  now?: Date;
}): boolean {
  if (input.milestoneStatus !== "release_scheduled") return false;
  if (!input.releaseScheduledAt) return false;
  const at =
    input.releaseScheduledAt instanceof Date
      ? input.releaseScheduledAt
      : new Date(input.releaseScheduledAt);
  if (Number.isNaN(at.getTime())) return false;
  const now = input.now ?? new Date();
  return now.getTime() >= at.getTime();
}

export function isReleaseReadyMilestoneStatus(status: string) {
  return (RELEASE_READY_STATUSES as readonly string[]).includes(status);
}
