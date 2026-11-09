import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CollaborationFeeRule } from "./collaboration-fees";
import { liveFundingBlockReason, quoteDualPlatformFees } from "./dual-platform-fees";
import {
  providerLedgerAdvance,
  buildProviderStagingTrace,
  buildSignedCommercialSnapshot,
  collaborationLaunchBlockers,
  collectionPostings,
  directGrossEditBlock,
  domesticCollaborationGate,
  earnPlatformFees,
  launchMilestoneGate,
  teamFundingGate,
  ordinaryDealShareSnapshot,
  providerEventMayAdvance,
  providerFeePosting,
  readSignedCollection,
  cancellationPostings,
  cancellationStage,
  refundPostings,
  reserveFeePostings,
  readSignedDealMoney,
  returnedPayoutPostings,
  settlePlatformFees,
  signedDealMoneyEvents,
  signedQuoteExpired,
  taxIsSeparateFromPlatformFees,
} from "./payment-engine";

const AS_OF = "2026-06-01T00:00:00.000Z";

function rule(overrides: Partial<CollaborationFeeRule>): CollaborationFeeRule {
  return {
    id: "rule",
    name: "Rule",
    version: 1,
    active: true,
    priority: 100,
    jurisdiction: "*",
    serviceLevel: "contracted",
    feeType: "platform_service",
    fundingMode: "*",
    relationshipSource: "*",
    promotionChannel: "*",
    method: "percent",
    percentBps: 0,
    fixedCents: 0,
    minFeeCents: 0,
    maxFeeCents: null,
    tierBands: [],
    payer: "brand",
    purpose: "business_platform_fee",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    notes: "",
    ...overrides,
  };
}

const business = rule({ id: "biz", name: "Business", percentBps: 250, minFeeCents: 25_000 });
const influencer = rule({
  id: "inf",
  name: "Influencer",
  payer: "creator",
  purpose: "influencer_platform_fee",
  percentBps: 200,
});

function fixtureQuote() {
  const quote = quoteDualPlatformFees([business, influencer], {
    jurisdiction: "US",
    serviceLevel: "contracted",
    grossValueCents: 350_000,
    asOf: AS_OF,
  });
  assert.equal(quote.ok, true);
  if (!quote.ok) throw new Error("fixture");
  return quote;
}

