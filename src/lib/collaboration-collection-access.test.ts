import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSandboxCollectionProvenance,
  collectionRequestHost,
  isLiveProductCollectionHost,
  isSandboxLedgerHoldRouteEnabled,
  isSandboxLedgerHoldTransferRef,
  isTrustedSandboxDeployment,
  mergeSandboxCollectionProvenance,
  readSandboxCollectionProvenance,
  resolveCollaborationCollectionRoute,
  sandboxLedgerHoldReleaseSimulation,
  stripeCapabilityStatus,
} from "@/lib/payment-account-routing";
import { classifyStripeKey, setStripeTransportForTests } from "@/lib/stripe-admin";
import { verifyCollaborationCollectionAccess } from "@/lib/collaboration-collection-access";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const noCaps = {
  status: "checked" as const,
  allocatedFunds: false,
  treasury: false,
  reason: "The account payload does not prove allocated funds or Treasury.",
};

const sandboxGates = { trustedDeployment: true, sandboxRouteEnabled: true };

describe("collaboration collection routing", () => {
  it("parses hosts and treats influrios.com as the live product host", () => {
    assert.equal(collectionRequestHost("https://app.example.com:3000/x"), "app.example.com");
    assert.equal(collectionRequestHost("127.0.0.1:3000"), "127.0.0.1");
    assert.equal(isLiveProductCollectionHost("https://influrios.com/payments"), true);
    assert.equal(isLiveProductCollectionHost("https://www.influrios.com"), true);
    assert.equal(isLiveProductCollectionHost("http://127.0.0.1:3000"), false);
    assert.equal(isLiveProductCollectionHost("https://staging.example.com"), false);
  });

  it("requires trusted deployment and explicit sandbox route enable", () => {
    assert.equal(isTrustedSandboxDeployment({ NODE_ENV: "production" }), false);
    assert.equal(isTrustedSandboxDeployment({ NODE_ENV: "test" }), true);
    assert.equal(isTrustedSandboxDeployment({}), false);
    assert.equal(isSandboxLedgerHoldRouteEnabled({ COLLABORATION_SANDBOX_LEDGER_HOLD: "1" }), true);
    assert.equal(isSandboxLedgerHoldRouteEnabled({}), false);
  });

  it("opens labelled sandbox ledger-hold only when gates pass (sk_test)", () => {
    const route = resolveCollaborationCollectionRoute({
      environment: "sandbox",
      stripeKeyMode: "sandbox",
      originOrHost: "http://127.0.0.1:3000",
      probe: noCaps,
      ...sandboxGates,
    });
    assert.equal(route.ok, true);
    if (!route.ok) return;
    assert.equal(route.topology, "sandbox_ledger_hold");
    assert.equal(route.simulation, true);
    assert.equal(route.providerE2eComplete, false);
    assert.match(String(route.limitation), /not complete/i);
  });

  it("does not enable live collection or providerE2eComplete from capability probes", () => {
    const liveWithCaps = resolveCollaborationCollectionRoute({
      environment: "live",
      stripeKeyMode: "live",
      originOrHost: "https://influrios.com",
      probe: { status: "checked", allocatedFunds: true, treasury: true, reason: "detected" },
      ...sandboxGates,
    });
    assert.equal(liveWithCaps.ok, false);
    if (!liveWithCaps.ok) {
      assert.equal(liveWithCaps.refuseKind, "live_closed");
      assert.equal(liveWithCaps.providerE2eComplete, false);
    }

    const sandboxWithCaps = resolveCollaborationCollectionRoute({
      environment: "sandbox",
      stripeKeyMode: "sandbox",
      originOrHost: "http://127.0.0.1:3000",
      probe: { status: "checked", allocatedFunds: true, treasury: false, reason: "detected" },
      ...sandboxGates,
    });
    assert.equal(sandboxWithCaps.ok, true);
    if (!sandboxWithCaps.ok) return;
    assert.equal(sandboxWithCaps.topology, "sandbox_ledger_hold");
    assert.equal(sandboxWithCaps.providerE2eComplete, false);
    assert.equal(sandboxWithCaps.simulation, true);
  });

  it("refuses empty host, prod host, missing enable, and untrusted deployment", () => {
    assert.equal(
      resolveCollaborationCollectionRoute({
        environment: "sandbox",
        stripeKeyMode: "sandbox",
        originOrHost: "",
        probe: noCaps,
        ...sandboxGates,
      }).ok,
      false,
    );
    assert.equal(
      resolveCollaborationCollectionRoute({
        environment: "sandbox",
        stripeKeyMode: "sandbox",
        originOrHost: "https://influrios.com",
        probe: noCaps,
        ...sandboxGates,
      }).ok,
      false,
    );
    assert.equal(
      resolveCollaborationCollectionRoute({
        environment: "sandbox",
        stripeKeyMode: "sandbox",
        originOrHost: "http://127.0.0.1:3000",
        probe: noCaps,
        trustedDeployment: false,
        sandboxRouteEnabled: true,
      }).ok,
      false,
    );
    assert.equal(
      resolveCollaborationCollectionRoute({
        environment: "sandbox",
        stripeKeyMode: "sandbox",
        originOrHost: "http://127.0.0.1:3000",
        probe: noCaps,
        trustedDeployment: true,
        sandboxRouteEnabled: false,
      }).ok,
      false,
    );
  });

  it("treats failed probes as verification_failed, not sandbox_ledger_hold", () => {
    const failed = resolveCollaborationCollectionRoute({
      environment: "sandbox",
      stripeKeyMode: "sandbox",
      originOrHost: "http://127.0.0.1:3000",
      probe: {
        status: "failed",
        allocatedFunds: false,
        treasury: false,
        reason: "Stripe account probe failed (HTTP 401). Verification stays unknown. Nothing was enabled.",
        httpStatus: 401,
      },
      ...sandboxGates,
    });
    assert.equal(failed.ok, false);
    if (!failed.ok) {
      assert.equal(failed.refuseKind, "verification_failed");
      assert.match(failed.error, /Verification stays unknown|probe failed/i);
    }
  });

  it("persists and reads sandbox provenance without reclassification from a later key", () => {
    const provenance = buildSandboxCollectionProvenance({
      originOrHost: "http://127.0.0.1:3000",
      allocatedFundsDetected: false,
      treasuryDetected: false,
      openedAt: "2026-11-19T03:00:00.000Z",
    });
    const merged = mergeSandboxCollectionProvenance({ countryCode: "US", version: "1" }, provenance);
    const read = readSandboxCollectionProvenance(merged);
    assert.ok(read);
    assert.equal(read?.topology, "sandbox_ledger_hold");
    assert.equal(read?.providerE2eComplete, false);
    assert.equal(read?.originHost, "127.0.0.1");
    assert.equal(isSandboxLedgerHoldTransferRef("sim_sandbox_ledger_hold:set_1"), true);
    assert.equal(isSandboxLedgerHoldTransferRef("tr_123"), false);
  });

  it("labels sandbox release simulation without claiming provider payout", () => {
    const sim = sandboxLedgerHoldReleaseSimulation({ settlementId: "set_1", fundingId: "fund_1" });
    assert.equal(sim.ok, true);
    if (!sim.ok) return;
    assert.equal(sim.providerE2eComplete, false);
    assert.equal(sim.transferRef, "sim_sandbox_ledger_hold:set_1");
  });

  it("surfaces sandbox_ledger_hold in capability status without enabling live", () => {
    const decision = resolveCollaborationCollectionRoute({
      environment: "sandbox",
      stripeKeyMode: "sandbox",
      originOrHost: "http://127.0.0.1:3000",
      probe: noCaps,
      ...sandboxGates,
    });
    const status = stripeCapabilityStatus({
      secretPresent: true,
      probe: noCaps,
      collectionDecision: decision,
      checkedAt: "2026-11-19T03:00:00.000Z",
    });
    assert.equal(status.allocatedFunds, "unavailable");
    assert.equal(status.treasury, "unavailable");
    assert.equal(status.newCollaborationFunding, "sandbox_ledger_hold");
    assert.equal(status.providerE2eComplete, false);
    assert.equal(status.checkedAt, "2026-11-19T03:00:00.000Z");
  });
});

