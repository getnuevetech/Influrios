/**
 * Dev Addendum §16–17 — dispute SLA reminders and provider hold-period warnings.
 * Pure eligibility helpers; sweeps live in jobs.ts and notify via W3.11 templates.
 */

export const DEFAULT_DISPUTE_SLA_HOURS = 72;
export const DEFAULT_PROVIDER_HOLD_WARN_HOURS = 168; // 7 days

export function shouldRemindDisputeSla(input: {
  status: string;
  openedAt: Date | string;
  now?: Date;
  slaHours?: number;
}): boolean {
  if (!["open", "under_review"].includes(input.status)) return false;
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
