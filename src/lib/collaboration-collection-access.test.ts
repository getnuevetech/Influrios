import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectionRequestHost,
  isLiveProductCollectionHost,
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
  allocatedFunds: false,
  treasury: false,
  reason: "The account payload does not prove allocated funds or Treasury.",
};

describe("collaboration collection routing", () => {
  it("parses hosts and treats influrios.com as the live product host", () => {
    assert.equal(collectionRequestHost("https://app.example.com:3000/x"), "app.example.com");
    assert.equal(collectionRequestHost("127.0.0.1:3000"), "127.0.0.1");
    assert.equal(isLiveProductCollectionHost("https://influrios.com/payments"), true);
    assert.equal(isLiveProductCollectionHost("https://www.influrios.com"), true);
    assert.equal(isLiveProductCollectionHost("http://127.0.0.1:3000"), false);
    assert.equal(isLiveProductCollectionHost("https://staging.example.com"), false);
  });

  it("opens labelled sandbox ledger-hold when capabilities are unavailable (sk_test only)", () => {
    const route = resolveCollaborationCollectionRoute({
      environment: "sandbox",
      stripeKeyMode: "sandbox",
      originOrHost: "http://127.0.0.1:3000",
      probe: noCaps,
    });
    assert.equal(route.ok, true);
    if (!route.ok) return;
    assert.equal(route.topology, "sandbox_ledger_hold");
    assert.equal(route.allocatedFunds, false);
    assert.equal(route.treasury, false);
    assert.equal(route.simulation, true);
    assert.equal(route.providerE2eComplete, false);
    assert.match(String(route.limitation), /allocated funds and Treasury/i);
    assert.match(String(route.simulationLabel), /^SIMULATION:/);
  });

  it("refuses live collection without allocated funds or Treasury", () => {
    const live = resolveCollaborationCollectionRoute({
      environment: "live",
      stripeKeyMode: "live",
      originOrHost: "https://influrios.com",
      probe: noCaps,
    });
    assert.equal(live.ok, false);
    if (live.ok) return;
    assert.match(live.error, /Nothing was charged/);
    assert.match(String(live.limitation), /unavailable/i);
  });

  it("refuses sk_live on the sandbox path and sk_test on live environment", () => {
    const liveKeySandboxEnv = resolveCollaborationCollectionRoute({
      environment: "sandbox",
      stripeKeyMode: "live",
      originOrHost: "http://127.0.0.1:3000",
      probe: noCaps,
    });
    assert.equal(liveKeySandboxEnv.ok, false);
    if (!liveKeySandboxEnv.ok) {
      assert.match(liveKeySandboxEnv.error, /Live Stripe credentials cannot open the sandbox/);
    }

    const testKeyLiveEnv = resolveCollaborationCollectionRoute({
      environment: "live",
      stripeKeyMode: "sandbox",
      originOrHost: "http://127.0.0.1:3000",
      probe: noCaps,
    });
    assert.equal(testKeyLiveEnv.ok, false);
    if (!testKeyLiveEnv.ok) {
      assert.match(testKeyLiveEnv.error, /Sandbox credentials cannot open live/);
    }
  });

  it("refuses sandbox ledger-hold on the production host even with sk_test", () => {
    const route = resolveCollaborationCollectionRoute({
      environment: "sandbox",
      stripeKeyMode: "sandbox",
      originOrHost: "https://www.influrios.com/payments/checkout/x",
      probe: noCaps,
    });
    assert.equal(route.ok, false);
    if (!route.ok) assert.match(route.error, /live product host/);
  });

  it("uses real allocated-funds topology when the probe proves it (sandbox)", () => {
    const route = resolveCollaborationCollectionRoute({
      environment: "sandbox",
      stripeKeyMode: "sandbox",
      originOrHost: "http://127.0.0.1:3000",
      probe: { allocatedFunds: true, treasury: false, reason: "proven", accountId: "acct_platform123" },
    });
    assert.equal(route.ok, true);
    if (!route.ok) return;
    assert.equal(route.topology, "connect_allocated_funds");
    assert.equal(route.simulation, false);
    assert.equal(route.providerE2eComplete, true);
    assert.equal(route.allocatedFunds, true);
  });

  it("labels sandbox release simulation without claiming provider payout", () => {
    const sim = sandboxLedgerHoldReleaseSimulation({ settlementId: "set_1", fundingId: "fund_1" });
    assert.equal(sim.ok, true);
    if (!sim.ok) return;
    assert.equal(sim.providerE2eComplete, false);
    assert.equal(sim.transferRef, "sim_sandbox_ledger_hold:set_1");
    assert.match(sim.simulationLabel, /^SIMULATION:/);
  });

  it("surfaces sandbox_ledger_hold in capability status without claiming allocated funds", () => {
    const decision = resolveCollaborationCollectionRoute({
      environment: "sandbox",
      stripeKeyMode: "sandbox",
      originOrHost: "http://127.0.0.1:3000",
      probe: noCaps,
    });
    const status = stripeCapabilityStatus({
      secretPresent: true,
      probe: noCaps,
      collectionDecision: decision,
    });
    assert.equal(status.allocatedFunds, "unavailable");
    assert.equal(status.treasury, "unavailable");
    assert.equal(status.newCollaborationFunding, "sandbox_ledger_hold");
    assert.equal(status.simulation, true);
  });
});

describe("collaboration collection live refusal (verify + transport)", () => {
  it("classifies sk_live and refuses sandbox verify when live key is configured", async () => {
    assert.equal(classifyStripeKey("sk_live_examplekey"), "live");
    const previous = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_live_examplekey";
    setStripeTransportForTests(async () =>
      jsonResponse(200, {
        id: "acct_liveprobe",
        capabilities: { card_payments: "active" },
      }),
    );
    const access = await verifyCollaborationCollectionAccess({
      originOrHost: "http://127.0.0.1:3000",
      environment: "sandbox",
    });
    process.env.STRIPE_SECRET_KEY = previous;
    setStripeTransportForTests(null);
    assert.equal(access.ok, false);
    assert.equal(access.stripeKeyMode, "live");
    if (!access.ok) assert.match(access.error, /Live Stripe credentials cannot open the sandbox/);
  });

  it("opens sandbox ledger-hold for sk_test on a local host when capabilities are absent", async () => {
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
    });
    process.env.STRIPE_SECRET_KEY = previous;
    setStripeTransportForTests(null);
    assert.equal(access.ok, true);
    assert.equal(access.topology, "sandbox_ledger_hold");
    assert.equal(access.allocatedFunds, false);
    assert.equal(access.treasury, false);
    assert.equal(access.providerE2eComplete, false);
  });

  it("refuses production host even when sk_test probe succeeds without capabilities", async () => {
    const previous = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_examplekey";
    setStripeTransportForTests(async () =>
      jsonResponse(200, { id: "acct_testprobe", capabilities: { card_payments: "active" } }),
    );
    const access = await verifyCollaborationCollectionAccess({
      originOrHost: "https://influrios.com",
      environment: "sandbox",
    });
    process.env.STRIPE_SECRET_KEY = previous;
    setStripeTransportForTests(null);
    assert.equal(access.ok, false);
    if (!access.ok) assert.match(access.error, /live product host/);
  });
});
