import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fundingBadge } from "./funding-badge";

describe("funding-badge", () => {
  it("marks unavailable when jurisdiction disables protected payments", () => {
    assert.equal(
      fundingBadge({ status: "held", protectedPaymentsEnabled: false }),
      "Protected Payment Unavailable",
    );
  });

  it("maps awaiting provider to Awaiting Funding", () => {
    assert.equal(fundingBadge({ status: "awaiting_provider" }), "Awaiting Funding");
  });

  it("maps payment_risk to Payment Risk", () => {
    assert.equal(fundingBadge({ status: "payment_risk", heldCents: 1000 }), "Payment Risk");
  });

  it("maps held with only held funds to Fully Funded", () => {
    assert.equal(fundingBadge({ status: "held", heldCents: 1000, releasedCents: 0 }), "Fully Funded");
  });

  it("maps held with partial release to Partially Funded", () => {
    assert.equal(fundingBadge({ status: "held", heldCents: 500, releasedCents: 500 }), "Partially Funded");
  });

  it("never shows Fully Funded for NONE funding mode", () => {
    assert.equal(
      fundingBadge({ status: "held", heldCents: 1000, releasedCents: 0, fundingMode: "NONE" }),
      "Outside Protected Coverage",
    );
  });

  it("marks staged schedules partial when later stages await funding", () => {
    assert.equal(
      fundingBadge({
        status: "held",
        heldCents: 1000,
        releasedCents: 0,
        fundingMode: "STAGED",
        schedulePartiallyFunded: true,
      }),
      "Partially Funded",
    );
  });
});
