/**
 * W4 / Platform Spec R073 — managed introduction ≠ contracted protected payment.
 * Intros are facilitation records; protected milestone funding requires an accepted
 * collaboration with a fundable service level (typically contracted / managed_campaign).
 */

import { asServiceLevel } from "@/lib/collaboration-fees";

export const MATCHING_PRODUCT_BOUNDARY = {
  introLabel: "Managed introduction",
  contractedLabel: "Contracted protected payment",
  summary:
    "A managed introduction connects parties. It is not a funded collaboration and does not hold or release protected payments.",
  introFeePaidLabel: "Intro fee settled",
  introFeePaidHint:
    "Means the introduction service fee was settled — not that a collaboration is Fully Funded under protected payments.",
  nextStepHint:
    "To fund milestones, start the contract wizard with a fundable service level after both parties agree.",
} as const;

/** Service levels that may create CollaborationFunding / protected holds. */
export const FUNDABLE_SERVICE_LEVELS = [
  "contracted",
  "managed_campaign",
  "managed_intro",
] as const;

export function isFundableServiceLevel(level: string): boolean {
  const normalized = asServiceLevel(level);
  return (FUNDABLE_SERVICE_LEVELS as readonly string[]).includes(normalized);
}

/**
 * Discovery / platform_match / unknown levels are matching-only — never imply a hold.
 * managed_intro may bill an intro fee but still must not be confused with Fully Funded.
 */
export function matchingStageImpliesProtectedPayment(input: {
  introStatus?: string | null;
  serviceLevel?: string | null;
}): boolean {
  if (input.introStatus && input.introStatus !== "paid") return false;
  // Even "paid" intro status is intro-fee settlement, not protected funding.
  if (input.introStatus === "paid") return false;
  const level = input.serviceLevel ? asServiceLevel(input.serviceLevel) : "";
  return level === "contracted" || level === "managed_campaign";
}

export function introStatusDisplayLabel(status: string): string {
  if (status === "paid") return MATCHING_PRODUCT_BOUNDARY.introFeePaidLabel;
  return status.replaceAll("_", " ");
}

export function assertIntroNotProtectedPayment(input: {
  claimingFullyFunded?: boolean;
  claimingProviderHold?: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (input.claimingFullyFunded || input.claimingProviderHold) {
    return {
      ok: false,
      error:
        "Managed introductions are not protected payments. Use the contract wizard to fund a collaboration.",
    };
  }
  return { ok: true };
}
