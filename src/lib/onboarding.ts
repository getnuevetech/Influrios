import { decideCount, PLAN_ENTITLEMENTS, type EntitlementLimits, type PlanCode } from "@/lib/entitlements";

export type OnboardingStage = "draft" | "claimed" | "verified" | "published";

export type CompletionRule = {
  key: string;
  label: string;
  hint: string;
  weight: number;
};

export type CompletionSubject = {
  stage: OnboardingStage;
  bio: string;
  locationCity: string;
  locationCountry: string;
  specialties: string[];
};

export const DEFAULT_COMPLETION_RULES: CompletionRule[] = [
  {
    key: "claimed",
    label: "Claim ownership",
    hint: "Attach your email and take ownership of this draft",
    weight: 20,
  },
  {
    key: "email_verified",
    label: "Verify email",
    hint: "Confirm the demo code. This does not verify the social account.",
    weight: 25,
  },
  {
    key: "published",
    label: "Publish Starter card",
    hint: "Make the card live on Discover and at /c/{slug}",
    weight: 25,
  },
  {
    key: "bio",
    label: "Write a real bio",
    hint: "Replace the draft placeholder bio",
    weight: 10,
  },
  {
    key: "location",
    label: "Set real location",
    hint: "City and country help brands find you",
    weight: 10,
  },
  {
    key: "specialty",
    label: "Confirm specialty",
    hint: "Pick the niche you actually influence",
    weight: 10,
  },
];

export function completionItemDone(rule: CompletionRule, subject: CompletionSubject): boolean {
  switch (rule.key) {
    case "claimed":
      return subject.stage !== "draft";
    case "email_verified":
    case "verified":
      return subject.stage === "verified" || subject.stage === "published";
    case "published":
      return subject.stage === "published";
    case "bio":
      return subject.bio.length > 80 && !subject.bio.includes("Draft Influencer Card");
    case "location":
      return subject.locationCity !== "Your city" && subject.locationCountry !== "Your country";
    case "specialty":
      return subject.specialties.length > 0 && subject.specialties[0] !== "lifestyle";
    default:
      return false;
  }
}

export function evaluateCompletion(subject: CompletionSubject, rules: CompletionRule[] = DEFAULT_COMPLETION_RULES) {
  const items = rules.map((rule) => ({
    id: rule.key,
    label: rule.label,
    hint: rule.hint,
    weight: rule.weight,
    done: completionItemDone(rule, subject),
  }));
  const total = items.reduce((sum, item) => sum + item.weight, 0) || 1;
  const earned = items.reduce((sum, item) => sum + (item.done ? item.weight : 0), 0);
  return { score: Math.round((earned / total) * 100), items };
}

/** Public directory objects must not carry private contact fields. */
export function toPublicProfile<T extends { email?: string }>(creator: T): Omit<T, "email"> {
  const rest = { ...creator };
  delete rest.email;
  return rest;
}

/**
 * Starter allows one social. A second add returns the feature key, limit, and upgrade plan.
 */
export function secondSocialDecision(
  currentSocials: number,
  limits: EntitlementLimits = PLAN_ENTITLEMENTS.STARTER,
  plan: PlanCode = "STARTER",
) {
  return decideCount(limits, "socialLinksMax", currentSocials + 1, plan);
}
