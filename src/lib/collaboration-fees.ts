/**
 * Phase 12.1 — Collaboration Fee Rules Engine (addendum-aligned demo).
 * Fee % / fixed amounts are admin-configured, never hard-coded in UI flows.
 * Accepted quotes produce an immutable fee snapshot.
 */
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";

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

export type FeeStore = {
  rules: CollaborationFeeRule[];
  snapshots: FeeSnapshot[];
  jurisdictions: {
    code: string;
    label: string;
    protectedPaymentsEnabled: boolean;
    escrowTermAllowed: boolean;
  }[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "collaboration-fees.json");
const now = () => new Date().toISOString();
const id = (p: string) => `${p}_${randomBytes(4).toString("hex")}`;

const DEFAULT_STORE: FeeStore = {
  jurisdictions: [
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
  ],
  rules: [
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
  ],
  snapshots: [],
};

async function ensureStore(): Promise<FeeStore> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as FeeStore;
    return {
      ...DEFAULT_STORE,
      ...parsed,
      rules: parsed.rules?.length ? parsed.rules : DEFAULT_STORE.rules,
      jurisdictions: parsed.jurisdictions?.length
        ? parsed.jurisdictions
        : DEFAULT_STORE.jurisdictions,
      snapshots: parsed.snapshots ?? [],
    };
  } catch {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(STORE_PATH, JSON.stringify(DEFAULT_STORE, null, 2));
    } catch {
      // read-only build contexts
    }
    return structuredClone(DEFAULT_STORE);
  }
}

async function saveStore(store: FeeStore) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2));
  } catch {
    /* ignore write failures in read-only environments */
  }
}

export async function getFeeStore() {
  return ensureStore();
}

function matchesRule(rule: CollaborationFeeRule, ctx: FeeResolveContext, asOf: string) {
  if (!rule.active) return false;
  if (rule.effectiveFrom > asOf) return false;
  if (rule.jurisdiction !== "*" && rule.jurisdiction !== ctx.jurisdiction) return false;
  if (rule.serviceLevel !== "*" && rule.serviceLevel !== ctx.serviceLevel) return false;
  if (rule.minGrossCents != null && ctx.grossValueCents < rule.minGrossCents) return false;
  if (rule.maxGrossCents != null && ctx.grossValueCents > rule.maxGrossCents) return false;
  return true;
}

function calculateFeeCents(rule: CollaborationFeeRule, basisCents: number) {
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

/** Deterministic fee resolution — highest priority, then most specific jurisdiction/service. */
export async function resolveFee(ctx: FeeResolveContext) {
  const store = await ensureStore();
  const asOf = ctx.asOf ?? now();
  const candidates = store.rules
    .filter((r) => matchesRule(r, ctx, asOf))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const aSpec =
        (a.jurisdiction === "*" ? 0 : 1) + (a.serviceLevel === "*" ? 0 : 1);
      const bSpec =
        (b.jurisdiction === "*" ? 0 : 1) + (b.serviceLevel === "*" ? 0 : 1);
      return bSpec - aSpec;
    });

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

  const snapshot: FeeSnapshot = {
    id: id("feesnap"),
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
    createdAt: now(),
  };

  const store = await ensureStore();
  store.snapshots = [snapshot, ...store.snapshots].slice(0, 100);
  await saveStore(store);
  return snapshot;
}

export async function upsertFeeRule(input: Partial<CollaborationFeeRule> & { name: string }) {
  const store = await ensureStore();
  if (input.id) {
    const idx = store.rules.findIndex((r) => r.id === input.id);
    if (idx >= 0) {
      const prev = store.rules[idx];
      store.rules[idx] = {
        ...prev,
        ...input,
        version: prev.version + (input.active !== undefined || input.percentBps !== undefined || input.fixedCents !== undefined ? 1 : 0),
        id: prev.id,
      };
      await saveStore(store);
      return store.rules[idx];
    }
  }
  const rule: CollaborationFeeRule = {
    id: id("rule"),
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
  store.rules.push(rule);
  await saveStore(store);
  return rule;
}

export async function getJurisdiction(code: string) {
  const store = await ensureStore();
  return store.jurisdictions.find((j) => j.code === code) ?? null;
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
