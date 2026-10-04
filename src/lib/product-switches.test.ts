import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addAgencySeat } from "./agency";
import { isStripeConfigured, startCheckout } from "./billing";
import { disputeLoadAllowsPrefund, summarizeLedgerReport } from "./ledger";
import { setProductSwitchForTests } from "./product-switches";
import { signingEndpointAllowed } from "./providers";
import { openConnectLink, openCustomerPortal } from "./stripe-admin";

describe("admin product switches", () => {
  it("refuses a prefund at the open-dispute limit and skips that check when risk controls are off", () => {
    const blocked = disputeLoadAllowsPrefund({ enabled: true, openDisputes: 2, maxOpenDisputes: 2 });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.match(blocked.error, /Nothing was funded/);
    assert.equal(disputeLoadAllowsPrefund({ enabled: false, openDisputes: 9, maxOpenDisputes: 1 }).ok, true);
    assert.equal(disputeLoadAllowsPrefund({ enabled: true, openDisputes: 9, maxOpenDisputes: 0 }).ok, true);
  });

  it("sums a month and leaves share lines out of the report", () => {
    const rows = summarizeLedgerReport([
      { currency: "usd", kind: "hold", amountCents: 1000, createdAt: new Date("2026-03-02T00:00:00.000Z") },
      { currency: "USD", kind: "share", amountCents: 800, createdAt: new Date("2026-03-02T00:00:00.000Z") },
      { currency: "USD", kind: "fee", amountCents: 100, createdAt: new Date("2026-03-02T00:00:00.000Z") },
      { currency: "GBP", kind: "release", amountCents: 50, createdAt: new Date("2026-02-01T00:00:00.000Z") },
    ]);
    assert.equal(rows[0]?.month, "2026-03");
    assert.equal(rows[0]?.currency, "USD");
    assert.equal(rows[0]?.heldCents, 1000);
    assert.equal(rows[0]?.feeCents, 100);
    assert.deepEqual(rows[0]?.feesByType, [{ feeType: "collaboration", amountCents: 100 }]);
    assert.equal(rows[0]?.releasedCents, 0);
    assert.equal(rows[1]?.month, "2026-02");
    assert.equal(rows[1]?.releasedCents, 50);
  });

  it("breaks monthly fee totals into separate feeType columns", () => {
    const rows = summarizeLedgerReport([
      {
        currency: "USD",
        kind: "fee",
        amountCents: 150,
        feeType: "collaboration",
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
      },
      {
        currency: "USD",
        kind: "fee",
        amountCents: 75,
        feeType: "managed_intro",
        createdAt: new Date("2026-04-15T00:00:00.000Z"),
      },
      {
        currency: "USD",
        kind: "fee",
        amountCents: 25,
        feeType: "collaboration",
        createdAt: new Date("2026-04-20T00:00:00.000Z"),
      },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.feeCents, 250);
    assert.deepEqual(rows[0]?.feesByType, [
      { feeType: "collaboration", amountCents: 175 },
      { feeType: "managed_intro", amountCents: 75 },
    ]);
  });

  it("accepts only an https signing URL with no userinfo", () => {
    assert.equal(signingEndpointAllowed("https://sign.example/hook"), true);
    assert.equal(signingEndpointAllowed("http://sign.example/hook"), false);
    assert.equal(signingEndpointAllowed("https://user:pass@sign.example/hook"), false);
    assert.equal(signingEndpointAllowed(""), false);
  });

  it("keeps Stripe Connect and the billing portal closed when those switches are off", async () => {
    setProductSwitchForTests("stripe_connect", false);
    setProductSwitchForTests("customer_portal", false);
    const connect = await openConnectLink({
      accountId: "acct_test",
      refreshUrl: "https://example.com/r",
      returnUrl: "https://example.com/b",
    });
    const portal = await openCustomerPortal({ customerId: "cus_test", returnUrl: "https://example.com/billing" });
    setProductSwitchForTests("stripe_connect", null);
    setProductSwitchForTests("customer_portal", null);
    assert.equal(connect.ok, false);
    assert.equal(portal.ok, false);
    if (!connect.ok) assert.match(connect.error, /Nothing was opened/);
    if (!portal.ok) assert.match(portal.error, /Nothing was opened/);
  });

  it("refuses demo checkout when that switch is off and Stripe is not configured", async () => {
    if (isStripeConfigured()) return;
    setProductSwitchForTests("demo_checkout", false);
    const result = await startCheckout({ sku: "creator_plus" });
    setProductSwitchForTests("demo_checkout", null);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /Nothing was charged/);
  });

  it("refuses a new agency seat when seats are turned off", async () => {
    setProductSwitchForTests("agency_seats", false);
    await assert.rejects(() => addAgencySeat({ email: "seat@agency.demo", role: "member" }), /turned off/);
    setProductSwitchForTests("agency_seats", null);
  });
});
