/**
 * Launch-default entitlements. Admin overrides belong in EntitlementPlan.limitsJson.
 * UI and API must read effective entitlements — never hard-code plan name checks.
 */
export type PlanCode = "STARTER" | "PLUS" | "PRO";

export type EntitlementLimits = {
  specialtiesMax: number;
  socialLinksMax: number;
  portfolioMax: number;
  shortlink: boolean;
  customAlias: boolean;
  standardQr: boolean;
  dynamicQr: boolean;
  contactInquiry: "none" | "limited" | "full";
  collabCta: boolean;
  analytics: "views" | "standard" | "advanced";
  themes: "default" | "limited" | "full";
  platformBranding: "visible" | "reduced" | "minimal";
  mediaKit: boolean;
  leadTracking: boolean;
};

export const PLAN_ENTITLEMENTS: Record<PlanCode, EntitlementLimits> = {
  STARTER: {
    specialtiesMax: 1,
    socialLinksMax: 1,
    portfolioMax: 0,
    shortlink: false,
    customAlias: false,
    standardQr: false,
    dynamicQr: false,
    contactInquiry: "limited",
    collabCta: false,
    analytics: "views",
    themes: "default",
    platformBranding: "visible",
    mediaKit: false,
    leadTracking: false,
  },
  PLUS: {
    specialtiesMax: 3,
    socialLinksMax: 4,
    portfolioMax: 6,
    shortlink: true,
    customAlias: false,
    standardQr: true,
    dynamicQr: false,
    contactInquiry: "full",
    collabCta: true,
    analytics: "standard",
    themes: "limited",
    platformBranding: "reduced",
    mediaKit: false,
    leadTracking: false,
  },
  PRO: {
    specialtiesMax: 8,
    socialLinksMax: 8,
    portfolioMax: 24,
    shortlink: true,
    customAlias: true,
    standardQr: true,
    dynamicQr: true,
    contactInquiry: "full",
    collabCta: true,
    analytics: "advanced",
    themes: "full",
    platformBranding: "minimal",
    mediaKit: true,
    leadTracking: true,
  },
};

export function getEntitlements(plan: PlanCode): EntitlementLimits {
  return PLAN_ENTITLEMENTS[plan];
}
