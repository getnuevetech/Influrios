/**
 * Phase 12.1 / Phase O — Collaboration Fee Rules Engine.
 * Fee % / fixed amounts are admin-configured, never hard-coded in UI flows.
 * Accepted quotes produce an immutable fee snapshot (admin simulator freezes here;
 * marketplace prefunds freeze on CollaborationFunding.feeSnapshotJson).
 */
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";

export type FeeMethod = "percent" | "fixed" | "percent_plus_fixed";
export type FeePayer = "brand" | "creator" | "split";

export type CollaborationFeeRule = {
  id: string;
  name: string;
  version: number;
  active: boolean;
  priority: number;
  jurisdiction: string; // "*" = all
  serviceLevel: string; // discovery | platform_match | contracted | managed_intro | managed_campaign | *
  minGrossCents?: number;
  maxGrossCents?: number;
  method: FeeMethod;
  percentBps: number; // basis points, e.g. 1000 = 10%
  fixedCents: number;
  minFeeCents: number;
  maxFeeCents: number | null;
  payer: FeePayer;
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
};

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
    method: "percent",
    percentBps: 1000,
    fixedCents: 0,
    minFeeCents: 500,
    maxFeeCents: null,
    payer: "brand",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    notes: "Launch default — 10% of gross, min $5. Admin-editable.",
  },
  {
    id: "rule_us_managed",
    name: "US managed introduction",
    version: 1,
    active: true,
    priority: 200,
    jurisdiction: "US",
    serviceLevel: "managed_intro",
    method: "percent_plus_fixed",
    percentBps: 1500,
    fixedCents: 2500,
    minFeeCents: 2500,
    maxFeeCents: 50000,
    payer: "brand",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    notes: "Higher touch managed intro — 15% + $25, capped.",
  },
  {
    id: "rule_discovery",
    name: "Discovery-only (no transaction fee)",
    version: 1,
    active: true,
    priority: 50,
    jurisdiction: "*",
    serviceLevel: "discovery",
    method: "fixed",
    percentBps: 0,
    fixedCents: 0,
    minFeeCents: 0,
    maxFeeCents: 0,
    payer: "brand",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    notes: "Subscription-covered discovery connects — $0 transaction fee.",
  },
];

function asFeeMethod(value: string): FeeMethod {
  if (value === "fixed" || value === "percent_plus_fixed") return value;
  return "percent";
}

function asFeePayer(value: string): FeePayer {
  if (value === "creator" || value === "split") return value;
  return "brand";
}

function ruleFromRow(row: {
  id: string;
  name: string;
  version: number;
  active: boolean;
  priority: number;
  jurisdiction: string;
  serviceLevel: string;
  minGrossCents: number | null;
  maxGrossCents: number | null;
  method: string;
  percentBps: number;
  fixedCents: number;
  minFeeCents: number;
  maxFeeCents: number | null;
  payer: string;
  effectiveFrom: Date;
  notes: string;
}): CollaborationFeeRule {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    active: row.active,
    priority: row.priority,
    jurisdiction: row.jurisdiction,
    serviceLevel: row.serviceLevel,
    minGrossCents: row.minGrossCents ?? undefined,
    maxGrossCents: row.maxGrossCents ?? undefined,
    method: asFeeMethod(row.method),
    percentBps: row.percentBps,
    fixedCents: row.fixedCents,
    minFeeCents: row.minFeeCents,
    maxFeeCents: row.maxFeeCents,
    payer: asFeePayer(row.payer),
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
    minGrossCents: rule.minGrossCents ?? null,
    maxGrossCents: rule.maxGrossCents ?? null,
    method: rule.method,
    percentBps: rule.percentBps,
    fixedCents: rule.fixedCents,
    minFeeCents: rule.minFeeCents,
    maxFeeCents: rule.maxFeeCents,
    payer: rule.payer,
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
        version: Number(rule.version) || 1,
        active: Boolean(rule.active),
        priority: Number(rule.priority) || 100,
        jurisdiction: rule.jurisdiction || "*",
        serviceLevel: rule.serviceLevel || "contracted",
        percentBps: Number(rule.percentBps) || 0,
        fixedCents: Number(rule.fixedCents) || 0,
        minFeeCents: Number(rule.minFeeCents) || 0,
        maxFeeCents: rule.maxFeeCents == null ? null : Number(rule.maxFeeCents),
        effectiveFrom: rule.effectiveFrom || "2026-01-01T00:00:00.000Z",
        notes: rule.notes || "",
      }));
    const snapshots = (parsed.snapshots ?? [])
      .filter((snap): snap is FeeSnapshot => Boolean(snap?.id && snap?.ruleId))
      .map((snap) => ({
        ...snap,
        method: asFeeMethod(snap.method),
        payer: asFeePayer(snap.payer),
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
  if (rule.minGrossCents != null && ctx.grossValueCents < rule.minGrossCents) return false;
  if (rule.maxGrossCents != null && ctx.grossValueCents > rule.maxGrossCents) return false;
  return true;
}

export function calculateFeeCents(rule: CollaborationFeeRule, basisCents: number) {
  let fee = 0;
  if (rule.method === "percent" || rule.method === "percent_plus_fixed") {
    fee += Math.round((basisCents * rule.percentBps) / 10_000);
  }
  if (rule.method === "fixed" || rule.method === "percent_plus_fixed") {
    fee += rule.fixedCents;
  }
  fee = Math.max(fee, rule.minFeeCents);
  if (rule.maxFeeCents != null) fee = Math.min(fee, rule.maxFeeCents);
  return fee;
}

export function pickWinningRule(rules: CollaborationFeeRule[], ctx: FeeResolveContext, asOf: string) {
  return rules
    .filter((r) => matchesRule(r, ctx, asOf))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const aSpec =
        (a.jurisdiction === "*" ? 0 : 1) + (a.serviceLevel === "*" ? 0 : 1);
      const bSpec =
        (b.jurisdiction === "*" ? 0 : 1) + (b.serviceLevel === "*" ? 0 : 1);
      return bSpec - aSpec;
    });
}

