import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyStripeKey,
  confirmStripeCheckout,
  openStripeCheckout,
  probeStripeSandbox,
  setStripeTransportForTests,
} from "./stripe-admin";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("stripe sandbox", () => {
  it("accepts sandbox key prefixes and refuses a live key", () => {
    assert.equal(classifyStripeKey("sk_test_abc"), "sandbox");
    assert.equal(classifyStripeKey("rk_test_abc"), "sandbox");
    assert.equal(classifyStripeKey("rkcs_test_abc"), "sandbox");
    assert.equal(classifyStripeKey("sk_live_abc"), "live");
    assert.equal(classifyStripeKey("not-a-key"), null);
  });

  it("confirms a sandbox only when Stripe lists test sessions", async () => {
    const previous = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "rkcs_test_sandboxkey";
    setStripeTransportForTests(async (input, init) => {
      assert.equal(String(input), "https://api.stripe.com/v1/checkout/sessions?limit=1");
      assert.equal(init?.redirect, "manual");
      return jsonResponse(200, { object: "list", data: [{ id: "cs_test_a", livemode: false }] });
    });
    const ok = await probeStripeSandbox();
    process.env.STRIPE_SECRET_KEY = "sk_live_real";
    const live = await probeStripeSandbox();
    process.env.STRIPE_SECRET_KEY = previous;
    setStripeTransportForTests(null);
    assert.equal(ok.ok, true);
    assert.equal(live.ok, false);
    if (!live.ok) assert.match(live.error, /Nothing was charged/);
  });

  it("opens an unpaid sandbox checkout and refuses to treat it as paid", async () => {
    const calls: string[] = [];
    setStripeTransportForTests(async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method} ${url}`);
      if (url.endsWith("/v1/checkout/sessions")) {
        return jsonResponse(200, { id: "cs_test_session", url: "https://checkout.stripe.com/c/pay/cs_test_session", livemode: false });
      }
      return jsonResponse(200, {
        id: "cs_test_session",
        status: "open",
        payment_status: "unpaid",
        livemode: false,
        metadata: { localSessionId: "local_1" },
      });
    });
    const opened = await openStripeCheckout({
      secret: "rkcs_test_sandboxkey",
      mode: "sandbox",
      priceId: "",
      amountCents: 1900,
      name: "Creator Plus",
      description: "Test",
      successUrl: "http://127.0.0.1:3000/billing/success",
      cancelUrl: "http://127.0.0.1:3000/billing/cancel",
      metadata: { localSessionId: "local_1", sku: "creator_plus" },
    });
    const confirmed = await confirmStripeCheckout({
      secret: "rkcs_test_sandboxkey",
      mode: "sandbox",
      checkoutSessionId: "cs_test_session",
      localId: "local_1",
    });
    setStripeTransportForTests(null);
    assert.equal(opened.ok, true);
    if (opened.ok) assert.match(opened.url, /^https:\/\/checkout\.stripe\.com\//);
    assert.equal(confirmed.ok, false);
    if (!confirmed.ok) assert.match(confirmed.error, /Nothing was changed/);
    assert.ok(calls.some((call) => call.startsWith("POST https://api.stripe.com/v1/checkout/sessions")));
  });

  it("talks to the Stripe sandbox when a test key is present", async (t) => {
    const key = process.env.STRIPE_SECRET_KEY ?? "";
    if (process.env.STRIPE_SANDBOX_LIVE !== "1" || classifyStripeKey(key) !== "sandbox") {
      t.skip();
      return;
    }
    setStripeTransportForTests(null);
    const probed = await probeStripeSandbox();
    assert.equal(probed.ok, true);
    const opened = await openStripeCheckout({
      secret: key,
      mode: "sandbox",
      priceId: "",
      amountCents: 1900,
      name: "Creator Plus",
      description: "Influrios sandbox check",
      successUrl: "https://example.com/billing/success?session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://example.com/billing/cancel",
      metadata: { localSessionId: "sandbox_check", sku: "creator_plus" },
    });
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    console.log("sandbox checkout", opened.id, "unpaid");
    assert.match(opened.id, /^cs_test_/);
    assert.match(opened.url, /^https:\/\/checkout\.stripe\.com\//);
    const confirmed = await confirmStripeCheckout({
      secret: key,
      mode: "sandbox",
      checkoutSessionId: opened.id,
      localId: "sandbox_check",
    });
    assert.equal(confirmed.ok, false);
    if (!confirmed.ok) assert.match(confirmed.error, /Nothing was changed/);
  });
});
