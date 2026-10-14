import type { KycTypeCode } from "@/lib/kyc-types";
import type { PayoutOnboardingChoice } from "@/lib/payout-readiness";

export type ReceivePaymentsStatus = "ready" | "action_needed" | "unavailable";

export type ReceivePaymentsAction =
  | { kind: "link"; href: string; label: string }
  | { kind: "stripe"; label: string }
  | { kind: "provider"; label: string };

export type ReceivePaymentsStep = {
  id: "identity" | "payout_method";
  label: string;
  detail: string;
  done: boolean;
  pending: boolean;
  action: ReceivePaymentsAction | null;
};

export type ReceivePaymentsView = {
  status: ReceivePaymentsStatus;
  statusLabel: string;
  summary: string;
  steps: ReceivePaymentsStep[];
  primaryAction: ReceivePaymentsAction | null;
};

export type KycSubmissionState = "none" | "draft" | "submitted" | "pending_gateway" | "verified" | "rejected";

/**
 * Member-facing receive-payments checklist.
 * Driven by corridor KYC type + collection rail, without exposing country codes,
 * provider brands, or account ids in labels.
 */
export function buildReceivePaymentsView(input: {
  rail: PayoutOnboardingChoice | null;
  kycType: KycTypeCode | null;
  identityVerified: boolean;
  kycSubmission: KycSubmissionState;
  hasStripeConnectAccount: boolean;
  hasProviderAccount: boolean;
  hasVerifiedPayoutMethod: boolean;
}): ReceivePaymentsView {
  const rail = input.rail;
  const corridorReady = Boolean(rail && rail.rail !== "none");
  const routeUnavailable = Boolean(rail && rail.rail === "none");

  const identity = identityStep({
    kycType: input.kycType,
    identityVerified: input.identityVerified,
    kycSubmission: input.kycSubmission,
  });

  const payout = payoutMethodStep({
    rail,
    hasStripeConnectAccount: input.hasStripeConnectAccount,
    hasProviderAccount: input.hasProviderAccount,
    hasVerifiedPayoutMethod: input.hasVerifiedPayoutMethod,
  });

  const steps = [identity, payout];
  const allDone = identity.done && payout.done && corridorReady;
  const status: ReceivePaymentsStatus = allDone
    ? "ready"
    : routeUnavailable && identity.done
      ? "unavailable"
      : "action_needed";

  const primaryAction =
    status === "ready"
      ? null
      : !identity.done
        ? identity.action
        : status === "unavailable"
          ? null
          : payout.action;

  return {
    status,
    statusLabel: status === "ready" ? "Ready" : status === "unavailable" ? "Unavailable" : "Action needed",
    summary:
      status === "ready"
        ? "You’re set up to receive collaboration payments."
        : status === "unavailable"
          ? rail?.emptyHint?.trim() ||
            "Payouts aren’t available for your region yet. Check back soon."
          : !identity.done
            ? identity.detail
            : payout.detail,
    steps,
    primaryAction,
  };
}

function identityStep(input: {
  kycType: KycTypeCode | null;
  identityVerified: boolean;
  kycSubmission: KycSubmissionState;
}): ReceivePaymentsStep {
  if (input.identityVerified || input.kycSubmission === "verified") {
    return {
      id: "identity",
      label: "Verify your identity",
      detail: "Identity verified.",
      done: true,
      pending: false,
      action: null,
    };
  }

  if (!input.kycType) {
    return {
      id: "identity",
      label: "Verify your identity",
      detail: "Identity verification isn’t set up for your region yet.",
      done: false,
      pending: false,
      action: null,
    };
  }

  if (input.kycType === "government_id") {
    if (input.kycSubmission === "submitted") {
      return {
        id: "identity",
        label: "Verify your identity",
        detail: "Document review is in progress.",
        done: false,
        pending: true,
        action: { kind: "link", href: "/dashboard/kyc", label: "View identity status" },
      };
    }
    if (input.kycSubmission === "rejected") {
      return {
        id: "identity",
        label: "Verify your identity",
        detail: "Your documents need another look. Resubmit to continue.",
        done: false,
        pending: false,
        action: { kind: "link", href: "/dashboard/kyc", label: "Resubmit documents" },
      };
    }
    return {
      id: "identity",
      label: "Verify your identity",
      detail: "Upload the required ID documents to get paid.",
      done: false,
      pending: false,
      action: { kind: "link", href: "/dashboard/kyc", label: "Upload documents" },
    };
  }

  // gateway KYC
  if (input.kycSubmission === "pending_gateway") {
    return {
      id: "identity",
      label: "Verify your identity",
      detail: "Finish the identity check with your payment provider.",
      done: false,
      pending: true,
      action: { kind: "link", href: "/dashboard/kyc", label: "Continue identity check" },
    };
  }
  return {
    id: "identity",
    label: "Verify your identity",
    detail: "Complete identity verification with your payment provider.",
    done: false,
    pending: false,
    action: { kind: "link", href: "/dashboard/kyc", label: "Verify identity" },
  };
}

function payoutMethodStep(input: {
  rail: PayoutOnboardingChoice | null;
  hasStripeConnectAccount: boolean;
  hasProviderAccount: boolean;
  hasVerifiedPayoutMethod: boolean;
}): ReceivePaymentsStep {
  const rail = input.rail;

  if (!rail || rail.rail === "none") {
    const local =
      rail?.collectionProviderCode === "flutterwave" || rail?.collectionProviderCode === "mpesa";
    if (local && input.hasVerifiedPayoutMethod) {
      return {
        id: "payout_method",
        label: "Add where you get paid",
        detail: "Payout method on file.",
        done: true,
        pending: false,
        action: null,
      };
    }
    return {
      id: "payout_method",
      label: "Add where you get paid",
      detail:
        rail?.emptyHint?.trim() ||
        "Payout setup opens here when your region is ready.",
      done: false,
      pending: false,
      action: null,
    };
  }

  if (rail.showStripe) {
    if (input.hasStripeConnectAccount) {
      return {
        id: "payout_method",
        label: "Add where you get paid",
        detail: "Payout account on file. Updating it does not send a payout.",
        done: true,
        pending: false,
        action: { kind: "stripe", label: "Update payout account" },
      };
    }
    return {
      id: "payout_method",
      label: "Add where you get paid",
      detail: "Set up the account that receives collaboration payments.",
      done: false,
      pending: false,
      action: { kind: "stripe", label: "Set up payout account" },
    };
  }

  if (rail.showProvider) {
    if (input.hasProviderAccount) {
      return {
        id: "payout_method",
        label: "Add where you get paid",
        detail: "Payout account on file. Confirming it does not send a payout.",
        done: true,
        pending: false,
        action: { kind: "provider", label: "Update payout account" },
      };
    }
    return {
      id: "payout_method",
      label: "Add where you get paid",
      detail: "Set up the account that receives collaboration payments.",
      done: false,
      pending: false,
      action: { kind: "provider", label: "Set up payout account" },
    };
  }

  if (input.hasVerifiedPayoutMethod) {
    return {
      id: "payout_method",
      label: "Add where you get paid",
      detail: "Payout method on file.",
      done: true,
      pending: false,
      action: null,
    };
  }

  return {
    id: "payout_method",
    label: "Add where you get paid",
    detail: "Payout details will be requested when your region’s payout method is ready.",
    done: false,
    pending: false,
    action: null,
  };
}
