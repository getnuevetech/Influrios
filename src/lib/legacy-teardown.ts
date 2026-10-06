/**
 * Collab OS P8 — freeze / teardown helpers for Phase 9–10 JSON demo stores
 * and creator_* → influencer_* deprecation telemetry.
 */
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { legacyDemoPaymentsEnabled } from "@/lib/legacy-demo-payments";

export const LEGACY_DEMO_JSON_FILES = [
  "protected-payments.json",
  "trust.json",
] as const;

const DATA_DIR = path.join(process.cwd(), "data");

/** Paths that remain only for the gated Phase 9/10 JSON demos. */
export const LEGACY_DEMO_ENDPOINTS = [
  { path: "/admin/payments", role: "admin", store: "protected-payments.json", productReplacement: "/admin/marketplace" },
  { path: "/trust (demo queue)", role: "public", store: "trust.json", productReplacement: "/payments + ledger disputes" },
  { path: "src/lib/protected-payments.ts", role: "lib", store: "protected-payments.json", productReplacement: "src/lib/marketplace-ledger.ts" },
  { path: "src/lib/trust.ts", role: "lib", store: "trust.json", productReplacement: "src/lib/milestone-disputes.ts" },
] as const;

/** Technical creator_* identifiers that stay for compatibility; public copy already says Influencer. */
export const CREATOR_STAR_COMPAT_FIELDS = [
  { key: "creator_plus", kind: "billing_sku", influencerLabel: "Influencer Plus" },
  { key: "creator_pro", kind: "billing_sku", influencerLabel: "Influencer Pro" },
  { key: "creator_claim", kind: "legal_trigger", influencerLabel: "influencer_claim" },
  { key: "creator_opportunity", kind: "marketplace_kind", influencerLabel: "influencer_opportunity" },
  { key: "business_creator_match", kind: "ai_function", influencerLabel: "business_influencer_match" },
  { key: "influrios_creator_session", kind: "cookie", influencerLabel: "influrios_influencer_session" },
] as const;

export type CreatorCompatField = (typeof CREATOR_STAR_COMPAT_FIELDS)[number]["key"];

export function isCreatorCompatField(value: string): value is CreatorCompatField {
  return CREATOR_STAR_COMPAT_FIELDS.some((row) => row.key === value);
}

export function influencerAliasForCreatorField(key: string): string | null {
  const row = CREATOR_STAR_COMPAT_FIELDS.find((item) => item.key === key);
  return row?.influencerLabel ?? null;
}

/**
 * Record deprecation telemetry when a creator_* technical field is still accepted.
 * Does not change request handling — warehouse continuity only.
 */
export async function recordCreatorFieldDeprecation(input: {
  field: string;
  source: string;
  actor?: string;
}): Promise<{ recorded: boolean; alias: string | null }> {
  const alias = influencerAliasForCreatorField(input.field);
  if (!alias && !isCreatorCompatField(input.field)) {
    return { recorded: false, alias: null };
  }
  const resolvedAlias = alias ?? influencerAliasForCreatorField(input.field);
  await prisma.auditLog
    .create({
      data: {
        actor: (input.actor ?? "system").slice(0, 120),
        action: "terminology.creator_field_deprecated",
        objectType: "CreatorCompatField",
        objectId: input.field.slice(0, 80),
        after: {
          field: input.field,
          influencerAlias: resolvedAlias,
          source: input.source.slice(0, 200),
          recordedAt: new Date().toISOString(),
        },
      },
    })
    .catch(() => null);
  return { recorded: true, alias: resolvedAlias };
}

/** When legacy demos are off, remove quarantined JSON files if present. */
export async function purgeLegacyDemoJsonFiles(): Promise<{
  frozen: boolean;
  removed: string[];
  kept: string[];
}> {
  const frozen = !(await legacyDemoPaymentsEnabled());
  if (!frozen) {
    return { frozen: false, removed: [], kept: [...LEGACY_DEMO_JSON_FILES] };
  }
  const removed: string[] = [];
  const kept: string[] = [];
  for (const name of LEGACY_DEMO_JSON_FILES) {
    const full = path.join(DATA_DIR, name);
    try {
      await fs.unlink(full);
      removed.push(name);
    } catch {
      kept.push(name);
    }
  }
  return { frozen: true, removed, kept };
}

/** Inventory snapshot for docs / ops. */
export function legacyInventorySnapshot() {
  return {
    endpoints: LEGACY_DEMO_ENDPOINTS,
    jsonFiles: LEGACY_DEMO_JSON_FILES,
    creatorCompatFields: CREATOR_STAR_COMPAT_FIELDS,
    signingDecision:
      "Keep /admin/signing as a non-goal shell until counsel approves e-sign. Contract wizard remains accept-only; do not claim provider success.",
    moneyEngine: "marketplace ledger (CollaborationFunding + LedgerEntry) is the sole product money path.",
  };
}
