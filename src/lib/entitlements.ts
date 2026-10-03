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
  shortlinkMax: number;
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
  proposalsMax: number;
};

export const PLAN_ENTITLEMENTS: Record<PlanCode, EntitlementLimits> = {
  STARTER: {
    specialtiesMax: 1,
    socialLinksMax: 1,
    portfolioMax: 0,
    shortlink: false,
    shortlinkMax: 0,
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
    proposalsMax: 0,
  },
  PLUS: {
    specialtiesMax: 3,
    socialLinksMax: 4,
    portfolioMax: 6,
    shortlink: true,
    shortlinkMax: 1,
    customAlias: true,
    standardQr: true,
    dynamicQr: false,
    contactInquiry: "full",
    collabCta: true,
    analytics: "standard",
    themes: "limited",
    platformBranding: "reduced",
    mediaKit: false,
    leadTracking: false,
    proposalsMax: 8,
  },
  PRO: {
    specialtiesMax: 8,
    socialLinksMax: 8,
    portfolioMax: 24,
    shortlink: true,
    shortlinkMax: 5,
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
    proposalsMax: 30,
  },
};

/** Launch-default fallback when the database catalog is empty or unreachable. */
export function getEntitlements(plan: PlanCode): EntitlementLimits {
  return PLAN_ENTITLEMENTS[plan];
}

export function isPlanCode(value: string): value is PlanCode {
  return value === "STARTER" || value === "PLUS" || value === "PRO";
}

export type FeatureValue = {
  featureKey: string;
  enabled?: boolean | null;
  limitInt?: number | null;
  valueText?: string | null;
};

const INT_FIELDS = {
  "card.specialties.max": "specialtiesMax",
  "card.social_links.max": "socialLinksMax",
  "card.portfolio_items.max": "portfolioMax",
  "card.shortlink.max": "shortlinkMax",
  "collaboration.proposals.max": "proposalsMax",
} as const satisfies Record<string, keyof EntitlementLimits>;

const BOOL_FIELDS = {
  "card.shortlink.enabled": "shortlink",
  "card.custom_slug.enabled": "customAlias",
  "card.qr.enabled": "standardQr",
  "card.qr.dynamic": "dynamicQr",
  "card.collaboration.enabled": "collabCta",
  "card.media_kit.enabled": "mediaKit",
  "card.lead_tracking.enabled": "leadTracking",
} as const satisfies Record<string, keyof EntitlementLimits>;

const TEXT_FIELDS = {
  "card.contact.level": "contactInquiry",
  "card.analytics.level": "analytics",
  "card.custom_theme.level": "themes",
  "card.platform_branding": "platformBranding",
} as const satisfies Record<string, keyof EntitlementLimits>;

const TEXT_ALLOWED: Record<keyof typeof TEXT_FIELDS, readonly string[]> = {
  "card.contact.level": ["none", "limited", "full"],
  "card.analytics.level": ["views", "standard", "advanced"],
  "card.custom_theme.level": ["default", "limited", "full"],
  "card.platform_branding": ["visible", "reduced", "minimal"],
};

export const EDITABLE_FEATURE_KEYS = [
  "card.social_links.max",
  "card.specialties.max",
  "card.portfolio_items.max",
  "card.qr.enabled",
  "card.qr.dynamic",
  "card.shortlink.enabled",
  "card.shortlink.max",
  "card.custom_slug.enabled",
  "card.collaboration.enabled",
  "collaboration.proposals.max",
  "card.media_kit.enabled",
  "card.lead_tracking.enabled",
  "card.contact.level",
  "card.analytics.level",
  "card.custom_theme.level",
  "card.platform_branding",
] as const;

export type EditableFeatureKey = (typeof EDITABLE_FEATURE_KEYS)[number];

export function isEditableFeatureKey(value: string): value is EditableFeatureKey {
  return (EDITABLE_FEATURE_KEYS as readonly string[]).includes(value);
}

