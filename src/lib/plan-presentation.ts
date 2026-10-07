/**
 * How a public plan is drawn. Prices and limits come from the saved plan.
 * The approved layouts are the structure; they are not a second price list.
 */

export type FeatureKind = "int" | "bool" | "text";

export const PLAN_FEATURE_META: Record<
  string,
  { label: string; kind: FeatureKind; options?: string[]; hint?: string }
> = {
  "card.social_links.max": { label: "Social links", kind: "int" },
  "card.specialties.max": { label: "Specialties", kind: "int" },
  "card.portfolio_items.max": { label: "Portfolio items", kind: "int" },
  "card.qr.enabled": { label: "QR code", kind: "bool" },
  "card.qr.dynamic": { label: "Dynamic destination", kind: "bool" },
  "card.nfc.enabled": {
    label: "NFC tag URL",
    kind: "bool",
    hint: "Mints inflr.me/n/{token}. The creator writes that URL onto a physical tag.",
  },
  "card.shortlink.enabled": { label: "Short link", kind: "bool" },
  "card.shortlink.max": {
    label: "Profile short links",
    kind: "int",
    hint: "The inflr.me/{name} link. This is not the campaign-link count.",
  },
  "card.campaign_links.max": {
    label: "Campaign links",
    kind: "int",
    hint: "The number you save is the only campaign-link limit for this plan. A new plan starts at 0. Nothing else adds a count.",
  },
  "card.custom_slug.enabled": { label: "Custom slug", kind: "bool" },
  "card.collaboration.enabled": { label: "Collaboration CTA", kind: "bool" },
  "collaboration.proposals.max": { label: "Proposals per window", kind: "int" },
  "card.media_kit.enabled": { label: "Media kit", kind: "bool" },
  "card.lead_tracking.enabled": { label: "Lead tracking", kind: "bool" },
  "card.contact.level": { label: "Contact", kind: "text", options: ["none", "limited", "full"] },
  "card.analytics.level": { label: "Analytics", kind: "text", options: ["views", "standard", "advanced"] },
  "card.custom_theme.level": { label: "Theme", kind: "text", options: ["default", "limited", "full"] },
  "card.platform_branding": {
    label: "Platform branding",
    kind: "text",
    options: ["visible", "reduced", "minimal"],
  },
  "business.shortlist.max": { label: "Shortlist size", kind: "int" },
  "business.inquiry.max": { label: "Inquiries per month", kind: "int" },
  "business.team_seats.max": { label: "Team seats", kind: "int" },
  "business.advanced_filters": { label: "Advanced filters", kind: "bool" },
  "business.fit_insights": { label: "Fit insights", kind: "bool" },
  "business.exports": { label: "Exports", kind: "bool" },
  "business.saved_alerts": { label: "Saved alerts", kind: "bool" },
  "business.managed_matching": { label: "Managed matching", kind: "bool" },
  "business.intelligence": { label: "Intelligence", kind: "bool" },
  "business.agency_workspace": { label: "Agency workspace", kind: "bool" },
  "business.custom_milestones": { label: "Custom milestones", kind: "bool" },
};

export type PlanFeatureValue = {
  featureKey: string;
  enabled: boolean;
  limitInt: number | null;
  valueText: string | null;
};

export type PresentedFeature = {
  included: boolean;
  /** Empty when the plan does not include the feature. A number or level when it does. */
  text: string;
};

const PLAN_RETURNS = ["/pricing", "/billing", "/business/plans", "/business/billing"] as const;
export type PlanReturnPath = (typeof PLAN_RETURNS)[number];

export function planPageReturn(value: unknown): PlanReturnPath {
  const text = String(value ?? "").trim();
  return (PLAN_RETURNS as readonly string[]).includes(text) ? (text as PlanReturnPath) : "/billing";
}

/** Center card when there are three or more. With a free plan and one paid plan, recommend the paid plan. */
export function recommendedPlanCode(plans: { code: string; amountCents: number }[]): string | null {
  if (plans.length >= 3) return plans[Math.floor(plans.length / 2)]?.code ?? null;
  if (plans.length === 2) {
    const paid = plans.filter((plan) => plan.amountCents > 0);
    const free = plans.filter((plan) => plan.amountCents <= 0);
    if (paid.length === 1 && free.length === 1) return paid[0].code;
  }
  return null;
}

