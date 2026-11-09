import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { CollaborationFeeRule } from "./collaboration-fees";
import { quoteDualPlatformFees, quotePartyPlatformFee } from "./dual-platform-fees";
import { PILOT_FEE_RULES } from "./pilot-fee-rules";

const AS_OF = "2026-11-09T12:00:00.000Z";

function legacyOverlap(overrides: Partial<CollaborationFeeRule> = {}): CollaborationFeeRule {
  return {
    ...PILOT_FEE_RULES[2],
    id: "rule_legacy_overlap",
    name: "Legacy 80/20",
    active: false,
    priority: 900,
    percentBps: 8000,
    jurisdiction: "*",
    serviceLevel: "*",
    purpose: "business_platform_fee",
    payer: "brand",
    notes: "Preserved for history. Excluded from new-deal selection.",
    ...overrides,
  };
}

describe("pilot fee rules", () => {
  const active = PILOT_FEE_RULES.filter((rule) => rule.active);

  it("prices the contracted pilot fixtures and leaves taxes out", () => {
    const fixtures = [
      { gross: 10_000, business: 500, pays: 10_500, influencer: 250, receives: 9_750, total: 750 },
      { gross: 100_000, business: 5_000, pays: 105_000, influencer: 2_500, receives: 97_500, total: 7_500 },
      { gross: 350_000, business: 17_500, pays: 367_500, influencer: 8_750, receives: 341_250, total: 26_250 },
    ];
    for (const fixture of fixtures) {
      const quote = quoteDualPlatformFees(
        [...active, legacyOverlap(), legacyOverlap({ id: "rule_split", payer: "split", purpose: "legacy", active: true })],
        { jurisdiction: "US", serviceLevel: "contracted", grossValueCents: fixture.gross, asOf: AS_OF },
      );
      assert.equal(quote.ok, true);
      if (!quote.ok) return;
      assert.equal(quote.business.rule.id, "rule_pilot_contracted_business");
      assert.equal(quote.influencer.rule.id, "rule_pilot_contracted_influencer");
      assert.equal(quote.businessPlatformFeeCents, fixture.business);
      assert.equal(quote.businessPaysCents, fixture.pays);
      assert.equal(quote.influencerPlatformFeeCents, fixture.influencer);
      assert.equal(quote.influencerReceivesCents, fixture.receives);
      assert.equal(quote.platformFeesTotalCents, fixture.total);
    }
  });

  it("keeps discovery free and prices platform match at the pilot rates", () => {
    const discovery = quoteDualPlatformFees(PILOT_FEE_RULES, {
      jurisdiction: "US",
      serviceLevel: "discovery",
      grossValueCents: 10_000,
      asOf: AS_OF,
    });
    assert.equal(discovery.ok, true);
    if (!discovery.ok) return;
    assert.equal(discovery.businessPlatformFeeCents, 0);
    assert.equal(discovery.influencerPlatformFeeCents, 0);
    assert.equal(discovery.businessPaysCents, 10_000);

    const match = quoteDualPlatformFees(PILOT_FEE_RULES, {
      jurisdiction: "US",
      serviceLevel: "platform_match",
      grossValueCents: 10_000,
      asOf: AS_OF,
    });
    assert.equal(match.ok, true);
    if (!match.ok) return;
    assert.equal(match.business.rule.id, "rule_pilot_platform_match_business");
    assert.equal(match.influencer.rule.id, "rule_pilot_platform_match_influencer");
    assert.equal(match.businessPlatformFeeCents, 500);
    assert.equal(match.influencerPlatformFeeCents, 250);

    const outsidePilot = quotePartyPlatformFee(active, {
      jurisdiction: "NG",
      serviceLevel: "contracted",
      grossValueCents: 10_000,
      asOf: AS_OF,
    }, "business");
    assert.equal(outsidePilot.ok, false);
  });

  it("would let another fee type win, so deferred types are not saved as active rules", () => {
    const success = legacyOverlap({
      id: "rule_success",
      name: "Success fee",
      active: true,
      feeType: "success",
      priority: 900,
      percentBps: 9000,
      jurisdiction: "US",
      serviceLevel: "contracted",
    });
    const quote = quoteDualPlatformFees([...active, success], {
      jurisdiction: "US",
      serviceLevel: "contracted",
      grossValueCents: 10_000,
      asOf: AS_OF,
    });
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.business.rule.id, "rule_success");

    const sql = readFileSync("prisma/migrations/20261109220000_pilot_fee_rules/migration.sql", "utf8");
    assert.equal(sql.includes("rule_pilot_contracted_business"), true);
    assert.equal(sql.includes("'percent', 500"), true);
    assert.equal(sql.includes("'percent', 250"), true);
    assert.equal(sql.includes("'success'"), false);
    assert.equal(sql.includes("managed_intro"), false);
    assert.equal(sql.includes("managed_campaign"), false);
    assert.equal(sql.includes("Excluded from new-deal selection."), true);
  });
});
