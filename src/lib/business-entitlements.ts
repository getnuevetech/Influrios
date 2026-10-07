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
  /** Collab OS P3 — custom milestone schedules (requires influencer accept) */
  customMilestones: boolean;
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
    customMilestones: false,
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
    customMilestones: true,
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
    customMilestones: true,
  },
};

export function getBusinessEntitlements(plan: BusinessPlanCode): BusinessEntitlements {
  return BUSINESS_ENTITLEMENTS[plan];
}

export function isBusinessPlanCode(value: string): value is BusinessPlanCode {
  return value === "BUSINESS_FREE" || value === "BUSINESS_PRO" || value === "AGENCY";
}

export const EMPTY_BUSINESS_ENTITLEMENTS: BusinessEntitlements = {
  shortlistMax: 0,
  inquiryMaxPerMonth: 0,
  advancedFilters: false,
  fitInsights: false,
  teamSeats: 0,
  exports: false,
  savedAlerts: false,
  managedMatching: false,
  intelligence: false,
  agencyWorkspace: false,
  customMilestones: false,
};

const BUSINESS_INT_FIELDS = {
  "business.shortlist.max": "shortlistMax",
  "business.inquiry.max": "inquiryMaxPerMonth",
  "business.team_seats.max": "teamSeats",
} as const satisfies Record<string, keyof BusinessEntitlements>;

const BUSINESS_BOOL_FIELDS = {
  "business.advanced_filters": "advancedFilters",
  "business.fit_insights": "fitInsights",
  "business.exports": "exports",
  "business.saved_alerts": "savedAlerts",
  "business.managed_matching": "managedMatching",
  "business.intelligence": "intelligence",
  "business.agency_workspace": "agencyWorkspace",
  "business.custom_milestones": "customMilestones",
} as const satisfies Record<string, keyof BusinessEntitlements>;

export const BUSINESS_FEATURE_KEYS = [
  "business.shortlist.max",
  "business.inquiry.max",
  "business.team_seats.max",
  "business.advanced_filters",
  "business.fit_insights",
  "business.exports",
  "business.saved_alerts",
  "business.managed_matching",
  "business.intelligence",
  "business.agency_workspace",
  "business.custom_milestones",
] as const;

export type BusinessFeatureKey = (typeof BUSINESS_FEATURE_KEYS)[number];

export function isBusinessFeatureKey(value: string): value is BusinessFeatureKey {
  return (BUSINESS_FEATURE_KEYS as readonly string[]).includes(value);
}

export function businessLimitsToFeatureRows(limits: BusinessEntitlements): FeatureValue[] {
  const rows: FeatureValue[] = [];
  for (const [featureKey, field] of Object.entries(BUSINESS_INT_FIELDS)) {
    rows.push({ featureKey, enabled: true, limitInt: limits[field], valueText: null });
  }
  for (const [featureKey, field] of Object.entries(BUSINESS_BOOL_FIELDS)) {
    rows.push({ featureKey, enabled: Boolean(limits[field]), limitInt: null, valueText: null });
  }
  return rows;
}

export function applyBusinessFeatureRows(base: BusinessEntitlements, rows: FeatureValue[]): BusinessEntitlements {
  const next: BusinessEntitlements = { ...base };
  for (const row of rows) {
    const intField = BUSINESS_INT_FIELDS[row.featureKey as keyof typeof BUSINESS_INT_FIELDS];
    if (intField && typeof row.limitInt === "number" && Number.isFinite(row.limitInt)) {
      next[intField] = Math.max(0, Math.round(row.limitInt));
      continue;
    }
    const boolField = BUSINESS_BOOL_FIELDS[row.featureKey as keyof typeof BUSINESS_BOOL_FIELDS];
    if (boolField && typeof row.enabled === "boolean") {
      next[boolField] = row.enabled;
    }
  }
  return next;
}

type FeatureValue = {
  featureKey: string;
  enabled?: boolean | null;
  limitInt?: number | null;
  valueText?: string | null;
};

export const BUSINESS_PLAN_PRICES = {
  BUSINESS_FREE: { label: "Free", price: "$0", period: "forever" },
  BUSINESS_PRO: { label: "Business Pro", price: "$79–129", period: "/mo" },
  AGENCY: { label: "Agency", price: "$249–499", period: "/mo" },
} as const;
