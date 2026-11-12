/**
 * Phase 12.1 / Phase O — Collaboration Fee Rules Engine.
 * Fee % / fixed amounts are admin-configured, never hard-coded in UI flows.
 * Accepted quotes produce an immutable fee snapshot (admin simulator freezes here;
 * marketplace prefunds freeze on CollaborationFunding.feeSnapshotJson).
 */
import { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { serviceLevelForFeeResolution } from "@/lib/attribution";
import { prisma } from "@/lib/db";

export type FeeMethod = "percent" | "fixed" | "percent_plus_fixed" | "waived" | "tiered" | "custom_enterprise";
export type FeePayer = "brand" | "creator" | "split";
export const FEE_PURPOSES = ["business_platform_fee", "influencer_platform_fee", "platform_activation", "legacy"] as const;
export type FeePurpose = (typeof FEE_PURPOSES)[number];

export const FEE_PURPOSE_LABELS: Record<FeePurpose, string> = {
  business_platform_fee: "Business Platform Fee",
  influencer_platform_fee: "Influencer Platform Fee",
  platform_activation: "Platform Activation Fee",
  legacy: "Legacy, not used on a new deal",
};

export const FEE_METHODS = [
  "percent",
  "fixed",
  "percent_plus_fixed",
  "waived",
  "tiered",
  "custom_enterprise",
] as const;

export const FEE_METHOD_LABELS: Record<FeeMethod, string> = {
  percent: "Percent",
  fixed: "Fixed",
  percent_plus_fixed: "Percent + fixed",
  waived: "Waived",
  tiered: "Tiered bands",
  custom_enterprise: "Custom enterprise",
};

export type FeeTierBand = { upToCents: number | null; percentBps: number };

/** Product Addendum §5 — fee types must remain distinct in product/reporting. */
export const FEE_TYPES = [
  "platform_service",
  "collaboration",
  "managed_intro",
  "managed_campaign",
  "success",
  "processing",
  "fx",
  "cancellation_dispute",
  "referral",
] as const;
export type FeeType = (typeof FEE_TYPES)[number];

/** Product Addendum §3 — service levels on every collaboration. */
export const SERVICE_LEVELS = [
  "discovery",
  "platform_match",
  "contracted",
  "managed_intro",
  "managed_campaign",
] as const;
export type ServiceLevel = (typeof SERVICE_LEVELS)[number];

export const SERVICE_LEVEL_LABELS: Record<ServiceLevel, string> = {
  discovery: "Discovery only",
  platform_match: "Platform match",
  contracted: "Contracted collaboration",
  managed_intro: "Managed introduction",
  managed_campaign: "Managed campaign",
};

export type ServiceLevelFeeCoverage = {
  serviceLevel: ServiceLevel;
  label: string;
  business: { id: string; name: string; version: number; active: boolean }[];
  influencer: { id: string; name: string; version: number; active: boolean }[];
};

/** A service level lists the rules that price that side. An inactive rule saved for that exact level is shown. An inactive rule for any level is not. */
export function serviceLevelFeeCoverage(rules: CollaborationFeeRule[]): ServiceLevelFeeCoverage[] {
  return SERVICE_LEVELS.map((serviceLevel) => {
    const covers = (side: "business" | "influencer") => {
      const matching = rules.filter(
        (rule) => feeRuleSide(rule) === side && (rule.serviceLevel === serviceLevel || rule.serviceLevel === "*"),
      );
      const active = matching.filter((rule) => rule.active);
      const chosen = active.length > 0 ? active : matching.filter((rule) => rule.serviceLevel === serviceLevel);
      return chosen.map((rule) => ({ id: rule.id, name: rule.name, version: rule.version, active: rule.active }));
    };
    return {
      serviceLevel,
      label: SERVICE_LEVEL_LABELS[serviceLevel],
      business: covers("business"),
      influencer: covers("influencer"),
    };
  });
}

export const FEE_TYPE_LABELS: Record<FeeType, string> = {
  platform_service: "Platform Service Fee",
  collaboration: "Collaboration Fee",
  managed_intro: "Managed Introduction Fee",
  managed_campaign: "Managed Campaign Fee",
  success: "Success Fee",
  processing: "Payment Processing Fee",
  fx: "FX Fee",
  cancellation_dispute: "Cancellation/Dispute Fee",
  referral: "Referral Fee",
};

export function asFeePurpose(value: string | undefined | null): FeePurpose {
  if (value && (FEE_PURPOSES as readonly string[]).includes(value)) return value as FeePurpose;
  return "legacy";
}

/**
 * Which side of a contract this rule prices.
 * A rule saved before fee purpose existed is stored as legacy. That default follows the payer
 * the admin already chose. An explicit legacy purpose with a split payer is not applied.
 */
export function feeRuleSide(rule: { payer?: string | null; purpose?: string | null }): "business" | "influencer" | null {
  if (rule.payer === "split") return null;
  if (rule.purpose === "platform_activation") return null;
  if (rule.purpose === "business_platform_fee" && rule.payer === "brand") return "business";
  if (rule.purpose === "influencer_platform_fee" && rule.payer === "creator") return "influencer";
  if (rule.purpose === "legacy" || rule.purpose == null || rule.purpose === "") {
    if (rule.payer === "brand") return "business";
    if (rule.payer === "creator") return "influencer";
  }
  return null;
}

export function feeRulePurposeLabel(rule: { payer?: string | null; purpose?: string | null }) {
  if (rule.purpose === "platform_activation" && rule.payer === "brand") return FEE_PURPOSE_LABELS.platform_activation;
  const side = feeRuleSide(rule);
  if (side === "business") return FEE_PURPOSE_LABELS.business_platform_fee;
  if (side === "influencer") return FEE_PURPOSE_LABELS.influencer_platform_fee;
  return "Not applied to a new deal";
}

export function asFeeType(value: string | undefined | null): FeeType {
  if (value && (FEE_TYPES as readonly string[]).includes(value)) return value as FeeType;
  return "collaboration";
}

export function asServiceLevel(value: string | undefined | null): ServiceLevel | "*" {
  if (!value || value === "*") return value === "*" ? "*" : "contracted";
  if ((SERVICE_LEVELS as readonly string[]).includes(value)) return value as ServiceLevel;
  // Alias from Product Addendum wording
  if (value === "discovery_only") return "discovery";
  return "contracted";
}

export function defaultFeeTypeForServiceLevel(serviceLevel: string): FeeType {
  if (serviceLevel === "discovery") return "platform_service";
  if (serviceLevel === "managed_intro") return "managed_intro";
  if (serviceLevel === "managed_campaign") return "managed_campaign";
  return "collaboration";
}

function usdToCents(value: string): number | null {
  const text = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  return Number.isFinite(cents) ? cents : null;
}

function integerText(value: string): number | null {
  const text = value.trim();
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
}

/** A fee rule stores only the terms that were entered. */
export function feeRuleDraft(input: {
  name?: string | null;
  priority?: string | null;
  jurisdiction?: string | null;
  serviceLevel?: string | null;
  feeType?: string | null;
  fundingMode?: string | null;
  relationshipSource?: string | null;
  promotionChannel?: string | null;
  method?: string | null;
  percentBps?: string | null;
  fixedUsd?: string | null;
  minFeeUsd?: string | null;
  maxFeeUsd?: string | null;
  payer?: string | null;
  purpose?: string | null;
  notes?: string | null;
  active?: boolean;
  tierBands?: FeeTierBand[];
}):
  | { ok: false; error: string }
  | {
      ok: true;
      name: string;
      priority: number;
      jurisdiction: string;
      serviceLevel: string;
      feeType: FeeType;
      fundingMode: string;
      relationshipSource: string;
      promotionChannel: string;
      method: FeeMethod;
      percentBps: number;
      fixedCents: number;
      minFeeCents: number;
      maxFeeCents: number | null;
      payer: FeePayer;
      purpose: FeePurpose;
      notes: string;
      active: boolean;
      tierBands: FeeTierBand[];
    } {
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "A rule name is required." };
  const priority = integerText(input.priority ?? "");
  if (priority == null) return { ok: false, error: "Enter a priority." };
  const jurisdiction = (input.jurisdiction ?? "").trim();
  if (!jurisdiction) return { ok: false, error: "Choose a jurisdiction." };
  const serviceLevel = (input.serviceLevel ?? "").trim();
  if (serviceLevel !== "*" && !(SERVICE_LEVELS as readonly string[]).includes(serviceLevel)) {
    return { ok: false, error: "Choose a service level." };
  }
  const feeType = (input.feeType ?? "").trim();
  if (!(FEE_TYPES as readonly string[]).includes(feeType)) {
    return { ok: false, error: "Choose a fee type." };
  }
  const fundingMode = (input.fundingMode ?? "").trim();
  if (!(FUNDING_MODE_CONDITIONS as readonly string[]).includes(fundingMode)) {
    return { ok: false, error: "Choose a funding mode." };
  }
  const relationshipSource = (input.relationshipSource ?? "").trim();
  if (!(RELATIONSHIP_SOURCE_CONDITIONS as readonly string[]).includes(relationshipSource)) {
    return { ok: false, error: "Choose a relationship source." };
  }
  const promotionChannel = (input.promotionChannel ?? "").trim();
  if (!(PROMOTION_CHANNEL_CONDITIONS as readonly string[]).includes(promotionChannel)) {
    return { ok: false, error: "Choose a promotion channel." };
  }
  const method = (input.method ?? "").trim();
  if (!(FEE_METHODS as readonly string[]).includes(method)) {
    return { ok: false, error: "Choose a fee method." };
  }
  const payer = (input.payer ?? "").trim();
  if (payer !== "brand" && payer !== "creator" && payer !== "split") {
    return { ok: false, error: "Choose who pays the fee." };
  }
  const purpose = (input.purpose ?? "").trim();
  if (!(FEE_PURPOSES as readonly string[]).includes(purpose)) {
    return { ok: false, error: "Choose a fee purpose." };
  }
  if (purpose === "platform_activation" && payer !== "brand") {
    return { ok: false, error: "The platform activation fee is paid by the business." };
  }
  if (purpose === "business_platform_fee" && payer !== "brand") {
    return { ok: false, error: "A business platform fee is paid by the business." };
  }
  if (purpose === "influencer_platform_fee" && payer !== "creator") {
    return { ok: false, error: "An influencer platform fee is deducted from the influencer." };
  }
  const percent = integerText(input.percentBps ?? "");
  const needsPercent = method === "percent" || method === "percent_plus_fixed";
  if (needsPercent && percent == null) return { ok: false, error: "Enter the percent in basis points." };
  if (method === "tiered" && !(input.tierBands ?? []).length) {
    return { ok: false, error: "Enter tier bands." };
  }
  const fixed = usdToCents(input.fixedUsd ?? "");
  const needsFixed = method === "fixed" || method === "percent_plus_fixed" || method === "custom_enterprise";
  if (needsFixed && fixed == null) return { ok: false, error: "Enter the fixed amount." };
  const minFee = (input.minFeeUsd ?? "").trim() ? usdToCents(input.minFeeUsd ?? "") : 0;
  if (minFee == null) return { ok: false, error: "Enter a minimum fee, or leave it blank." };
  const maxText = (input.maxFeeUsd ?? "").trim();
  const maxFee = maxText ? usdToCents(maxText) : null;
  if (maxText && maxFee == null) return { ok: false, error: "Enter a maximum fee, or leave it blank." };
  return {
    ok: true,
    name,
    priority,
    jurisdiction,
    serviceLevel,
    feeType: feeType as FeeType,
    fundingMode,
    relationshipSource,
    promotionChannel,
    method: method as FeeMethod,
    percentBps: percent ?? 0,
    fixedCents: fixed ?? 0,
    minFeeCents: minFee,
    maxFeeCents: maxFee,
    payer,
    purpose: purpose as FeePurpose,
    notes: (input.notes ?? "").trim(),
    active: input.active === true,
    tierBands: input.tierBands ?? [],
  };
}