export function presentFeature(key: string, row: PlanFeatureValue | undefined): PresentedFeature {
  const meta = PLAN_FEATURE_META[key];
  if (!meta || !row) return { included: false, text: "" };
  if (meta.kind === "bool") return row.enabled ? { included: true, text: "Included" } : { included: false, text: "" };
  if (meta.kind === "int") {
    const limit = typeof row.limitInt === "number" && Number.isFinite(row.limitInt) ? Math.round(row.limitInt) : 0;
    if (limit <= 0) return { included: false, text: "" };
    return { included: true, text: String(limit) };
  }
  const value = (row.valueText ?? "").trim().toLowerCase();
  if (!value || value === "none") return { included: false, text: "" };
  return { included: true, text: value.charAt(0).toUpperCase() + value.slice(1) };
}

const COUNT_LINE: Record<string, (count: number) => string> = {
  "card.social_links.max": (count) => `${count} social ${count === 1 ? "link" : "links"}`,
  "card.specialties.max": (count) => `${count} ${count === 1 ? "specialty" : "specialties"}`,
  "card.portfolio_items.max": (count) => `${count} portfolio ${count === 1 ? "item" : "items"}`,
  "card.shortlink.max": (count) => `${count} profile short ${count === 1 ? "link" : "links"}`,
  "card.campaign_links.max": (count) => `${count} campaign ${count === 1 ? "link" : "links"}`,
  "collaboration.proposals.max": (count) => `${count} ${count === 1 ? "proposal" : "proposals"} per window`,
  "business.shortlist.max": (count) => `Shortlist of ${count}`,
  "business.inquiry.max": (count) => `${count} ${count === 1 ? "inquiry" : "inquiries"} per month`,
  "business.team_seats.max": (count) => `${count} team ${count === 1 ? "seat" : "seats"}`,
};

export function highlightLine(key: string, row: PlanFeatureValue | undefined): string | null {
  const cell = presentFeature(key, row);
  if (!cell.included) return null;
  const label = PLAN_FEATURE_META[key]?.label;
  if (!label) return null;
  if (cell.text === "Included") return label;
  if (/^\d+$/.test(cell.text)) {
    const count = Number(cell.text);
    return COUNT_LINE[key]?.(count) ?? `${count} ${label.toLowerCase()}`;
  }
  return `${label}: ${cell.text}`;
}

export function highlightsFor(features: PlanFeatureValue[], keys: readonly string[], limit = 6): string[] {
  const byKey = new Map(features.map((feature) => [feature.featureKey, feature]));
  const lines: string[] = [];
  for (const key of keys) {
    const line = highlightLine(key, byKey.get(key));
    if (!line) continue;
    lines.push(line);
    if (lines.length >= limit) break;
  }
  return lines.length ? lines : ["Features are set on this plan."];
}

/** Card copy leads with what this plan adds over the previous public plan. */
export function cardHighlights(
  plans: { name: string; features: PlanFeatureValue[] }[],
  index: number,
  keys: readonly string[],
  limit = 6,
): string[] {
  const lines = highlightsFor(plans[index]?.features ?? [], keys, 24);
  if (index <= 0) return lines.slice(0, limit);
  const previous = highlightsFor(plans[index - 1]?.features ?? [], keys, 24);
  const added = lines.filter((line) => !previous.includes(line));
  if (!added.length) return lines.slice(0, limit);
  const coversPrevious = previous.every((line) => lines.includes(line));
  const head = coversPrevious ? [`Everything in ${plans[index - 1].name}`] : [];
  const picked = [...head, ...added].slice(0, limit);
  return picked.length ? picked : lines.slice(0, limit);
}

export type ComparisonCell = PresentedFeature & { code: string };
export type ComparisonRow = { key: string; label: string; cells: ComparisonCell[] };

export function comparisonRows(
  plans: { code: string; features: PlanFeatureValue[] }[],
  keys: readonly string[],
): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  for (const key of keys) {
    const label = PLAN_FEATURE_META[key]?.label;
    if (!label) continue;
    const cells = plans.map((plan) => ({
      code: plan.code,
      ...presentFeature(key, plan.features.find((feature) => feature.featureKey === key)),
    }));
    if (!cells.some((cell) => cell.included)) continue;
    rows.push({ key, label, cells });
  }
  return rows;
}

export function planActionLabel(input: {
  name: string;
  amountCents: number;
  current: boolean;
  currentAmountCents: number | null;
}): string {
  if (input.current) return "Current plan";
  if (input.amountCents <= 0) return "Get started free";
  if (input.currentAmountCents != null && input.amountCents > input.currentAmountCents) {
    return `Upgrade to ${input.name}`;
  }
  return `Choose ${input.name}`;
}

export function displayPrice(amountCents: number, priceLabel: string): string {
  if (amountCents <= 0) return "$0";
  const trimmed = priceLabel.replace(/\s*\/\s*mo(nth)?/i, "").trim();
  return trimmed || `$${(amountCents / 100).toFixed(0)}`;
}
