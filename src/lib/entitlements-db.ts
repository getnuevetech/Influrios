import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { rethrowIfNextDynamicError } from "@/lib/next-dynamic";
import {
  EMPTY_ENTITLEMENTS,
  PLAN_ENTITLEMENTS,
  PLAN_LIMIT_MAX,
  applyFeatureRows,
  getEntitlements,
  isEditableFeatureKey,
  isPlanCode,
  limitsToFeatureRows,
  normalizePlanCode,
  type EntitlementLimits,
  type FeatureValue,
} from "@/lib/entitlements";
import {
  BUSINESS_ENTITLEMENTS,
  EMPTY_BUSINESS_ENTITLEMENTS,
  applyBusinessFeatureRows,
  businessLimitsToFeatureRows,
  isBusinessFeatureKey,
  isBusinessPlanCode,
  type BusinessEntitlements,
} from "@/lib/business-entitlements";

const CACHE_MS = 5_000;

type Catalog = Map<string, FeatureValue[]>;

let catalogCache: { at: number; plans: Catalog; overrides: FeatureOverrideRow[] } | null = null;

type FeatureOverrideRow = FeatureValue & {
  planCode: string | null;
  countryCode: string | null;
  subjectId: string | null;
};

const LAUNCH_PLAN_META: Record<string, {
  name: string;
  audience: "creator" | "business";
  amountCents: number;
  priceLabel: string;
  publicListing: boolean;
  sortOrder: number;
  description: string;
}> = {
  STARTER: {
    name: "Starter",
    audience: "creator",
    amountCents: 0,
    priceLabel: "Free",
    publicListing: true,
    sortOrder: 0,
    description: "Claim a card. Campaign links and NFC stay off until an admin turns them on.",
  },
  PLUS: {
    name: "Plus",
    audience: "creator",
    amountCents: 1900,
    priceLabel: "$19/mo",
    publicListing: true,
    sortOrder: 1,
    description: "Short link, QR, and NFC. Campaign links start at zero and can be raised.",
  },
  PRO: {
    name: "Pro",
    audience: "creator",
    amountCents: 2900,
    priceLabel: "$29/mo",
    publicListing: true,
    sortOrder: 2,
    description: "Dynamic destination, QR, NFC, and a campaign-link count an admin can change.",
  },
  BUSINESS_FREE: {
    name: "Business Free",
    audience: "business",
    amountCents: 0,
    priceLabel: "Free",
    publicListing: true,
    sortOrder: 10,
    description: "A small shortlist and a few inquiries.",
  },
  BUSINESS_PRO: {
    name: "Business Pro",
    audience: "business",
    amountCents: 9900,
    priceLabel: "$99/mo",
    publicListing: true,
    sortOrder: 11,
    description: "Larger shortlists, intelligence, and custom milestones.",
  },
  AGENCY: {
    name: "Agency",
    audience: "business",
    amountCents: 34900,
    priceLabel: "$349/mo",
    publicListing: true,
    sortOrder: 12,
    description: "Team seats, managed matching, and an agency workspace.",
  },
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

async function readCatalog(): Promise<{ plans: Catalog; overrides: FeatureOverrideRow[] }> {
  const now = Date.now();
  if (catalogCache && now - catalogCache.at < CACHE_MS) return catalogCache;

  const [planRows, overrideRows] = await Promise.all([
    prisma.entitlementPlan.findMany({
      include: { features: true },
    }),
    prisma.entitlementOverride.findMany({ where: { active: true } }),
  ]);

  const plans: Catalog = new Map();
  for (const plan of planRows) {
    plans.set(
      plan.code,
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
      planCode: row.planCode ? normalizePlanCode(row.planCode) : null,
      countryCode: row.countryCode,
      subjectId: row.subjectId,
    });
  }

  catalogCache = { at: now, plans, overrides };
  return catalogCache;
}

