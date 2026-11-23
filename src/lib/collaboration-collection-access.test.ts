import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectionRequestHost,
  isLiveProductCollectionHost,
  mergeCollectionProvenance,
  resolveCollaborationCollectionRoute,
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

describe("collaboration collection routing", () => {
  it("parses hosts and treats influrios.com as the live product host", () => {
    assert.equal(collectionRequestHost("https://app.example.com:3000/x"), "app.example.com");
    assert.equal(collectionRequestHost("127.0.0.1:3000"), "127.0.0.1");
    assert.equal(isLiveProductCollectionHost("https://influrios.com/payments"), true);
    assert.equal(isLiveProductCollectionHost("https://www.influrios.com"), true);
    assert.equal(isLiveProductCollectionHost("http://127.0.0.1:3000"), false);
    assert.equal(isLiveProductCollectionHost("https://staging.example.com"), false);
  });

  it("opens standard Stripe collection with test keys, on any host, labelled as test mode", () => {
    for (const host of ["http://127.0.0.1:3000", "https://influrios.com"]) {
      const route = resolveCollaborationCollectionRoute({
        environment: "sandbox",
        stripeKeyMode: "sandbox",
        originOrHost: host,
        probe: noCaps,
      });
      assert.equal(route.ok, true);
      if (!route.ok) return;
      assert.equal(route.topology, "stripe_charges_and_transfers");
      assert.equal(route.simulation, true);
      assert.equal(route.simulationLabel, "Stripe test mode");
    }
  });

  it("opens standard Stripe collection with live keys; who may fund is gated by launch approvals", () => {
    const live = resolveCollaborationCollectionRoute({
      environment: "live",
      stripeKeyMode: "live",
      originOrHost: "https://influrios.com",
      probe: noCaps,
    });
    assert.equal(live.ok, true);
    if (!live.ok) return;
    assert.equal(live.topology, "stripe_charges_and_transfers");
    assert.equal(live.simulation, false);
    assert.equal(live.simulationLabel, null);
  });

  it("refuses without a valid Stripe key", () => {
    const none = resolveCollaborationCollectionRoute({
      environment: "sandbox",
      stripeKeyMode: null,
      originOrHost: "https://influrios.com",
      probe: noCaps,
    });
    assert.equal(none.ok, false);
  });

  it("treats failed probes as verification_failed", () => {
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
    });
    assert.equal(failed.ok, false);
    if (!failed.ok) {
      assert.equal(failed.refuseKind, "verification_failed");
      assert.match(failed.error, /Verification stays unknown|probe failed/i);
    }
  });

  it("records collection provenance without dropping frozen route fields", () => {
    const merged = mergeCollectionProvenance(
      { countryCode: "US", version: "1" },
      { topology: "stripe_charges_and_transfers", stripeKeyModeAtOpen: "sandbox", testMode: true, originHost: "influrios.com", openedAt: "2026-11-19T03:00:00.000Z" },
    );
    assert.equal((merged as { countryCode?: string }).countryCode, "US");
    assert.equal((merged as { collaborationCollection: { topology: string } }).collaborationCollection.topology, "stripe_charges_and_transfers");
  });

  it("reports Stripe Checkout collection in capability status", () => {
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
      checkedAt: "2026-11-19T03:00:00.000Z",
    });
    assert.equal(status.allocatedFunds, "unavailable");
    assert.equal(status.treasury, "unavailable");
    assert.equal(status.newCollaborationFunding, "stripe_checkout");
    assert.equal(status.providerE2eComplete, true);
    assert.equal(status.checkedAt, "2026-11-19T03:00:00.000Z");
  });
});

describe("collaboration collection live refusal (verify + transport)", () => {
  it("opens real collection for sk_live (launch approvals gate who may fund)", async () => {
    assert.equal(classifyStripeKey("sk_live_examplekey"), "live");
    const previous = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_live_examplekey";
    setStripeTransportForTests(async () => jsonResponse(200, { id: "acct_liveprobe", capabilities: { card_payments: "active" } }));
    const access = await verifyCollaborationCollectionAccess({ originOrHost: "https://influrios.com", environment: "live", env: { NODE_ENV: "production" } });
    process.env.STRIPE_SECRET_KEY = previous;
    setStripeTransportForTests(null);
    assert.equal(access.ok, true);
    assert.equal(access.topology, "stripe_charges_and_transfers");
    assert.equal(access.simulation, false);
  });

  it("opens real collection for sk_test on the production host, labelled as test mode", async () => {
    const previous = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_examplekey";
    setStripeTransportForTests(async (input) => {
      const url = String(input);
      if (url.includes("/v1/account")) {
        return jsonResponse(200, { id: "acct_testprobe", capabilities: { card_payments: "active", transfers: "active" } });
      }
      return jsonResponse(400, { error: { message: "no treasury" } });
    });
    const access = await verifyCollaborationCollectionAccess({ originOrHost: "https://influrios.com", environment: "sandbox", env: { NODE_ENV: "production" } });
    process.env.STRIPE_SECRET_KEY = previous;
    setStripeTransportForTests(null);
    assert.equal(access.ok, true);
    assert.equal(access.topology, "stripe_charges_and_transfers");
    assert.equal(access.simulation, true);
    assert.equal(access.probe.status, "checked");
  });

  it("refuses failed Stripe probes (401)", async () => {
    const previous = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_examplekey";
    setStripeTransportForTests(async () => jsonResponse(401, { error: { message: "Invalid API Key" } }));
    const access = await verifyCollaborationCollectionAccess({
      originOrHost: "http://127.0.0.1:3000",
      environment: "sandbox",
      env: { NODE_ENV: "test" },
    });
    process.env.STRIPE_SECRET_KEY = previous;
    setStripeTransportForTests(null);
    assert.equal(access.ok, false);
    assert.equal(access.probe.status, "failed");
    if (!access.ok) assert.equal(access.refuseKind, "verification_failed");
  });
});
