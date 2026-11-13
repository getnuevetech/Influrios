import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bankPayoutConfirmed, paymentStageNote, paymentStages } from "./payment-stages";

describe("payment stage separation", () => {
  it("keeps delivery approval, account transfer, and bank payout apart", () => {
    const approved = paymentStages({
      fundingStatus: "held",
      milestoneStatuses: ["approved"],
      entryKinds: ["hold"],
    });
    assert.equal(approved.find((stage) => stage.id === "delivery")?.status, "Complete");
    assert.equal(approved.find((stage) => stage.id === "transfer")?.status, "Processing");
    assert.equal(approved.find((stage) => stage.id === "bank")?.status, "Not started");
    assert.equal(bankPayoutConfirmed(approved), false);
    assert.match(paymentStageNote(approved) ?? "", /bank payout has not been confirmed/);
  });

  it("calls a payout paid only after the bank payout is confirmed", () => {
    const processing = paymentStages({
      fundingStatus: "held",
      milestoneStatuses: ["release_requested"],
      entryKinds: ["hold", "release"],
    });
    assert.equal(processing.find((stage) => stage.id === "transfer")?.status, "Confirmed");
    assert.equal(processing.find((stage) => stage.id === "bank")?.status, "Processing");
    assert.equal(bankPayoutConfirmed(processing), false);

    const paid = paymentStages({
      fundingStatus: "completed",
      milestoneStatuses: ["released"],
      entryKinds: ["hold", "release"],
    });
    assert.equal(paid.find((stage) => stage.id === "bank")?.status, "Paid");
    assert.equal(bankPayoutConfirmed(paid), true);
  });

  it("treats a returned payout as a bank return, not a refund", () => {
    const returned = paymentStages({
      fundingStatus: "held",
      milestoneStatuses: ["returned"],
      entryKinds: ["hold", "release", "return"],
    });
    assert.equal(returned.find((stage) => stage.id === "delivery")?.status, "Complete");
    assert.equal(returned.find((stage) => stage.id === "bank")?.status, "Returned");
    assert.equal(bankPayoutConfirmed(returned), false);
    assert.match(paymentStageNote(returned) ?? "", /does not refund/);
    assert.equal(returned.some((stage) => /refund/i.test(stage.status) || /refund/i.test(stage.label)), false);
  });

  it("does not treat an unconfirmed collection as received", () => {
    const pending = paymentStages({
      fundingStatus: "awaiting_provider",
      milestoneStatuses: ["pending"],
      entryKinds: [],
    });
    assert.equal(pending.find((stage) => stage.id === "funding")?.status, "Not started");
    assert.equal(bankPayoutConfirmed(pending), false);
  });
});
