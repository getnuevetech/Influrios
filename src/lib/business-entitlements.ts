/**
 * Business-side entitlements (Phase 3).
 * Creator plans stay in PLAN_ENTITLEMENTS; businesses use these.
 */
export type BusinessPlanCode = "BUSINESS_FREE" | "BUSINESS_PRO" | "AGENCY";

export type BusinessEntitlements = {
  shortlistMax: number;
  inquiryMaxPerMonth: number;
  advancedFilters: boolean;
  fitInsights: boolean;
  teamSeats: number;
  exports: boolean;
  savedAlerts: boolean;
  managedMatching: boolean;
  /** Phase 5 — audience snapshots, trends, relationship signals */
  intelligence: boolean;
  /** Phase 11 — multi-creator roster, agency campaigns, joint portfolios */
  agencyWorkspace: boolean;
};

export const BUSINESS_ENTITLEMENTS: Record<BusinessPlanCode, BusinessEntitlements> = {
  BUSINESS_FREE: {
    shortlistMax: 5,
    inquiryMaxPerMonth: 3,
    advancedFilters: false,
    fitInsights: false,
    teamSeats: 1,
    exports: false,
    savedAlerts: false,
    managedMatching: false,
    intelligence: false,
    agencyWorkspace: false,
  },
  BUSINESS_PRO: {
    shortlistMax: 100,
    inquiryMaxPerMonth: 50,
    advancedFilters: true,
    fitInsights: true,
    teamSeats: 3,
    exports: true,
    savedAlerts: true,
    managedMatching: false,
    intelligence: true,
    agencyWorkspace: false,
  },
  AGENCY: {
    shortlistMax: 500,
    inquiryMaxPerMonth: 200,
    advancedFilters: true,
    fitInsights: true,
    teamSeats: 15,
    exports: true,
    savedAlerts: true,
    managedMatching: true,
    intelligence: true,
    agencyWorkspace: true,
  },
};

export function getBusinessEntitlements(plan: BusinessPlanCode): BusinessEntitlements {
  return BUSINESS_ENTITLEMENTS[plan];
}

export const BUSINESS_PLAN_PRICES = {
  BUSINESS_FREE: { label: "Free", price: "$0", period: "forever" },
  BUSINESS_PRO: { label: "Business Pro", price: "$79–129", period: "/mo" },
  AGENCY: { label: "Agency", price: "$249–499", period: "/mo" },
} as const;