describe("payment engine acceptance", () => {
  it("reconciles the fixture, keeps tax out of platform fees, and blocks an unapproved launch", () => {
    const quote = fixtureQuote();
    assert.equal(quote.businessPaysCents, 375_000);
    assert.equal(quote.influencerReceivesCents, 343_000);
    assert.equal(quote.platformFeesTotalCents, 32_000);
    const snapshot = buildSignedCommercialSnapshot({
      quote,
      currency: "USD",
      minorDigits: 2,
      milestoneCount: 1,
      tax: { status: "approved_zero", lines: [] },
    });
    assert.equal("ok" in snapshot, false);
    if ("ok" in snapshot) return;
    assert.equal(snapshot.businessPaysCents, 375_000);
    assert.equal(snapshot.influencerReceivesCents, 343_000);
    assert.equal(snapshot.feeState, "reserved");
    assert.equal(taxIsSeparateFromPlatformFees(snapshot.taxLines, snapshot.platformFeesTotalCents).taxIncludedInPlatformFees, false);
    assert.equal(collaborationLaunchBlockers().length, 4);
    assert.equal(
      collaborationLaunchBlockers(
        {
          feeSchedulesApproved: true,
          taxTreatmentApproved: true,
          earningRefundPolicyApproved: true,
          providerRouteApproved: true,
        },
        { status: "approved_zero", lines: [] },
      ).length,
      0,
    );
    assert.equal(
      collaborationLaunchBlockers(
        {
          feeSchedulesApproved: true,
          taxTreatmentApproved: true,
          earningRefundPolicyApproved: true,
          providerRouteApproved: true,
        },
        { status: "unresolved", lines: [] },
      ).length,
      1,
    );
    const held = collectionPostings(snapshot, false);
    assert.equal("ok" in held, true);
    const available = collectionPostings(snapshot, true);
    assert.ok(Array.isArray(available));
    if (!Array.isArray(available)) return;
    assert.equal(available.find((row) => row.kind === "hold")?.amountCents, 375_000);
    const pending = reserveFeePostings(snapshot);
    assert.equal(pending.filter((row) => row.kind === "fee_pending").reduce((sum, row) => sum + row.amountCents, 0), 32_000);
  });

  it("earns both fees once after final payout and refuses a replay", () => {
    const blocked = earnPlatformFees({
      policyApproved: false,
      finalPayoutConfirmed: true,
      alreadyEarned: false,
      businessFeeCents: 25_000,
      influencerFeeCents: 7_000,
    });
    assert.equal(blocked.ok, false);
    const early = earnPlatformFees({
      policyApproved: true,
      finalPayoutConfirmed: false,
      alreadyEarned: false,
      businessFeeCents: 25_000,
      influencerFeeCents: 7_000,
    });
    assert.equal(early.ok, false);
    const earned = earnPlatformFees({
      policyApproved: true,
      finalPayoutConfirmed: true,
      alreadyEarned: false,
      businessFeeCents: 25_000,
      influencerFeeCents: 7_000,
    });
    assert.equal(earned.ok, true);
    if (!earned.ok) return;
    assert.equal(earned.entries.length, 2);
    const replay = earnPlatformFees({
      policyApproved: true,
      finalPayoutConfirmed: true,
      alreadyEarned: true,
      businessFeeCents: 25_000,
      influencerFeeCents: 7_000,
    });
    assert.equal(replay.ok, false);
    const beforeEarning = settlePlatformFees({
      earned: false,
      alreadySettled: false,
      businessFeeCents: 25_000,
      influencerFeeCents: 7_000,
      amountCents: 32_000,
      providerReference: "set_staging",
    });
    assert.equal(beforeEarning.ok, false);
    const settled = settlePlatformFees({
      earned: true,
      alreadySettled: false,
      businessFeeCents: 25_000,
      influencerFeeCents: 7_000,
      amountCents: 32_000,
      providerReference: "set_staging",
    });
    assert.equal(settled.ok, true);
    if (!settled.ok) return;
    assert.equal(settled.entries.filter((row) => row.kind === "fee_settled").length, 2);
    assert.equal(settled.entries.some((row) => row.kind === "fee_earned"), false);
    const again = settlePlatformFees({
      earned: true,
      alreadySettled: true,
      businessFeeCents: 25_000,
      influencerFeeCents: 7_000,
      amountCents: 32_000,
      providerReference: "set_staging",
    });
    assert.equal(again.ok, false);
  });

  it("records a refund and a returned payout without rewriting the original amounts", () => {
    const unapproved = refundPostings({
      policyApproved: false,
      businessPaysCents: 375_000,
      businessFeeCents: 25_000,
      influencerFeeCents: 7_000,
      businessTaxCents: 0,
      influencerTaxCents: 0,
      feeRefundable: true,
      taxReversible: true,
    });
    assert.equal(unapproved.ok, false);
    const refund = refundPostings({
      policyApproved: true,
      businessPaysCents: 375_000,
      businessFeeCents: 25_000,
      influencerFeeCents: 7_000,
      businessTaxCents: 1_000,
      influencerTaxCents: 500,
      feeRefundable: true,
      taxReversible: true,
    });
    assert.equal(refund.ok, true);
    if (!refund.ok) return;
    assert.equal(refund.entries[0].reverses, "collection");
    assert.equal(refund.entries[0].amountCents, 375_000);
    const returned = returnedPayoutPostings({ amountCents: 343_000, alreadyReturned: false });
    assert.equal(returned.ok, true);
    const again = returnedPayoutPostings({ amountCents: 343_000, alreadyReturned: true });
    assert.equal(again.ok, false);
    const deal = {
      businessPaysCents: 375_000,
      influencerReceivesCents: 343_000,
      businessPlatformFeeCents: 25_000,
      influencerPlatformFeeCents: 7_000,
      businessTaxCents: 0,
      influencerTaxCents: 0,
    };
    const held = signedDealMoneyEvents({
      deal,
      eventType: "funding.held",
      amountCents: 375_000,
      policyApproved: false,
      finalPayout: false,
      alreadyEarned: false,
      alreadyReturned: false,
    });
    assert.equal(held.ok, true);
    if (!held.ok) return;
    assert.equal(held.entries.filter((row) => row.kind === "fee_pending").length, 2);
    const early = signedDealMoneyEvents({
      deal,
      eventType: "payout.released",
      amountCents: 343_000,
      policyApproved: false,
      finalPayout: true,
      alreadyEarned: false,
      alreadyReturned: false,
    });
    assert.equal(early.ok, true);
    if (!early.ok) return;
    assert.equal(early.entries.length, 0);
    const earned = signedDealMoneyEvents({
      deal,
      eventType: "payout.released",
      amountCents: 343_000,
      policyApproved: true,
      finalPayout: true,
      alreadyEarned: false,
      alreadyReturned: false,
    });
    assert.equal(earned.ok, true);
    if (!earned.ok) return;
    assert.equal(earned.entries.filter((row) => row.kind === "fee_earned").length, 2);
    const blockedRefund = signedDealMoneyEvents({
      deal,
      eventType: "payout.refunded",
      amountCents: 375_000,
      policyApproved: false,
      finalPayout: false,
      alreadyEarned: false,
      alreadyReturned: false,
    });
    assert.equal(blockedRefund.ok, false);
    const returnedPayout = signedDealMoneyEvents({
      deal,
      eventType: "payout.returned",
      amountCents: 343_000,
      policyApproved: false,
      finalPayout: true,
      alreadyEarned: true,
      alreadyReturned: false,
    });
    assert.equal(returnedPayout.ok, true);
    const beforeWork = cancellationPostings({
      stage: cancellationStage({ releasedCents: 0, influencerReceivesCents: 343_000, feesEarned: false }),
      policyApproved: true,
      payoutReturned: false,
      businessPaysCents: 375_000,
      influencerReceivesCents: 343_000,
      businessFeeCents: 25_000,
      influencerFeeCents: 7_000,
      businessTaxCents: 0,
      influencerTaxCents: 0,
    });
    assert.equal(beforeWork.ok, true);
    if (!beforeWork.ok) return;
    assert.equal(beforeWork.entries.some((row) => row.reverses === "fee_pending"), true);
    assert.equal(beforeWork.entries.some((row) => row.reverses === "influencer_payable"), true);
    const partial = cancellationPostings({
      stage: cancellationStage({ releasedCents: 100_000, influencerReceivesCents: 343_000, feesEarned: false }),
      policyApproved: true,
      payoutReturned: false,
      businessPaysCents: 375_000,
      influencerReceivesCents: 343_000,
      businessFeeCents: 25_000,
      influencerFeeCents: 7_000,
      businessTaxCents: 0,
      influencerTaxCents: 0,
    });
    assert.equal(partial.ok, false);
    const afterPayout = cancellationPostings({
      stage: "after_payout",
      policyApproved: true,
      payoutReturned: false,
      businessPaysCents: 375_000,
      influencerReceivesCents: 343_000,
      businessFeeCents: 25_000,
      influencerFeeCents: 7_000,
      businessTaxCents: 0,
      influencerTaxCents: 0,
    });
    assert.equal(afterPayout.ok, false);
    const afterEarning = cancellationPostings({
      stage: cancellationStage({ releasedCents: 343_000, influencerReceivesCents: 343_000, feesEarned: true }),
      policyApproved: true,
      payoutReturned: true,
      businessPaysCents: 375_000,
      influencerReceivesCents: 343_000,
      businessFeeCents: 25_000,
      influencerFeeCents: 7_000,
      businessTaxCents: 0,
      influencerTaxCents: 0,
    });
    assert.equal(afterEarning.ok, true);
    if (!afterEarning.ok) return;
    assert.equal(afterEarning.entries.some((row) => row.reverses === "fee_earned"), true);
    assert.equal(afterEarning.entries.some((row) => row.kind === "fee_earned"), false);
    const providerFee = providerFeePosting({ amountCents: 50, providerReference: "prov_fee_1" });
    assert.equal(providerFee.ok, true);
    if (!providerFee.ok) return;
    assert.equal(providerFee.entries[0].kind, "provider_fee");
    assert.equal(providerFee.entries[0].party, "provider");
    assert.equal(providerFeePosting({ amountCents: 50, providerReference: "x" }).ok, false);
    assert.equal(readSignedDealMoney({ signedQuote: deal })?.businessPaysCents, 375_000);
    assert.equal(readSignedDealMoney({ feeRuleId: "legacy" }), null);
  });

  it("blocks cross-border deals, extra milestones, direct edits, and weak provider events", () => {
    assert.equal(
      domesticCollaborationGate({
        businessCountry: "US",
        influencerCountry: "NG",
        dealCountry: "US",
        businessVerified: true,
        influencerVerified: true,
        routeActive: true,
        currency: "USD",
        routeCurrency: "USD",
        payoutMethod: "bank",
      }).ok,
      false,
    );
    assert.equal(launchMilestoneGate(3).ok, false);
    assert.equal(launchMilestoneGate(3, { stagedAllowed: true, maxMilestones: 4 }).ok, true);
    assert.equal(launchMilestoneGate(1).ok, true);
    assert.equal(teamFundingGate(2, false).ok, false);
    assert.equal(teamFundingGate(2, true).ok, true);
    const abroad = domesticCollaborationGate({
      businessCountry: "US",
      influencerCountry: "NG",
      dealCountry: "US",
      businessVerified: true,
      influencerVerified: true,
      routeActive: true,
      currency: "USD",
      routeCurrency: "USD",
      payoutMethod: "local_bank",
      crossBorderAllowed: true,
    });
    assert.equal(abroad.ok, true);
    assert.match(directGrossEditBlock({ feeReservation: { status: "reserved" } }) ?? "", /signed amounts/);
    assert.equal(ordinaryDealShareSnapshot()[0].shareBps, 10_000);
    const charge = providerLedgerAdvance(
      JSON.stringify({
        name: "payment_intent.succeeded",
        data: { object: { amount: 375000, currency: "USD", metadata: { fundingId: "deal-1" } } },
      }),
    );
    assert.equal(charge.advance, false);
    const held = providerLedgerAdvance(
      JSON.stringify({
        name: "payment_intent.succeeded",
        account_id: "acct",
        environment: "demo",
        data: {
          object: {
            amount: 375000,
            currency: "USD",
            metadata: { fundingId: "deal-1", holdingAvailable: true, accountId: "acct", environment: "demo" },
          },
        },
      }),
      { amountCents: 375000, currency: "USD", accountId: "acct", environment: "demo", fundingId: "deal-1" },
    );
    assert.equal(held.advance, true);
    const wrong = providerEventMayAdvance({
      eventName: "payment_intent.succeeded",
      holdingAvailable: true,
      beneficiaryConfirmed: false,
      amountCents: 100,
      expectedAmountCents: 375000,
      currency: "USD",
      expectedCurrency: "USD",
      accountId: "acct",
      expectedAccountId: "acct",
      environment: "demo",
      expectedEnvironment: "demo",
      fundingId: "deal-1",
      expectedFundingId: "deal-1",
      duplicate: false,
    });
    assert.equal(wrong.advance, false);
    const quote = fixtureQuote();
    const snapshot = buildSignedCommercialSnapshot({
      quote,
      currency: "USD",
      minorDigits: 2,
      milestoneCount: 1,
      tax: { status: "approved_zero", lines: [] },
      quotedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    if ("ok" in snapshot) return;
    assert.match(signedQuoteExpired({ signedQuote: snapshot }, new Date("2026-02-01T00:00:00.000Z")) ?? "", /expired/);
  });

  it("records a staging trace only when the payout and the refund reconcile", () => {
    const shared = {
      currency: "USD",
      businessPaysCents: 375_000,
      influencerReceivesCents: 343_000,
      platformFeesTotalCents: 32_000,
      taxCents: 0,
      collectionRef: "col_staging",
      holdingRef: "hold_staging",
      releaseRef: "rel_staging",
      payoutRef: "pay_staging",
      holdingAvailable: true,
      beneficiaryConfirmed: true,
    };
    const payout = buildProviderStagingTrace({ ...shared, scenario: "payout" });
    assert.equal("ok" in payout, false);
    if ("ok" in payout) return;
    assert.equal(payout.steps.reduce((sum, step) => sum + (step.step === "collection" ? step.amountCents : 0), 0), 375_000);
    const broken = buildProviderStagingTrace({ ...shared, scenario: "payout", platformFeesTotalCents: 1 });
    assert.equal("ok" in broken, true);
    const refund = buildProviderStagingTrace({ ...shared, scenario: "refund", refundRef: "rf_staging", refundConfirmed: true });
    assert.equal("ok" in refund, false);
    const open = {
      feeSchedulesApproved: true,
      taxTreatmentApproved: true,
      earningRefundPolicyApproved: true,
      providerRouteApproved: true,
    };
    const plan = {
      feeReservation: { status: "reserved" },
      signedQuote: { taxStatus: "approved_zero" },
    };
    assert.match(liveFundingBlockReason(plan, { approvals: open, traceReady: false }) ?? "", /staging trace/);
    assert.equal(liveFundingBlockReason(plan, { approvals: open, traceReady: true }), null);
    assert.equal(
      readSignedCollection(
        {
          signedQuote: {
            currency: "USD",
            businessPaysCents: 375_000,
            influencerReceivesCents: 343_000,
            platformFeesTotalCents: 32_000,
          },
        },
        "USD",
      ) && "error" in (readSignedCollection({ signedQuote: { currency: "EUR", businessPaysCents: 1, influencerReceivesCents: 1, platformFeesTotalCents: 0 } }, "USD") ?? {}),
      true,
    );
  });
});
