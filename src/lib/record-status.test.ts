import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recordStatusAxes } from "./record-status";

describe("shared record statuses", () => {
  it("keeps invitation, agreement, funding, delivery, and payout on separate axes", () => {
    const axes = recordStatusAxes({
      invitation: "ACCEPTED",
      agreement: "signed",
      fundingStatus: "held",
      deliveryStatus: "approved",
      milestoneStatus: "approved",
    });
    assert.equal(axes.invitation, "Accepted");
    assert.equal(axes.agreement, "Signed");
    assert.equal(axes.funding, "Confirmed");
    assert.equal(axes.delivery, "Approved");
    assert.equal(axes.payout, "Processing");
    assert.notEqual(axes.payout, "Paid");
  });

  it("shows unknown evidence as unavailable and paid only after a confirmed payout", () => {
    const unknown = recordStatusAxes({
      invitation: "mystery",
      agreement: "",
      fundingStatus: "mystery",
      deliveryStatus: "",
      payoutState: "unknown",
      verification: "complete",
    });
    assert.equal(unknown.invitation, "Unavailable");
    assert.equal(unknown.agreement, "Unavailable");
    assert.equal(unknown.funding, "Unavailable");
    assert.equal(unknown.delivery, "Unavailable");
    assert.equal(unknown.payout, "Unavailable");
    assert.equal(unknown.verification, "Unavailable");

    const paid = recordStatusAxes({ payoutState: "paid", deliveryStatus: "pending" });
    assert.equal(paid.payout, "Paid");
    assert.equal(paid.delivery, "Not started");
    const released = recordStatusAxes({ milestoneStatus: "released", deliveryStatus: "released" });
    assert.equal(released.payout, "Paid");
    assert.equal(released.delivery, "Approved");
    const returned = recordStatusAxes({ payoutState: "returned", deliveryStatus: "approved" });
    assert.equal(returned.payout, "Returned");
    assert.equal(returned.delivery, "Approved");
  });
});