export function limitsToFeatureRows(limits: EntitlementLimits): FeatureValue[] {
  const rows: FeatureValue[] = [];
  for (const [featureKey, field] of Object.entries(INT_FIELDS)) {
    rows.push({ featureKey, enabled: true, limitInt: limits[field] as number, valueText: null });
  }
  for (const [featureKey, field] of Object.entries(BOOL_FIELDS)) {
    rows.push({ featureKey, enabled: Boolean(limits[field]), limitInt: null, valueText: null });
  }
  for (const [featureKey, field] of Object.entries(TEXT_FIELDS)) {
    rows.push({ featureKey, enabled: true, limitInt: null, valueText: String(limits[field]) });
  }
  return rows;
}

/** Overlay stored feature rows onto a base limit set. Unknown or invalid values are ignored. */
export function applyFeatureRows(base: EntitlementLimits, rows: FeatureValue[]): EntitlementLimits {
  const next: EntitlementLimits = { ...base };
  for (const row of rows) {
    const intField = INT_FIELDS[row.featureKey as keyof typeof INT_FIELDS];
    if (intField && typeof row.limitInt === "number" && Number.isFinite(row.limitInt)) {
      next[intField] = Math.max(0, Math.round(row.limitInt));
      continue;
    }
    const boolField = BOOL_FIELDS[row.featureKey as keyof typeof BOOL_FIELDS];
    if (boolField && typeof row.enabled === "boolean") {
      (next[boolField] as boolean) = row.enabled;
      continue;
    }
    const textField = TEXT_FIELDS[row.featureKey as keyof typeof TEXT_FIELDS];
    if (textField && row.valueText && TEXT_ALLOWED[row.featureKey as keyof typeof TEXT_FIELDS].includes(row.valueText)) {
      (next[textField] as string) = row.valueText;
    }
  }
  return next;
}

const PLAN_ORDER: PlanCode[] = ["STARTER", "PLUS", "PRO"];

export type EntitlementDecision =
  | { ok: true }
  | {
      ok: false;
      feature: string;
      limit: number;
      upgradePlanCode: PlanCode | null;
    };

export function decideCount(
  limits: EntitlementLimits,
  field: "specialtiesMax" | "socialLinksMax",
  count: number,
  current: PlanCode,
): EntitlementDecision {
  const limit = limits[field];
  if (count <= limit) return { ok: true };
  const feature = field === "specialtiesMax" ? "card.specialties.max" : "card.social_links.max";
  const start = PLAN_ORDER.indexOf(current);
  let upgradePlanCode: PlanCode | null = null;
  for (let i = start + 1; i < PLAN_ORDER.length; i++) {
    const code = PLAN_ORDER[i];
    if (PLAN_ENTITLEMENTS[code][field] >= count) {
      upgradePlanCode = code;
      break;
    }
  }
  return { ok: false, feature, limit, upgradePlanCode };
}

export type CardChrome = {
  premium: boolean;
  gold: boolean;
  ctaLabel: string;
  showShortlink: boolean;
  showQr: boolean;
  dynamicQr: boolean;
};

/** Visual system derived from entitlements. Gold and QR follow features, not the plan name. */
export function cardChrome(entitlements: EntitlementLimits): CardChrome {
  const premium = entitlements.themes === "full";
  let ctaLabel = "Contact →";
  if (premium && entitlements.collabCta) ctaLabel = "Work With Me →";
  else if (entitlements.contactInquiry === "full") ctaLabel = "Contact →";
  else if (entitlements.contactInquiry === "limited") ctaLabel = "Contact →";
  return {
    premium,
    gold: premium,
    ctaLabel,
    showShortlink: entitlements.shortlink,
    showQr: entitlements.standardQr || entitlements.dynamicQr,
    dynamicQr: entitlements.dynamicQr,
  };
}

/** Full-card chrome for signup draft previews (demo only — not published entitlements). */
export const DRAFT_PREVIEW_ENTITLEMENTS: EntitlementLimits = {
  ...PLAN_ENTITLEMENTS.PRO,
  // Preview shows the full card experience; publishing still starts on Starter.
};