/** Insert launch-default plans and feature rows when they are missing. Does not overwrite edits. */
function launchFeatureRows(code: string): FeatureValue[] {
  if (isPlanCode(code)) return limitsToFeatureRows(PLAN_ENTITLEMENTS[code]);
  if (isBusinessPlanCode(code)) return businessLimitsToFeatureRows(BUSINESS_ENTITLEMENTS[code]);
  return [];
}

export async function ensureLaunchEntitlements() {
  for (const [code, meta] of Object.entries(LAUNCH_PLAN_META)) {
    const rows = launchFeatureRows(code);
    const plan = await prisma.entitlementPlan.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: meta.name,
        description: meta.description,
        audience: meta.audience,
        amountCents: meta.amountCents,
        priceLabel: meta.priceLabel,
        publicListing: meta.publicListing,
        sortOrder: meta.sortOrder,
        limitsJson: isPlanCode(code) ? PLAN_ENTITLEMENTS[code] : {},
        featuresJson: isBusinessPlanCode(code) ? BUSINESS_ENTITLEMENTS[code] : {},
      },
    });
    for (const row of rows) {
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
  plan: string;
  countryCode?: string | null;
  subjectId?: string | null;
}): Promise<EntitlementLimits> {
  await optIntoRequest();
  const code = normalizePlanCode(input.plan) ?? "STARTER";
  try {
    let catalog = await readCatalog();
    const existing = catalog.plans.get(code);
    if (!existing || existing.length === 0) {
      await ensureLaunchEntitlements();
      catalog = await readCatalog();
    }
    const rows = catalog.plans.get(code) ?? [];
    const base = isPlanCode(code) ? getEntitlements(code) : EMPTY_ENTITLEMENTS;
    let limits = rows.length ? applyFeatureRows(base, rows) : base;

    const overrides = catalog.overrides.filter((row) => {
      if (row.planCode && row.planCode !== code) return false;
      if (row.countryCode && row.countryCode !== input.countryCode) return false;
      if (row.subjectId && row.subjectId !== input.subjectId) return false;
      if (!row.planCode && !row.countryCode && !row.subjectId) return false;
      return true;
    });
    if (overrides.length) limits = applyFeatureRows(limits, overrides);
    return limits;
  } catch (error) {
    console.error("entitlements: using launch defaults", error);
    return isPlanCode(code) ? getEntitlements(code) : EMPTY_ENTITLEMENTS;
  }
}

export async function entitlementsForPlan(plan: string): Promise<EntitlementLimits> {
  return getEffectiveEntitlements({ plan });
}

export async function businessEntitlementsForPlan(plan: string): Promise<BusinessEntitlements> {
  await optIntoRequest();
  const code = normalizePlanCode(plan) ?? "BUSINESS_FREE";
  try {
    let catalog = await readCatalog();
    if (!catalog.plans.has(code) || (catalog.plans.get(code)?.length ?? 0) === 0) {
      await ensureLaunchEntitlements();
      catalog = await readCatalog();
    }
    const rows = catalog.plans.get(code) ?? [];
    const base = isBusinessPlanCode(code) ? BUSINESS_ENTITLEMENTS[code] : EMPTY_BUSINESS_ENTITLEMENTS;
    let limits = rows.length ? applyBusinessFeatureRows(base, rows) : base;
    const overrides = catalog.overrides.filter((row) => {
      if (row.planCode && row.planCode !== code) return false;
      if (row.subjectId) return false;
      if (!row.planCode && !row.countryCode && !row.subjectId) return false;
      return !row.countryCode;
    });
    if (overrides.length) limits = applyBusinessFeatureRows(limits, overrides);
    return limits;
  } catch (error) {
    console.error("business entitlements: using launch defaults", error);
    return isBusinessPlanCode(code) ? BUSINESS_ENTITLEMENTS[code] : EMPTY_BUSINESS_ENTITLEMENTS;
  }
}

export type PlanFeatureEditorRow = {
  planCode: string;
  planName: string;
  audience: string;
  featureKey: string;
  enabled: boolean;
  limitInt: number | null;
  valueText: string | null;
};

