import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allocateAgreementMilestones } from "@/lib/agreement-fee-engine";
import {
  ILLUSTRATIVE_NO_TAX,
  ILLUSTRATIVE_SUBSCRIPTION,
  approvalCopy,
  businessOverviewTotals,
  buttonClickMovesMoney,
  buyerIdentityIsNotKyb,
  changedPayableNeedsConsent,
  confirmedCollectionJournal,
  countryConflict,
  customerPaymentLabel,
  emptyPaymentsCopy,
  exceptionCopy,
  feeRuleEnablesFunding,
  fundingBlockedByVerification,
  fundingEvidenceAccepts,
  illustrativeAllocation,
  journalBalances,
  paymentStatusEmail,
  planCoupledSettlement,
  primaryPaymentAction,
  quoteExclusiveTax,
  refundAfterPartialSettlement,
  rejectSplitOrLegacyShare,
  routeReadiness,
  sameIdempotency,
  stripeUsInvoke,
  stripeUsRoleMapping,
  subscriptionPreview,
  verificationTasks,
} from "@/lib/payment-standard-v4";

const zeroTreatments = {
  gross: "no_collection_obligation" as const,
  businessFee: "no_collection_obligation" as const,
  influencerFee: "no_collection_obligation" as const,
  activation: "no_collection_obligation" as const,
};
const nullRates = { gross: null, businessFee: null, influencerFee: null, activation: null };

