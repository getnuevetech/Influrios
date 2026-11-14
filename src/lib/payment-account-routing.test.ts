import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allocateAgreementMilestones } from "@/lib/agreement-fee-engine";
import {
  acceptCapabilityEvidence,
  buildRoleMapping,
  capabilityLossAllows,
  collaborationCollectionGate,
  collaborationOperationsBridge,
  describeStripeOperation,
  domesticLaunchAllowed,
  duplicateSettlement,
  executionContextAllowed,
  frozenDealRoute,
  interpretStripeAccountPayload,
  maskAccountId,
  operationsWithdrawal,
  partialLegRecovery,
  payoutFailureKeepsTransfer,
  planRouteDraft,
  previewUsesStableClient,
  providerOutageResult,
  providerSubmissionAccepted,
  publishCountryRules,
  readAgreementVersion,
  readMilestoneAllocation,
  reconcileProviderEvidence,
  remainingObligation,
  selectStripeTopology,
  settlementCommandKey,
  stampAllocationMilestoneIds,
  stripeCapabilityStatus,
  subscriptionEffect,
  timeoutAfterProviderCall,
  webhookAttachesToDeal,
} from "@/lib/payment-account-routing";
import { planCoupledSettlement, refundAfterPartialSettlement, stripeUsInvoke } from "@/lib/payment-standard-v4";

const previewEvidence = {
  source: "stripe_account_retrieve" as const,
  capability: "allocated_funds" as const,
  environment: "sandbox" as const,
  objectId: "acct_platform123",
  apiVersion: "2026-01-01.preview",
  retrievedAt: "2026-11-13T00:00:00.000Z",
};

