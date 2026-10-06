import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ValuePropositionItem } from "./cms";
import {
  VALUE_PROP_PILLAR_CLICK_EVENT,
  VALUE_PROP_PROTECTED_PAYMENTS_KEY,
  VALUE_PROP_VIEWPORTS,
  applyMarketAwareProtectedPaymentsClaim,
  enabledValuePropItems,
  valuePropPillarClickMeta,
  valuePropPillarGridClass,
} from "./value-proposition";

function item(partial: Partial<ValuePropositionItem> & { key: string }): ValuePropositionItem {
  return {
    enabled: true,
    sortOrder: 0,
    iconKey: "card",
    title: partial.key,
    description: "desc",
    microLabel: "",
    linkUrl: "/",
    accentToken: "violet",
    ...partial,
  };
}

describe("value-prop layout (§23.9)", () => {
  it("documents viewport column bands", () => {
    assert.equal(VALUE_PROP_VIEWPORTS.mobile.columns, 1);
    assert.equal(VALUE_PROP_VIEWPORTS.tablet.columns, 2);
    assert.equal(VALUE_PROP_VIEWPORTS.desktop.columns, 4);
    assert.equal(VALUE_PROP_VIEWPORTS.tablet.minWidth, 768);
    assert.equal(VALUE_PROP_VIEWPORTS.desktop.minWidth, 1200);
  });

  it("builds balanced grid classes for 1–4 enabled pillars", () => {
    assert.match(valuePropPillarGridClass(1), /grid-cols-1/);
    assert.match(valuePropPillarGridClass(2), /md:grid-cols-2/);
    assert.doesNotMatch(valuePropPillarGridClass(2), /xl:grid-cols-4/);
    assert.match(valuePropPillarGridClass(3), /xl:grid-cols-3/);
    assert.match(valuePropPillarGridClass(4), /xl:grid-cols-4/);
    assert.match(valuePropPillarGridClass(4), /md:grid-cols-2/);
  });
});

describe("market-aware Protected Payments claim", () => {
  const pillars = [
    item({ key: "influrios_card", sortOrder: 0 }),
    item({ key: VALUE_PROP_PROTECTED_PAYMENTS_KEY, sortOrder: 3, title: "Protected Payments" }),
  ];

  it("drops the payments pillar when the home market disables protected payments", () => {
    const next = applyMarketAwareProtectedPaymentsClaim(pillars, {
      protectedPaymentsEnabled: false,
    });
    assert.equal(next.some((row) => row.key === VALUE_PROP_PROTECTED_PAYMENTS_KEY), false);
    assert.equal(next.length, 1);
  });

  it("keeps the pillar and prefers Escrow title only when allowed", () => {
    const protectedOnly = applyMarketAwareProtectedPaymentsClaim(pillars, {
      protectedPaymentsEnabled: true,
      escrowTermAllowed: false,
    });
    assert.equal(protectedOnly.find((row) => row.key === VALUE_PROP_PROTECTED_PAYMENTS_KEY)?.title, "Protected Payments");

    const escrow = applyMarketAwareProtectedPaymentsClaim(pillars, {
      protectedPaymentsEnabled: true,
      escrowTermAllowed: true,
    });
    assert.equal(escrow.find((row) => row.key === VALUE_PROP_PROTECTED_PAYMENTS_KEY)?.title, "Escrow");
  });
});

describe("enabled pillars + analytics meta", () => {
  it("filters disabled and sorts", () => {
    const rows = enabledValuePropItems([
      item({ key: "b", enabled: true, sortOrder: 2 }),
      item({ key: "a", enabled: false, sortOrder: 0 }),
      item({ key: "c", enabled: true, sortOrder: 1 }),
    ]);
    assert.deepEqual(
      rows.map((row) => row.key),
      ["c", "b"],
    );
  });

  it("shapes pillar click meta for AnalyticsEvent", () => {
    const meta = valuePropPillarClickMeta({
      pillarKey: "collaboration_network",
      linkUrl: "/collaboration",
      title: "Collaboration Network",
    });
    assert.equal(meta.pillarKey, "collaboration_network");
    assert.equal(meta.surface, "homepage_value_proposition_strip");
    assert.equal(VALUE_PROP_PILLAR_CLICK_EVENT, "homepage_value_prop_pillar_click");
  });
});
