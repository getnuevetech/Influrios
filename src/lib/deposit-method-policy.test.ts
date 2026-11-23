import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_DEPOSIT_BANDS, depositMethodsForAmount, readDepositBands } from "@/lib/deposit-method-policy";
import { depositMethodKind, stripePaymentMethodFor } from "@/lib/funding-checkout";
import { stripeFundingCheckoutBody } from "@/lib/stripe-admin";

const bands = DEFAULT_DEPOSIT_BANDS;

test("small USD deposits offer card (recommended) and ACH debit", () => {
  assert.deepEqual(depositMethodsForAmount(55_125, "USD", bands), { methods: ["card", "ach_online"], recommended: "card" });
  assert.deepEqual(depositMethodsForAmount(200_000, "usd", bands).methods, ["card", "ach_online"]);
});

test("larger USD deposits offer ACH debit only", () => {
  assert.deepEqual(depositMethodsForAmount(200_001, "USD", bands), { methods: ["ach_online"], recommended: "ach_online" });
  assert.deepEqual(depositMethodsForAmount(2_499_999, "USD", bands).methods, ["ach_online"]);
});

test("very large USD deposits offer wire or bank transfer only", () => {
  assert.deepEqual(depositMethodsForAmount(2_500_000, "USD", bands), { methods: ["bank_transfer"], recommended: "bank_transfer" });
  assert.deepEqual(depositMethodsForAmount(5_000_000, "USD", bands).methods, ["bank_transfer"]);
});

test("other currencies pay by card", () => {
  assert.deepEqual(depositMethodsForAmount(5_000_000, "GBP", bands), { methods: ["card"], recommended: "card" });
});

test("bad saved bands fall back to the defaults", () => {
  assert.deepEqual(readDepositBands(null), bands);
  assert.deepEqual(readDepositBands({ cardMaxCents: 500_000, bankTransferMinCents: 100_000 }), bands);
  assert.deepEqual(readDepositBands({ cardMaxCents: 100_000, bankTransferMinCents: 1_000_000 }), { cardMaxCents: 100_000, bankTransferMinCents: 1_000_000 });
});

test("bank transfer is a Stripe gateway deposit using the customer balance", () => {
  assert.equal(depositMethodKind("bank_transfer"), "gateway");
  assert.equal(stripePaymentMethodFor("bank_transfer"), "customer_balance");
  assert.equal(stripePaymentMethodFor("ach_online"), "us_bank_account");
  const body = stripeFundingCheckoutBody({
    amountCents: 5_000_000,
    currency: "USD",
    name: "Deal",
    successUrl: "https://influrios.com/ok",
    cancelUrl: "https://influrios.com/no",
    paymentMethod: "customer_balance",
    metadata: { fundingId: "f1" },
  });
  assert.equal(body.get("payment_method_types[0]"), "customer_balance");
  assert.equal(body.get("customer_creation"), "always");
  assert.equal(body.get("payment_method_options[customer_balance][funding_type]"), "bank_transfer");
  assert.equal(body.get("payment_method_options[customer_balance][bank_transfer][type]"), "us_bank_transfer");
  const card = stripeFundingCheckoutBody({ amountCents: 100, currency: "USD", name: "x", successUrl: "https://a/", cancelUrl: "https://a/", paymentMethod: "card", metadata: {} });
  assert.equal(card.get("customer_creation"), null);
});

test("a Stripe refusal keeps Stripe's reason so a failed payout says why", async () => {
  const { setStripeTransportForTests, stripeApiRequest } = await import("@/lib/stripe-admin");
  setStripeTransportForTests((async () =>
    new Response(JSON.stringify({ error: { message: "Your destination account needs to have the transfers capability enabled." } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch);
  try {
    const result = await stripeApiRequest({ method: "POST", path: "/v1/transfers", secret: "sk_test_x", body: new URLSearchParams({ amount: "1" }) });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.state, "blocked");
      assert.match(result.error, /transfers capability/);
    }
  } finally {
    setStripeTransportForTests(null);
  }
});