describe("payment standard v4.1", () => {
  it("allocates the illustrative 40/60 fixture without treating it as a rate card", () => {
    const quote = illustrativeAllocation();
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.businessPaysCents, 104_000);
    assert.deepEqual(
      quote.rows.map((row) => [row.grossCents, row.businessCollaborationFeeCents, row.influencerFeeCents, row.influencerNetCents, row.operationsFeeCents]),
      [
        [40_000, 1_600, 1_000, 39_000, 2_600],
        [60_000, 2_400, 1_500, 58_500, 3_900],
      ],
    );
    assert.match(ILLUSTRATIVE_NO_TAX.label, /not a production rate/i);
    assert.notEqual(ILLUSTRATIVE_SUBSCRIPTION.taxCents, 0);
  });

  it("conserves odd cents across gross and both fees", () => {
    const rows = allocateAgreementMilestones({
      grossCents: 100,
      businessCollaborationFeeCents: 10,
      influencerFeeCents: 7,
      weightsBps: [1, 9_999],
    });
    if (!rows.ok) throw new Error(rows.error);
    const allocated = rows.rows;
    const sum = (pick: (row: (typeof allocated)[number]) => number) => allocated.reduce((total, row) => total + pick(row), 0);
    assert.equal(sum((row) => row.grossCents), 100);
    assert.equal(sum((row) => row.businessCollaborationFeeCents), 10);
    assert.equal(sum((row) => row.influencerFeeCents), 7);
    assert.equal(allocated.every((row) => row.influencerNetCents >= 0), true);
  });

  it("blocks a missing rule tie path and legacy share", () => {
    assert.equal(rejectSplitOrLegacyShare("80/20").ok, false);
    assert.equal(rejectSplitOrLegacyShare("business_platform_fee").ok, true);
    assert.equal(feeRuleEnablesFunding(), false);
  });

  it("keeps zero, exempt, taxable, and unresolved tax distinct", () => {
    const zero = quoteExclusiveTax({
      grossCents: 100_000,
      businessFeeCents: 4_000,
      influencerFeeCents: 2_500,
      activationCents: 0,
      treatments: zeroTreatments,
      ratesBps: nullRates,
    });
    assert.equal(zero.ok && zero.businessPaysCents, 104_000);
    assert.equal(zero.ok && zero.lines[0]?.reason.length > 0, true);
    const unresolved = quoteExclusiveTax({
      grossCents: 100_000,
      businessFeeCents: 4_000,
      influencerFeeCents: 2_500,
      activationCents: 0,
      treatments: { ...zeroTreatments, businessFee: "unresolved" },
      ratesBps: nullRates,
    });
    assert.equal(unresolved.ok, false);
    const taxable = quoteExclusiveTax({
      grossCents: 100_000,
      businessFeeCents: 4_000,
      influencerFeeCents: 2_500,
      activationCents: 0,
      treatments: { ...zeroTreatments, businessFee: "taxable", influencerFee: "taxable" },
      ratesBps: { ...nullRates, businessFee: 1_000, influencerFee: 1_000 },
    });
    assert.equal(taxable.ok && taxable.businessPaysCents, 104_400);
    assert.equal(taxable.ok && taxable.influencerNetCents, 97_250);
    assert.equal(taxable.ok && taxable.taxLiabilityCents, 650);
  });

  it("does not mark funding from a redirect, a wrong amount, or a button", () => {
    assert.equal(buttonClickMovesMoney(), false);
    const redirect = fundingEvidenceAccepts({
      redirectSucceeded: true,
      providerAccountMatches: false,
      environmentMatches: false,
      amountMatches: false,
      currencyMatches: false,
      referenceMatches: false,
      allocationAvailable: false,
    });
    assert.equal(redirect.funded, false);
    const wrongAmount = fundingEvidenceAccepts({
      redirectSucceeded: false,
      providerAccountMatches: true,
      environmentMatches: true,
      amountMatches: false,
      currencyMatches: true,
      referenceMatches: true,
      allocationAvailable: true,
    });
    assert.equal(wrongAmount.funded, false);
    const held = fundingEvidenceAccepts({
      redirectSucceeded: true,
      providerAccountMatches: true,
      environmentMatches: true,
      amountMatches: true,
      currencyMatches: true,
      referenceMatches: true,
      allocationAvailable: true,
    });
    assert.equal(held.funded, true);
  });

  it("starts both settlement legs and does not repeat a transfer when payout fails", () => {
    const started = planCoupledSettlement({
      grossCents: 40_000,
      businessFeeCents: 1_600,
      influencerFeeCents: 1_000,
      alreadySettled: false,
      transferConfirmed: false,
      existingTransferRef: "",
      payoutState: "queued",
    });
    assert.equal(started.ok && started.createTransfer, true);
    assert.equal(started.ok && started.influencerNetCents, 39_000);
    assert.equal(started.ok && started.operationsFeeCents, 2_600);
    const retry = planCoupledSettlement({
      grossCents: 40_000,
      businessFeeCents: 1_600,
      influencerFeeCents: 1_000,
      alreadySettled: true,
      transferConfirmed: true,
      existingTransferRef: "tr_390",
      payoutState: "failed",
    });
    assert.equal(retry.ok && retry.createTransfer, false);
    assert.equal(retry.ok && retry.retryPayoutOnly, true);
    assert.equal(retry.ok && retry.restrictOperationsFee, true);
    const unknown = planCoupledSettlement({
      grossCents: 40_000,
      businessFeeCents: 1_600,
      influencerFeeCents: 1_000,
      alreadySettled: true,
      transferConfirmed: true,
      existingTransferRef: "tr_390",
      payoutState: "unknown",
    });
    assert.equal(unknown.ok, false);
    const duplicate = sameIdempotency({ idempotencyKey: "m1" }, { idempotencyKey: "m1" });
    assert.equal(duplicate.idempotencyKey, "m1");
  });

  it("refunds the unfinished funded amount after the first milestone", () => {
    const kept = refundAfterPartialSettlement({
      collectedCents: 104_000,
      settledInfluencerNetCents: 39_000,
      settledOperationsFeeCents: 2_600,
      retainedActivationCents: 0,
      proposedRefundCents: 62_400,
    });
    assert.equal(kept.ok && kept.refundCents, 62_400);
    const netOnly = refundAfterPartialSettlement({
      collectedCents: 104_000,
      settledInfluencerNetCents: 39_000,
      settledOperationsFeeCents: 2_600,
      retainedActivationCents: 0,
      proposedRefundCents: 58_500,
    });
    assert.equal(netOnly.ok, false);
    const lines = confirmedCollectionJournal({ currency: "USD", amountCents: 104_000, eventKey: "ch_1" });
    assert.equal(journalBalances(lines).ok, true);
  });

  it("keeps buyer identity, KYB, and a Connect return separate", () => {
    assert.equal(buyerIdentityIsNotKyb({ individualVerified: true, entityVerified: false }).ok, false);
    const tasks = verificationTasks({
      role: "paying_business",
      emailVerified: true,
      individualVerified: true,
      entityStatus: "in_review",
      authorityStatus: "not_started",
      taxStatus: "verified",
      connectStatus: "not_started",
      bankStatus: "not_started",
      connectReturnSeen: true,
    });
    assert.equal(tasks.some((task) => task.key === "connect"), false);
    assert.equal(tasks.find((task) => task.key === "entity")?.owner, "Influrios review");
    assert.match(fundingBlockedByVerification(tasks, "paying_business") ?? "", /business verification/i);
    assert.equal(countryConflict({ agreementCountry: "US", evidenceCountry: "NG" }).ok, false);
  });

  it("blocks Stripe collection without allocated-funds approval and does not simulate success", () => {
    const mapping = stripeUsRoleMapping({ environment: "sandbox", allocatedFundsApproved: false });
    assert.deepEqual(mapping.map((row) => row.role), ["SUBSCRIPTIONS", "COLLABORATION_FUNDS", "OPERATIONS", "RECIPIENT"]);
    const blocked = stripeUsInvoke({
      method: "createCollection",
      allocatedFundsApproved: false,
      bankPayoutControl: false,
      methodAllowed: "card",
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.match(blocked.blocker, /Provider approval required/);
    const ach = stripeUsInvoke({
      method: "createCollection",
      allocatedFundsApproved: true,
      bankPayoutControl: true,
      methodAllowed: "ach",
    });
    assert.equal(ach.ok, false);
    const ready = stripeUsInvoke({
      method: "queryCollection",
      allocatedFundsApproved: false,
      bankPayoutControl: false,
      methodAllowed: "card",
    });
    assert.equal(ready.ok && ready.value.simulated, false);
  });

  it("uses paid only after payout confirmation and separates business totals", () => {
    assert.equal(customerPaymentLabel({ collection: "succeeded", funds: "allocated_available", payout: "paid", refund: "none" }), "Payout confirmed");
    assert.equal(customerPaymentLabel({ collection: "succeeded", funds: "allocated_available", payout: "in_transit", refund: "none" }), "Payout processing");
    assert.notEqual(customerPaymentLabel({ collection: "processing", funds: "unconfirmed", payout: "none", refund: "none" }), "Funded");
    const business = businessOverviewTotals({
      discloseCounterpartyFees: false,
      collectedCents: 104_000,
      remainingCents: 62_400,
      businessFeeCents: 4_000,
      taxCents: 0,
      influencerPaidCents: 39_000,
      feesReleasedCents: 2_600,
    });
    assert.equal(business.some((line) => line.label === "Influencer paid"), false);
    const finance = businessOverviewTotals({
      discloseCounterpartyFees: true,
      collectedCents: 104_000,
      remainingCents: 62_400,
      businessFeeCents: 4_000,
      taxCents: 0,
      influencerPaidCents: 39_000,
      feesReleasedCents: 2_600,
    });
    assert.equal(finance.some((line) => line.label === "Fees released"), true);
    const email = paymentStatusEmail({ event: "funding_confirmed", reference: "pay_1" });
    assert.equal(email.saysPaid, false);
    assert.equal(email.authorizesRelease, false);
    assert.equal(paymentStatusEmail({ event: "payout_confirmed", reference: "po_1" }).saysPaid, true);
  });

  it("names the next safe action and blocks a stale tax total", () => {
    assert.equal(primaryPaymentAction({ signed: true, funded: false, submissionReady: false, payoutProcessing: false, payoutProblem: false, cancellationOpen: false, completed: false }).label, "Fund collaboration");
    assert.equal(primaryPaymentAction({ signed: true, funded: false, submissionReady: false, payoutProcessing: false, payoutProblem: false, cancellationOpen: false, completed: false }).money, false);
    assert.equal(changedPayableNeedsConsent({ signedPayableCents: 104_000, nextPayableCents: 104_400, consented: false }).ok, false);
    const release = approvalCopy({ amountCents: 41_600, currency: "USD", versionLabel: "v2", milestoneName: "Kickoff" });
    assert.match(release.button, /Approve and release/);
    assert.match(release.note, /does not charge/i);
    const preview = subscriptionPreview({ priceCents: 2_000, treatment: "unresolved", rateBps: null, addressReady: true, consented: true });
    assert.equal(preview.ok, false);
    const ready = subscriptionPreview({ priceCents: 2_000, treatment: "exempt", rateBps: null, addressReady: true, consented: false });
    assert.equal(ready.ok && ready.taxCents, 0);
    assert.equal(ready.ok && ready.canSubmit, false);
    const route = routeReadiness({
      domesticRule: true,
      currency: true,
      cardMethod: true,
      holdingEvidence: false,
      payoutMethod: true,
      refundSupport: true,
      bankPayoutControl: false,
      verificationWorkflow: true,
      taxOwner: false,
      productionApproval: false,
      allocatedFundsApproved: false,
    });
    assert.equal(route.fundingBlocked, true);
    assert.equal(route.blocker, "Provider approval required");
    assert.match(emptyPaymentsCopy(false).title, /No collaboration payments yet/);
    assert.match(exceptionCopy("payout_returned"), /net remains owed/i);
    assert.match(exceptionCopy("forbidden"), /do not have access/i);
  });
});