/** Deterministic fee resolution — highest priority, then most specific jurisdiction/service. */
export async function resolveFee(ctx: FeeResolveContext) {
  await ensureFeeDefaults();
  const asOf = ctx.asOf ?? now();
  const rows = await prisma.collaborationFeeRule.findMany();
  const candidates = pickWinningRule(rows.map(ruleFromRow), ctx, asOf);

  const winner = candidates[0] ?? null;
  if (!winner) {
    return {
      rule: null as CollaborationFeeRule | null,
      feeCents: 0,
      explanation: "No active fee rule matched this context.",
      candidates: [] as CollaborationFeeRule[],
    };
  }

  const feeCents = calculateFeeCents(winner, ctx.grossValueCents);
  return {
    rule: winner,
    feeCents,
    explanation: `Matched “${winner.name}” (priority ${winner.priority}, v${winner.version}).`,
    candidates,
  };
}

/** Freeze a commercial fee snapshot — later rule edits must not mutate this. */
export async function createFeeSnapshot(ctx: FeeResolveContext) {
  const { rule, feeCents, explanation } = await resolveFee(ctx);
  if (!rule) throw new Error(explanation);

  const snapshotId = id("feesnap");
  const created = await prisma.collaborationFeeSnapshot.create({
    data: {
      id: snapshotId,
      ruleId: rule.id,
      ruleName: rule.name,
      ruleVersion: rule.version,
      method: rule.method,
      payer: rule.payer,
      basisCents: ctx.grossValueCents,
      percentBps: rule.percentBps,
      fixedCents: rule.fixedCents,
      calculatedFeeCents: feeCents,
      jurisdiction: ctx.jurisdiction,
      serviceLevel: ctx.serviceLevel,
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

export async function upsertFeeRule(input: Partial<CollaborationFeeRule> & { name: string }) {
  await ensureFeeDefaults();
  if (input.id) {
    const prev = await prisma.collaborationFeeRule.findUnique({ where: { id: input.id } });
    if (prev) {
      const bumpVersion =
        input.active !== undefined ||
        input.percentBps !== undefined ||
        input.fixedCents !== undefined;
      const updated = await prisma.collaborationFeeRule.update({
        where: { id: prev.id },
        data: {
          name: input.name ?? prev.name,
          active: input.active ?? prev.active,
          priority: input.priority ?? prev.priority,
          jurisdiction: input.jurisdiction ?? prev.jurisdiction,
          serviceLevel: input.serviceLevel ?? prev.serviceLevel,
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
          payer: input.payer ?? prev.payer,
          effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : prev.effectiveFrom,
          notes: input.notes ?? prev.notes,
          version: bumpVersion ? prev.version + 1 : prev.version,
        },
      });
      return ruleFromRow(updated);
    }
  }

  const rule: CollaborationFeeRule = {
    id: input.id || id("rule"),
    name: input.name,
    version: 1,
    active: input.active ?? true,
    priority: input.priority ?? 100,
    jurisdiction: input.jurisdiction ?? "*",
    serviceLevel: input.serviceLevel ?? "contracted",
    minGrossCents: input.minGrossCents,
    maxGrossCents: input.maxGrossCents,
    method: input.method ?? "percent",
    percentBps: input.percentBps ?? 1000,
    fixedCents: input.fixedCents ?? 0,
    minFeeCents: input.minFeeCents ?? 0,
    maxFeeCents: input.maxFeeCents ?? null,
    payer: input.payer ?? "brand",
    effectiveFrom: input.effectiveFrom ?? now(),
    notes: input.notes ?? "",
  };
  const created = await prisma.collaborationFeeRule.create({ data: ruleCreateData(rule) });
  return ruleFromRow(created);
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
