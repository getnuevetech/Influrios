import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allocateByLargestRemainder } from "@/lib/agreement-fee-engine";
import {
  carriedSettlementTax,
  carryOriginalTaxThroughPayouts,
  collaborationTaxBeforeCollection,
  combineCollaborationTax,
  determineSaleTax,
} from "@/lib/tax-determination";

describe("tax determinations", () => {
  it("collects tax on a subscription invoice, a collaboration sale, and both fees", () => {
    const invoice = determineSaleTax({
      event: "subscription_invoice",
      subjectId: "pro",
      baseCents: 2_900,
      inclusive: false,
      result: { state: "calculated", taxCents: 290, reason: "The provider applied its standard rate for this address." },
    });
    assert.equal(invoice.ok, true);
    if (!invoice.ok) return;
    assert.equal(invoice.line.collectedCents, 3_190);
    assert.equal(invoice.line.collection, "added");

    const sale = determineSaleTax({
      event: "collaboration_sale",
      subjectId: "service",
      baseCents: 100_000,
      inclusive: false,
      result: { state: "calculated", taxCents: 0, reason: "Exempt in this fixture." },
    });
    const business = determineSaleTax({
      event: "business_fee",
      subjectId: "business-fee",
      baseCents: 5_000,
      inclusive: false,
      result: { state: "calculated", taxCents: 500, reason: "Taxable at 10%." },
    });
    const influencer = determineSaleTax({
      event: "influencer_fee",
      subjectId: "influencer-fee",
      baseCents: 2_500,
      inclusive: false,
      result: { state: "calculated", taxCents: 250, reason: "Taxable at 10%." },
    });
    assert.equal(sale.ok && business.ok && influencer.ok, true);
    if (!sale.ok || !business.ok || !influencer.ok) return;
    const checkout = combineCollaborationTax({ sale: sale.line, businessFee: business.line, influencerFee: influencer.line });
    assert.equal(checkout.ok, true);
    if (!checkout.ok) return;
    assert.equal(checkout.businessPaysCents, 105_500);
    assert.equal(checkout.influencerNetCents, 97_250);
    assert.equal(checkout.operationsCents, 7_500);
    assert.equal(checkout.taxLiabilityCents, 750);
    assert.equal(sale.line.reason, "Exempt in this fixture.");
  });

  it("does not store a failed calculation as zero", () => {
    const failed = determineSaleTax({
      event: "subscription_invoice",
      subjectId: "pro",
      baseCents: 2_900,
      inclusive: false,
      result: { state: "failed", detail: "The tax provider timed out." },
    });
    assert.equal(failed.ok, false);
    if (failed.ok) return;
    assert.equal(failed.storedAsZero, false);
    assert.equal("taxCents" in failed, false);
    const blank = determineSaleTax({
      event: "business_fee",
      subjectId: "fee",
      baseCents: 5_000,
      inclusive: false,
      result: { state: "calculated", taxCents: 0, reason: "  " },
    });
    assert.equal(blank.ok, false);
    if (!blank.ok) assert.match(blank.error, /reason/i);
  });

  it("carries original tax through a milestone payout and does not charge it again", () => {
    const carried = carryOriginalTaxThroughPayouts({
      lines: [
        { event: "collaboration_sale", subjectId: "service", taxCents: 0, reason: "Exempt in this fixture." },
        { event: "business_fee", subjectId: "business-fee", taxCents: 500, reason: "Taxable at 10%." },
        { event: "influencer_fee", subjectId: "influencer-fee", taxCents: 250, reason: "Taxable at 10%." },
      ],
      weightsBps: [4_000, 6_000],
    });
    assert.equal(carried.ok, true);
    if (!carried.ok) return;
    assert.equal(carried.chargedAgain, false);
    assert.equal(carried.payouts[0]?.taxCents, 300);
    assert.equal(carried.payouts[1]?.taxCents, 450);
    assert.equal(carried.payouts[0]?.payoutPaid, false);
    assert.equal(carried.payouts[0]?.moneyMoved, false);
    assert.equal(carried.payouts[0]?.lines[0]?.reason, "Exempt in this fixture.");
    const nets = allocateByLargestRemainder(97_250, [4_000, 6_000]);
    const fees = allocateByLargestRemainder(7_500, [4_000, 6_000]);
    assert.equal(nets?.[0], 38_900);
    assert.equal(fees?.[0], 3_000);
    assert.equal((nets?.[0] ?? 0) + (fees?.[0] ?? 0) + (carried.payouts[0]?.taxCents ?? 0), 42_200);
  });

  it("keeps a missing determination off the settlement and blocks an unresolved quote", () => {
    const legacy = carriedSettlementTax({ quote: {}, milestoneId: "ms_1" });
    assert.equal(legacy.ok && legacy.taxCents, null);
    assert.equal(legacy.ok && legacy.payoutPaid, false);
    const unresolved = collaborationTaxBeforeCollection({ signedQuote: { taxStatus: "unresolved", taxLines: [] } });
    assert.equal(unresolved.ok, false);
    if (!unresolved.ok) assert.equal(unresolved.storedAsZero, false);
    const zero = carriedSettlementTax({
      quote: {
        taxStatus: "approved_zero",
        taxLines: [
          { type: "business_fee_tax", amountCents: 0, disposition: "Non-taxable supply.", ruleVersion: "fee-1" },
        ],
        milestoneAllocations: [
          { milestoneId: "ms_1", grossCents: 40_000 },
          { milestoneId: "ms_2", grossCents: 60_000 },
        ],
      },
      milestoneId: "ms_1",
    });
    assert.equal(zero.ok && zero.taxCents, 0);
    assert.match(zero.ok ? zero.taxReason : "", /Non-taxable/);
    assert.equal(zero.ok && zero.chargedAgain, false);
  });
});
