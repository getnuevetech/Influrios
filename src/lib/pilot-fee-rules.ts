/**
 * Pilot fee pairs. The quote matches jurisdiction, service level, and gross only,
 * so funding mode, relationship source, and promotion channel stay "*".
 * Fee type does not exclude a rule. Deferred fee types are omitted, not saved as active rows.
 * Managed introduction and managed campaign stay unconfigured.
 */
import type { CollaborationFeeRule } from "@/lib/collaboration-fees";

export const PILOT_FEE_EFFECTIVE_FROM = "2026-11-09T00:00:00.000Z";
export const PILOT_FEE_JURISDICTION = "US";

const shared = {
  version: 1,
  fundingMode: "*",
  relationshipSource: "*",
  promotionChannel: "*",
  fixedCents: 0,
  minFeeCents: 0,
  maxFeeCents: null,
  tierBands: [],
  effectiveFrom: PILOT_FEE_EFFECTIVE_FROM,
} satisfies Partial<CollaborationFeeRule>;

function pair(input: {
  id: string;
  name: string;
  serviceLevel: CollaborationFeeRule["serviceLevel"];
  feeType: CollaborationFeeRule["feeType"];
  method: CollaborationFeeRule["method"];
  percentBps: number;
  priority: number;
  active: boolean;
  jurisdiction: string;
  side: "business" | "influencer";
  notes: string;
}): CollaborationFeeRule {
  return {
    ...shared,
    id: input.id,
    name: input.name,
    active: input.active,
    priority: input.priority,
    jurisdiction: input.jurisdiction,
    serviceLevel: input.serviceLevel,
    feeType: input.feeType,
    method: input.method,
    percentBps: input.percentBps,
    payer: input.side === "business" ? "brand" : "creator",
    purpose: input.side === "business" ? "business_platform_fee" : "influencer_platform_fee",
    notes: input.notes,
  };
}

export const PILOT_FEE_RULES: CollaborationFeeRule[] = [
  pair({
    id: "rule_pilot_discovery_business",
    name: "Discovery Only · Business",
    serviceLevel: "discovery",
    feeType: "platform_service",
    method: "fixed",
    percentBps: 0,
    priority: 600,
    active: true,
    jurisdiction: "*",
    side: "business",
    notes: "Discovery stays free. Fixed zero. No gross bounds.",
  }),
  pair({
    id: "rule_pilot_discovery_influencer",
    name: "Discovery Only · Influencer",
    serviceLevel: "discovery",
    feeType: "platform_service",
    method: "fixed",
    percentBps: 0,
    priority: 600,
    active: true,
    jurisdiction: "*",
    side: "influencer",
    notes: "Discovery stays free. Fixed zero. No gross bounds.",
  }),
  pair({
    id: "rule_pilot_contracted_business",
    name: "Contracted Pilot · Business",
    serviceLevel: "contracted",
    feeType: "platform_service",
    method: "percent",
    percentBps: 500,
    priority: 700,
    active: true,
    jurisdiction: PILOT_FEE_JURISDICTION,
    side: "business",
    notes: "Pilot business fee, 500 bps added to gross. Self-sourced deals use this pair. Live funding stays off until the launch approvals.",
  }),
  pair({
    id: "rule_pilot_contracted_influencer",
    name: "Contracted Pilot · Influencer",
    serviceLevel: "contracted",
    feeType: "platform_service",
    method: "percent",
    percentBps: 250,
    priority: 700,
    active: true,
    jurisdiction: PILOT_FEE_JURISDICTION,
    side: "influencer",
    notes: "Pilot influencer fee, 250 bps deducted from gross compensation. Live funding stays off until the launch approvals.",
  }),
  pair({
    id: "rule_pilot_platform_match_business",
    name: "Platform Match · Business",
    serviceLevel: "platform_match",
    feeType: "platform_service",
    method: "percent",
    percentBps: 500,
    priority: 700,
    active: false,
    jurisdiction: PILOT_FEE_JURISDICTION,
    side: "business",
    notes: "Off. Quote a funded agreement as Contracted collaboration unless the signed deal keeps Platform match.",
  }),
  pair({
    id: "rule_pilot_platform_match_influencer",
    name: "Platform Match · Influencer",
    serviceLevel: "platform_match",
    feeType: "platform_service",
    method: "percent",
    percentBps: 250,
    priority: 700,
    active: false,
    jurisdiction: PILOT_FEE_JURISDICTION,
    side: "influencer",
    notes: "Off. Quote a funded agreement as Contracted collaboration unless the signed deal keeps Platform match.",
  }),
];