/** The fee simulator uses the jurisdiction, service level, and gross amount that were entered. */
export function feeSimulationDraft(input: {
  jurisdiction?: string | null;
  serviceLevel?: string | null;
  grossUsd?: string | null;
}):
  | { ok: false; error: string }
  | { ok: true; jurisdiction: string; serviceLevel: ServiceLevel; grossValueCents: number; grossUsd: string } {
  const jurisdiction = (input.jurisdiction ?? "").trim();
  if (!jurisdiction) return { ok: false, error: "Choose a jurisdiction." };
  const serviceLevel = (input.serviceLevel ?? "").trim();
  if (!(SERVICE_LEVELS as readonly string[]).includes(serviceLevel)) {
    return { ok: false, error: "Choose a service level." };
  }
  const grossUsd = (input.grossUsd ?? "").trim();
  const grossValueCents = usdToCents(grossUsd);
  if (grossValueCents == null || grossValueCents <= 0) {
    return { ok: false, error: "Enter a gross amount." };
  }
  return { ok: true, jurisdiction, serviceLevel: serviceLevel as ServiceLevel, grossValueCents, grossUsd };
}

export type CollaborationFeeRule = {
  id: string;
  name: string;
  version: number;
  active: boolean;
  priority: number;
  jurisdiction: string; // "*" = all
  serviceLevel: string; // discovery | platform_match | contracted | managed_intro | managed_campaign | *
  feeType: FeeType;
  fundingMode: string; // FULL | STAGED | NONE | *
  relationshipSource: string; // organic | platform_match | managed_intro | referral | pre_existing | *
  promotionChannel: string; // none | sponsored | ambassador | affiliate | *
  minGrossCents?: number;
  maxGrossCents?: number;
  method: FeeMethod;
  percentBps: number; // basis points, e.g. 1000 = 10%
  fixedCents: number;
  minFeeCents: number;
  maxFeeCents: number | null;
  /** Tiered method bands: first matching upToCents wins; null upTo = catch-all. */
  tierBands: FeeTierBand[];
  payer: FeePayer;
  purpose: FeePurpose;
  effectiveFrom: string;
  notes: string;
};