export async function listPlanFeatures(): Promise<PlanFeatureEditorRow[]> {
  await ensureLaunchEntitlements();
  const plans = await prisma.entitlementPlan.findMany({
    include: { features: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  const rows: PlanFeatureEditorRow[] = [];
  for (const plan of plans) {
    for (const feature of plan.features) {
      rows.push({
        planCode: plan.code,
        planName: plan.name,
        audience: plan.audience,
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
  planCode: string;
  featureKey: string;
  enabled: boolean;
  limitInt: number | null;
  valueText: string | null;
}) {
  const planCode = normalizePlanCode(input.planCode);
  if (!planCode) throw new Error("Unknown plan");
  if (!isEditableFeatureKey(input.featureKey) && !isBusinessFeatureKey(input.featureKey)) {
    throw new Error("Unknown feature");
  }
  if (input.limitInt != null && (!Number.isFinite(input.limitInt) || input.limitInt < 0 || input.limitInt > PLAN_LIMIT_MAX)) {
    throw new Error(`Limit must be between 0 and ${PLAN_LIMIT_MAX}`);
  }
  input = { ...input, planCode };

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

export type PlanCatalogRow = {
  code: string;
  name: string;
  description: string;
  audience: "creator" | "business";
  amountCents: number;
  priceLabel: string;
  stripePriceId: string;
  publicListing: boolean;
  active: boolean;
  sortOrder: number;
  assigned: number;
};

function asAudience(value: string): "creator" | "business" {
  return value === "business" ? "business" : "creator";
}

export async function listPlanCatalog(): Promise<PlanCatalogRow[]> {
  await ensureLaunchEntitlements();
  const plans = await prisma.entitlementPlan.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });
  const [users, creators, workspaces] = await Promise.all([
    prisma.user.groupBy({ by: ["planTier"], _count: { _all: true } }),
    prisma.creator.groupBy({ by: ["planTier"], _count: { _all: true } }),
    prisma.businessWorkspace.groupBy({ by: ["plan"], _count: { _all: true } }),
  ]);
  const counts = new Map<string, number>();
  for (const row of users) counts.set(row.planTier, (counts.get(row.planTier) ?? 0) + row._count._all);
  for (const row of creators) counts.set(row.planTier, (counts.get(row.planTier) ?? 0) + row._count._all);
  for (const row of workspaces) counts.set(row.plan, (counts.get(row.plan) ?? 0) + row._count._all);
  return plans.map((plan) => ({
    code: plan.code,
    name: plan.name,
    description: plan.description ?? "",
    audience: asAudience(plan.audience),
    amountCents: plan.amountCents,
    priceLabel: plan.priceLabel,
    stripePriceId: plan.stripePriceId ?? "",
    publicListing: plan.publicListing,
    active: plan.active,
    sortOrder: plan.sortOrder,
    assigned: counts.get(plan.code) ?? 0,
  }));
}

export async function assignablePlanCodes(): Promise<string[]> {
  const plans = await listPlanCatalog();
  return plans.filter((plan) => plan.active).map((plan) => plan.code);
}

export async function createEntitlementPlan(input: {
  actor: string;
  code: string;
  name: string;
  audience: "creator" | "business";
  description: string;
  amountCents: number;
  priceLabel: string;
  stripePriceId: string;
  publicListing: boolean;
  copyFrom: string;
}) {
  const code = normalizePlanCode(input.code);
  if (!code) throw new Error("Use a plan code of letters, numbers, and underscores, starting with a letter.");
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("A plan name is required.");
  if (!Number.isFinite(input.amountCents) || input.amountCents < 0 || input.amountCents > 10_000_000) {
    throw new Error("Monthly price must be zero or a positive amount in cents.");
  }
  const stripePriceId = input.stripePriceId.trim();
  if (stripePriceId && !/^price_[A-Za-z0-9]+$/.test(stripePriceId)) {
    throw new Error("A Stripe price id starts with price_.");
  }
  const copyFrom = normalizePlanCode(input.copyFrom);
  const source = copyFrom
    ? await prisma.entitlementPlan.findUnique({ where: { code: copyFrom }, include: { features: true } })
    : null;
  const fallbackRows = input.audience === "business"
    ? businessLimitsToFeatureRows(EMPTY_BUSINESS_ENTITLEMENTS)
    : limitsToFeatureRows(EMPTY_ENTITLEMENTS);
  const copied = (source?.features ?? [])
    .filter((feature) =>
      input.audience === "business" ? isBusinessFeatureKey(feature.featureKey) : isEditableFeatureKey(feature.featureKey),
    )
    .map((feature) => ({
      featureKey: feature.featureKey,
      enabled: feature.enabled,
      limitInt: feature.limitInt,
      valueText: feature.valueText,
    }));
  const rows = copied.length ? copied : fallbackRows;
  try {
    const plan = await prisma.entitlementPlan.create({
      data: {
        code,
        name,
        description: input.description.trim().slice(0, 400),
        audience: input.audience,
        amountCents: Math.round(input.amountCents),
        priceLabel: input.priceLabel.trim().slice(0, 40) || (input.amountCents === 0 ? "Free" : ""),
        stripePriceId: stripePriceId || null,
        publicListing: input.publicListing,
        sortOrder: 50,
        active: true,
        limitsJson: {},
        featuresJson: {},
        features: {
          create: rows
            .filter((row) => isEditableFeatureKey(row.featureKey) || isBusinessFeatureKey(row.featureKey))
            .map((row) => ({
              featureKey: row.featureKey,
              enabled: row.enabled ?? true,
              limitInt: row.limitInt,
              valueText: row.valueText,
            })),
        },
      },
    });
    await prisma.auditLog.create({
      data: {
        actor: input.actor,
        action: "entitlement.plan.create",
        objectType: "EntitlementPlan",
        objectId: plan.id,
        after: { code, name, audience: input.audience },
      },
    });
    invalidateEntitlementCache();
    return plan;
  } catch (error) {
    const prismaCode = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (prismaCode === "P2002") throw new Error("That plan code already exists. Remove the unused plan before recreating it.");
    throw error;
  }
}

export async function updateEntitlementPlanMeta(input: {
  actor: string;
  code: string;
  name: string;
  description: string;
  amountCents: number;
  priceLabel: string;
  stripePriceId: string;
  publicListing: boolean;
  active: boolean;
}) {
  const code = normalizePlanCode(input.code);
  if (!code) throw new Error("Unknown plan");
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("A plan name is required.");
  if (!Number.isFinite(input.amountCents) || input.amountCents < 0 || input.amountCents > 10_000_000) {
    throw new Error("Monthly price must be zero or a positive amount in cents.");
  }
  const stripePriceId = input.stripePriceId.trim();
  if (stripePriceId && !/^price_[A-Za-z0-9]+$/.test(stripePriceId)) {
    throw new Error("A Stripe price id starts with price_.");
  }
  if (code === "STARTER" && !input.active) throw new Error("Starter stays active because new accounts use it.");
  const plan = await prisma.entitlementPlan.update({
    where: { code },
    data: {
      name,
      description: input.description.trim().slice(0, 400),
      amountCents: Math.round(input.amountCents),
      priceLabel: input.priceLabel.trim().slice(0, 40),
      stripePriceId: stripePriceId || null,
      publicListing: input.publicListing,
      active: input.active,
    },
  });
  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: "entitlement.plan.update",
      objectType: "EntitlementPlan",
      objectId: plan.id,
      after: { code, name, active: input.active, publicListing: input.publicListing },
    },
  });
  invalidateEntitlementCache();
}

export async function deleteEntitlementPlan(input: { actor: string; code: string }) {
  const code = normalizePlanCode(input.code);
  if (!code) throw new Error("Unknown plan");
  if (code === "STARTER") {
    throw new Error("Starter is the default for new accounts. Edit its features instead of removing it.");
  }
  const [users, creators, workspaces] = await Promise.all([
    prisma.user.count({ where: { planTier: code } }),
    prisma.creator.count({ where: { planTier: code } }),
    prisma.businessWorkspace.count({ where: { plan: code } }),
  ]);
  const assigned = users + creators + workspaces;
  if (assigned > 0) {
    throw new Error(`Move ${assigned} account${assigned === 1 ? "" : "s"} off ${code} before removing it. You can recreate the code after it is unused.`);
  }
  const plan = await prisma.entitlementPlan.findUnique({ where: { code } });
  if (!plan) throw new Error("Plan not found");
  await prisma.entitlementOverride.deleteMany({ where: { planCode: code } });
  await prisma.entitlementPlan.delete({ where: { code } });
  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: "entitlement.plan.delete",
      objectType: "EntitlementPlan",
      objectId: plan.id,
      before: { code, name: plan.name },
    },
  });
  invalidateEntitlementCache();
}

