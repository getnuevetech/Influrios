import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateFeeCents,
  matchesRule,
  pickWinningRule,
  protectedPaymentLabel,
  type CollaborationFeeRule,
  type FeeResolveContext,
} from "./collaboration-fees";

function rule(overrides: Partial<CollaborationFeeRule> = {}): CollaborationFeeRule {
  return {
    id: "rule_test",
    name: "Test rule",
    version: 1,
    active: true,
    priority: 100,
    jurisdiction: "*",
    serviceLevel: "contracted",
    method: "percent",
    percentBps: 1000,
    fixedCents: 0,
    minFeeCents: 0,
    maxFeeCents: null,
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
});

describe("protected payment label", () => {
  it("only says Escrow when the jurisdiction flag allows it", () => {
    assert.equal(protectedPaymentLabel(false), "Protected Payment");
    assert.equal(protectedPaymentLabel(true), "Escrow");
  });
});