export type FeeSnapshot = {
  id: string;
  ruleId: string;
  ruleName: string;
  ruleVersion: number;
  method: FeeMethod;
  payer: FeePayer;
  feeType: FeeType;
  basisCents: number;
  percentBps: number;
  fixedCents: number;
  calculatedFeeCents: number;
  jurisdiction: string;
  serviceLevel: string;
  createdAt: string;
};

export type FeeResolveContext = {
  jurisdiction: string;
  serviceLevel: string;
  grossValueCents: number;
  asOf?: string;
  /** W3.7 — active | expired | contested | pre_existing */
  attributionStatus?: string;
  fundingMode?: string;
  relationshipSource?: string;
  promotionChannel?: string;
};

export const FUNDING_MODE_CONDITIONS = ["*", "FULL", "STAGED", "NONE"] as const;
export const RELATIONSHIP_SOURCE_CONDITIONS = [
  "*",
  "organic",
  "platform_match",
  "managed_intro",
  "referral",
  "pre_existing",
] as const;
export const PROMOTION_CHANNEL_CONDITIONS = ["*", "none", "sponsored", "ambassador", "affiliate"] as const;

export type FeeJurisdiction = {
  code: string;
  label: string;
  protectedPaymentsEnabled: boolean;
  escrowTermAllowed: boolean;
};

