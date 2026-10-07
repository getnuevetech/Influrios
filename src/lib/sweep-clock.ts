import { timingSafeEqual } from "crypto";

/** Kinds the host cron enqueues. One open row per kind. */
export const SWEEP_JOB_KINDS = [
  "milestone_auto_approval",
  "review_deadline_sweep",
  "dispute_sla_sweep",
  "provider_hold_warn_sweep",
  "failed_payout_retry_sweep",
  "funding_recon_sweep",
  "scheduled_release_sweep",
  "marketplace_application_expire_sweep",
  "recurring_cycle_sweep",
  "short_link_schedule_sweep",
] as const;

export type SweepJobKind = (typeof SWEEP_JOB_KINDS)[number];

export function isSweepJobKind(kind: string): kind is SweepJobKind {
  return (SWEEP_JOB_KINDS as readonly string[]).includes(kind);
}

/** Bearer token must match CRON_SECRET. Length mismatch never throws. */
export function cronAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  const presented = Buffer.from(token);
  const expected = Buffer.from(secret);
  if (presented.length !== expected.length || presented.length === 0) return false;
  return timingSafeEqual(presented, expected);
}
