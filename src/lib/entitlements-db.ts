import { Prisma, type PlanTier } from "@prisma/client";
import { prisma } from "@/lib/db";
import { rethrowIfNextDynamicError } from "@/lib/next-dynamic";
import {
  PLAN_ENTITLEMENTS,
  applyFeatureRows,
  getEntitlements,
  isEditableFeatureKey,
  isPlanCode,
  limitsToFeatureRows,
  type EntitlementLimits,
  type FeatureValue,
  type PlanCode,
} from "@/lib/entitlements";

const CACHE_MS = 5_000;

type Catalog = Map<PlanCode, FeatureValue[]>;

let catalogCache: { at: number; plans: Catalog; overrides: FeatureOverrideRow[] } | null = null;

type FeatureOverrideRow = FeatureValue & {
  planCode: PlanCode | null;
  countryCode: string | null;
  subjectId: string | null;
};

export function invalidateEntitlementCache() {
  catalogCache = null;
}

async function optIntoRequest() {
  try {
    const { connection } = await import("next/server");
    await connection();
  } catch (error) {
    rethrowIfNextDynamicError(error);
    // Scripts and unit tests have no request scope.
  }
}

function asPlanCode(code: PlanTier): PlanCode | null {
  return isPlanCode(code) ? code : null;
}

async function readCatalog(): Promise<{ plans: Catalog; overrides: FeatureOverrideRow[] }> {
  const now = Date.now();
  if (catalogCache && now - catalogCache.at < CACHE_MS) return catalogCache;

  const [planRows, overrideRows] = await Promise.all([
    prisma.entitlementPlan.findMany({
      where: { active: true },
      include: { features: true },
    }),
    prisma.entitlementOverride.findMany({ where: { active: true } }),
  ]);

  const plans: Catalog = new Map();
  for (const plan of planRows) {
    const code = asPlanCode(plan.code);
    if (!code) continue;
    plans.set(
      code,
      plan.features.map((feature) => ({
        featureKey: feature.featureKey,
        enabled: feature.enabled,
        limitInt: feature.limitInt,
        valueText: feature.valueText,
      })),
    );
  }

  const overrides: FeatureOverrideRow[] = [];
  for (const row of overrideRows) {
    overrides.push({
      featureKey: row.featureKey,
      enabled: row.enabled,
      limitInt: row.limitInt,
      valueText: row.valueText,
      planCode: row.planCode ? asPlanCode(row.planCode) : null,
      countryCode: row.countryCode,
      subjectId: row.subjectId,
    });
  }

  catalogCache = { at: now, plans, overrides };
  return catalogCache;
}

/** Insert launch-default plans and feature rows when they are missing. Does not overwrite edits. */
export async function ensureLaunchEntitlements() {
  for (const code of Object.keys(PLAN_ENTITLEMENTS) as PlanCode[]) {
    const limits = PLAN_ENTITLEMENTS[code];
    const plan = await prisma.entitlementPlan.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: code.charAt(0) + code.slice(1).toLowerCase(),
        description: `Launch defaults for ${code}`,
        limitsJson: limits,
        featuresJson: limits,
      },
    });
    for (const row of limitsToFeatureRows(limits)) {
      await prisma.planFeatureEntitlement.upsert({
        where: { planId_featureKey: { planId: plan.id, featureKey: row.featureKey } },
        update: {},
        create: {
          planId: plan.id,
          featureKey: row.featureKey,
          enabled: row.enabled ?? true,
          limitInt: row.limitInt,
          valueText: row.valueText,
        },
      });
    }
  }

  await prisma.country.upsert({
    where: { code: "US" },
    update: {},
    create: { code: "US", name: "United States", currency: "USD", locale: "en", enabled: true },
  });
  await prisma.platformSetting.upsert({
    where: { key: "brand.name" },
    update: {},
    create: { key: "brand.name", value: "Influrios" },
  });
  invalidateEntitlementCache();
}