export type FeeStore = {
  rules: CollaborationFeeRule[];
  snapshots: FeeSnapshot[];
  jurisdictions: FeeJurisdiction[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const LEGACY_STORE_PATH = path.join(DATA_DIR, "collaboration-fees.json");
const LEGACY_MIGRATED_PATH = path.join(DATA_DIR, "collaboration-fees.json.migrated");
const SNAPSHOT_CAP = 100;
const now = () => new Date().toISOString();
const id = (p: string) => `${p}_${randomBytes(4).toString("hex")}`;

const DEFAULT_JURISDICTIONS: FeeJurisdiction[] = [
  {
    code: "US",
    label: "United States",
    protectedPaymentsEnabled: true,
    escrowTermAllowed: false,
  },
  {
    code: "GB",
    label: "United Kingdom",
    protectedPaymentsEnabled: true,
    escrowTermAllowed: false,
  },
  {
    code: "NG",
    label: "Nigeria",
    protectedPaymentsEnabled: false,
    escrowTermAllowed: false,
  },
];

const DEFAULT_RULES: CollaborationFeeRule[] = [
  {
    id: "rule_default_contracted",
    name: "Default contracted collaboration fee",
    version: 1,
    active: true,
    priority: 100,
    jurisdiction: "*",
    serviceLevel: "contracted",
    feeType: "collaboration",
    fundingMode: "*",
    relationshipSource: "*",
    promotionChannel: "*",
    method: "percent",
    percentBps: 1000,
    fixedCents: 0,
    minFeeCents: 500,
    maxFeeCents: null,
    tierBands: [],
    payer: "brand",
    purpose: "legacy",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    notes: "Legacy brand rule. It is not a Business Platform Fee and is not copied to the influencer.",
  },
  {
    id: "rule_us_managed",
    name: "US managed introduction",
    version: 1,
    active: true,
    priority: 200,
    jurisdiction: "US",
    serviceLevel: "managed_intro",
    feeType: "managed_intro",
    fundingMode: "*",
    relationshipSource: "*",
    promotionChannel: "*",
    method: "percent_plus_fixed",
    percentBps: 1500,
    fixedCents: 2500,
    minFeeCents: 2500,
    maxFeeCents: 50000,
    tierBands: [],
    payer: "brand",
    purpose: "legacy",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    notes: "Legacy managed-intro rule. It does not price a new dual-fee deal.",
  },
  {
    id: "rule_discovery",
    name: "Discovery-only (no transaction fee)",
    version: 1,
    active: true,
    priority: 50,
    jurisdiction: "*",
    serviceLevel: "discovery",
    feeType: "platform_service",
    fundingMode: "*",
    relationshipSource: "*",
    promotionChannel: "*",
    method: "fixed",
    percentBps: 0,
    fixedCents: 0,
    minFeeCents: 0,
    maxFeeCents: 0,
    tierBands: [],
    payer: "brand",
    purpose: "legacy",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    notes: "Legacy discovery rule. A new deal needs an explicit waived or zero rule on each side.",
  },
];

function asFeeMethod(value: string): FeeMethod {
  if ((FEE_METHODS as readonly string[]).includes(value)) return value as FeeMethod;
  return "percent";
}

/** Tier rows from the fee form. A blank Up to means the remaining amount. */
export function tierBandsFromFields(upToUsd: string[], percentBps: string[]): FeeTierBand[] | { error: string } {
  const count = Math.max(upToUsd.length, percentBps.length);
  const bands: FeeTierBand[] = [];
  for (let index = 0; index < count; index += 1) {
    const upTo = (upToUsd[index] ?? "").trim();
    const bpsText = (percentBps[index] ?? "").trim();
    if (!upTo && !bpsText) continue;
    const bps = integerText(bpsText);
    if (bps == null) return { error: "Enter the tier percent in basis points." };
    if (!upTo) {
      bands.push({ upToCents: null, percentBps: bps });
      continue;
    }
    const upToCents = usdToCents(upTo);
    if (upToCents == null || upToCents <= 0) {
      return { error: "Enter the tier limit in dollars, or leave it blank for the remaining amount." };
    }
    bands.push({ upToCents, percentBps: bps });
  }
  return bands;
}

export function parseTierBands(value: unknown): FeeTierBand[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const upTo = (row as { upToCents?: unknown }).upToCents;
      const bps = (row as { percentBps?: unknown }).percentBps;
      if (!Number.isInteger(bps) || (bps as number) < 0) return null;
      const upToCents =
        upTo == null || upTo === ""
          ? null
          : Number.isInteger(upTo) && (upTo as number) > 0
            ? (upTo as number)
            : null;
      if (upTo != null && upTo !== "" && upToCents == null) return null;
      return { upToCents, percentBps: bps as number };
    })
    .filter((row): row is FeeTierBand => row != null);
}

export function feeFromTier(basisCents: number, bands: FeeTierBand[]) {
  if (!Number.isInteger(basisCents) || basisCents < 0 || bands.length === 0) return 0;
  const ordered = [...bands].sort((a, b) => {
    if (a.upToCents == null) return 1;
    if (b.upToCents == null) return -1;
    return a.upToCents - b.upToCents;
  });
  const hit = ordered.find((band) => band.upToCents == null || basisCents <= band.upToCents) ?? ordered[ordered.length - 1];
  return Math.round((basisCents * hit.percentBps) / 10_000);
}

function asFeePayer(value: string): FeePayer {
  if (value === "creator" || value === "split") return value;
  return "brand";
}

function storedRuleCondition(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function ruleFromRow(row: {
  id: string;
  name: string;
  version: number;
  active: boolean;
  priority: number;
  jurisdiction: string;
  serviceLevel: string;
  feeType: string;
  fundingMode?: string | null;
  relationshipSource?: string | null;
  promotionChannel?: string | null;
  minGrossCents: number | null;
  maxGrossCents: number | null;
  method: string;
  percentBps: number;
  fixedCents: number;
  minFeeCents: number;
  maxFeeCents: number | null;
  payer: string;
  purpose?: string | null;
  effectiveFrom: Date;
  notes: string;
  tierBandsJson?: unknown;
}): CollaborationFeeRule {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    active: row.active,
    priority: row.priority,
    jurisdiction: row.jurisdiction,
    serviceLevel: row.serviceLevel,
    feeType: asFeeType(row.feeType || defaultFeeTypeForServiceLevel(row.serviceLevel)),
    fundingMode: storedRuleCondition(row.fundingMode),
    relationshipSource: storedRuleCondition(row.relationshipSource),
    promotionChannel: storedRuleCondition(row.promotionChannel),
    minGrossCents: row.minGrossCents ?? undefined,
    maxGrossCents: row.maxGrossCents ?? undefined,
    method: asFeeMethod(row.method),
    percentBps: row.percentBps,
    fixedCents: row.fixedCents,
    minFeeCents: row.minFeeCents,
    maxFeeCents: row.maxFeeCents,
    tierBands: parseTierBands(row.tierBandsJson),
    payer: asFeePayer(row.payer),
    purpose: asFeePurpose(row.purpose),
    effectiveFrom: row.effectiveFrom.toISOString(),
    notes: row.notes,
  };
}

function snapshotFromRow(row: {
  id: string;
  ruleId: string;
  ruleName: string;
  ruleVersion: number;
  method: string;
  payer: string;
  feeType: string;
  basisCents: number;
  percentBps: number;
  fixedCents: number;
  calculatedFeeCents: number;
  jurisdiction: string;
  serviceLevel: string;
  createdAt: Date;
}): FeeSnapshot {
  return {
    id: row.id,
    ruleId: row.ruleId,
    ruleName: row.ruleName,
    ruleVersion: row.ruleVersion,
    method: asFeeMethod(row.method),
    payer: asFeePayer(row.payer),
    feeType: asFeeType(row.feeType || defaultFeeTypeForServiceLevel(row.serviceLevel)),
    basisCents: row.basisCents,
    percentBps: row.percentBps,
    fixedCents: row.fixedCents,
    calculatedFeeCents: row.calculatedFeeCents,
    jurisdiction: row.jurisdiction,
    serviceLevel: row.serviceLevel,
    createdAt: row.createdAt.toISOString(),
  };
}