describe("collaboration collection live refusal (verify + transport)", () => {
  it("classifies sk_live and refuses even when capability flags are returned", async () => {
    assert.equal(classifyStripeKey("sk_live_examplekey"), "live");
    const previous = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_live_examplekey";
    setStripeTransportForTests(async () =>
      jsonResponse(200, {
        id: "acct_liveprobe",
        capabilities: { card_payments: "active", allocated_funds: "active" },
        allocated_funds: "active",
      }),
    );
    const access = await verifyCollaborationCollectionAccess({
      originOrHost: "http://127.0.0.1:3000",
      environment: "live",
      env: { COLLABORATION_SANDBOX_LEDGER_HOLD: "1", NODE_ENV: "test" },
    });
    process.env.STRIPE_SECRET_KEY = previous;
    setStripeTransportForTests(null);
    assert.equal(access.ok, false);
    assert.equal(access.providerE2eComplete, false);
    if (!access.ok) assert.equal(access.refuseKind, "live_closed");
  });

  it("opens sandbox ledger-hold for sk_test when gates pass and capabilities are unsupported", async () => {
    const previous = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_examplekey";
    setStripeTransportForTests(async (input) => {
      const url = String(input);
      if (url.includes("/v1/account")) {
        return jsonResponse(200, {
          id: "acct_testprobe",
          capabilities: { card_payments: "active", transfers: "active" },
        });
      }
      return jsonResponse(400, { error: { message: "no treasury" } });
    });
    const access = await verifyCollaborationCollectionAccess({
      originOrHost: "http://127.0.0.1:3000",
      environment: "sandbox",
      env: { COLLABORATION_SANDBOX_LEDGER_HOLD: "1", NODE_ENV: "test" },
    });
    process.env.STRIPE_SECRET_KEY = previous;
    setStripeTransportForTests(null);
    assert.equal(access.ok, true);
    assert.equal(access.topology, "sandbox_ledger_hold");
    assert.equal(access.providerE2eComplete, false);
    assert.equal(access.probe.status, "checked");
  });

  it("refuses failed Stripe probes (401) instead of opening sandbox_ledger_hold", async () => {
    const previous = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_examplekey";
    setStripeTransportForTests(async () => jsonResponse(401, { error: { message: "Invalid API Key" } }));
    const access = await verifyCollaborationCollectionAccess({
      originOrHost: "http://127.0.0.1:3000",
      environment: "sandbox",
      env: { COLLABORATION_SANDBOX_LEDGER_HOLD: "1", NODE_ENV: "test" },
    });
    process.env.STRIPE_SECRET_KEY = previous;
    setStripeTransportForTests(null);
    assert.equal(access.ok, false);
    assert.equal(access.probe.status, "failed");
    if (!access.ok) assert.equal(access.refuseKind, "verification_failed");
  });

  it("refuses production host and missing sandbox route enable even with a good probe", async () => {
    const previous = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_examplekey";
    setStripeTransportForTests(async () =>
      jsonResponse(200, { id: "acct_testprobe", capabilities: { card_payments: "active" } }),
    );

    const prodHost = await verifyCollaborationCollectionAccess({
      originOrHost: "https://influrios.com",
      environment: "sandbox",
      env: { COLLABORATION_SANDBOX_LEDGER_HOLD: "1", NODE_ENV: "test" },
    });
    assert.equal(prodHost.ok, false);

    const disabled = await verifyCollaborationCollectionAccess({
      originOrHost: "http://127.0.0.1:3000",
      environment: "sandbox",
      env: { COLLABORATION_SANDBOX_LEDGER_HOLD: "0", NODE_ENV: "test" },
    });
    assert.equal(disabled.ok, false);

    const emptyHost = await verifyCollaborationCollectionAccess({
      originOrHost: "",
      environment: "sandbox",
      env: { COLLABORATION_SANDBOX_LEDGER_HOLD: "1", NODE_ENV: "test" },
    });
    assert.equal(emptyHost.ok, false);

    process.env.STRIPE_SECRET_KEY = previous;
    setStripeTransportForTests(null);
  });
});

describe("settlement simulation retry semantics", () => {
  it("keeps simulated transfer refs out of ordinary transfer_recorded classification", () => {
    assert.equal(isSandboxLedgerHoldTransferRef("sim_sandbox_ledger_hold:abc"), true);
    assert.equal(isSandboxLedgerHoldTransferRef("tr_live_abc"), false);
    const sim = sandboxLedgerHoldReleaseSimulation({ settlementId: "s1", fundingId: "f1" });
    assert.equal(sim.ok && sim.providerE2eComplete, false);
  });
});
