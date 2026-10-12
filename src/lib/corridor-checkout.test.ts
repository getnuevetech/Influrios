import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  checkoutUsesStoredCorridor,
  corridorPrefundSnapshot,
  gatewayIdentitySessionAllowed,
  storedIdentitySessionUrl,
  storedPayoutMethodList,
} from "./corridor-checkout";
import { stripeIdentitySession } from "./stripe-admin";

describe("corridor prefund snapshot", () => {
  it("copies a saved corridor currency, route, and chosen payout method", () => {
    const snapshot = corridorPrefundSnapshot({
      corridorCurrency: "kes",
      jurisdictionCurrency: "USD",
      collectionProviderCode: " flutterwave ",
      payoutMethods: ["mpesa", "local_bank", ""],
      payoutMethod: "mpesa",
    });
    assert.equal(snapshot.currency, "KES");
    assert.equal(snapshot.collectionProviderCode, "flutterwave");
    assert.equal(snapshot.payoutMethod, "mpesa");
    assert.equal(snapshot.payoutMethodError, null);
  });

  it("leaves a blank route and method blank and does not pick the first method", () => {
    const snapshot = corridorPrefundSnapshot({
      corridorCurrency: "",
      jurisdictionCurrency: "gbp",
      collectionProviderCode: "  ",
      payoutMethods: ["local_bank", "usd_bank"],
      payoutMethod: "",
    });
    assert.equal(snapshot.currency, "GBP");
    assert.equal(snapshot.collectionProviderCode, "");
    assert.equal(snapshot.payoutMethod, "");
    assert.equal(snapshot.payoutMethodError, null);
    assert.deepEqual(storedPayoutMethodList([" local_bank ", "", "local_bank"]), ["local_bank"]);
    const blank = corridorPrefundSnapshot({
      corridorCurrency: null,
      jurisdictionCurrency: null,
      payoutMethods: [],
    });
    assert.equal(blank.currency, null);
  });

  it("refuses a payout method that is not saved on the corridor", () => {
    const snapshot = corridorPrefundSnapshot({
      corridorCurrency: "NGN",
      jurisdictionCurrency: "USD",
      collectionProviderCode: "flutterwave",
      payoutMethods: ["local_bank"],
      payoutMethod: "mpesa",
    });
    assert.equal(snapshot.payoutMethod, "");
    assert.match(snapshot.payoutMethodError ?? "", /payout method saved on this corridor/);
  });
});

describe("corridor checkout", () => {
  it("uses the stored route and method and refuses a blank", () => {
    assert.deepEqual(checkoutUsesStoredCorridor({ collectionProviderCode: "airwallex", payoutMethod: "local_bank" }), {
      ok: true,
      collectionProviderCode: "airwallex",
      payoutMethod: "local_bank",
    });
    const missingRoute = checkoutUsesStoredCorridor({ collectionProviderCode: "", payoutMethod: "mpesa" });
    assert.equal(missingRoute.ok, false);
    const missingMethod = checkoutUsesStoredCorridor({ collectionProviderCode: "mpesa", payoutMethod: " " });
    assert.equal(missingMethod.ok, false);
    const actions = readFileSync("src/app/payments/actions.ts", "utf8");
    const ledger = readFileSync("src/lib/marketplace-ledger.ts", "utf8");
    const migration = readFileSync("prisma/migrations/20261012140000_corridor_checkout/migration.sql", "utf8");
    assert.equal(actions.includes("resolvePaymentGatewayForCountry"), false);
    assert.match(actions, /checkoutUsesStoredCorridor/);
    assert.match(ledger, /corridorPrefundSnapshot/);
    assert.match(ledger, /collectionProviderCode: corridorFacts\.collectionProviderCode/);
    assert.match(ledger, /collectionProviderCode: row\.collectionProviderCode/);
    assert.equal(ledger.includes('|| "USD"'), false);
    assert.equal(migration.includes("UPDATE"), false);
  });

  it("opens a gateway identity session only when that provider is enabled", () => {
    assert.equal(gatewayIdentitySessionAllowed({ enabled: true }), true);
    assert.equal(gatewayIdentitySessionAllowed({ enabled: false }), false);
    assert.equal(gatewayIdentitySessionAllowed(null), false);
    assert.equal(storedIdentitySessionUrl("https://verify.stripe.com/start"), "https://verify.stripe.com/start");
    assert.equal(storedIdentitySessionUrl("http://verify.stripe.com/start"), null);
    assert.equal(
      stripeIdentitySession({ id: "vs_123", url: "https://verify.stripe.com/start" })?.id,
      "vs_123",
    );
    assert.equal(stripeIdentitySession({ id: "vs_123", url: "" }), null);
    assert.equal(stripeIdentitySession({ id: "seti_123", url: "https://verify.stripe.com/start" }), null);
    const kyc = readFileSync("src/lib/kyc-document.ts", "utf8");
    const page = readFileSync("src/app/dashboard/kyc/page.tsx", "utf8");
    const enabledAt = kyc.indexOf("gatewayIdentitySessionAllowed");
    const openAt = kyc.indexOf("openStripeIdentitySession");
    assert.equal(enabledAt >= 0 && openAt > enabledAt, true);
    assert.match(kyc, /No identity session was opened/);
    assert.match(page, /gateway\?\.enabled/);
    assert.match(page, /storedIdentitySessionUrl/);
  });
});