function ruleCreateData(rule: CollaborationFeeRule) {
  return {
    id: rule.id,
    name: rule.name,
    version: rule.version,
    active: rule.active,
    priority: rule.priority,
    jurisdiction: rule.jurisdiction,
    serviceLevel: rule.serviceLevel,
    feeType: rule.feeType,
    fundingMode: storedRuleCondition(rule.fundingMode),
    relationshipSource: storedRuleCondition(rule.relationshipSource),
    promotionChannel: storedRuleCondition(rule.promotionChannel),
    minGrossCents: rule.minGrossCents ?? null,
    maxGrossCents: rule.maxGrossCents ?? null,
    method: rule.method,
    percentBps: rule.percentBps,
    fixedCents: rule.fixedCents,
    minFeeCents: rule.minFeeCents,
    maxFeeCents: rule.maxFeeCents,
    tierBandsJson: rule.tierBands.length ? rule.tierBands : undefined,
    payer: rule.payer,
    purpose: rule.purpose || "legacy",
    effectiveFrom: new Date(rule.effectiveFrom),
    notes: rule.notes,
  };
}

async function readLegacyStore(): Promise<{
  rules: CollaborationFeeRule[];
  snapshots: FeeSnapshot[];
  jurisdictions: FeeJurisdiction[];
} | null> {
  try {
    const raw = await fs.readFile(LEGACY_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<FeeStore>;
    const rules = (parsed.rules ?? [])
      .filter((rule): rule is CollaborationFeeRule => Boolean(rule?.id && rule?.name))
      .map((rule) => ({
        ...rule,
        method: asFeeMethod(rule.method),
        payer: asFeePayer(rule.payer),
        feeType: asFeeType(rule.feeType || defaultFeeTypeForServiceLevel(rule.serviceLevel || "contracted")),
        fundingMode: storedRuleCondition(rule.fundingMode),
        relationshipSource: storedRuleCondition(rule.relationshipSource),
        promotionChannel: storedRuleCondition(rule.promotionChannel),
        version: Number(rule.version) || 1,
        active: Boolean(rule.active),
        priority: Number(rule.priority) || 100,
        jurisdiction: rule.jurisdiction || "*",
        serviceLevel: rule.serviceLevel || "contracted",
        percentBps: Number(rule.percentBps) || 0,
        fixedCents: Number(rule.fixedCents) || 0,
        minFeeCents: Number(rule.minFeeCents) || 0,
        maxFeeCents: rule.maxFeeCents == null ? null : Number(rule.maxFeeCents),
        tierBands: parseTierBands((rule as { tierBands?: unknown }).tierBands),
        effectiveFrom: rule.effectiveFrom || "2026-01-01T00:00:00.000Z",
        notes: rule.notes || "",
      }));
    const snapshots = (parsed.snapshots ?? [])
      .filter((snap): snap is FeeSnapshot => Boolean(snap?.id && snap?.ruleId))
      .map((snap) => ({
        ...snap,
        method: asFeeMethod(snap.method),
        payer: asFeePayer(snap.payer),
        feeType: asFeeType(snap.feeType || defaultFeeTypeForServiceLevel(snap.serviceLevel || "contracted")),
        ruleVersion: Number(snap.ruleVersion) || 1,
        basisCents: Number(snap.basisCents) || 0,
        percentBps: Number(snap.percentBps) || 0,
        fixedCents: Number(snap.fixedCents) || 0,
        calculatedFeeCents: Number(snap.calculatedFeeCents) || 0,
        jurisdiction: snap.jurisdiction || "*",
        serviceLevel: snap.serviceLevel || "contracted",
        createdAt: snap.createdAt || now(),
      }));
    const jurisdictions = (parsed.jurisdictions ?? [])
      .filter((row): row is FeeJurisdiction => Boolean(row?.code && row?.label))
      .map((row) => ({
        code: row.code,
        label: row.label,
        protectedPaymentsEnabled: Boolean(row.protectedPaymentsEnabled),
        escrowTermAllowed: Boolean(row.escrowTermAllowed),
      }));
    return { rules, snapshots, jurisdictions };
  } catch {
    return null;
  }
}

async function markLegacyMigrated() {
  try {
    await fs.rename(LEGACY_STORE_PATH, LEGACY_MIGRATED_PATH);
  } catch {
    try {
      await fs.unlink(LEGACY_STORE_PATH);
    } catch {
      /* ignore */
    }
  }
}

async function ensureJurisdictions(seed?: FeeJurisdiction[]) {
  const existing = await prisma.collaborationJurisdiction.count();
  if (existing > 0) return;
  const rows = seed?.length ? seed : DEFAULT_JURISDICTIONS;
  for (const row of rows) {
    await prisma.collaborationJurisdiction.upsert({
      where: { code: row.code },
      update: {},
      create: {
        code: row.code,
        label: row.label,
        protectedPaymentsEnabled: row.protectedPaymentsEnabled,
        escrowTermAllowed: row.escrowTermAllowed,
        currency: row.code === "GB" ? "GBP" : row.code === "NG" ? "NGN" : "USD",
        minorDigits: 2,
        providerCode: "primary",
      },
    });
  }
}

async function ensureFeeDefaults() {
  const ruleCount = await prisma.collaborationFeeRule.count();
  if (ruleCount > 0) {
    await ensureJurisdictions();
    return;
  }

  const legacy = await readLegacyStore();
  const rules = legacy?.rules?.length ? legacy.rules : DEFAULT_RULES;
  const snapshots = legacy?.snapshots ?? [];

  await prisma.$transaction(async (tx) => {
    const stillEmpty = await tx.collaborationFeeRule.count();
    if (stillEmpty > 0) return;
    for (const rule of rules) {
      await tx.collaborationFeeRule.create({ data: ruleCreateData(rule) });
    }
    for (const snap of snapshots.slice(0, SNAPSHOT_CAP)) {
      await tx.collaborationFeeSnapshot.create({
        data: {
          id: snap.id,
          ruleId: snap.ruleId,
          ruleName: snap.ruleName,
          ruleVersion: snap.ruleVersion,
          method: snap.method,
          payer: snap.payer,
          feeType: snap.feeType,
          basisCents: snap.basisCents,
          percentBps: snap.percentBps,
          fixedCents: snap.fixedCents,
          calculatedFeeCents: snap.calculatedFeeCents,
          jurisdiction: snap.jurisdiction,
          serviceLevel: snap.serviceLevel,
          createdAt: new Date(snap.createdAt),
        },
      });
    }
  });

  await ensureJurisdictions(legacy?.jurisdictions);
  if (legacy) await markLegacyMigrated();
}

export async function getFeeStore(): Promise<FeeStore> {
  await ensureFeeDefaults();
  const [rules, snapshots, jurisdictions] = await Promise.all([
    prisma.collaborationFeeRule.findMany({ orderBy: [{ priority: "desc" }, { id: "asc" }] }),
    prisma.collaborationFeeSnapshot.findMany({
      orderBy: { createdAt: "desc" },
      take: SNAPSHOT_CAP,
    }),
    prisma.collaborationJurisdiction.findMany({ orderBy: { code: "asc" } }),
  ]);
  return {
    rules: rules.map(ruleFromRow),
    snapshots: snapshots.map(snapshotFromRow),
    jurisdictions: jurisdictions.map((row) => ({
      code: row.code,
      label: row.label,
      protectedPaymentsEnabled: row.protectedPaymentsEnabled,
      escrowTermAllowed: row.escrowTermAllowed,
    })),
  };
}

export function matchesRule(rule: CollaborationFeeRule, ctx: FeeResolveContext, asOf: string) {
  if (!rule.active) return false;
  if (rule.effectiveFrom > asOf) return false;
  if (rule.jurisdiction !== "*" && rule.jurisdiction !== ctx.jurisdiction) return false;
  if (rule.serviceLevel !== "*" && rule.serviceLevel !== ctx.serviceLevel) return false;
  const fundingMode = (ctx.fundingMode ?? "").trim();
  if (rule.fundingMode !== "*" && rule.fundingMode !== fundingMode) return false;
  const relationshipSource = (ctx.relationshipSource ?? "").trim();
  if (rule.relationshipSource !== "*" && rule.relationshipSource !== relationshipSource) return false;
  const promotionChannel = (ctx.promotionChannel ?? "").trim();
  if (rule.promotionChannel !== "*" && rule.promotionChannel !== promotionChannel) return false;
  if (rule.minGrossCents != null && ctx.grossValueCents < rule.minGrossCents) return false;
  if (rule.maxGrossCents != null && ctx.grossValueCents > rule.maxGrossCents) return false;
  return true;
}

export function calculateFeeCents(rule: CollaborationFeeRule, basisCents: number) {
  if (rule.method === "waived") return 0;
  let fee = 0;
  if (rule.method === "tiered") {
    fee = feeFromTier(basisCents, rule.tierBands);
  } else if (rule.method === "custom_enterprise") {
    // Negotiated override — fixedCents is the contracted enterprise fee.
    fee = rule.fixedCents;
  } else {
    if (rule.method === "percent" || rule.method === "percent_plus_fixed") {
      fee += Math.round((basisCents * rule.percentBps) / 10_000);
    }
    if (rule.method === "fixed" || rule.method === "percent_plus_fixed") {
      fee += rule.fixedCents;
    }
  }
  fee = Math.max(fee, rule.minFeeCents);
  if (rule.maxFeeCents != null) fee = Math.min(fee, rule.maxFeeCents);
  return fee;
}

/** Integer minor units. Percent rounding is half away from zero. Records whether the floor or cap applied. */
export function explainFeeApplication(rule: CollaborationFeeRule, basisCents: number) {
  let raw = 0;
  if (rule.method !== "waived") {
    if (rule.method === "tiered") raw = feeFromTier(basisCents, rule.tierBands);
    else if (rule.method === "custom_enterprise") raw = rule.fixedCents;
    else {
      if (rule.method === "percent" || rule.method === "percent_plus_fixed") {
        raw += Math.round((basisCents * rule.percentBps) / 10_000);
      }
      if (rule.method === "fixed" || rule.method === "percent_plus_fixed") raw += rule.fixedCents;
    }
  }
  const floorApplied = rule.method !== "waived" && raw < rule.minFeeCents;
  const afterFloor = rule.method === "waived" ? 0 : Math.max(raw, rule.minFeeCents);
  const capApplied = rule.maxFeeCents != null && afterFloor > rule.maxFeeCents;
  const feeCents = rule.maxFeeCents != null ? Math.min(afterFloor, rule.maxFeeCents) : afterFloor;
  return { feeCents, floorApplied, capApplied, rounding: "half_away_from_zero" as const };
}

export function feeRuleRateLabel(rule: Pick<CollaborationFeeRule, "method" | "percentBps" | "fixedCents">) {
  if (rule.method === "percent") return `${(rule.percentBps / 100).toFixed(2)}% of the gross influencer compensation`;
  if (rule.method === "fixed") return "a fixed amount";
  if (rule.method === "percent_plus_fixed") return `${(rule.percentBps / 100).toFixed(2)}% plus a fixed amount`;
  if (rule.method === "waived") return "waived";
  if (rule.method === "tiered") return "tiered on the gross influencer compensation";
  return "an enterprise amount";
}

export function pickWinningRule(rules: CollaborationFeeRule[], ctx: FeeResolveContext, asOf: string) {
  return rules
    .filter((r) => matchesRule(r, ctx, asOf))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return ruleSpecificity(b) - ruleSpecificity(a);
    });
}