export async function getEffectiveEntitlements(input: {
  plan: PlanCode;
  countryCode?: string | null;
  subjectId?: string | null;
}): Promise<EntitlementLimits> {
  await optIntoRequest();
  try {
    let catalog = await readCatalog();
    const existing = catalog.plans.get(input.plan);
    if (!existing || existing.length === 0) {
      await ensureLaunchEntitlements();
      catalog = await readCatalog();
    }
    const rows = catalog.plans.get(input.plan) ?? [];
    let limits = rows.length
      ? applyFeatureRows(getEntitlements(input.plan), rows)
      : getEntitlements(input.plan);

    const overrides = catalog.overrides.filter((row) => {
      if (row.planCode && row.planCode !== input.plan) return false;
      if (row.countryCode && row.countryCode !== input.countryCode) return false;
      if (row.subjectId && row.subjectId !== input.subjectId) return false;
      if (!row.planCode && !row.countryCode && !row.subjectId) return false;
      return true;
    });
    if (overrides.length) limits = applyFeatureRows(limits, overrides);
    return limits;
  } catch (error) {
    console.error("entitlements: using launch defaults", error);
    return getEntitlements(input.plan);
  }
}

export async function entitlementsForPlan(plan: string): Promise<EntitlementLimits> {
  const code: PlanCode = isPlanCode(plan) ? plan : "STARTER";
  return getEffectiveEntitlements({ plan: code });
}

export type PlanFeatureEditorRow = {
  planCode: PlanCode;
  planName: string;
  featureKey: string;
  enabled: boolean;
  limitInt: number | null;
  valueText: string | null;
};

export async function listPlanFeatures(): Promise<PlanFeatureEditorRow[]> {
  await ensureLaunchEntitlements();
  const plans = await prisma.entitlementPlan.findMany({
    where: { code: { in: ["STARTER", "PLUS", "PRO"] } },
    include: { features: true },
    orderBy: { code: "asc" },
  });
  const rows: PlanFeatureEditorRow[] = [];
  for (const plan of plans) {
    const code = asPlanCode(plan.code);
    if (!code) continue;
    for (const feature of plan.features) {
      rows.push({
        planCode: code,
        planName: plan.name,
        featureKey: feature.featureKey,
        enabled: feature.enabled,
        limitInt: feature.limitInt,
        valueText: feature.valueText,
      });
    }
  }
  return rows;
}

export async function updatePlanFeature(input: {
  actor: string;
  planCode: PlanCode;
  featureKey: string;
  enabled: boolean;
  limitInt: number | null;
  valueText: string | null;
}) {
  if (!isEditableFeatureKey(input.featureKey)) {
    throw new Error("Unknown feature");
  }
  if (input.limitInt != null && (!Number.isFinite(input.limitInt) || input.limitInt < 0 || input.limitInt > 100)) {
    throw new Error("Limit must be between 0 and 100");
  }

  const plan = await prisma.entitlementPlan.findUnique({ where: { code: input.planCode } });
  if (!plan) throw new Error("Plan not found");

  const before = await prisma.planFeatureEntitlement.findUnique({
    where: { planId_featureKey: { planId: plan.id, featureKey: input.featureKey } },
  });

  const after = await prisma.planFeatureEntitlement.upsert({
    where: { planId_featureKey: { planId: plan.id, featureKey: input.featureKey } },
    update: {
      enabled: input.enabled,
      limitInt: input.limitInt,
      valueText: input.valueText,
    },
    create: {
      planId: plan.id,
      featureKey: input.featureKey,
      enabled: input.enabled,
      limitInt: input.limitInt,
      valueText: input.valueText,
    },
  });

  const toJson = (value: unknown): Prisma.InputJsonValue =>
    JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: "entitlement.update",
      objectType: "PlanFeatureEntitlement",
      objectId: after.id,
      before: before ? toJson(before) : undefined,
      after: toJson(after),
    },
  });
  invalidateEntitlementCache();
  return after;
}
