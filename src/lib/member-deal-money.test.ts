import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { influencerLedgerShare, ledgerEntryVisibleTo, memberDealView } from "./member-deal-money";

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

  it("hides the business collection from the influencer and the influencer fee from the business", () => {
    const hold = { kind: "hold", party: "" };
    const businessFee = { kind: "fee_pending", party: "platform:business" };
    const influencerFee = { kind: "fee_pending", party: "platform:influencer" };
    const payable = { kind: "influencer_payable", party: "influencer" };
    const payout = { kind: "release", party: "Influencer" };
    assert.equal(ledgerEntryVisibleTo({ role: "business", ...hold }), true);
    assert.equal(ledgerEntryVisibleTo({ role: "influencer", ...hold }), false);
    assert.equal(ledgerEntryVisibleTo({ role: "business", ...businessFee }), true);
    assert.equal(ledgerEntryVisibleTo({ role: "influencer", ...businessFee }), false);
    assert.equal(ledgerEntryVisibleTo({ role: "business", ...influencerFee }), false);
    assert.equal(ledgerEntryVisibleTo({ role: "influencer", ...influencerFee }), true);
    assert.equal(ledgerEntryVisibleTo({ role: "business", ...payable }), false);
    assert.equal(ledgerEntryVisibleTo({ role: "influencer", ...payable }), true);
    assert.equal(ledgerEntryVisibleTo({ role: "business", ...payout }), true);
    assert.equal(ledgerEntryVisibleTo({ role: "influencer", ...payout }), true);
    assert.equal(ledgerEntryVisibleTo({ role: "influencer", kind: "fee", party: "Platform" }), false);
  });

  it("keeps a legacy row on one platform fee", () => {
    const business = memberDealView({ role: "business", grossCents: 10_000, feeCents: 1_000 });
    assert.equal(business.lines[0].amountCents, 10_000);
    assert.equal(business.feeCents, 1_000);
    const influencer = memberDealView({ role: "influencer", grossCents: 10_000, feeCents: 1_000 });
    assert.equal(influencer.headlineCents, 9_000);
  });

  it("keeps the business collection out of the influencer's held earnings", () => {
    const share = influencerLedgerShare({
      grossCents: 483_000,
      feeCents: 126_000,
      plan: {
        financialPlan: {
          signedQuote: {
            grossInfluencerCompensationCents: 420_000,
            businessPlatformFeeCents: 63_000,
            influencerPlatformFeeCents: 63_000,
            businessPaysCents: 483_000,
            influencerReceivesCents: 357_000,
            influencerTaxCents: 0,
            withholdingCents: 0,
          },
        },
      },
      ledger: { heldCents: 483_000, releasedCents: 0 },
    });
    assert.equal(share.heldCents, 357_000);
    assert.equal(share.releasedCents, 0);
    const paid = influencerLedgerShare({
      grossCents: 483_000,
      feeCents: 126_000,
      plan: {
        financialPlan: {
          signedQuote: {
            grossInfluencerCompensationCents: 420_000,
            businessPlatformFeeCents: 63_000,
            influencerPlatformFeeCents: 63_000,
            businessPaysCents: 483_000,
            influencerReceivesCents: 357_000,
          },
        },
      },
      ledger: { heldCents: 126_000, releasedCents: 357_000 },
    });
    assert.equal(paid.heldCents, 0);
    assert.equal(paid.releasedCents, 357_000);
  });
});