export function ruleSpecificity(rule: CollaborationFeeRule) {
  return (
    (rule.jurisdiction === "*" ? 0 : 1) +
    (rule.serviceLevel === "*" ? 0 : 1) +
    (rule.fundingMode === "*" ? 0 : 1) +
    (rule.relationshipSource === "*" ? 0 : 1) +
    (rule.promotionChannel === "*" ? 0 : 1)
  );
}

export function explainFeeWinner(
  winner: CollaborationFeeRule,
  candidates: CollaborationFeeRule[],
  feeCents: number,
) {
  const runnerUp = candidates[1];
  const parts = [
    `Winner “${winner.name}” (${FEE_TYPE_LABELS[winner.feeType]}, priority ${winner.priority}, specificity ${ruleSpecificity(winner)}, v${winner.version}) → ${feeCents}¢.`,
  ];
  if (runnerUp) {
    parts.push(
      `Next: “${runnerUp.name}” (priority ${runnerUp.priority}, specificity ${ruleSpecificity(runnerUp)}).`,
    );
  } else {
    parts.push("No other matching rules.");
  }
  return parts.join(" ");
}

/** Deterministic fee resolution — highest priority, then most specific jurisdiction/service. */
export async function resolveFee(ctx: FeeResolveContext) {
  await ensureFeeDefaults();
  const asOf = ctx.asOf ?? now();
  const resolvedLevel = serviceLevelForFeeResolution({
    requestedServiceLevel: ctx.serviceLevel,
    attributionStatus: ctx.attributionStatus,
  });
  const effectiveCtx: FeeResolveContext = { ...ctx, serviceLevel: resolvedLevel };
  const rows = await prisma.collaborationFeeRule.findMany();
  const candidates = pickWinningRule(rows.map(ruleFromRow), effectiveCtx, asOf);

  const winner = candidates[0] ?? null;
  if (!winner) {
    return {
      rule: null as CollaborationFeeRule | null,
      feeCents: 0,
      explanation: "No active fee rule matched this context.",
      candidates: [] as CollaborationFeeRule[],
    };
  }

  const feeCents = calculateFeeCents(winner, effectiveCtx.grossValueCents);
  return {
    rule: winner,
    feeCents,
    explanation: explainFeeWinner(winner, candidates, feeCents),
    candidates,
  };
}

