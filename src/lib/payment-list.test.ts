import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { currencyPaymentTotals, paymentNextAction } from "./payment-list";

describe("collaboration payments list", () => {
  it("groups held and paid totals by currency", () => {
    const totals = currencyPaymentTotals([
      { currency: "usd", heldCents: 100, releasedCents: 40 },
      { currency: "EUR", heldCents: 20, releasedCents: 0 },
      { currency: "USD", heldCents: 5, releasedCents: 5 },
    ]);
    assert.deepEqual(totals, [
      ["EUR", { heldCents: 20, releasedCents: 0 }],
      ["USD", { heldCents: 105, releasedCents: 45 }],
    ]);
  });

  it("names one next action and does not treat a returned payout as pending", () => {
    assert.equal(paymentNextAction({ status: "awaiting_provider", role: "business", payoutPending: false, payoutReturned: false }), "Deposit funds");
    assert.equal(paymentNextAction({ status: "held", role: "influencer", payoutPending: true, payoutReturned: false }), "Track the pending payout");
    assert.equal(paymentNextAction({ status: "held", role: "business", payoutPending: true, payoutReturned: true }), "Recover the returned payout");
  });
});
