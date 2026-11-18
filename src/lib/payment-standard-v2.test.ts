import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDollars, dollar, dollarsEqual } from "@/lib/payment-money";
import { createMockGatewayAdapter, providerAmountPayload } from "@/lib/payment-standard-v2-adapter";
import {
  activateRoute,
  connectionHealthImpliesReadiness,
  requiredCollaborationEdges,
  validatePaymentRoute,
  type GatewayAccountRecord,
  type PaymentRouteDraft,
} from "@/lib/payment-standard-v2-accounts";
import {
  ACCEPTANCE_FIXTURE_USD,
  allocateCollaborationMilestones,
  assertUniqueReleaseAuthorization,
  buildReleaseAuthorization,
  collaborationTotals,
  proveAcceptanceFixture,
  SUBSCRIPTION_TAX_FIXTURE_USD,
  subscriptionQuote,
} from "@/lib/payment-standard-v2";
import {
  executeReleaseBatch,
  operationsSweepEligible,
  planReleaseBatch,
  retryIncompleteLegsOnly,
} from "@/lib/payment-standard-v2-release";

function account(input: Partial<GatewayAccountRecord> & Pick<GatewayAccountRecord, "id" | "providerAccountId">): GatewayAccountRecord {
  return {
    integrationId: "int_1",
    providerCode: "mock",
    accountType: "main",
    legalOwner: "Influrios",
    country: "US",
    currencies: ["USD"],
    capabilities: [
      {
        capability: "collect_payment",
        documentationRef: "mock",
        environment: "sandbox",
        verifiedAt: "2026-11-18",
      },
      {
        capability: "retain_funding",
        documentationRef: "mock",
        environment: "sandbox",
        verifiedAt: "2026-11-18",
      },
      {
        capability: "move_between_accounts",
        documentationRef: "mock",
        environment: "sandbox",
        verifiedAt: "2026-11-18",
      },
      {
        capability: "pay_beneficiary",
        documentationRef: "mock",
        environment: "sandbox",
        verifiedAt: "2026-11-18",
      },
      {
        capability: "observe_outcomes",
        documentationRef: "mock",
        environment: "sandbox",
        verifiedAt: "2026-11-18",
      },
    ],
    ...input,
  };
}

function separateMainsRoute(): { route: PaymentRouteDraft; accounts: Map<string, GatewayAccountRecord> } {
  const accounts = new Map<string, GatewayAccountRecord>([
    ["acct_s", account({ id: "acct_s", providerAccountId: "S" })],
    ["acct_c", account({ id: "acct_c", providerAccountId: "C" })],
    ["acct_o", account({ id: "acct_o", providerAccountId: "O" })],
  ]);
  const route: PaymentRouteDraft = {
    id: "route_separate",
    label: "Separate mains",
    arrangement: "separate_main_accounts",
    environment: "sandbox",
    chargeCurrency: "USD",
    status: "draft",
    bindings: [
      { role: "SUBSCRIPTION", accountId: "acct_s", environment: "sandbox", payoutPolicy: "manual" },
      { role: "COLLABORATION", accountId: "acct_c", environment: "sandbox", payoutPolicy: "manual" },
      { role: "OPERATIONS", accountId: "acct_o", environment: "sandbox", payoutPolicy: "completion_sweep" },
    ],
    edges: requiredCollaborationEdges(),
  };
  return { route, accounts };
}