async function persistFeeSnapshot(input: {
  rule: CollaborationFeeRule;
  feeCents: number;
  basisCents: number;
  jurisdiction: string;
  serviceLevel: string;
}) {
  const snapshotId = id("feesnap");
  const created = await prisma.collaborationFeeSnapshot.create({
    data: {
      id: snapshotId,
      ruleId: input.rule.id,
      ruleName: input.rule.name,
      ruleVersion: input.rule.version,
      method: input.rule.method,
      payer: input.rule.payer,
      feeType: input.rule.feeType,
      basisCents: input.basisCents,
      percentBps: input.rule.percentBps,
      fixedCents: input.rule.fixedCents,
      calculatedFeeCents: input.feeCents,
      jurisdiction: input.jurisdiction,
      serviceLevel: input.serviceLevel,
    },
  });

  const excess = await prisma.collaborationFeeSnapshot.findMany({
    orderBy: { createdAt: "desc" },
    skip: SNAPSHOT_CAP,
    select: { id: true },
  });
  if (excess.length) {
    await prisma.collaborationFeeSnapshot.deleteMany({
      where: { id: { in: excess.map((row) => row.id) } },
    });
  }

  return snapshotFromRow(created);
}

/** Freeze one already-resolved side. Later rule edits must not mutate this row. */
export async function createFeeSnapshotForRule(input: {
  rule: CollaborationFeeRule;
  feeCents: number;
  basisCents: number;
  jurisdiction: string;
  serviceLevel: string;
}) {
  return persistFeeSnapshot(input);
}

/** Freeze a commercial fee snapshot — later rule edits must not mutate this. */
export async function createFeeSnapshot(ctx: FeeResolveContext) {
  const { rule, feeCents, explanation } = await resolveFee(ctx);
  if (!rule) throw new Error(explanation);
  return persistFeeSnapshot({
    rule,
    feeCents,
    basisCents: ctx.grossValueCents,
    jurisdiction: ctx.jurisdiction,
    serviceLevel: ctx.serviceLevel,
  });
}