const CHECKOUT_SKU: Record<string, string> = {
  PLUS: "creator_plus",
  PRO: "creator_pro",
  BUSINESS_PRO: "business_pro",
  AGENCY: "agency",
};

function highlightFor(featureKey: string, enabled: boolean, limitInt: number | null): string | null {
  if (featureKey === "card.shortlink.enabled" && enabled) return "Profile short link";
  if (featureKey === "card.qr.enabled" && enabled) return "QR code";
  if (featureKey === "card.nfc.enabled" && enabled) return "NFC tag URL";
  if (featureKey === "card.qr.dynamic" && enabled) return "Change destination without a new QR or NFC tag";
  if (featureKey === "card.campaign_links.max" && (limitInt ?? 0) > 0) {
    return `${limitInt} campaign ${limitInt === 1 ? "link" : "links"}`;
  }
  if (featureKey === "business.shortlist.max" && (limitInt ?? 0) > 0) return `Shortlist of ${limitInt}`;
  if (featureKey === "business.inquiry.max" && (limitInt ?? 0) > 0) return `${limitInt} inquiries / month`;
  if (featureKey === "business.team_seats.max" && (limitInt ?? 0) > 0) return `${limitInt} team seats`;
  if (featureKey === "business.intelligence" && enabled) return "Intelligence";
  if (featureKey === "business.agency_workspace" && enabled) return "Agency workspace";
  return null;
}

