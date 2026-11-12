import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { activationExceptionForReason, settlementFromSnapshot, settlementProposal } from "./cancellation-settlement";

const milestones = [
  {
    grossCents: 40_000,
    businessCollaborationFeeCents: 1_600,
    influencerFeeCents: 1_000,
    influencerNetCents: 39_000,
  },
  {
    grossCents: 60_000,
    businessCollaborationFeeCents: 2_400,
    influencerFeeCents: 1_500,
    influencerNetCents: 58_500,
  },
];

describe("cancellation settlement proposal", () => {
  it("retains activation before any accepted work and refunds the rest", () => {
    const result = settlementProposal({
      businessPaysCents: 105_000,
      activationFeeCents: 1_000,
      activationEligible: true,
      activationException: false,
      review: false,
      milestones: milestones.map((row) => ({ ...row, acceptedGrossCents: 0 })),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.proposal.retainedActivationCents, 1_000);
    assert.equal(result.proposal.influencerNetCents, 0);
    assert.equal(result.proposal.platformRetainedCents, 1_000);
    assert.equal(result.proposal.businessRefundCents, 104_000);
    assert.equal(result.proposal.automatic, true);
  });

  it("keeps the first milestone after it is paid and refunds the unused remainder", () => {
    const result = settlementProposal({
      businessPaysCents: 105_000,
      activationFeeCents: 1_000,
      activationEligible: true,
      activationException: false,
      review: false,
      milestones: [
        { ...milestones[0], acceptedGrossCents: 40_000 },
        { ...milestones[1], acceptedGrossCents: 0 },
      ],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.proposal.influencerNetCents, 39_000);
    assert.equal(result.proposal.platformRetainedCents, 3_600);
    assert.equal(result.proposal.businessRefundCents, 62_400);
    assert.equal(
      result.proposal.influencerNetCents + result.proposal.platformRetainedCents + result.proposal.businessRefundCents,
      105_000,
    );
  });

  it("refunds activation when it is not eligible and holds an in-progress milestone for review", () => {
    const open = settlementProposal({
      businessPaysCents: 105_000,
      activationFeeCents: 1_000,
      activationEligible: false,
      activationException: false,
      review: false,
      milestones: milestones.map((row) => ({ ...row, acceptedGrossCents: 0 })),
    });
    assert.equal(open.ok, true);
    if (!open.ok) return;
    assert.equal(open.proposal.retainedActivationCents, 0);
    assert.equal(open.proposal.businessRefundCents, 105_000);
    const snapshot = settlementFromSnapshot({
      feeSnapshot: {
        financialPlan: {
          businessPaysCents: 105_000,
          activationFeeCents: 1_000,
          signedQuote: { businessPaysCents: 105_000, activationFeeCents: 1_000, milestoneAllocations: milestones },
        },
      },
      milestones: [
        { id: "m1", status: "released" },
        { id: "m2", status: "submitted" },
      ],
      activationEligible: true,
      currentMilestoneId: "m2",
    });
    assert.equal(snapshot?.ok, true);
    if (!snapshot?.ok) return;
    assert.equal(snapshot.proposal.automatic, false);
    assert.equal(snapshot.proposal.influencerNetCents, 39_000);
    const exception = settlementProposal({
      businessPaysCents: 105_000,
      activationFeeCents: 1_000,
      activationEligible: true,
      activationException: true,
      review: false,
      milestones: milestones.map((row) => ({ ...row, acceptedGrossCents: 0 })),
    });
    assert.equal(exception.ok, true);
    if (!exception.ok) return;
    assert.equal(exception.proposal.retainedActivationCents, 0);
    assert.equal(exception.proposal.businessRefundCents, 105_000);
    assert.equal(exception.proposal.activationRecoveryCents, 0);
    assert.equal(exception.proposal.automatic, true);
    const afterFirst = settlementProposal({
      businessPaysCents: 105_000,
      activationFeeCents: 1_000,
      activationEligible: true,
      activationException: true,
      review: false,
      milestones: [
        { ...milestones[0], acceptedGrossCents: 40_000 },
        { ...milestones[1], acceptedGrossCents: 0 },
      ],
    });
    assert.equal(afterFirst.ok, true);
    if (!afterFirst.ok) return;
    assert.equal(afterFirst.proposal.influencerNetCents, 39_000);
    assert.equal(afterFirst.proposal.platformRetainedCents, 2_600);
    assert.equal(afterFirst.proposal.businessRefundCents, 63_400);
    const settled = settlementProposal({
      businessPaysCents: 105_000,
      activationFeeCents: 1_000,
      activationEligible: true,
      activationException: true,
      activationSettled: true,
      review: false,
      milestones: milestones.map((row) => ({ ...row, acceptedGrossCents: 0 })),
    });
    assert.equal(settled.ok, true);
    if (!settled.ok) return;
    assert.equal(settled.proposal.automatic, false);
    assert.equal(settled.proposal.activationRecoveryCents, 1_000);
    assert.equal(settled.proposal.businessRefundCents, 105_000);
    assert.equal(activationExceptionForReason("platform_cannot_serve"), true);
    assert.equal(activationExceptionForReason("brand_before_start"), false);
    const cancellation = readFileSync("src/lib/collaboration-cancellation.ts", "utf8");
    assert.ok(cancellation.indexOf("createPartialRefund") > cancellation.indexOf("settlementFromSnapshot"));
  });
});
