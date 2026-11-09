import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { buildFinancialPlan, feeRuleChangeAffectsPlan, lockFinancialPlan } from "./contract-wizard";
import type { CollaborationFeeRule } from "./collaboration-fees";
import { liveFundingBlockReason, quoteDualPlatformFees } from "./dual-platform-fees";

const AS_OF = "2026-06-01T00:00:00.000Z";

function rule(overrides: Partial<CollaborationFeeRule>): CollaborationFeeRule {
  return {
    id: "rule",
    name: "Rule",
    version: 1,
    active: true,
    priority: 100,
    jurisdiction: "*",
    serviceLevel: "contracted",
    feeType: "platform_service",
    fundingMode: "*",
    relationshipSource: "*",
    promotionChannel: "*",
    method: "fixed",
    percentBps: 0,
    fixedCents: 0,
    minFeeCents: 0,
    maxFeeCents: null,
    tierBands: [],
    payer: "brand",
    purpose: "business_platform_fee",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    notes: "",
    ...overrides,
  };
}

const business = rule({
  id: "rule_business",
  name: "Business fixture",
  payer: "brand",
  purpose: "business_platform_fee",
  method: "percent",
  percentBps: 250,
  minFeeCents: 25_000,
});
const influencer = rule({
  id: "rule_influencer",
  name: "Influencer fixture",
  payer: "creator",
  purpose: "influencer_platform_fee",
  method: "percent",
  percentBps: 200,
  minFeeCents: 0,
});

describe("dual platform fee quote", () => {
  it("reconciles the acceptance fixture and keeps the fees reserved", () => {
    const quote = quoteDualPlatformFees([business, influencer], {
      jurisdiction: "US",
      serviceLevel: "contracted",
      grossValueCents: 350_000,
      asOf: AS_OF,
    });
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.grossInfluencerCompensationCents, 350_000);
    assert.equal(quote.businessPlatformFeeCents, 25_000);
    assert.equal(quote.influencerPlatformFeeCents, 7_000);
    assert.equal(quote.businessPaysCents, 375_000);
    assert.equal(quote.influencerReceivesCents, 343_000);
    assert.equal(quote.platformFeesTotalCents, 32_000);
    assert.equal(quote.business.floorApplied, true);
    assert.equal(quote.influencer.floorApplied, false);
    assert.equal(quote.reservation.status, "reserved");
    assert.equal(quote.reservation.earnedAt, null);
    assert.equal(quote.reservation.providerSettledAt, null);

    const plan = buildFinancialPlan({
      grossCents: quote.grossInfluencerCompensationCents,
      currency: "USD",
      totalPlatformFeeCents: quote.platformFeesTotalCents,
      businessPlatformFeeCents: quote.businessPlatformFeeCents,
      influencerPlatformFeeCents: quote.influencerPlatformFeeCents,
      businessPaysCents: quote.businessPaysCents,
      feeRuleId: quote.business.rule.id,
      feeRuleVersion: quote.business.rule.version,
      feeReservation: quote.reservation,
      fundingCountry: "US",
      creatorCountry: "US",
      milestones: [
        { title: "Draft", shareBps: 5000 },
        { title: "Publish", shareBps: 5000 },
      ],
      milestoneSource: "template",
    });
    assert.ok(plan);
    assert.equal(plan!.businessPaysCents, 375_000);
    assert.equal(plan!.totalCreatorCompensationCents, 343_000);
    assert.equal(
      plan!.milestones.reduce((sum, row) => sum + row.creatorCents, 0),
      343_000,
    );
    assert.equal(
      plan!.milestones.reduce((sum, row) => sum + (row.businessPlatformFeeCents ?? 0), 0),
      25_000,
    );
    const locked = lockFinancialPlan(plan!);
    assert.equal(feeRuleChangeAffectsPlan(locked, { id: "rule_influencer", version: 2 }), true);
    assert.equal(feeRuleChangeAffectsPlan(locked, { id: "rule_influencer", version: 1 }), false);
    assert.equal(liveFundingBlockReason(locked), liveFundingBlockReason(plan));
    assert.match(liveFundingBlockReason(locked) ?? "", /Nothing was charged/);
    assert.equal(liveFundingBlockReason({ feeRuleId: "legacy" }), null);
  });

  it("accepts an explicit waiver and ignores a legacy split rule", () => {
    const quote = quoteDualPlatformFees(
      [
        business,
        rule({
          id: "waive",
          name: "Influencer waiver",
          payer: "creator",
          purpose: "influencer_platform_fee",
          method: "waived",
          priority: 200,
        }),
        rule({ id: "split", name: "Legacy split", payer: "split", purpose: "legacy", priority: 900, fixedCents: 99_000 }),
      ],
      { jurisdiction: "US", serviceLevel: "contracted", grossValueCents: 350_000, asOf: AS_OF },
    );
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.influencer.waived, true);
    assert.equal(quote.influencerPlatformFeeCents, 0);
    assert.equal(quote.influencerReceivesCents, 350_000);
    assert.match(quote.explanation, /not applied to either side/);
  });

  it("blocks a missing side, a tie, and an influencer fee above the gross", () => {
    const missing = quoteDualPlatformFees([business], {
      jurisdiction: "US",
      serviceLevel: "contracted",
      grossValueCents: 350_000,
      asOf: AS_OF,
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.match(missing.error, /influencer/);

    const tie = quoteDualPlatformFees(
      [
        business,
        influencer,
        rule({
          id: "tie",
          name: "Same precedence",
          payer: "creator",
          purpose: "influencer_platform_fee",
          fixedCents: 1_000,
          priority: 100,
        }),
      ],
      { jurisdiction: "US", serviceLevel: "contracted", grossValueCents: 350_000, asOf: AS_OF },
    );
    assert.equal(tie.ok, false);
    if (!tie.ok) assert.match(tie.error, /ties/);

    const specific = quoteDualPlatformFees(
      [
        business,
        influencer,
        rule({
          id: "specific",
          name: "US influencer",
          payer: "creator",
          purpose: "influencer_platform_fee",
          jurisdiction: "US",
          fixedCents: 1_000,
          priority: 100,
        }),
      ],
      { jurisdiction: "US", serviceLevel: "contracted", grossValueCents: 350_000, asOf: AS_OF },
    );
    assert.equal(specific.ok, true);
    if (specific.ok) assert.equal(specific.influencer.rule.id, "specific");

    const tooLarge = quoteDualPlatformFees(
      [business, rule({ ...influencer, method: "fixed", percentBps: 0, fixedCents: 400_000 })],
      { jurisdiction: "US", serviceLevel: "contracted", grossValueCents: 350_000, asOf: AS_OF },
    );
    assert.equal(tooLarge.ok, false);
  });

  it("does not seed the acceptance fixture in the fee matrix", () => {
    const fees = readFileSync("src/lib/collaboration-fees.ts", "utf8");
    const engine = readFileSync("src/lib/dual-platform-fees.ts", "utf8");
    assert.equal(fees.includes("350_000"), false);
    assert.equal(fees.includes("25_000"), false);
    assert.equal(engine.includes("350_000"), false);
    assert.equal(engine.includes("25_000"), false);
    const funding = readFileSync("src/lib/signed-funding-apply.ts", "utf8");
    assert.match(funding, /liveFundingBlockReason/);
  });
});
