import { BILLING_CATALOG } from "@/lib/billing";
import {
  BUSINESS_ENTITLEMENTS,
  BUSINESS_FEATURE_KEYS,
  businessLimitsToFeatureRows,
  type BusinessPlanCode,
} from "@/lib/business-entitlements";
import { prisma } from "@/lib/db";
import {
  EDITABLE_FEATURE_KEYS,
  PLAN_ENTITLEMENTS,
  limitsToFeatureRows,
  type PlanCode,
} from "@/lib/entitlements";
import {
  comparisonRows,
  cardHighlights,
  recommendedPlanCode,
  type ComparisonRow,
  type PlanFeatureValue,
} from "@/lib/plan-presentation";

export type PlanColumn = {
  code: string;
  sku: string;
  name: string;
  description: string;
  priceLabel: string;
  amountCents: number;
  audience: "creator" | "business";
  checkout: boolean;
  highlights: string[];
  recommended: boolean;
  features: PlanFeatureValue[];
};

export type PlanMatrix = {
  plans: PlanColumn[];
  rows: ComparisonRow[];
  source: "saved" | "launch-defaults";
};

const CHECKOUT_SKU: Record<string, string> = {
  PLUS: "creator_plus",
  PRO: "creator_pro",
  BUSINESS_PRO: "business_pro",
  AGENCY: "agency",
};

const KEYS = {
  creator: EDITABLE_FEATURE_KEYS,
  business: BUSINESS_FEATURE_KEYS,
} as const;

function asFeatures(
  rows: { featureKey: string; enabled?: boolean | null; limitInt?: number | null; valueText?: string | null }[],
): PlanFeatureValue[] {
  return rows.map((row) => ({
    featureKey: row.featureKey,
    enabled: Boolean(row.enabled),
    limitInt: typeof row.limitInt === "number" ? row.limitInt : null,
    valueText: row.valueText ?? null,
  }));
}

function decorate(audience: "creator" | "business", plans: Omit<PlanColumn, "highlights" | "recommended">[]): PlanMatrix {
  const keys = KEYS[audience];
  const recommended = recommendedPlanCode(plans);
  const columns: PlanColumn[] = plans.map((plan) => ({
    ...plan,
    recommended: plan.code === recommended,
        highlights: cardHighlights(plans, plans.indexOf(plan), keys),
  }));
  return {
    plans: columns,
    rows: comparisonRows(columns, keys),
    source: "saved",
  };
}

function launchDefaults(audience: "creator" | "business"): PlanMatrix {
  if (audience === "creator") {
    const catalog = new Map(BILLING_CATALOG.filter((plan) => plan.audience === "creator").map((plan) => [plan.creatorPlan, plan]));
    const plans = (["STARTER", "PLUS", "PRO"] as PlanCode[]).map((code) => {
      const paid = catalog.get(code);
      return {
        code,
        sku: code === "STARTER" ? "creator_starter" : paid?.sku ?? code,
        name: code === "STARTER" ? "Influencer Starter" : paid?.name ?? code,
        description:
          code === "STARTER" ? "Claim your Influencer Card and get discovered." : paid?.description ?? "",
        priceLabel: code === "STARTER" ? "Free" : paid?.priceLabel ?? "",
        amountCents: code === "STARTER" ? 0 : paid?.amountCents ?? 0,
        audience: "creator" as const,
        checkout: code !== "STARTER",
        features: asFeatures(limitsToFeatureRows(PLAN_ENTITLEMENTS[code])),
      };
    });
    return { ...decorate("creator", plans), source: "launch-defaults" };
  }
  const catalog = new Map(BILLING_CATALOG.filter((plan) => plan.audience === "business").map((plan) => [plan.businessPlan, plan]));
  const plans = (["BUSINESS_FREE", "BUSINESS_PRO", "AGENCY"] as BusinessPlanCode[]).map((code) => {
    const paid = catalog.get(code);
    return {
      code,
      sku: paid?.sku ?? code,
      name: code === "BUSINESS_FREE" ? "Business Starter" : paid?.name ?? code,
      description:
        code === "BUSINESS_FREE"
          ? "Discover creators and start a shortlist."
          : paid?.description ?? "",
      priceLabel: code === "BUSINESS_FREE" ? "Free" : paid?.priceLabel ?? "",
      amountCents: code === "BUSINESS_FREE" ? 0 : paid?.amountCents ?? 0,
      audience: "business" as const,
      checkout: code !== "BUSINESS_FREE",
      features: asFeatures(businessLimitsToFeatureRows(BUSINESS_ENTITLEMENTS[code])),
    };
  });
  return { ...decorate("business", plans), source: "launch-defaults" };
}

export async function loadPlanMatrix(audience: "creator" | "business"): Promise<PlanMatrix> {
  try {
    const saved = await prisma.entitlementPlan.findMany({
      where: { active: true, publicListing: true, audience },
      include: { features: true },
      orderBy: [{ sortOrder: "asc" }, { amountCents: "asc" }, { code: "asc" }],
    });
    if (!saved.length) return launchDefaults(audience);
    return decorate(
      audience,
      saved.map((plan) => ({
        code: plan.code,
        sku: CHECKOUT_SKU[plan.code] ?? plan.code,
        name: plan.name,
        description: plan.description ?? "",
        priceLabel: plan.priceLabel || (plan.amountCents === 0 ? "Free" : ""),
        amountCents: plan.amountCents,
        audience,
        checkout: plan.amountCents > 0,
        features: asFeatures(plan.features),
      })),
    );
  } catch (error) {
    console.error("plan matrix", error);
    return launchDefaults(audience);
  }
}
