import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { signedCollectCents, signedDealMoneyEvents } from "./payment-engine";

// The live US example: $500 to the influencer, $25 business fee, $26.25 business tax → $551.25.
const deal = {
  businessPaysCents: 52_500,
  influencerReceivesCents: 50_000,
  businessPlatformFeeCents: 2_500,
  influencerPlatformFeeCents: 0,
  businessTaxCents: 2_625,
  influencerTaxCents: 0,
};

describe("taxed collection", () => {
  it("charges the signed amount plus business tax exactly once", () => {
    assert.equal(signedCollectCents(deal), 55_125);
    assert.equal(signedCollectCents({ ...deal, businessPaysCents: 55_125 }), 55_125);
    assert.equal(signedCollectCents({ ...deal, businessTaxCents: 0 }), 52_500);
  });

  it("accepts the tax-inclusive deposit and refuses the pre-tax amount", () => {
    const base = { policyApproved: true, finalPayout: false, alreadyEarned: false, alreadyReturned: false };
    assert.equal(signedDealMoneyEvents({ ...base, deal, eventType: "funding.held", amountCents: 55_125 }).ok, true);
    assert.equal(signedDealMoneyEvents({ ...base, deal, eventType: "funding.held", amountCents: 52_500 }).ok, false);
  });

  it("refunds the full tax-inclusive payment and reverses the tax", () => {
    const refund = signedDealMoneyEvents({
      deal,
      eventType: "payout.refunded",
      amountCents: 55_125,
      policyApproved: true,
      finalPayout: false,
      alreadyEarned: false,
      alreadyReturned: false,
      releasedCents: 0,
    });
    assert.equal(refund.ok, true, JSON.stringify(refund));
    if (!refund.ok) return;
    assert.equal(refund.entries.find((row) => row.kind === "refund")?.amountCents, 55_125);
    assert.equal(refund.entries.find((row) => row.party === "tax")?.amountCents, 2_625);
  });
});
