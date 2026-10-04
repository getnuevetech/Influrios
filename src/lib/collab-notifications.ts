/**
 * W3.11 — Collaboration notification event kinds (Dev Addendum §18).
 * Templates use Influencer terminology (not legacy “creator” in user-facing copy).
 */

export const COLLAB_NOTIFICATION_KINDS = [
  "funding_required",
  "funding_successful",
  "funding_failed",
  "milestone_submitted",
  "review_deadline_approaching",
  "revision_requested",
  "milestone_approved",
  "milestone_auto_approved",
  "payout_completed",
  "payout_failed",
  "dispute_opened",
  "dispute_resolved",
  "collaboration_cancelled",
  "refund_completed",
  "payment_risk",
  "change_order_accepted",
  "preexisting_relationship_claimed",
  "provider_jurisdiction_limitation",
  "dispute_sla_reminder",
  "provider_hold_period_warning",
] as const;

export type CollabNotificationKind = (typeof COLLAB_NOTIFICATION_KINDS)[number];

export type CollabNotificationAudience = "business" | "influencer" | "admin" | "both";

export type CollabNotificationTemplate = {
  kind: CollabNotificationKind;
  audience: CollabNotificationAudience;
  subject: string;
  body: string;
};

/** Static templates — placeholders: {{business}}, {{influencer}}, {{title}}, {{milestone}}, {{detail}} */
export const COLLAB_NOTIFICATION_TEMPLATES: Record<CollabNotificationKind, CollabNotificationTemplate> = {
  funding_required: {
    kind: "funding_required",
    audience: "business",
    subject: "Funding required for {{title}}",
    body: "Protected payment funding is required for your collaboration with {{influencer}} ({{title}}). Confirm funding so the Influencer can begin agreed work.",
  },
  funding_successful: {
    kind: "funding_successful",
    audience: "both",
    subject: "Funding confirmed for {{title}}",
    body: "The marketplace provider confirmed protected funding for {{title}} ({{business}} ↔ {{influencer}}). Milestone work can proceed under the accepted plan.",
  },
  funding_failed: {
    kind: "funding_failed",
    audience: "business",
    subject: "Funding failed for {{title}}",
    body: "Funding did not complete for {{title}}. Review provider status or try again. Detail: {{detail}}",
  },
  milestone_submitted: {
    kind: "milestone_submitted",
    audience: "business",
    subject: "Influencer submitted {{milestone}}",
    body: "{{influencer}} submitted milestone “{{milestone}}” on {{title}}. Review, request a revision, or approve within the review window.",
  },
  review_deadline_approaching: {
    kind: "review_deadline_approaching",
    audience: "business",
    subject: "Review deadline approaching — {{milestone}}",
    body: "The review window for “{{milestone}}” on {{title}} is ending soon. Approve, request a permitted revision, or open a dispute.",
  },
  revision_requested: {
    kind: "revision_requested",
    audience: "influencer",
    subject: "Revision requested on {{milestone}}",
    body: "{{business}} requested a revision on “{{milestone}}” for {{title}}. Detail: {{detail}}",
  },
  milestone_approved: {
    kind: "milestone_approved",
    audience: "both",
    subject: "Milestone approved — {{milestone}}",
    body: "“{{milestone}}” on {{title}} was approved. Usage rights stay pending until payment release unless the deal says otherwise.",
  },
  milestone_auto_approved: {
    kind: "milestone_auto_approved",
    audience: "both",
    subject: "Milestone auto-approved — {{milestone}}",
    body: "“{{milestone}}” on {{title}} was auto-approved after the review window. The Influencer payout can proceed once the provider releases funds.",
  },
  payout_completed: {
    kind: "payout_completed",
    audience: "influencer",
    subject: "Payout released — {{milestone}}",
    body: "Payment for “{{milestone}}” on {{title}} was released to the Influencer payout path. Usage rights for that milestone are now active by default.",
  },
  payout_failed: {
    kind: "payout_failed",
    audience: "admin",
    subject: "Payout failed — {{title}}",
    body: "A payout failed for {{title}} ({{influencer}}). Detail: {{detail}}",
  },
  dispute_opened: {
    kind: "dispute_opened",
    audience: "both",
    subject: "Dispute opened on {{milestone}}",
    body: "A dispute was opened on “{{milestone}}” for {{title}} ({{business}} ↔ {{influencer}}). Release for that milestone is paused while evidence is reviewed.",
  },
  dispute_resolved: {
    kind: "dispute_resolved",
    audience: "both",
    subject: "Dispute resolved — {{milestone}}",
    body: "The dispute on “{{milestone}}” for {{title}} was resolved. Detail: {{detail}}",
  },
  collaboration_cancelled: {
    kind: "collaboration_cancelled",
    audience: "both",
    subject: "Collaboration cancelled — {{title}}",
    body: "The collaboration {{title}} between {{business}} and {{influencer}} was cancelled. Detail: {{detail}}",
  },
  refund_completed: {
    kind: "refund_completed",
    audience: "both",
    subject: "Refund completed — {{title}}",
    body: "A refund was completed for {{title}}. Detail: {{detail}}",
  },
  payment_risk: {
    kind: "payment_risk",
    audience: "both",
    subject: "Payment risk — {{title}}",
    body: "Protected payment for {{title}} ({{business}} ↔ {{influencer}}) entered payment-risk. Releases are paused until ops or the provider resolves the chargeback/reversal. Detail: {{detail}}",
  },
  change_order_accepted: {
    kind: "change_order_accepted",
    audience: "both",
    subject: "Change order accepted — {{title}}",
    body: "A change order was accepted for {{title}}. The new commercial snapshot is now in force.",
  },
  preexisting_relationship_claimed: {
    kind: "preexisting_relationship_claimed",
    audience: "admin",
    subject: "Pre-existing relationship claim — {{business}} / {{influencer}}",
    body: "A pre-existing relationship claim was filed for {{business}} ↔ {{influencer}}. Detail: {{detail}}",
  },
  provider_jurisdiction_limitation: {
    kind: "provider_jurisdiction_limitation",
    audience: "both",
    subject: "Provider or jurisdiction limitation — {{title}}",
    body: "A provider or jurisdiction limitation affects {{title}}. Detail: {{detail}}",
  },
  dispute_sla_reminder: {
    kind: "dispute_sla_reminder",
    audience: "both",
    subject: "Dispute SLA reminder — {{milestone}}",
    body: "An open dispute on “{{milestone}}” for {{title}} ({{business}} ↔ {{influencer}}) is past the response SLA. Detail: {{detail}}",
  },
  provider_hold_period_warning: {
    kind: "provider_hold_period_warning",
    audience: "admin",
    subject: "Provider hold period warning — {{title}}",
    body: "Protected funds for {{title}} ({{business}} ↔ {{influencer}}) have been held past the warning window. Detail: {{detail}}",
  },
};

