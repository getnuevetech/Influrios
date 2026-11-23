/** Customer-facing payout states (master-spec 2.1). Pure: safe to import anywhere. */

export type PayoutState =
  | "setup_required"
  | "verification_pending"
  | "ready"
  | "action_required"
  | "not_available"
  | "status_unavailable";

export type PayoutStateView = {
  state: PayoutState;
  label: string;
  message: string;
  /** Primary action, or null when the influencer has nothing to do. */
  action: { label: string; href: string } | null;
  /** Counts toward the Earnings badge (only while collaborations are active). */
  needsAction: boolean;
};

/**
 * Six payout states (master-spec 2.1). A saved account alone is never Ready: identity must be verified
 * and the provider must report the payout account verified. Pending never asks for finished steps.
 */
export function payoutStateFrom(input: {
  countryCode: string | null;
  corridorActive: boolean;
  routeReady: boolean;
  identityVerified: boolean;
  identitySubmitted?: boolean;
  identityRejected?: boolean;
  primaryStatus: string | null;
  secondaryStatus?: string | null;
  accountOnFile: boolean;
  payoutVerified: boolean;
}): PayoutState {
  if (input.countryCode && (!input.corridorActive || !input.routeReady)) return "not_available";
  if (input.identityVerified && input.payoutVerified) return "ready";
  if (input.identityRejected || input.primaryStatus === "REJECTED") return "action_required";
  const identityDoneOrWaiting = input.identityVerified || Boolean(input.identitySubmitted);
  const payoutDoneOrWaiting = input.payoutVerified || input.primaryStatus === "PENDING" || input.secondaryStatus === "PENDING";
  if (identityDoneOrWaiting && payoutDoneOrWaiting && input.accountOnFile) return "verification_pending";
  return "setup_required";
}

export function payoutStateView(state: PayoutState, input?: { country?: string | null; method?: string | null }): PayoutStateView {
  switch (state) {
    case "ready":
      return {
        state,
        label: "Ready",
        message: `You can receive payouts${input?.method ? ` to ${input.method}` : ""}.`,
        action: null,
        needsAction: false,
      };
    case "verification_pending":
      return {
        state,
        label: "In review",
        message: "We're checking your details. You don't need to do anything right now. Check Earnings & Payouts for the latest status.",
        action: null,
        needsAction: false,
      };
    case "action_required":
      return {
        state,
        label: "Action required",
        message: "Your payout provider needs one more detail before payouts can be sent.",
        action: { label: "Resolve now", href: "/creator/earnings#payouts" },
        needsAction: true,
      };
    case "not_available":
      return {
        state,
        label: "Not available",
        message: `Collaboration payouts aren't available in ${input?.country || "your country"} yet.`,
        action: null,
        needsAction: false,
      };
    case "status_unavailable":
      return {
        state,
        label: "Status unavailable",
        message: "We can't check your payout status right now. Please try again in a moment.",
        action: null,
        needsAction: false,
      };
    default:
      return {
        state: "setup_required",
        label: "Set up payouts",
        message: "Add your identity and payout account to receive collaboration payouts.",
        action: { label: "Set up payouts", href: "/creator/earnings#payouts" },
        needsAction: true,
      };
  }
}