describe("payment account routing", () => {
  it("keeps the illustrative five percent fixture conserved and does not store it as a rate", () => {
    const rows = allocateAgreementMilestones({
      grossCents: 100_000,
      businessCollaborationFeeCents: 5_000,
      influencerFeeCents: 2_500,
      weightsBps: [4_000, 6_000],
    });
    assert.equal(rows.ok, true);
    if (!rows.ok) return;
    assert.deepEqual(
      rows.rows.map((row) => [row.grossCents, row.businessCollaborationFeeCents, row.influencerFeeCents, row.influencerNetCents]),
      [
        [40_000, 2_000, 1_000, 39_000],
        [60_000, 3_000, 1_500, 58_500],
      ],
    );
    const firstFunded = 40_000 + 2_000;
    const firstOperations = 2_000 + 1_000;
    assert.equal(firstFunded, 39_000 + firstOperations);
    const remaining = remainingObligation({ fundedCents: 105_000, settledFundedCents: firstFunded });
    assert.equal(remaining.ok && remaining.remainingCents, 63_000);
  });

  it("does not treat a note or a stable API version as allocated-funds access", () => {
    const status = stripeCapabilityStatus({ secretPresent: false });
    assert.equal(status.allocatedFunds, "unproven");
    assert.equal(status.treasury, "unproven");
    assert.equal(status.newCollaborationFunding, "disabled");
    assert.equal(status.unproven.every((row) => row.proven === false && row.status === "unproven"), true);
    assert.equal(status.unproven.some((row) => row.id === "connect_allocated_funds"), true);
    assert.equal(status.unproven.some((row) => row.id === "treasury_financial_accounts"), true);
    assert.equal(interpretStripeAccountPayload({ id: "acct_123", capabilities: { card_payments: "active" } }).allocatedFunds, false);
    assert.equal(interpretStripeAccountPayload({ id: "acct_123", capabilities: { card_payments: "active" } }).treasury, false);
    assert.equal(acceptCapabilityEvidence("approved by email", "sandbox").ok, false);
    assert.equal(acceptCapabilityEvidence({ ...previewEvidence, apiVersion: "2025-02-24.acacia" }, "sandbox").ok, false);
    assert.equal(acceptCapabilityEvidence({ ...previewEvidence, environment: "live" }, "sandbox").ok, false);
    const accepted = acceptCapabilityEvidence(previewEvidence, "sandbox");
    assert.equal(accepted.ok, true);
    assert.equal(collaborationCollectionGate({ allocatedFunds: false, treasury: false }).ok, false);
    assert.equal(selectStripeTopology({ providerCode: "stripe", evidence: null }).newCollectionsEnabled, false);
  });

  it("stores verified account ids and refuses a Stripe mapping on another provider", () => {
    const mapping = buildRoleMapping({
      environment: "sandbox",
      collaborationReady: false,
      accounts: {
        SUBSCRIPTIONS: { externalAccountId: "acct_bill123", owner: "Influrios billing", capabilities: ["card_payments"] },
      },
    });
    assert.equal(mapping.find((row) => row.role === "SUBSCRIPTIONS")?.providerAccount, "acct_bill123");
    assert.equal(mapping.find((row) => row.role === "COLLABORATION_FUNDS")?.verified, false);
    assert.equal(mapping.find((row) => row.role === "COLLABORATION_FUNDS")?.providerAccount, "");
    assert.equal(maskAccountId("acct_bill123"), "acct_b…l123");
    const stripe = planRouteDraft({
      countryCode: "US",
      environment: "sandbox",
      currency: "USD",
      providerCode: "stripe",
      allocatedFundsApproved: true,
      newCollectionsEnabled: false,
      releasesEnabled: true,
      bankPayoutControl: true,
      evidence: "A note is not access.",
    });
    assert.equal(stripe.ok, true);
    if (!stripe.ok) return;
    assert.equal(stripe.allocatedFundsApproved, false);
    assert.equal(stripe.newCollectionsEnabled, false);
    assert.equal(stripe.bankPayoutControl, true);
    assert.equal(stripe.topology, "unavailable");
    const other = planRouteDraft({
      countryCode: "US",
      environment: "sandbox",
      currency: "USD",
      providerCode: "airwallex",
      allocatedFundsApproved: true,
      newCollectionsEnabled: false,
      releasesEnabled: false,
    });
    assert.equal(other.ok, false);
    assert.equal(
      collaborationOperationsBridge({ collaborationProvider: "stripe", operationsProvider: "airwallex", bridgeApproved: false }).ok,
      false,
    );
  });

  it("blocks equal-priority country conflicts and a cross-border domestic launch", () => {
    const published = publishCountryRules([
      { id: "group", country: "US", currency: "USD", priority: 1, provider: "stripe", concrete: false },
      { id: "concrete", country: "US", currency: "USD", priority: 2, provider: "stripe", concrete: true },
    ]);
    assert.equal(published.ok, true);
    assert.equal(published.published[0]?.id, "concrete");
    const blocked = publishCountryRules([
      { id: "a", country: "US", currency: "USD", priority: 5, provider: "stripe", concrete: true },
      { id: "b", country: "US", currency: "EUR", priority: 5, provider: "stripe", concrete: true },
    ]);
    assert.equal(blocked.ok, false);
    assert.equal(domesticLaunchAllowed({ routeCountry: "US", businessCountry: "US", influencerCountry: "NG" }).ok, false);
    assert.equal(domesticLaunchAllowed({ routeCountry: "US", businessCountry: "US", influencerCountry: "US" }).ok, true);
  });

  it("uses the signed milestone id and one command for both legs", () => {
    const version = readAgreementVersion({ agreementVersion: 3 });
    assert.equal(version.ok && version.version, 3);
    assert.equal(readAgreementVersion({}).ok, false);
    const legacy = readMilestoneAllocation({
      allocations: [{ grossCents: 40_000, businessCollaborationFeeCents: 2_000, influencerFeeCents: 1_000 }],
      milestoneId: "ms_1",
    });
    assert.equal(legacy.kind, "legacy");
    const match = readMilestoneAllocation({
      allocations: [
        { milestoneId: "ms_2", grossCents: 60_000, businessCollaborationFeeCents: 3_000, influencerFeeCents: 1_500 },
        { milestoneId: "ms_1", grossCents: 40_000, businessCollaborationFeeCents: 2_000, influencerFeeCents: 1_000 },
      ],
      milestoneId: "ms_1",
    });
    assert.equal(match.kind, "match");
    if (match.kind !== "match") return;
    assert.equal(match.row.influencerNetCents, 39_000);
    assert.equal(readMilestoneAllocation({ allocations: [{ milestoneId: "ms_9", grossCents: 1, businessCollaborationFeeCents: 0, influencerFeeCents: 0 }], milestoneId: "ms_1" }).kind, "reject");
    const key = settlementCommandKey({ milestoneId: "ms_1", agreementVersion: 3 });
    assert.equal(duplicateSettlement(key, key).reuse, true);
    assert.equal(duplicateSettlement(null, key).reuse, false);
    const stamped = stampAllocationMilestoneIds(
      { financialPlan: { signedQuote: { agreementVersion: 3, milestoneAllocations: [{ grossCents: 40_000 }, { grossCents: 60_000 }] } } },
      ["ms_1", "ms_2"],
    ) as { financialPlan: { signedQuote: { milestoneAllocations: { milestoneId: string; grossCents: number }[] } } };
    assert.equal(stamped.financialPlan.signedQuote.milestoneAllocations[1]?.milestoneId, "ms_2");
    assert.equal(stamped.financialPlan.signedQuote.milestoneAllocations[0]?.grossCents, 40_000);
  });

  it("keeps a timeout, a partial fee failure, and a failed bank payout from moving money twice", () => {
    const unknown = timeoutAfterProviderCall({ timedOut: true, providerObjectId: "tr_123" });
    assert.equal(unknown.state, "unknown");
    assert.equal(unknown.retryMovement, false);
    assert.equal(providerSubmissionAccepted({ providerObjectId: null }), false);
    assert.equal(providerSubmissionAccepted({ providerObjectId: "tr_123" }), true);
    assert.equal(stripeUsInvoke({ method: "queryCollection", allocatedFundsApproved: false, bankPayoutControl: false, methodAllowed: "card" }).ok, true);
    const partial = partialLegRecovery({ influencer: "confirmed", operations: "failed" });
    assert.deepEqual(partial.retry, ["operations_fees"]);
    assert.equal(partial.secondInfluencerTransfer, false);
    const payout = payoutFailureKeepsTransfer({ transferConfirmed: true, payout: "failed" });
    assert.equal(payout.createTransfer, false);
    assert.equal(payout.retryPayoutOnly, true);
    const planned = planCoupledSettlement({
      grossCents: 40_000,
      businessFeeCents: 2_000,
      influencerFeeCents: 1_000,
      alreadySettled: true,
      transferConfirmed: true,
      existingTransferRef: "tr_123",
      payoutState: "returned",
    });
    assert.equal(planned.ok && planned.createTransfer, false);
    const refund = refundAfterPartialSettlement({
      collectedCents: 105_000,
      settledInfluencerNetCents: 39_000,
      settledOperationsFeeCents: 3_000,
      retainedActivationCents: 0,
      proposedRefundCents: 63_000,
    });
    assert.equal(refund.ok && refund.refundCents, 63_000);
  });

  it("rejects the wrong account and keeps an outage unknown", () => {
    assert.equal(
      executionContextAllowed({
        routeEnvironment: "sandbox",
        requestEnvironment: "live",
        routeCurrency: "USD",
        requestCurrency: "USD",
        routeAccount: "acct_a",
        requestAccount: "acct_a",
      }).ok,
      false,
    );
    assert.equal(
      webhookAttachesToDeal({
        signatureValid: true,
        eventAccount: "acct_other",
        dealAccount: "acct_deal",
        eventFundingId: "fund_1",
        dealFundingId: "fund_1",
      }).attach,
      false,
    );
    const outage = providerOutageResult();
    assert.equal(outage.balanceCents, null);
    assert.equal(outage.reconciled, false);
    const compared = reconcileProviderEvidence({
      outage: true,
      reference: "ch_1",
      retrieved: null,
      expected: { amountCents: 105_000, currency: "USD", account: "acct_a" },
    });
    assert.equal(compared.ok, false);
    if (!compared.ok) assert.equal(compared.state, "unknown");
    assert.equal(capabilityLossAllows({ capabilityActive: false, action: "new_collection" }).allowed, false);
    assert.equal(capabilityLossAllows({ capabilityActive: false, action: "refund" }).allowed, true);
    assert.equal(frozenDealRoute({ signedAccountId: "acct_signed", editedAccountId: "acct_new" }).accountId, "acct_signed");
  });

  it("keeps subscription billing off the collaboration ledger and limits an Operations withdrawal", () => {
    const subscription = subscriptionEffect("customer.subscription.deleted");
    assert.equal(subscription.createsCollaborationSettlement, false);
    assert.equal(subscription.touchesSubscriptionLedger, true);
    const early = operationsWithdrawal({
      earningsCents: 7_500,
      reserveCents: 0,
      taxLiabilityCents: 0,
      unsettledFeeCents: 0,
      unrelatedDealCents: 20_000,
      influencerPayoutConfirmed: false,
      requestedCents: 7_500,
    });
    assert.equal(early.ok, false);
    const paid = operationsWithdrawal({
      earningsCents: 7_500,
      reserveCents: 500,
      taxLiabilityCents: 200,
      unsettledFeeCents: 0,
      unrelatedDealCents: 20_000,
      influencerPayoutConfirmed: true,
      requestedCents: 6_800,
    });
    assert.equal(paid.ok && paid.payCents, 6_800);
    const tooMuch = operationsWithdrawal({
      earningsCents: 7_500,
      reserveCents: 500,
      taxLiabilityCents: 200,
      unsettledFeeCents: 1_000,
      unrelatedDealCents: 0,
      influencerPayoutConfirmed: true,
      requestedCents: 7_500,
    });
    assert.equal(tooMuch.ok, false);
  });

  it("describes the Stripe operations and refuses preview fields on the stable client", () => {
    const blocked = describeStripeOperation({
      operation: "allocated_collection",
      environment: "sandbox",
      currency: "usd",
      idempotencyKey: "col_1",
      evidence: null,
      amountCents: 105_000,
    });
    assert.equal(blocked.ok, false);
    const collection = describeStripeOperation({
      operation: "allocated_collection",
      environment: "sandbox",
      currency: "usd",
      idempotencyKey: "col_1",
      evidence: previewEvidence,
      amountCents: 105_000,
    });
    assert.equal(collection.ok, true);
    if (!collection.ok) return;
    assert.equal(collection.request.path, "/v1/payment_intents");
    assert.equal(collection.request.body["allocated_funds[enabled]"], "true");
    assert.equal(collection.request.apiVersion, "2026-01-01.preview");
    assert.equal(previewUsesStableClient(collection.request), false);
    const release = describeStripeOperation({
      operation: "allocated_release",
      environment: "sandbox",
      currency: "usd",
      idempotencyKey: "rel_1",
      evidence: previewEvidence,
      amountCents: 39_000,
      applicationFeeCents: 3_000,
      chargeId: "ch_1",
      destinationAccountId: "acct_creator1",
    });
    assert.equal(release.ok, true);
    if (!release.ok) return;
    assert.equal(release.request.path, "/v1/transfers");
    assert.equal(release.request.body.source_transaction, "ch_1");
    assert.equal(release.request.body.application_fee_amount, "3000");
    const refund = describeStripeOperation({
      operation: "refund",
      environment: "sandbox",
      currency: "usd",
      idempotencyKey: "re_1",
      evidence: null,
      paymentIntentId: "pi_1",
      amountCents: 63_000,
    });
    assert.equal(refund.ok, true);
    if (!refund.ok) return;
    assert.equal(refund.request.path, "/v1/refunds");
    assert.equal(refund.request.apiVersion, "2025-02-24.acacia");
    assert.equal(refund.request.preview, false);
    const payout = describeStripeOperation({
      operation: "connect_payout",
      environment: "sandbox",
      currency: "usd",
      idempotencyKey: "po_1",
      stripeAccount: "acct_creator1",
      evidence: null,
      amountCents: 39_000,
    });
    assert.equal(payout.ok, true);
    if (!payout.ok) return;
    assert.equal(payout.request.stripeAccount, "acct_creator1");
    const treasury = describeStripeOperation({
      operation: "treasury_outbound_payment",
      environment: "sandbox",
      currency: "usd",
      idempotencyKey: "obp_1",
      evidence: null,
    });
    assert.equal(treasury.ok, false);
  });
});
