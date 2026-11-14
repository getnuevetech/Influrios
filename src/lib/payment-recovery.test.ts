import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paymentRecoveryView } from "./payment-recovery";

const stages = [
  { id: "delivery" as const, status: "Complete" },
  { id: "transfer" as const, status: "Confirmed" },
  { id: "bank" as const, status: "Returned" },
];

describe("payment recovery", () => {
  it("tells the influencer to update bank details without starting another payout", () => {
    const view = paymentRecoveryView({ audience: "influencer", stages });
    assert.equal(view?.kind, "influencer");
    if (view?.kind !== "influencer") return;
    assert.equal(view.title, "Payout needs attention");
    assert.equal(view.detail, "Your bank details need updating.");
    assert.deepEqual(
      view.rows.map((row) => row.label),
      ["Delivery approved", "Transfer confirmed", "Bank payout failed"],
    );
    assert.match(view.note, /does not create another payout/);
    assert.equal(view.cta, "Update payout details");
  });

  it("tells the business the influencer must act and not to fund again", () => {
    const view = paymentRecoveryView({ audience: "business", stages });
    assert.equal(view?.kind, "business");
    if (view?.kind !== "business") return;
    assert.equal(view.detail, "Action is required from the influencer before payout can continue.");
    assert.match(view.note, /Do not fund this collaboration again/);
    assert.equal(view.cta, "View payment history");
  });

  it("shows an unavailable load instead of a zero balance", () => {
    const view = paymentRecoveryView({ audience: "business", stages, unavailable: true });
    assert.equal(view?.kind, "unavailable");
    assert.match(view?.detail ?? "", /Could not load/);
    assert.equal(paymentRecoveryView({ audience: "business", stages: [{ id: "bank", status: "Paid" }] }), null);
  });
});
