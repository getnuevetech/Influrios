/** Plain names for background job kinds shown to admins. Unlisted kinds fall back to a readable form. */
const JOB_LABELS: Record<string, string> = {
  milestone_auto_approval: "Milestone auto-approval",
  review_deadline_sweep: "Review deadline reminders",
  dispute_sla_sweep: "Dispute reminders",
  provider_hold_warn_sweep: "Long-held funds warning",
  failed_payout_retry_sweep: "Retry failed payouts",
  funding_recon_sweep: "Funding reconciliation",
  scheduled_release_sweep: "Send approved payouts",
  marketplace_application_expire_sweep: "Expire old applications",
  short_link_schedule_sweep: "Scheduled short-link changes",
  invitation_followup_sweep: "Invitation follow-ups",
  quote_expiry_sweep: "Expire unsigned quotes",
  subscription_renewal_sweep: "Subscription renewals",
  verification_email: "Verification email",
  claim_verification_email: "Profile claim email",
  password_reset_email: "Password reset email",
  collab_notification: "Collaboration email",
  catalog_email: "Email",
  dispute_sla_reminder: "Dispute reminder",
  review_deadline_approaching: "Review deadline reminder",
  provider_hold_period_warning: "Long-held funds warning",
  stale_funding: "Unpaid funding reminder",
  ledger_mismatch: "Ledger mismatch",
  payout_retry: "Payout retry",
};

export function jobLabel(kind: string) {
  if (JOB_LABELS[kind]) return JOB_LABELS[kind];
  const text = kind.replace(/[_.-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Job";
}

export const JOB_STATUS_LABEL: Record<string, string> = {
  succeeded: "Succeeded",
  failed: "Failed",
  queued: "Queued",
  running: "Running",
  pending: "Queued",
};

export function jobWhen(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return `${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago" }).format(date)} CT`;
}
