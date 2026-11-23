import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openStripeCheckout, setStripeTransportForTests } from "./stripe-admin";

async function bodyFor(collectionAccountId: string | null) {
  let sent = new URLSearchParams();
  setStripeTransportForTests(async (_url, init) => {
    sent = new URLSearchParams(String(init?.body ?? ""));
    return new Response(JSON.stringify({ id: "cs_test_sub", url: "https://checkout.stripe.com/c/pay/cs_test_sub", livemode: false }), { status: 200 });
  });
  try {
    const opened = await openStripeCheckout({
      secret: "sk_test_sub",
      mode: "sandbox",
      priceId: "",
      amountCents: 1_900,
      name: "Influencer Plus",
      description: "Monthly plan",
      successUrl: "https://influrios.com/billing/success",
      cancelUrl: "https://influrios.com/pricing",
      metadata: { plan: "PLUS" },
      collectionAccountId,
    });
    assert.equal(opened.ok, true, JSON.stringify(opened));
    return sent;
  } finally {
    setStripeTransportForTests(null);
  }
}

describe("subscriptions go to the Collection sub-account", () => {
  it("routes every invoice of a new subscription to the Collection account when one is set", async () => {
    const body = await bodyFor("acct_collection1");
    assert.equal(body.get("mode"), "subscription");
    assert.equal(body.get("subscription_data[transfer_data][destination]"), "acct_collection1");
  });

  it("keeps subscriptions in the main account when no Collection account is set", async () => {
    assert.equal((await bodyFor(null)).get("subscription_data[transfer_data][destination]"), null);
    assert.equal((await bodyFor("not-an-account")).get("subscription_data[transfer_data][destination]"), null);
  });
});
