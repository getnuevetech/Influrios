import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectionPayoutReady, gatewayCredentialLabels, mergeProviderExtra } from "./providers";
import { collectionProviderCode } from "./provider-collection";

describe("admin integration fields", () => {
  it("keeps Airwallex account ids when a later save only changes the model", () => {
    const saved = mergeProviderExtra(
      { holdingAccountId: "hold", operationsAccountId: "ops", lastWebhookAt: "2026-10-06T00:00:00.000Z" },
      { model: "" },
    );
    assert.equal(saved?.holdingAccountId, "hold");
    assert.equal(saved?.operationsAccountId, "ops");
    assert.equal(saved?.lastWebhookAt, "2026-10-06T00:00:00.000Z");
  });

  it("clears a holding account id when the admin field is blank", () => {
    const saved = mergeProviderExtra({ holdingAccountId: "hold", integrationKey: "ik" }, { holdingAccountId: "" });
    assert.equal(saved?.holdingAccountId, undefined);
    assert.equal(saved?.integrationKey, "ik");
  });

  it("labels the gateway fields an admin has to fill", () => {
    assert.equal(gatewayCredentialLabels("mpesa").publicKey, "Business short code");
    assert.equal(gatewayCredentialLabels("airwallex").secret, "API key");
    assert.equal(collectionProviderCode("flutterwave"), "flutterwave");
    assert.equal(collectionProviderCode("stripe"), null);
  });

  it("requires a connected account only for the collaboration payout rail", () => {
    assert.equal(
      collectionPayoutReady({ providerCode: "airwallex", routeReady: true, providerConnectedAccountId: null }),
      false,
    );
    assert.equal(
      collectionPayoutReady({ providerCode: "airwallex", routeReady: true, providerConnectedAccountId: "acct_creator" }),
      true,
    );
    assert.equal(
      collectionPayoutReady({ providerCode: "flutterwave", routeReady: true, providerConnectedAccountId: null }),
      true,
    );
  });
});
