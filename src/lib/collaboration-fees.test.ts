import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateFeeCents,
  explainFeeWinner,
  feeFromTier,
  feeRuleDraft,
  feeSimulationDraft,
  matchesRule,
  parseTierBands,
  pickWinningRule,
  protectedPaymentLabel,
  ruleSpecificity,
  type CollaborationFeeRule,
  type FeeResolveContext,
} from "./collaboration-fees";
import { readFileSync } from "node:fs";

function rule(overrides: Partial<CollaborationFeeRule> = {}): CollaborationFeeRule {
  return {
    id: "rule_test",
    name: "Test rule",
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
    minFeeCents: 0,
    maxFeeCents: null,
    tierBands: [],
    payer: "brand",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    notes: "",
    ...overrides,
  };
}

describe("collaboration fee calculation", () => {
  it("applies percent, fixed, and min/max clamps", () => {
    assert.equal(calculateFeeCents(rule({ method: "percent", percentBps: 1000 }), 10_000), 1_000);
    assert.equal(calculateFeeCents(rule({ method: "fixed", fixedCents: 2500 }), 10_000), 2_500);
    assert.equal(
      calculateFeeCents(
        rule({ method: "percent_plus_fixed", percentBps: 1500, fixedCents: 2500 }),
        10_000,
      ),
      4_000,
    );
    assert.equal(
      calculateFeeCents(rule({ method: "percent", percentBps: 1000, minFeeCents: 500 }), 100),
      500,
    );
    assert.equal(
      calculateFeeCents(
        rule({ method: "percent", percentBps: 5000, maxFeeCents: 2_000 }),
        100_000,
      ),
      2_000,
    );
  });

  it("supports waived, tiered, and custom_enterprise methods", () => {
    assert.equal(calculateFeeCents(rule({ method: "waived", percentBps: 1000, minFeeCents: 500 }), 10_000), 0);
    assert.equal(
      calculateFeeCents(
        rule({
          method: "tiered",
          tierBands: [
            { upToCents: 10_000, percentBps: 800 },
            { upToCents: null, percentBps: 1200 },
          ],
        }),
        5_000,
      ),
      400,
    );
    assert.equal(
      calculateFeeCents(
        rule({
          method: "tiered",
          tierBands: [
            { upToCents: 10_000, percentBps: 800 },
            { upToCents: null, percentBps: 1200 },
          ],
        }),
        20_000,
      ),
      2_400,
    );
    assert.equal(
      calculateFeeCents(rule({ method: "custom_enterprise", fixedCents: 75_000 }), 1_000_000),
      75_000,
    );
  });
});

describe("tier band parsing", () => {
  it("keeps ordered catch-all bands and drops invalid rows", () => {
    assert.deepEqual(
      parseTierBands([
        { upToCents: 5000, percentBps: 500 },
        { upToCents: null, percentBps: 900 },
        { upToCents: "x", percentBps: 100 },
      ]),
      [
        { upToCents: 5000, percentBps: 500 },
        { upToCents: null, percentBps: 900 },
      ],
    );
    assert.equal(feeFromTier(4_000, [{ upToCents: 5000, percentBps: 1000 }]), 400);
  });
});

describe("collaboration fee matching", () => {
  const asOf = "2026-06-01T00:00:00.000Z";
  const ctx: FeeResolveContext = {
    jurisdiction: "US",
    serviceLevel: "managed_intro",
    grossValueCents: 10_000,
  };

  it("rejects inactive, future, mismatched, and out-of-band rules", () => {
    assert.equal(matchesRule(rule({ active: false }), ctx, asOf), false);
    assert.equal(matchesRule(rule({ effectiveFrom: "2027-01-01T00:00:00.000Z" }), ctx, asOf), false);
    assert.equal(matchesRule(rule({ jurisdiction: "GB" }), ctx, asOf), false);
    assert.equal(matchesRule(rule({ serviceLevel: "discovery" }), ctx, asOf), false);
    assert.equal(matchesRule(rule({ minGrossCents: 50_000 }), ctx, asOf), false);
    assert.equal(matchesRule(rule({ maxGrossCents: 500 }), ctx, asOf), false);
    assert.equal(matchesRule(rule({ jurisdiction: "US", serviceLevel: "managed_intro" }), ctx, asOf), true);
  });

  it("matches funding mode, relationship source, and promotion channel conditions", () => {
    const stagedCtx: FeeResolveContext = {
      ...ctx,
      serviceLevel: "contracted",
      fundingMode: "STAGED",
      relationshipSource: "referral",
      promotionChannel: "ambassador",
    };
    assert.equal(matchesRule(rule({ fundingMode: "STAGED" }), stagedCtx, asOf), true);
    assert.equal(matchesRule(rule({ fundingMode: "FULL" }), stagedCtx, asOf), false);
    assert.equal(matchesRule(rule({ relationshipSource: "referral" }), stagedCtx, asOf), true);
    assert.equal(matchesRule(rule({ relationshipSource: "organic" }), stagedCtx, asOf), false);
    assert.equal(matchesRule(rule({ promotionChannel: "ambassador" }), stagedCtx, asOf), true);
    assert.equal(matchesRule(rule({ promotionChannel: "sponsored" }), stagedCtx, asOf), false);
    assert.equal(ruleSpecificity(rule({ fundingMode: "STAGED", relationshipSource: "referral" })), 3);
  });

  it("picks highest priority then most specific jurisdiction/service", () => {
    const candidates = pickWinningRule(
      [
        rule({ id: "low", priority: 50, jurisdiction: "*", serviceLevel: "*" }),
        rule({ id: "mid", priority: 200, jurisdiction: "*", serviceLevel: "managed_intro" }),
        rule({ id: "high", priority: 200, jurisdiction: "US", serviceLevel: "managed_intro" }),
      ],
      ctx,
      asOf,
    );
    assert.equal(candidates[0]?.id, "high");
    assert.equal(candidates[1]?.id, "mid");
  });

  it("at equal priority prefers jurisdiction+service over service-only (Dev §22.1)", () => {
    const candidates = pickWinningRule(
      [
        rule({ id: "service_only", priority: 100, jurisdiction: "*", serviceLevel: "contracted" }),
        rule({ id: "both", priority: 100, jurisdiction: "US", serviceLevel: "contracted" }),
        rule({ id: "jur_only", priority: 100, jurisdiction: "US", serviceLevel: "*" }),
      ],
      { jurisdiction: "US", serviceLevel: "contracted", grossValueCents: 10_000 },
      asOf,
    );
    assert.equal(candidates[0]?.id, "both");
    assert.equal(ruleSpecificity(candidates[0]!), 2);
    assert.ok(ruleSpecificity(candidates[0]!) >= ruleSpecificity(candidates[1]!));
  });
});