export type PublicPlanOffer = {
  code: string;
  sku: string;
  name: string;
  priceLabel: string;
  amountCents: number;
  description: string;
  audience: "creator" | "business";
  checkout: boolean;
  highlights: string[];
};

export async function listPublicPlanOffers(): Promise<PublicPlanOffer[]> {
  await ensureLaunchEntitlements();
  const plans = await prisma.entitlementPlan.findMany({
    where: { active: true, publicListing: true },
    include: { features: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  return plans.map((plan) => {
    const highlights = plan.features
      .map((feature) => highlightFor(feature.featureKey, feature.enabled, feature.limitInt))
      .filter((line): line is string => Boolean(line))
      .slice(0, 5);
    return {
      code: plan.code,
      sku: CHECKOUT_SKU[plan.code] ?? plan.code,
      name: plan.name,
      priceLabel: plan.priceLabel || (plan.amountCents === 0 ? "Free" : ""),
      amountCents: plan.amountCents,
      description: plan.description ?? "",
      audience: plan.audience === "business" ? "business" : "creator",
      checkout: plan.amountCents > 0,
      highlights: highlights.length ? highlights : ["Features are set on this plan."],
    };
  });
}

export async function findActivePlan(code: string) {
  const normalized = normalizePlanCode(code);
  if (!normalized) return null;
  const plan = await prisma.entitlementPlan.findUnique({ where: { code: normalized } });
  if (!plan?.active) return null;
  return plan;
}
