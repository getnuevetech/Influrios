import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildContractLedgerRow, contractCode, ledgerCsv } from "./contract-ledger";
import { reconcile } from "./reconciliation";

const at = (day: number) => new Date(Date.UTC(2026, 10, day));
const signedQuote = {
  businessPaysCents: 495_000,
  influencerReceivesCents: 357_000,
  businessPlatformFeeCents: 63_000,
  influencerPlatformFeeCents: 63_000,
  businessTaxCents: 12_000,
  influencerTaxCents: 0,
};

/** The approved design's example: C-0108 · Lifestyle launch, ABC Holdings → Ag Olomola. */
function c0108() {
  return buildContractLedgerRow({
    id: "fund_108",
    position: 108,
    title: "Lifestyle launch",
    businessName: "ABC Holdings",
    influencerName: "Ag Olomola",
    currency: "USD",
    createdAt: at(10),
    grossCents: 495_000,
    feeCents: 126_000,
    feeSnapshotJson: { financialPlan: { signedQuote } },
    awaitingPayoutCents: 0,
    entries: [
      { id: "e1", kind: "hold", amountCents: 495_000, party: "", milestoneId: null, createdAt: at(10) },
      { id: "e2", kind: "fee_pending", amountCents: 63_000, party: "platform:business", milestoneId: null, createdAt: at(10) },
      { id: "e3", kind: "fee_pending", amountCents: 63_000, party: "platform:influencer", milestoneId: null, createdAt: at(10) },
      { id: "e4", kind: "fee_eligible", amountCents: 63_000, party: "platform:business", milestoneId: null, createdAt: at(10) },
      { id: "e5", kind: "fee_eligible", amountCents: 25_200, party: "platform:influencer", milestoneId: "m1", createdAt: at(12) },
      { id: "e6", kind: "release", amountCents: 142_800, party: "Influencer", milestoneId: "m1", createdAt: at(13) },
      { id: "e7", kind: "provider_fee", amountCents: 15_000, party: "provider", milestoneId: null, createdAt: at(13) },
    ],
  });
}

describe("contract ledger", () => {
  it("reproduces the approved design's C-0108 figures", () => {
    const row = c0108();
    assert.equal(row.code, "C-0108");
    assert.equal(row.collectedCents, 495_000);
    assert.equal(row.collaborationFeesCents, 126_000);
    assert.equal(row.taxesCents, 12_000);
    assert.equal(row.platformRetainedCents, 88_200);
    assert.equal(row.processingCostsCents, 15_000);
    assert.equal(row.netEarningsCents, 73_200);
    assert.equal(row.heldCents, 252_000);
    assert.equal(row.releasedAwaitingPayoutCents, 0);
    assert.equal(row.paidToInfluencerCents, 142_800);
    assert.equal(row.retainedBusinessFeeCents, 63_000);
    assert.equal(row.retainedInfluencerFeeCents, 25_200);
  });

  it("lists the money movements in the design's order and amounts", () => {
    const moves = c0108().movements.map((m) => [m.movement, m.from, m.to, m.amountCents, m.status, m.reference]);
    assert.deepEqual(moves, [
      ["Collection", "Business", "Gateway", 495_000, "Settled", "PAY-108"],
      ["Tax allocation", "Contract funds", "Tax payable", 12_000, "Posted", "TAX-108"],
      ["Business fee allocation", "Contract funds", "Platform", 63_000, "Posted", "FEE-108B"],
      ["Influencer fee allocation", "Release allocation", "Platform", 25_200, "Posted", "FEE-108I"],
      ["Milestone release", "Contract funds", "Release allocation", 168_000, "Posted", "REL-108"],
      ["Net payout payable", "Release allocation", "Influencer payable", 142_800, "Posted", "NET-108"],
      ["Influencer payout", "Gateway", "Influencer bank", -142_800, "Paid", "OUT-108"],
      ["Processing costs", "Gateway", "Provider fees", -15_000, "Settled", "COST-108"],
    ]);
  });

  it("reconciles like the design: 4,950 − 1,428 − 150 = 3,372 owned as 2,520 + 120 + 732", () => {
    const result = reconcile([c0108()], {
      ok: true,
      availableCents: 137_200,
      pendingCents: 0,
      reserveCents: 0,
      bankCents: 200_000,
      inTransitCount: 0,
      lastPayout: null,
      fetchedAt: at(14),
    });
    assert.equal(result.ledgerCashCents, 337_200);
    assert.equal(result.combinedCents, 337_200);
    assert.equal(result.unexplainedCents, 0);
    assert.equal(result.heldCents + result.awaitingPayoutCents + result.taxPayableCents + result.platformNetCents, 337_200);
    assert.ok(result.lines.every((line) => line.matched));
    const off = reconcile([c0108()], { ok: true, availableCents: 130_000, pendingCents: 0, reserveCents: 0, bankCents: 200_000, inTransitCount: 1, lastPayout: null, fetchedAt: at(14) });
    assert.equal(off.unexplainedCents, -7_200);
    assert.equal(off.lines[0]!.matched, false);
    assert.equal(off.exceptions.pendingSettlement, 1);
  });

  it("shows provider columns as not read when Stripe cannot be reached", () => {
    const result = reconcile([c0108()], { ok: false, error: "Stripe is not connected", fetchedAt: at(14) });
    assert.equal(result.combinedCents, null);
    assert.ok(result.lines.every((line) => line.matched === null));
  });

  it("exports movements as CSV and pads contract codes", () => {
    assert.equal(contractCode(7), "C-0007");
    const csv = ledgerCsv([c0108()]);
    assert.match(csv, /^Contract,Campaign,Business,Influencer,Currency,Date,Movement,From,To,Amount,Status,Reference\n/);
    assert.match(csv, /C-0108,Lifestyle launch,ABC Holdings,Ag Olomola,USD,2026-11-13,Influencer payout,Gateway,Influencer bank,-1428\.00,Paid,OUT-108/);
  });
});
