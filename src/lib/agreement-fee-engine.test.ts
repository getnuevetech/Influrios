import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allocateAgreementMilestones, allocateByLargestRemainder, quoteNewAgreementFees } from "./agreement-fee-engine";
import type { CollaborationFeeRule } from "./collaboration-fees";
import { PILOT_FEE_RULES } from "./pilot-fee-rules";

const AS_OF = "2026-11-09T12:00:00.000Z";

function activation(fixedCents: number, overrides: Partial<CollaborationFeeRule> = {}): CollaborationFeeRule {
  return {
    ...PILOT_FEE_RULES.find((rule) => rule.id === "rule_pilot_activation_business")!,
    fixedCents,
    ...overrides,
  };
}

describe("agreement fee engine", () => {
  it("splits the fixture inside the business envelope and leaves activation off the milestones", () => {
    const quote = quoteNewAgreementFees(
      [...PILOT_FEE_RULES.filter((rule) => rule.id !== "rule_pilot_activation_business"), activation(1_000)],
      { jurisdiction: "US", serviceLevel: "contracted", grossValueCents: 100_000, asOf: AS_OF },
      [4_000, 6_000],
    );
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.activationFeeCents, 1_000);
    assert.equal(quote.businessCollaborationFeeCents, 4_000);
    assert.equal(quote.businessPlatformFeeCents, 5_000);
    assert.equal(quote.influencerPlatformFeeCents, 2_500);
    assert.equal(quote.businessPaysCents, 105_000);
    assert.equal(quote.influencerReceivesCents, 97_500);
    assert.equal(quote.platformFeesTotalCents, 7_500);
    assert.deepEqual(quote.allocations, [
      { grossCents: 40_000, businessCollaborationFeeCents: 1_600, influencerFeeCents: 1_000, influencerNetCents: 39_000 },
      { grossCents: 60_000, businessCollaborationFeeCents: 2_400, influencerFeeCents: 1_500, influencerNetCents: 58_500 },
    ]);
    assert.equal(
      quote.allocations.reduce((sum, row) => sum + row.businessCollaborationFeeCents, 0),
      quote.businessCollaborationFeeCents,
    );
  });

  it("keeps an explicit zero activation and caps a fixed allocation at the envelope", () => {
    const zero = quoteNewAgreementFees(
      PILOT_FEE_RULES,
      { jurisdiction: "US", serviceLevel: "contracted", grossValueCents: 10_000, asOf: AS_OF },
      [10_000],
    );
    assert.equal(zero.ok, true);
    if (!zero.ok) return;
    assert.equal(zero.activationFeeCents, 0);
    assert.equal(zero.businessCollaborationFeeCents, 500);
    assert.equal(zero.businessPaysCents, 10_500);
    const capped = quoteNewAgreementFees(
      [...PILOT_FEE_RULES.filter((rule) => rule.id !== "rule_pilot_activation_business"), activation(9_000)],
      { jurisdiction: "US", serviceLevel: "contracted", grossValueCents: 10_000, asOf: AS_OF },
      [10_000],
    );
    assert.equal(capped.ok, true);
    if (!capped.ok) return;
    assert.equal(capped.activationFeeCents, 500);
    assert.equal(capped.businessCollaborationFeeCents, 0);
  });

  it("blocks a missing activation rule, a tie, and an influencer activation rule", () => {
    const missing = quoteNewAgreementFees(
      PILOT_FEE_RULES.filter((rule) => rule.purpose !== "platform_activation"),
      { jurisdiction: "US", serviceLevel: "contracted", grossValueCents: 10_000, asOf: AS_OF },
      [10_000],
    );
    assert.equal(missing.ok, false);
    const tied = quoteNewAgreementFees(
      [...PILOT_FEE_RULES, activation(100, { id: "rule_activation_tie" })],
      { jurisdiction: "US", serviceLevel: "contracted", grossValueCents: 10_000, asOf: AS_OF },
      [10_000],
    );
    assert.equal(tied.ok, false);
    const influencer = quoteNewAgreementFees(
      [...PILOT_FEE_RULES, activation(100, { id: "rule_activation_creator", payer: "creator", priority: 900 })],
      { jurisdiction: "US", serviceLevel: "contracted", grossValueCents: 10_000, asOf: AS_OF },
      [10_000],
    );
    assert.equal(influencer.ok, false);
  });

  it("gives a tied remainder to the earlier milestone", () => {
    assert.deepEqual(allocateByLargestRemainder(3, [5_000, 5_000]), [2, 1]);
    assert.deepEqual(allocateByLargestRemainder(100, [3_334, 3_333, 3_333]), [34, 33, 33]);
    const allocated = allocateAgreementMilestones({
      grossCents: 10,
      businessCollaborationFeeCents: 0,
      influencerFeeCents: 0,
      weightsBps: [5_000, 5_000],
    });
    assert.equal(allocated.ok, true);
    if (!allocated.ok) return;
    assert.equal(allocated.rows[0]?.influencerNetCents, 5);
    assert.equal(allocated.rows[1]?.influencerNetCents, 5);
  });
});
