/**
 * W6 / Dev Addendum §23.9 — homepage value-prop strip helpers.
 * Responsive matrix, market-aware Protected Payments claim, pillar analytics.
 */

import type { ValuePropositionItem } from "@/lib/cms";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { fundingTerm } from "@/lib/ledger";

export const VALUE_PROP_PILLAR_CLICK_EVENT = "homepage_value_prop_pillar_click";
export const VALUE_PROP_PROTECTED_PAYMENTS_KEY = "protected_payments";

/** Viewport bands from Dev Addendum §23.9 acceptance. */
export const VALUE_PROP_VIEWPORTS = {
  mobile: { maxWidth: 767, columns: 1 },
  tablet: { minWidth: 768, maxWidth: 1199, columns: 2 },
  desktop: { minWidth: 1200, columns: 4 },
} as const;

/**
 * Tailwind grid for pillars only (closing tagline is a sibling).
 * ≥1200 → up to 4 cols; 768–1199 → 2; &lt;768 → 1.
 * Fewer enabled pillars still fill evenly (no empty fifth ghost column).
 */
export function valuePropPillarGridClass(enabledCount: number): string {
  const n = Math.max(0, Math.min(4, Math.floor(enabledCount)));
  if (n <= 1) return "grid grid-cols-1 gap-6";
  if (n === 2) return "grid grid-cols-1 gap-6 md:grid-cols-2";
  if (n === 3) return "grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3";
  return "grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4";
}

export type MarketAwarePaymentsInput = {
  protectedPaymentsEnabled: boolean;
  escrowTermAllowed?: boolean;
};

/**
 * When protected payments are off for the home market, drop the payments pillar
 * so the strip never claims a capability the jurisdiction disables.
 * When on, keep the pillar and align title with fundingTerm (never “Escrow” unless allowed).
 */
export function applyMarketAwareProtectedPaymentsClaim(
  items: ValuePropositionItem[],
  market: MarketAwarePaymentsInput,
): ValuePropositionItem[] {
  const term = fundingTerm(Boolean(market.escrowTermAllowed));
  return items
    .filter((item) => {
      if (item.key !== VALUE_PROP_PROTECTED_PAYMENTS_KEY) return true;
      return market.protectedPaymentsEnabled;
    })
    .map((item) => {
      if (item.key !== VALUE_PROP_PROTECTED_PAYMENTS_KEY) return item;
      if (item.title === "Protected Payments" || item.title === "Escrow") {
        return { ...item, title: term === "Escrow" ? "Escrow" : "Protected Payments" };
      }
      return item;
    });
}

/** Enabled pillars in sort order — used by UI + layout class. */
export function enabledValuePropItems(items: ValuePropositionItem[]): ValuePropositionItem[] {
  return [...items].filter((i) => i.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function valuePropPillarClickMeta(input: {
  pillarKey: string;
  linkUrl?: string;
  title?: string;
}): Record<string, unknown> {
  return {
    pillarKey: String(input.pillarKey ?? "").slice(0, 80),
    linkUrl: String(input.linkUrl ?? "").slice(0, 200),
    title: String(input.title ?? "").slice(0, 120),
    surface: "homepage_value_proposition_strip",
  };
}

export async function recordValuePropPillarClick(input: {
  pillarKey: string;
  linkUrl?: string;
  title?: string;
}): Promise<void> {
  const key = String(input.pillarKey ?? "").trim();
  if (!key) return;
  try {
    await prisma.analyticsEvent.create({
      data: {
        eventType: VALUE_PROP_PILLAR_CLICK_EVENT,
        metaJson: valuePropPillarClickMeta(input) as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error("value-prop analytics event failed", error);
  }
}