describe("fee winner explanation", () => {
  it("names fee type and runner-up", () => {
    const winner = rule({
      id: "win",
      name: "US contracted",
      feeType: "collaboration",
      priority: 200,
      jurisdiction: "US",
      serviceLevel: "contracted",
    });
    const next = rule({
      id: "next",
      name: "Global contracted",
      feeType: "collaboration",
      priority: 100,
      jurisdiction: "*",
      serviceLevel: "contracted",
    });
    const text = explainFeeWinner(winner, [winner, next], 1_000);
    assert.match(text, /Collaboration Fee/);
    assert.match(text, /US contracted/);
    assert.match(text, /Global contracted/);
  });
});

describe("entered fee rule facts", () => {
  it("stores a fee rule and a simulation only from the terms that were entered", () => {
    const blank = feeRuleDraft({});
    assert.equal(blank.ok, false);
    if (!blank.ok) assert.equal(blank.error, "A rule name is required.");

    const missingPercent = feeRuleDraft({
      name: "Open percent",
      priority: "100",
      jurisdiction: "*",
      serviceLevel: "contracted",
      feeType: "collaboration",
      fundingMode: "*",
      relationshipSource: "*",
      promotionChannel: "*",
      method: "percent",
      percentBps: "",
      payer: "brand",
    });
    assert.equal(missingPercent.ok, false);

    const waived = feeRuleDraft({
      name: "Discovery",
      priority: "10",
      jurisdiction: "*",
      serviceLevel: "discovery",
      feeType: "platform_service",
      fundingMode: "*",
      relationshipSource: "*",
      promotionChannel: "*",
      method: "waived",
      payer: "creator",
    });
    assert.equal(waived.ok, true);
    if (waived.ok) {
      assert.equal(waived.percentBps, 0);
      assert.equal(waived.fixedCents, 0);
      assert.equal(waived.active, false);
      assert.equal(waived.notes, "");
    }

    const zeroPercent = feeRuleDraft({
      name: "Zero percent",
      priority: "1",
      jurisdiction: "NG",
      serviceLevel: "contracted",
      feeType: "collaboration",
      fundingMode: "FULL",
      relationshipSource: "organic",
      promotionChannel: "none",
      method: "percent",
      percentBps: "0",
      payer: "split",
    });
    assert.equal(zeroPercent.ok, true);
    if (zeroPercent.ok) assert.equal(zeroPercent.percentBps, 0);

    assert.equal(feeSimulationDraft({ jurisdiction: "", serviceLevel: "contracted", grossUsd: "1000" }).ok, false);
    const quoted = feeSimulationDraft({ jurisdiction: "NG", serviceLevel: "contracted", grossUsd: "25.50" });
    assert.equal(quoted.ok, true);
    if (quoted.ok) {
      assert.equal(quoted.jurisdiction, "NG");
      assert.equal(quoted.grossValueCents, 2550);
    }

    const actions = readFileSync("src/app/admin/actions.ts", "utf8");
    const page = readFileSync("src/app/admin/fees/page.tsx", "utf8");
    assert.equal(actions.includes("Untitled rule"), false);
    assert.equal(actions.includes('|| "US"'), false);
    assert.equal(actions.includes('|| "contracted"'), false);
    assert.equal(actions.includes('|| "brand"'), false);
    assert.equal(page.includes('|| "US"'), false);
    assert.equal(page.includes('|| "1000"'), false);
    assert.equal(page.includes("?? 1000"), false);
    assert.equal(page.includes('?? "contracted"'), false);
    assert.equal(page.includes('?? "brand"'), false);
  });
});

describe("protected payment label", () => {
  it("only says Escrow when the jurisdiction flag allows it", () => {
    assert.equal(protectedPaymentLabel(false), "Protected Payment");
    assert.equal(protectedPaymentLabel(true), "Escrow");
  });
});
