import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setStripeTransportForTests } from "@/lib/stripe-admin";
import { planPriceBody, planPriceLookupKey, planProductId, syncPlanStripePrices } from "@/lib/stripe-plan-prices";

type Price = { id: string; product: string; unit_amount: number; recurring: { interval: string }; lookup_key: string };

function fakeStripe() {
  const products = new Map<string, { id: string; name: string }>();
  const prices: Price[] = [];
  const calls: string[] = [];
  const transport = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    const method = init?.method ?? "GET";
    const body = new URLSearchParams(String(init?.body ?? ""));
    calls.push(`${method} ${href.replace("https://api.stripe.com", "")}`);
    const json = (status: number, payload: unknown) => new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
    const productMatch = href.match(/\/v1\/products\/([^?]+)$/);
    if (productMatch && method === "GET") {
      const found = products.get(productMatch[1]!);
      return found ? json(200, { ...found, active: true }) : json(404, { error: { message: "No such product" } });
    }
    if (href.endsWith("/v1/products") && method === "POST") {
      const id = body.get("id")!;
      products.set(id, { id, name: body.get("name")! });
      return json(200, { id, name: body.get("name") });
    }
    if (productMatch && method === "POST") return json(200, { id: productMatch[1] });
    if (href.includes("/v1/prices?") && method === "GET") {
      const key = decodeURIComponent(href.split("lookup_keys[]=")[1] ?? "");
      return json(200, { data: prices.filter((row) => row.lookup_key === key) });
    }
    if (href.endsWith("/v1/prices") && method === "POST") {
      const price: Price = {
        id: `price_${prices.length + 1}`,
        product: body.get("product")!,
        unit_amount: Number(body.get("unit_amount")),
        recurring: { interval: body.get("recurring[interval]")! },
        lookup_key: body.get("lookup_key")!,
      };
      prices.push(price);
      return json(200, price);
    }
    return json(404, { error: { message: `unexpected ${method} ${href}` } });
  }) as typeof fetch;
  return { transport, products, prices, calls };
}

describe("plan prices are set in Influrios and created in Stripe automatically", () => {
  it("names products and prices predictably", () => {
    assert.equal(planProductId("PLUS"), "influrios_plan_plus");
    assert.equal(planPriceLookupKey("BUSINESS_PRO", "year", 299000), "influrios_business_pro_year_299000");
    const body = planPriceBody({ productId: "influrios_plan_plus", code: "PLUS", interval: "month", cents: 1900 });
    assert.equal(body.get("recurring[interval]"), "month");
    assert.equal(body.get("unit_amount"), "1900");
    assert.equal(body.get("currency"), "usd");
  });

  it("creates the product and both prices once, reuses them, and adds a new price when the amount changes", async () => {
    const previous = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_planprices";
    const fake = fakeStripe();
    setStripeTransportForTests(fake.transport);
    try {
      const first = await syncPlanStripePrices({ code: "PLUS", name: "Plus", description: "", monthlyCents: 1900, annualCents: 19000 });
      assert.equal(first.ok, true, JSON.stringify(first));
      assert.equal(fake.products.size, 1);
      assert.equal(fake.prices.length, 2);
      assert.deepEqual(fake.prices.map((row) => [row.recurring.interval, row.unit_amount]), [["month", 1900], ["year", 19000]]);

      const again = await syncPlanStripePrices({ code: "PLUS", name: "Plus", description: "", monthlyCents: 1900, annualCents: 19000 });
      assert.equal(again.ok && again.monthlyPriceId, first.ok && first.monthlyPriceId);
      assert.equal(fake.prices.length, 2, "same amounts reuse the same Stripe prices");

      const raised = await syncPlanStripePrices({ code: "PLUS", name: "Plus", description: "", monthlyCents: 2400, annualCents: 19000 });
      assert.equal(raised.ok, true);
      assert.equal(fake.prices.length, 3, "a new monthly amount creates one new price");
      assert.notEqual(raised.ok && raised.monthlyPriceId, first.ok && first.monthlyPriceId);
      assert.equal(raised.ok && raised.annualPriceId, first.ok && first.annualPriceId);

      const monthlyOnly = await syncPlanStripePrices({ code: "PRO", name: "Pro", description: "", monthlyCents: 4900, annualCents: null });
      assert.equal(monthlyOnly.ok && monthlyOnly.annualPriceId, "");
    } finally {
      setStripeTransportForTests(null);
      if (previous === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = previous;
    }
  });
});
