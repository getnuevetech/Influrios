/**
 * Direct-call regression tests for Ola's remaining #535 findings.
 * Calls startFundingDeposit, executeOwnedSettlement, and release adapter entry points.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authorizeSandboxLedgerHoldRelease,
  buildSandboxCollectionProvenance,
  isStripeAccountRetrievePayload,
  mergeSandboxCollectionProvenance,
  resolveSandboxDeploymentHost,
} from "@/lib/payment-account-routing";
import { executeOwnedSettlement } from "@/lib/payment-settlement-executor";
import { createStripePaymentAdapter, executeSandboxReleaseOrTransfer } from "@/lib/stripe-payment-adapter";
import { startFundingDeposit } from "@/lib/funding-checkout";
import { setStripeTransportForTests } from "@/lib/stripe-admin";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const VALID_ACCOUNT = {
  id: "acct_platform123",
  object: "account",
  capabilities: { card_payments: "active", transfers: "active" },
};

const provenance = buildSandboxCollectionProvenance({
  originOrHost: "http://127.0.0.1:3000",
  allocatedFundsDetected: false,
  treasuryDetected: false,
  openedAt: "2026-11-19T04:00:00.000Z",
});
const routeSnapshot = mergeSandboxCollectionProvenance({ countryCode: "US", version: "1" }, provenance);

const trustedSandboxEnv = {
  NODE_ENV: "test",
  COLLABORATION_SANDBOX_LEDGER_HOLD: "1",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
} as const;

describe("authorizeSandboxLedgerHoldRelease (central)", () => {
  it("refuses NODE_ENV=production even with mocked provenance and flag absent", () => {
    const denied = authorizeSandboxLedgerHoldRelease({
      env: { NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000" },
      originOrHost: "http://127.0.0.1:3000",
      routeSnapshotJson: routeSnapshot,
    });
    assert.equal(denied.ok, false);
  });

  it("refuses production current host and missing enable flag even with provenance", () => {
    assert.equal(
      authorizeSandboxLedgerHoldRelease({
        env: {
          NODE_ENV: "test",
          COLLABORATION_SANDBOX_LEDGER_HOLD: "1",
          NEXT_PUBLIC_APP_URL: "https://influrios.com",
        },
        originOrHost: "http://127.0.0.1:3000",
        routeSnapshotJson: routeSnapshot,
      }).ok,
      false,
    );
    assert.equal(
      authorizeSandboxLedgerHoldRelease({
        env: { NODE_ENV: "test", NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000" },
        originOrHost: "http://127.0.0.1:3000",
        routeSnapshotJson: routeSnapshot,
      }).ok,
      false,
    );
  });

  it("background-job shape: saved funding host cannot skip missing/production current host", () => {
    // No explicit host; provenance.originHost is localhost; current deployment missing.
    const missingCurrent = authorizeSandboxLedgerHoldRelease({
      env: { NODE_ENV: "test", COLLABORATION_SANDBOX_LEDGER_HOLD: "1" },
      routeSnapshotJson: routeSnapshot,
    });
    assert.equal(missingCurrent.ok, false);
    if (!missingCurrent.ok) assert.match(missingCurrent.error, /current trusted deployment host/i);

    // Current deployment is production — refuse even with saved localhost provenance.
    const prodCurrent = authorizeSandboxLedgerHoldRelease({
      env: {
        NODE_ENV: "test",
        COLLABORATION_SANDBOX_LEDGER_HOLD: "1",
        NEXT_PUBLIC_APP_URL: "https://influrios.com",
      },
      routeSnapshotJson: routeSnapshot,
    });
    assert.equal(prodCurrent.ok, false);
    if (!prodCurrent.ok) assert.match(prodCurrent.error, /live product host/i);
  });

  it("allows trusted test env with enable + provenance + non-prod current host", () => {
    const ok = authorizeSandboxLedgerHoldRelease({
      env: { ...trustedSandboxEnv },
      originOrHost: "http://127.0.0.1:3000",
      routeSnapshotJson: routeSnapshot,
    });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.host, "127.0.0.1");
  });

  it("resolves deployment host from env without inventing 127.0.0.1", () => {
    assert.equal(resolveSandboxDeploymentHost({ NEXT_PUBLIC_APP_URL: "https://staging.example.com" }), "staging.example.com");
    assert.equal(resolveSandboxDeploymentHost({ NEXT_PUBLIC_APP_URL: "https://influrios.com" }), "influrios.com");
    assert.equal(resolveSandboxDeploymentHost({}), "");
  });

  it("rejects invalid Stripe account payloads ({}, [], list)", () => {
    assert.equal(isStripeAccountRetrievePayload({}), false);
    assert.equal(isStripeAccountRetrievePayload([]), false);
    assert.equal(isStripeAccountRetrievePayload({ object: "list", data: [] }), false);
    assert.equal(isStripeAccountRetrievePayload({ id: "cus_123" }), false);
    assert.equal(isStripeAccountRetrievePayload({ id: "acct_platform123", object: "account" }), true);
  });
});

describe("executeSandboxReleaseOrTransfer (release adapter entry)", () => {
  it("refuses production env even when provenance is present (mocked persistence)", async () => {
    let queued = false;
    const result = await executeSandboxReleaseOrTransfer(
      { fundingId: "fund_1", milestoneId: "ms_1", amountCents: 1000 },
      {
        originOrHost: "http://127.0.0.1:3000",
        env: {
          NODE_ENV: "production",
          COLLABORATION_SANDBOX_LEDGER_HOLD: "1",
          NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
        },
      },
      {
        findRouteSnapshot: async () => routeSnapshot,
        queueRelease: async () => {
          queued = true;
          return { ok: true as const, reference: "job_1" };
        },
      },
    );
    assert.equal(result.ok, false);
    assert.equal(queued, false);
  });

  it("refuses when sandbox flag is absent even with provenance on a test host", async () => {
    const result = await executeSandboxReleaseOrTransfer(
      { fundingId: "fund_1", milestoneId: "ms_1", amountCents: 1000 },
      {
        originOrHost: "http://127.0.0.1:3000",
        env: { NODE_ENV: "test", NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000" },
      },
      {
        findRouteSnapshot: async () => routeSnapshot,
        queueRelease: async () => ({ ok: true as const, reference: "job_1" }),
      },
    );
    assert.equal(result.ok, false);
  });

  it("queues labelled simulation only when auth passes", async () => {
    const result = await executeSandboxReleaseOrTransfer(
      { fundingId: "fund_1", milestoneId: "ms_1", amountCents: 1000 },
      { originOrHost: "http://127.0.0.1:3000", env: { ...trustedSandboxEnv } },
      {
        findRouteSnapshot: async () => routeSnapshot,
        queueRelease: async () => ({ ok: true as const, reference: "job_9" }),
      },
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.match(result.reference, /^sim_sandbox_ledger_hold:/);
  });

  it("adapter createReleaseOrTransfer uses the same auth and does not queue release", async () => {
    let queued = false;
    const adapter = createStripePaymentAdapter({
      // Explicit host omitted — background-job shape; current host is production.
      env: {
        NODE_ENV: "test",
        COLLABORATION_SANDBOX_LEDGER_HOLD: "1",
        NEXT_PUBLIC_APP_URL: "https://influrios.com",
      },
      releaseDeps: {
        findRouteSnapshot: async () => routeSnapshot,
        queueRelease: async () => {
          queued = true;
          return { ok: true as const, reference: "job_should_not_queue" };
        },
      },
    });
    const result = await adapter.createReleaseOrTransfer({
      fundingId: "fund_1",
      milestoneId: "ms_1",
      amountCents: 1000,
    });
    assert.equal(result.ok, false);
    assert.equal(queued, false);
  });
});

describe("executeOwnedSettlement (direct)", () => {
  it("refuses production env with provenance present and does not persist", async () => {
    let persisted = false;
    const result = await executeOwnedSettlement(
      "set_1",
      {
        originOrHost: "http://127.0.0.1:3000",
        env: {
          NODE_ENV: "production",
          COLLABORATION_SANDBOX_LEDGER_HOLD: "1",
          NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
        },
      },
      {
        findSettlement: async () => ({
          id: "set_1",
          fundingId: "fund_1",
          payoutState: "queued",
          transferRef: "",
          taxReason: "US subscription tax 8.25%",
        }),
        findFundingRouteSnapshot: async () => routeSnapshot,
        persistSandboxSimulation: async () => {
          persisted = true;
        },
        openCapabilityCase: async () => undefined,
      },
    );
    assert.equal(result.ok, false);
    assert.equal(persisted, false);
  });

  it("refuses live product current host even when trusted env + flag + provenance", async () => {
    const result = await executeOwnedSettlement(
      "set_1",
      {
        // No explicit host (job shape); saved funding host is localhost via provenance.
        env: {
          NODE_ENV: "test",
          COLLABORATION_SANDBOX_LEDGER_HOLD: "1",
          NEXT_PUBLIC_APP_URL: "https://www.influrios.com",
        },
      },
      {
        findSettlement: async () => ({
          id: "set_1",
          fundingId: "fund_1",
          payoutState: "queued",
          transferRef: "",
          taxReason: "kept",
        }),
        findFundingRouteSnapshot: async () => routeSnapshot,
        persistSandboxSimulation: async () => {
          throw new Error("should not persist");
        },
        openCapabilityCase: async () => undefined,
      },
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /live product host/i);
  });

  it("persists simulation without overwriting taxReason", async () => {
    let savedTax = "";
    const result = await executeOwnedSettlement(
      "set_1",
      { originOrHost: "http://127.0.0.1:3000", env: { ...trustedSandboxEnv } },
      {
        findSettlement: async () => ({
          id: "set_1",
          fundingId: "fund_1",
          payoutState: "queued",
          transferRef: "",
          taxReason: "US subscription tax 8.25%",
        }),
        findFundingRouteSnapshot: async () => routeSnapshot,
        persistSandboxSimulation: async (input) => {
          savedTax = input.existingTaxReason;
          assert.equal(input.existingTaxReason, "US subscription tax 8.25%");
          assert.match(input.simulationLabel, /^SIMULATION:/);
        },
        openCapabilityCase: async () => undefined,
      },
    );
    assert.equal(result.ok, true);
    assert.equal(savedTax, "US subscription tax 8.25%");
    if (result.ok) {
      assert.equal(result.state, "sandbox_simulation");
      assert.equal(result.providerE2eComplete, false);
    }
  });

  it("retries keep sandbox_simulation for existing sim transfer refs", async () => {
    const result = await executeOwnedSettlement(
      "set_1",
      { env: { NODE_ENV: "production" } },
      {
        findSettlement: async () => ({
          id: "set_1",
          fundingId: "fund_1",
          payoutState: "queued",
          transferRef: "sim_sandbox_ledger_hold:set_1",
          taxReason: "kept",
        }),
        findFundingRouteSnapshot: async () => null,
        persistSandboxSimulation: async () => {
          throw new Error("no");
        },
        openCapabilityCase: async () => undefined,
      },
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.state, "sandbox_simulation");
      assert.equal(result.providerE2eComplete, false);
    }
  });
});

describe("startFundingDeposit (direct resume auth)", () => {
  function stripeTransportWithValidAccount(checkoutBody: unknown) {
    return async (input: RequestInfo | URL) => {
      const url = String(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (url.includes("/v1/account")) return jsonResponse(200, VALID_ACCOUNT);
      return jsonResponse(200, checkoutBody);
    };
  }

  it("resumes an unpaid Checkout on influrios.com, in production and without the old sandbox flag", async () => {
    const previous = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_resumeauth";
    const unpaidCheckout = {
      id: "cs_test_resume",
      payment_status: "unpaid",
      amount_total: 5000,
      currency: "usd",
      url: "https://checkout.stripe.com/c/pay/cs_test_resume",
      livemode: false,
      metadata: { depositId: "dep_1", fundingId: "fund_1" },
    };
    // Valid Stripe account so refusals are host/env/flag — not invalid payload.
    setStripeTransportForTests(stripeTransportWithValidAccount(unpaidCheckout));

    const fundingRow = {
      id: "fund_1",
      status: "awaiting_provider",
      grossCents: 5000,
      currency: "USD",
      title: "Test",
      feeSnapshotJson: {},
    };
    const unpaidSession = {
      id: "cs_test_resume",
      paymentStatus: "unpaid" as const,
      amountTotal: 5000,
      currency: "USD",
      url: "https://checkout.stripe.com/c/pay/cs_test_resume",
      metadata: { depositId: "dep_1", fundingId: "fund_1" },
    };

    const refusedHost = await startFundingDeposit(
      { fundingId: "fund_1", method: "card", origin: "https://influrios.com" },
      {
        skipProductGates: true,
        env: { NODE_ENV: "test", COLLABORATION_SANDBOX_LEDGER_HOLD: "1" },
        findFunding: async () => fundingRow,
        findOpenGatewayDeposit: async () => ({ id: "dep_1", reference: "cs_test_resume" }),
        readCheckoutSession: async () => unpaidSession,
      },
    );
    assert.equal(refusedHost.ok, true, JSON.stringify(refusedHost));

    const refusedFlag = await startFundingDeposit(
      { fundingId: "fund_1", method: "card", origin: "http://127.0.0.1:3000" },
      {
        skipProductGates: true,
        env: { NODE_ENV: "test" },
        findFunding: async () => fundingRow,
        findOpenGatewayDeposit: async () => ({ id: "dep_1", reference: "cs_test_resume" }),
        readCheckoutSession: async () => unpaidSession,
      },
    );
    assert.equal(refusedFlag.ok, true, JSON.stringify(refusedFlag));

    const refusedProd = await startFundingDeposit(
      { fundingId: "fund_1", method: "card", origin: "http://127.0.0.1:3000" },
      {
        skipProductGates: true,
        env: { NODE_ENV: "production", COLLABORATION_SANDBOX_LEDGER_HOLD: "1" },
        findFunding: async () => fundingRow,
        findOpenGatewayDeposit: async () => ({ id: "dep_1", reference: "cs_test_resume" }),
        readCheckoutSession: async () => unpaidSession,
      },
    );
    assert.equal(refusedProd.ok, true, JSON.stringify(refusedProd));

    process.env.STRIPE_SECRET_KEY = previous;
    setStripeTransportForTests(null);
  });

  it("allows unpaid resume only when sandbox gates pass", async () => {
    const previous = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_resumeauth";
    setStripeTransportForTests(
      stripeTransportWithValidAccount({
        id: "cs_test_resume",
        payment_status: "unpaid",
        amount_total: 5000,
        currency: "usd",
        url: "https://checkout.stripe.com/c/pay/cs_test_resume",
        livemode: false,
      }),
    );
    const allowed = await startFundingDeposit(
      { fundingId: "fund_1", method: "card", origin: "http://127.0.0.1:3000" },
      {
        skipProductGates: true,
        env: { ...trustedSandboxEnv },
        findFunding: async () => ({
          id: "fund_1",
          status: "awaiting_provider",
          grossCents: 5000,
          currency: "USD",
          title: "Test",
          feeSnapshotJson: {},
        }),
        findOpenGatewayDeposit: async () => ({ id: "dep_1", reference: "cs_test_resume" }),
        readCheckoutSession: async () => ({
          id: "cs_test_resume",
          paymentStatus: "unpaid",
          amountTotal: 5000,
          currency: "USD",
          url: "https://checkout.stripe.com/c/pay/cs_test_resume",
          metadata: {},
        }),
      },
    );
    process.env.STRIPE_SECRET_KEY = previous;
    setStripeTransportForTests(null);
    assert.equal(allowed.ok, true);
    if (allowed.ok && allowed.kind === "gateway") {
      assert.match(allowed.url, /checkout\.stripe\.com/);
    }
  });
});

describe("invalid account probe payload", () => {
  it("treats HTTP 200 with {} as verification_failed (not sandbox_ledger_hold)", async () => {
    const { verifyCollaborationCollectionAccess } = await import("@/lib/collaboration-collection-access");
    const previous = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_badpayload";
    setStripeTransportForTests(async () => jsonResponse(200, {}));
    const access = await verifyCollaborationCollectionAccess({
      originOrHost: "http://127.0.0.1:3000",
      environment: "sandbox",
      env: { NODE_ENV: "test", COLLABORATION_SANDBOX_LEDGER_HOLD: "1" },
    });
    process.env.STRIPE_SECRET_KEY = previous;
    setStripeTransportForTests(null);
    assert.equal(access.ok, false);
    assert.equal(access.probe.status, "failed");
    if (!access.ok) assert.equal(access.refuseKind, "verification_failed");
  });
});