export type CollabNotificationVars = {
  business?: string;
  influencer?: string;
  title?: string;
  milestone?: string;
  detail?: string;
};

export function isCollabNotificationKind(value: string): value is CollabNotificationKind {
  return (COLLAB_NOTIFICATION_KINDS as readonly string[]).includes(value);
}

export function renderCollabNotification(
  kind: CollabNotificationKind,
  vars: CollabNotificationVars,
): { subject: string; text: string; audience: CollabNotificationAudience } {
  const template = COLLAB_NOTIFICATION_TEMPLATES[kind];
  const replace = (input: string) =>
    input
      .replaceAll("{{business}}", vars.business?.trim() || "the business")
      .replaceAll("{{influencer}}", vars.influencer?.trim() || "the Influencer")
      .replaceAll("{{title}}", vars.title?.trim() || "your collaboration")
      .replaceAll("{{milestone}}", vars.milestone?.trim() || "a milestone")
      .replaceAll("{{detail}}", vars.detail?.trim() || "—");
  return {
    subject: replace(template.subject),
    text: replace(template.body),
    audience: template.audience,
  };
}

/** Guard: user-facing notification copy must not use legacy “creator” as the party noun. */
export function usesInfluencerTerminology(kind: CollabNotificationKind): boolean {
  const template = COLLAB_NOTIFICATION_TEMPLATES[kind];
  const blob = `${template.subject} ${template.body}`.toLowerCase();
  if (blob.includes(" the creator") || blob.includes("creator payout") || blob.includes("creator can")) {
    return false;
  }
  return blob.includes("influencer") || !blob.includes("creator");
}

/** Default lead time before `autoApproveAt` for review-deadline notices (Dev §18). */
export const REVIEW_DEADLINE_LEAD_HOURS = 12;

/**
 * True when a submitted milestone’s review window is inside the lead window
 * and has not already passed (auto-approve still in the future).
 */
export function shouldNotifyReviewDeadline(input: {
  milestoneStatus: string;
  autoApproveAt: Date | string | null | undefined;
  now?: Date;
  leadHours?: number;
}): boolean {
  if (input.milestoneStatus !== "submitted") return false;
  if (!input.autoApproveAt) return false;
  const deadline = input.autoApproveAt instanceof Date ? input.autoApproveAt : new Date(input.autoApproveAt);
  if (Number.isNaN(deadline.getTime())) return false;
  const now = input.now ?? new Date();
  if (deadline.getTime() <= now.getTime()) return false;
  const leadMs = (input.leadHours ?? REVIEW_DEADLINE_LEAD_HOURS) * 60 * 60 * 1000;
  return deadline.getTime() - now.getTime() <= leadMs;
}

/** Map marketplace provider event types onto collab notification kinds. */
export function collabKindForMarketplaceEvent(
  eventType: string,
): CollabNotificationKind | null {
  switch (eventType) {
    case "funding.held":
      return "funding_successful";
    case "funding.failed":
      return "funding_failed";
    case "funding.chargeback":
      return "payment_risk";
    case "payout.released":
      return "payout_completed";
    case "payout.refunded":
      return "refund_completed";
    case "payout.failed":
      return "payout_failed";
    default:
      return null;
  }
}
