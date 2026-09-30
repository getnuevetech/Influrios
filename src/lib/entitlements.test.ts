import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PLAN_ENTITLEMENTS,
  applyFeatureRows,
  cardChrome,
  decideCount,
  limitsToFeatureRows,
} from "./entitlements";

describe("entitlement catalog", () => {
  it("round-trips each launch plan through feature rows", () => {
    for (const code of ["STARTER", "PLUS", "PRO"] as const) {
      const restored = applyFeatureRows(
        PLAN_ENTITLEMENTS.STARTER,
        limitsToFeatureRows(PLAN_ENTITLEMENTS[code]),
      );
      assert.deepEqual(restored, PLAN_ENTITLEMENTS[code]);
    }
  });

  it("lets a stored social-link limit replace the launch default", () => {
    const starter = limitsToFeatureRows(PLAN_ENTITLEMENTS.STARTER);
    const patched = starter.map((row) =>
      row.featureKey === "card.social_links.max" ? { ...row, limitInt: 2 } : row,
    );
    const limits = applyFeatureRows(PLAN_ENTITLEMENTS.STARTER, patched);
    assert.equal(limits.socialLinksMax, 2);
    assert.equal(limits.standardQr, false);
  });

  it("applies a later override after the plan rows", () => {
    const plan = applyFeatureRows(
      PLAN_ENTITLEMENTS.STARTER,
      limitsToFeatureRows(PLAN_ENTITLEMENTS.STARTER),
    );
    const merged = applyFeatureRows(plan, [
      { featureKey: "card.qr.enabled", enabled: true, limitInt: null, valueText: null },
    ]);
    assert.equal(plan.standardQr, false);
    assert.equal(merged.standardQr, true);
  });

  it("ignores invalid enum values", () => {
    const limits = applyFeatureRows(PLAN_ENTITLEMENTS.PLUS, [
      { featureKey: "card.custom_theme.level", enabled: true, valueText: "gold-everywhere" },
    ]);
    assert.equal(limits.themes, "limited");
  });
});

describe("entitlement decisions", () => {
  it("allows a starter specialty count inside the limit", () => {
    assert.deepEqual(decideCount(PLAN_ENTITLEMENTS.STARTER, "specialtiesMax", 1, "STARTER"), {
      ok: true,
    });
  });

  it("denies a second starter specialty and points at Plus", () => {
    assert.deepEqual(decideCount(PLAN_ENTITLEMENTS.STARTER, "specialtiesMax", 2, "STARTER"), {
      ok: false,
      feature: "card.specialties.max",
      limit: 1,
      upgradePlanCode: "PLUS",
    });
  });
});

describe("card chrome", () => {
  it("hides QR and gold on starter limits", () => {
    const chrome = cardChrome(PLAN_ENTITLEMENTS.STARTER);
    assert.equal(chrome.showQr, false);
    assert.equal(chrome.gold, false);
    assert.equal(chrome.showShortlink, false);
    assert.equal(chrome.ctaLabel, "View Profile →");
  });

  it("shows a standard QR on plus limits without gold", () => {
    const chrome = cardChrome(PLAN_ENTITLEMENTS.PLUS);
    assert.equal(chrome.showQr, true);
    assert.equal(chrome.dynamicQr, false);
    assert.equal(chrome.gold, false);
    assert.equal(chrome.showShortlink, true);
    assert.equal(chrome.ctaLabel, "Contact →");
  });

  it("uses gold and the work CTA only when the theme entitlement is full", () => {
    const chrome = cardChrome(PLAN_ENTITLEMENTS.PRO);
    assert.equal(chrome.premium, true);
    assert.equal(chrome.gold, true);
    assert.equal(chrome.dynamicQr, true);
    assert.equal(chrome.ctaLabel, "Work With Me →");
  });
});