export async function upsertFeeRule(input: Partial<CollaborationFeeRule> & { name: string }) {
  await ensureFeeDefaults();
  if (input.id) {
    const prev = await prisma.collaborationFeeRule.findUnique({ where: { id: input.id } });
    if (prev) {
      const bumpVersion =
        input.active !== undefined ||
        input.percentBps !== undefined ||
        input.fixedCents !== undefined ||
        input.method !== undefined ||
        input.tierBands !== undefined ||
        input.minFeeCents !== undefined ||
        input.maxFeeCents !== undefined ||
        input.purpose !== undefined ||
        input.payer !== undefined;
      const updated = await prisma.collaborationFeeRule.update({
        where: { id: prev.id },
        data: {
          name: input.name ?? prev.name,
          active: input.active ?? prev.active,
          priority: input.priority ?? prev.priority,
          jurisdiction: input.jurisdiction ?? prev.jurisdiction,
          serviceLevel: input.serviceLevel ?? prev.serviceLevel,
          feeType: input.feeType ?? prev.feeType,
          fundingMode: input.fundingMode ?? prev.fundingMode,
          relationshipSource: input.relationshipSource ?? prev.relationshipSource,
          promotionChannel: input.promotionChannel ?? prev.promotionChannel,
          minGrossCents:
            input.minGrossCents !== undefined ? input.minGrossCents ?? null : prev.minGrossCents,
          maxGrossCents:
            input.maxGrossCents !== undefined ? input.maxGrossCents ?? null : prev.maxGrossCents,
          method: input.method ?? prev.method,
          percentBps: input.percentBps ?? prev.percentBps,
          fixedCents: input.fixedCents ?? prev.fixedCents,
          minFeeCents: input.minFeeCents ?? prev.minFeeCents,
          maxFeeCents:
            input.maxFeeCents !== undefined ? input.maxFeeCents : prev.maxFeeCents,
          tierBandsJson:
            input.tierBands !== undefined
              ? input.tierBands.length
                ? (input.tierBands as unknown as Prisma.InputJsonValue)
                : Prisma.DbNull
              : undefined,
          payer: input.payer ?? prev.payer,
          purpose: input.purpose ?? prev.purpose,
          effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : prev.effectiveFrom,
          notes: input.notes ?? prev.notes,
          version: bumpVersion ? prev.version + 1 : prev.version,
        },
      });
      return ruleFromRow(updated);
    }
  }

  if (
    !input.name.trim() ||
    input.priority == null ||
    !Number.isInteger(input.priority) ||
    !input.jurisdiction?.trim() ||
    !input.serviceLevel?.trim() ||
    !input.feeType ||
    !input.fundingMode ||
    !input.relationshipSource ||
    !input.promotionChannel ||
    !input.method ||
    input.percentBps == null ||
    !Number.isInteger(input.percentBps) ||
    input.fixedCents == null ||
    input.minFeeCents == null ||
    !input.payer ||
    !input.purpose
  ) {
    throw new Error(
      "A fee rule needs the name, priority, jurisdiction, service level, fee type, fee purpose, conditions, method, amounts, and payer that were entered.",
    );
  }

  const rule: CollaborationFeeRule = {
    id: input.id || id("rule"),
    name: input.name.trim(),
    version: 1,
    active: input.active === true,
    priority: input.priority,
    jurisdiction: input.jurisdiction.trim(),
    serviceLevel: input.serviceLevel.trim(),
    feeType: input.feeType,
    fundingMode: input.fundingMode,
    relationshipSource: input.relationshipSource,
    promotionChannel: input.promotionChannel,
    minGrossCents: input.minGrossCents,
    maxGrossCents: input.maxGrossCents,
    method: input.method,
    percentBps: input.percentBps,
    fixedCents: input.fixedCents,
    minFeeCents: input.minFeeCents,
    maxFeeCents: input.maxFeeCents ?? null,
    tierBands: input.tierBands ?? [],
    payer: input.payer,
    purpose: input.purpose,
    effectiveFrom: input.effectiveFrom ?? now(),
    notes: input.notes ?? "",
  };
  const created = await prisma.collaborationFeeRule.create({ data: ruleCreateData(rule) });
  return ruleFromRow(created);
}

export async function deleteFeeRule(ruleId: string) {
  const id = ruleId.trim();
  if (!id) throw new Error("Choose a fee rule.");
  const existing = await prisma.collaborationFeeRule.findUnique({ where: { id } });
  if (!existing) throw new Error("Fee rule not found.");
  await prisma.collaborationFeeRule.delete({ where: { id } });
  return { removed: true as const, id, name: existing.name };
}

export async function deleteFeeSnapshot(snapshotId: string) {
  const id = snapshotId.trim();
  if (!id) throw new Error("Choose a fee snapshot.");
  const existing = await prisma.collaborationFeeSnapshot.findUnique({ where: { id } });
  if (!existing) throw new Error("Fee snapshot not found.");
  await prisma.collaborationFeeSnapshot.delete({ where: { id } });
  return { removed: true as const, id };
}

/** Create or update the fee-page jurisdiction gate fields (PA004). */
export async function upsertJurisdictionGate(input: {
  code: string;
  label: string;
  protectedPaymentsEnabled: boolean;
  escrowTermAllowed: boolean;
}) {
  await ensureFeeDefaults();
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new Error("Use a two-letter jurisdiction code (e.g. US, NG).");
  const label = input.label.trim().slice(0, 80);
  if (!label) throw new Error("A jurisdiction label is required.");
  const protectedPaymentsEnabled = Boolean(input.protectedPaymentsEnabled);
  const escrowTermAllowed = Boolean(input.escrowTermAllowed) && protectedPaymentsEnabled;
  const existing = await prisma.collaborationJurisdiction.findUnique({ where: { code } });
  if (existing) {
    return prisma.collaborationJurisdiction.update({
      where: { code },
      data: { label, protectedPaymentsEnabled, escrowTermAllowed },
    });
  }
  return prisma.collaborationJurisdiction.create({
    data: {
      code,
      label,
      protectedPaymentsEnabled,
      escrowTermAllowed,
    },
  });
}

export async function deleteJurisdictionGate(codeRaw: string) {
  await ensureFeeDefaults();
  const code = codeRaw.trim().toUpperCase();
  if (!code) throw new Error("Choose a jurisdiction.");
  const existing = await prisma.collaborationJurisdiction.findUnique({ where: { code } });
  if (!existing) throw new Error("Jurisdiction not found.");
  await prisma.collaborationJurisdiction.delete({ where: { code } });
  return { removed: true as const, code, label: existing.label };
}

export async function getJurisdiction(code: string) {
  await ensureFeeDefaults();
  const row = await prisma.collaborationJurisdiction.findUnique({ where: { code } });
  if (!row) return null;
  return {
    code: row.code,
    label: row.label,
    protectedPaymentsEnabled: row.protectedPaymentsEnabled,
    escrowTermAllowed: row.escrowTermAllowed,
  };
}

export function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function protectedPaymentLabel(escrowTermAllowed: boolean) {
  return escrowTermAllowed ? "Escrow" : "Protected Payment";
}
