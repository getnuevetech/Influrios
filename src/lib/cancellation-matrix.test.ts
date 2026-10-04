import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyKillFeeOrPartial,
  calculateCancellation,
  cancellationAllowedForJurisdiction,
  DEFAULT_KILL_FEE_RULE,
} from "./cancellation-matrix";

describe("kill fee application", () => {
  it("pays zero when work has not begun", () => {
    const result = applyKillFeeOrPartial({
      milestoneAmountCents: 10_000,
      workBegan: false,
      rule: DEFAULT_KILL_FEE_RULE,
    });
    assert.equal(result.payableToCreatorCents, 0);
  });

  it("applies bps + fixed when work began", () => {
    const result = applyKillFeeOrPartial({
      milestoneAmountCents: 10_000,
      workBegan: true,
      rule: { killFeeBps: 2_500, killFeeFixedCents: 500 },
    });
    assert.equal(result.payableToCreatorCents, 3_000);
  });

  it("honors accepted partial delivery", () => {
    const result = applyKillFeeOrPartial({
      milestoneAmountCents: 10_000,
      workBegan: true,
      rule: DEFAULT_KILL_FEE_RULE,
      acceptedPartialCents: 4_000,
    });
    assert.equal(result.payableToCreatorCents, 4_000);
  });
});

describe("calculateCancellation matrix", () => {
  const milestones = [
    { id: "m1", title: "Kickoff", amountCents: 2_500, status: "released" },
    { id: "m2", title: "Draft", amountCents: 2_500, status: "submitted", workBegan: true },
    { id: "m3", title: "Live", amountCents: 5_000, status: "pending" },
  ];

  it("keeps completed payable and applies kill fee on current after brand cancel", () => {
    const result = calculateCancellation({
      milestones,
      currentMilestoneId: "m2",
      reason: "brand_after_start",
      fundedCents: 10_000,
      alreadyReleasedCents: 2_500,
      killFeeRule: { killFeeBps: 2_500, killFeeFixedCents: 0 },
      earnedFeeCents: 150,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.payableCompletedCents, 2_500);
    assert.equal(result.currentAdjustmentCents, 625); // 25% of 2500
    assert.equal(result.earnedFeeCents, 150);
    assert.equal(result.paymentRisk, false);
    assert.ok(result.refundableFutureCents > 0);
  });

  it("marks chargebacks as payment-risk without automatic refund", () => {
    const result = calculateCancellation({
      milestones,
      currentMilestoneId: "m2",
      reason: "chargeback",
      fundedCents: 10_000,
      alreadyReleasedCents: 2_500,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.paymentRisk, true);
    assert.equal(result.refundableFutureCents, 0);
  });

  it("gates held cancellations when protected payments are off", () => {
    assert.equal(
      cancellationAllowedForJurisdiction({
        protectedPaymentsEnabled: false,
        fundingStatus: "held",
      }).ok,
      false,
    );
    assert.equal(
      cancellationAllowedForJurisdiction({
        protectedPaymentsEnabled: true,
        fundingStatus: "held",
      }).ok,
      true,
    );
  });
});