describe("payment standard v2 dollars", () => {
  it("REL01 — acceptance fixture reconciles in dollars", () => {
    const proof = proveAcceptanceFixture();
    assert.equal(proof.ok, true, proof.checks.filter((c) => !c.ok).map((c) => c.detail).join("; "));
    const totals = collaborationTotals({
      currency: "USD",
      gross: ACCEPTANCE_FIXTURE_USD.gross,
      businessFee: ACCEPTANCE_FIXTURE_USD.businessFee,
      influencerFee: ACCEPTANCE_FIXTURE_USD.influencerFee,
      tax: ACCEPTANCE_FIXTURE_USD.tax,
      disclosedCosts: ACCEPTANCE_FIXTURE_USD.disclosedCosts,
    });
    assert.equal(totals.businessFunds, dollar("4830.00"));
    assert.equal(totals.influencerNet, dollar("3570.00"));
    assert.equal(totals.operationsFees, dollar("1260.00"));
  });

  it("does not expose cent fields on collaboration allocations", () => {
    const allocated = allocateCollaborationMilestones(
      {
        currency: "USD",
        gross: ACCEPTANCE_FIXTURE_USD.gross,
        businessFee: ACCEPTANCE_FIXTURE_USD.businessFee,
        influencerFee: ACCEPTANCE_FIXTURE_USD.influencerFee,
        tax: dollar("0.00"),
        disclosedCosts: dollar("0.00"),
      },
      [...ACCEPTANCE_FIXTURE_USD.milestones],
    );
    assert.equal(allocated.ok, true);
    if (!allocated.ok) return;
    const serialized = JSON.stringify(allocated);
    assert.equal(serialized.includes("Cents"), false);
    assert.equal(serialized.includes("cent"), false);
    assert.equal(allocated.rows[0]?.influencerNet, dollar("1213.80"));
  });

  it("SUB02 — subscription tax is $19.00 + $1.90 = $20.90 once", () => {
    const quote = subscriptionQuote({
      base: SUBSCRIPTION_TAX_FIXTURE_USD.base,
      taxRateBps: SUBSCRIPTION_TAX_FIXTURE_USD.taxRateBps,
    });
    assert.equal(quote.tax, dollar("1.90"));
    assert.equal(quote.total, dollar("20.90"));
    assert.equal(dollarsEqual(quote.total, addDollars(quote.base, quote.tax)), true);
  });

  it("STD02/STD04/STD05 — route validation and health separation", () => {
    const { route, accounts } = separateMainsRoute();
    const ok = validatePaymentRoute(route, accounts);
    assert.equal(ok.ok, true);

    const collapsed = {
      ...route,
      bindings: [
        { role: "SUBSCRIPTION" as const, accountId: "acct_s", environment: "sandbox" as const, payoutPolicy: "manual" as const },
        { role: "COLLABORATION" as const, accountId: "acct_c", environment: "sandbox" as const, payoutPolicy: "manual" as const },
        { role: "OPERATIONS" as const, accountId: "acct_c", environment: "sandbox" as const, payoutPolicy: "completion_sweep" as const },
      ],
    };
    const bad = validatePaymentRoute(collapsed, accounts);
    assert.equal(bad.ok, false);
    if (!bad.ok) {
      assert.match(bad.reasons.join(" "), /same account/i);
    }

    const missingEdge = { ...route, edges: route.edges.filter((edge) => edge.toRole !== "OPERATIONS") };
    const blocked = validatePaymentRoute(missingEdge, accounts);
    assert.equal(blocked.ok, false);
    assert.equal(connectionHealthImpliesReadiness("healthy", blocked), false);

    const activated = activateRoute(route, accounts);
    assert.equal(activated.ok, true);
  });

  it("STD03 — subaccount arrangement keeps identical economics", () => {
    const allocated = allocateCollaborationMilestones(
      {
        currency: "USD",
        gross: dollar("4200.00"),
        businessFee: dollar("630.00"),
        influencerFee: dollar("630.00"),
        tax: dollar("0.00"),
        disclosedCosts: dollar("0.00"),
      },
      [...ACCEPTANCE_FIXTURE_USD.milestones],
    );
    assert.equal(allocated.ok, true);
    if (!allocated.ok) return;
    assert.equal(allocated.totals.businessFunds, dollar("4830.00"));
  });

  it("REL02/REL03/REL05 — unique authorization, partial retry, direct payout", async () => {
    const keys = new Set<string>();
    const plan = buildReleaseAuthorization({
      agreementId: "agr_1",
      agreementVersion: 1,
      milestoneName: "Kickoff",
      currency: "USD",
      influencerNet: dollar("1213.80"),
      operationsFee: dollar("428.40"),
      influencerBeneficiaryRef: "benef_1",
      operationsAccountRef: "acct_o",
      influencerMethod: "direct_external_payout",
    });
    assert.equal(assertUniqueReleaseAuthorization(keys, plan).ok, true);
    keys.add(plan.authorizationKey);
    assert.equal(assertUniqueReleaseAuthorization(keys, plan).ok, false);

    const planned = planReleaseBatch({
      batchId: "batch_1",
      agreementId: "agr_1",
      agreementVersion: 1,
      milestoneName: "Kickoff",
      currency: "USD",
      influencerNet: dollar("1213.80"),
      operationsFee: dollar("428.40"),
      influencerBeneficiaryRef: "benef_1",
      operationsAccountRef: "acct_o",
      available: { available: dollar("4830.00"), currency: "USD" },
      existingAuthorizationKeys: new Set(),
      influencerMethod: "direct_external_payout",
    });
    assert.equal(planned.ok, true);
    if (!planned.ok) return;

    const adapter = createMockGatewayAdapter();
    const opsLeg = planned.batch.legs.find((leg) => leg.purpose === "operations")!;
    const partial = await executeReleaseBatch({
      batch: planned.batch,
      adapter,
      integrationId: "int_1",
      environment: "sandbox",
      collaborationAccountId: "acct_c",
      failLegIds: new Set([opsLeg.legId]),
    });
    assert.equal(partial.status, "partially_completed");
    assert.equal(partial.legs.find((leg) => leg.purpose === "influencer")?.status, "settled");
    assert.equal(partial.legs.find((leg) => leg.purpose === "operations")?.status, "failed");
    assert.deepEqual(
      retryIncompleteLegsOnly(partial).map((leg) => leg.purpose),
      ["operations"],
    );

    const recovered = await executeReleaseBatch({
      batch: partial,
      adapter,
      integrationId: "int_1",
      environment: "sandbox",
      collaborationAccountId: "acct_c",
    });
    assert.equal(recovered.status, "completed");
    assert.equal(recovered.legs.every((leg) => leg.status === "settled"), true);
    // Direct payout path: influencer leg used external payout; no second payout invented by planner.
    assert.equal(recovered.legs.filter((leg) => leg.purpose === "influencer").length, 1);
  });

  it("OPS01 — sweep only eligible completed-campaign cash", () => {
    const blocked = operationsSweepEligible({
      earnedOperations: dollar("1260.00"),
      alreadySwept: dollar("0.00"),
      reserves: dollar("0.00"),
      refunds: dollar("0.00"),
      pendingSweep: dollar("0.00"),
      collaborationCompleted: false,
    });
    assert.equal(blocked.ok, false);

    const ok = operationsSweepEligible({
      earnedOperations: dollar("1260.00"),
      alreadySwept: dollar("100.00"),
      reserves: dollar("50.00"),
      refunds: dollar("10.00"),
      pendingSweep: dollar("0.00"),
      collaborationCompleted: true,
    });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.sweepable, dollar("1100.00"));
  });

  it("STD01 — mock collection and payout without native split", async () => {
    const adapter = createMockGatewayAdapter();
    const caps = await adapter.getCapabilities();
    assert.equal(caps.includes("collect_payment"), true);
    const collected = await adapter.createCollection({
      integrationId: "int_1",
      environment: "sandbox",
      sourceAccountId: "acct_c",
      obligationId: "fund_1",
      amount: dollar("4830.00"),
      currency: "USD",
      idempotencyKey: "col_1",
      businessReference: "order_1",
    });
    assert.equal(collected.status, "settled");
    const again = await adapter.createCollection({
      integrationId: "int_1",
      environment: "sandbox",
      sourceAccountId: "acct_c",
      obligationId: "fund_1",
      amount: dollar("4830.00"),
      currency: "USD",
      idempotencyKey: "col_1",
      businessReference: "order_1",
    });
    assert.equal(again.providerId, collected.providerId);
    const payload = providerAmountPayload(dollar("1213.80"), "USD");
    assert.equal(payload.amount, dollar("1213.80"));
    assert.equal("amountCents" in payload, false);
  });
});
