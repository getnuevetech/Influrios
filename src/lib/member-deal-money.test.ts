import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { memberDealView } from "./member-deal-money";

const plan = {
  financialPlan: {
    signedQuote: {
      grossInfluencerCompensationCents: 350_000,
      businessPlatformFeeCents: 25_000,
      influencerPlatformFeeCents: 7_000,
      businessPaysCents: 375_000,
      influencerReceivesCents: 343_000,
      influencerTaxCents: 0,
      withholdingCents: 0,
    },
  },
};

describe("member deal amounts", () => {
  it("shows the business its total and fee, and the influencer their own fee and net", () => {
    const business = memberDealView({ role: "business", grossCents: 375_000, feeCents: 32_000, plan });
    assert.equal(business.headlineCents, 375_000);
    assert.equal(business.feeCents, 25_000);
    assert.equal(business.lines.some((line) => line.amountCents === 7_000), false);
    const influencer = memberDealView({ role: "influencer", grossCents: 375_000, feeCents: 32_000, plan });
    assert.equal(influencer.grossCents, 350_000);
    assert.equal(influencer.feeCents, 7_000);
    assert.equal(influencer.headlineCents, 343_000);
    assert.equal(influencer.lines.some((line) => line.amountCents === 25_000), false);
    assert.equal(influencer.lines.at(-1)?.label, "Net payout");
  });

  it("keeps a legacy row on one platform fee", () => {
    const business = memberDealView({ role: "business", grossCents: 10_000, feeCents: 1_000 });
    assert.equal(business.lines[0].amountCents, 10_000);
    assert.equal(business.feeCents, 1_000);
    const influencer = memberDealView({ role: "influencer", grossCents: 10_000, feeCents: 1_000 });
    assert.equal(influencer.headlineCents, 9_000);
  });
});
