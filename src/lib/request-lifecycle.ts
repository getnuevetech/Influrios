/**
 * Business request delete / withdraw / cancel rules.
 * Eligibility is rechecked at confirmation. This module does not move money.
 */

export const WITHDRAW_REASONS = [
  "Campaign cancelled",
  "Schedule changed",
  "Budget changed",
  "Requirements changed",
  "Other",
] as const;

export type WithdrawReason = (typeof WITHDRAW_REASONS)[number];

export type RequestLifecycleInput = {
  briefStatus: "draft" | "active" | "closed" | "cancelled";
  inviteCount: number;
  pendingInviteCount: number;
  acceptedWithoutAgreementCount: number;
  hasSignedAgreement: boolean;
  hasFundingOrPaymentHistory: boolean;
  collaborationCompleted: boolean;
};

export type RequestDeletePlan =
  | { kind: "delete"; confirm: "remove_draft"; notify: false }
  | { kind: "delete"; confirm: "revoke_pending"; notify: true }
  | { kind: "block"; reason: string; requireWithdrawals: true }
  | { kind: "cancel_settlement"; reason: string }
  | { kind: "archive"; reason: string };

export function requestDeletePlan(input: RequestLifecycleInput): RequestDeletePlan {
  if (input.collaborationCompleted) {
    return { kind: "archive", reason: "Completed collaborations are archived. Agreement, delivery, and financial history stay on record." };
  }
  if (input.hasSignedAgreement || input.hasFundingOrPaymentHistory) {
    return {
      kind: "cancel_settlement",
      reason: "A signed agreement, funded collaboration, or payment history is linked. Open cancellation and settlement instead of deleting.",
    };
  }
  if (input.acceptedWithoutAgreementCount > 0) {
    return {
      kind: "block",
      requireWithdrawals: true,
      reason: "Withdraw each accepted participant with a reason and notification before this request can be deleted.",
    };
  }
  if (input.pendingInviteCount > 0 || input.inviteCount > 0) {
    return { kind: "delete", confirm: "revoke_pending", notify: true };
  }
  if (input.briefStatus === "draft") {
    return { kind: "delete", confirm: "remove_draft", notify: false };
  }
  return { kind: "delete", confirm: "revoke_pending", notify: true };
}

export type WithdrawParticipationInput = {
  invitationStatus: string;
  hasSignedAgreement: boolean;
  hasFundingOrPaymentHistory: boolean;
  alreadyWithdrawn: boolean;
  reason: string;
  message: string;
};

export type WithdrawParticipationPlan =
  | { ok: true; label: "Withdraw participation"; notify: true }
  | { ok: false; error: string };

/** Business-initiated withdrawal of an accepted (or open) invitation. Not “Influencer withdrew.” */
export function withdrawParticipationPlan(input: WithdrawParticipationInput): WithdrawParticipationPlan {
  if (input.alreadyWithdrawn) {
    return { ok: false, error: "This participation was already withdrawn. Nothing was changed." };
  }
  if (input.hasSignedAgreement || input.hasFundingOrPaymentHistory) {
    return {
      ok: false,
      error: "A signed agreement or funding is linked. Use cancellation and settlement instead of withdrawing participation.",
    };
  }
  const status = input.invitationStatus.toUpperCase();
  if (status === "WITHDRAWN" || status === "DECLINED" || status === "EXPIRED") {
    return { ok: false, error: "This invitation is no longer active. Nothing was changed." };
  }
  if (!WITHDRAW_REASONS.includes(input.reason as WithdrawReason)) {
    return { ok: false, error: "Choose a withdrawal reason." };
  }
  if (!input.message.trim()) {
    return { ok: false, error: "Write a message the influencer will see before confirming." };
  }
  return { ok: true, label: "Withdraw participation", notify: true };
}

export function defaultWithdrawMessage(input: {
  businessName: string;
  requestTitle: string;
  reason: string;
}): string {
  return `${input.businessName} has withdrawn your participation in “${input.requestTitle}” (${input.reason}). Your invitation record stays available in Collaborations.`;
}
