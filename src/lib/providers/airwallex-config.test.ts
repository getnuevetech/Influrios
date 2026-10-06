import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { airwallexSettingsFromSources } from "./airwallex-config";

describe("Airwallex settings", () => {
  it("reads the enabled admin row, including holding and operations accounts", () => {
    const settings = airwallexSettingsFromSources({
      env: {},
      row: {
        enabled: true,
        clientId: "client",
        apiKey: "key",
        webhookSecret: "whsec",
        baseUrl: "https://api-demo.airwallex.com/",
        holdingAccountId: "hold",
        operationsAccountId: "ops",
      },
    });
    assert.equal(settings?.clientId, "client");
    assert.equal(settings?.holdingAccountId, "hold");
    assert.equal(settings?.operationsAccountId, "ops");
    assert.equal(settings?.baseUrl, "https://api-demo.airwallex.com");
  });

  it("falls back to the environment when the admin row is disabled", () => {
    const settings = airwallexSettingsFromSources({
      env: {
        AIRWALLEX_CLIENT_ID: "env-client",
        AIRWALLEX_API_KEY: "env-key",
        AIRWALLEX_WEBHOOK_SECRET: "env-wh",
        AIRWALLEX_HOLDING_ACCOUNT_ID: "env-hold",
        AIRWALLEX_OPERATIONS_ACCOUNT_ID: "env-ops",
      },
      row: { enabled: false, clientId: "client", apiKey: "key", baseUrl: "https://api-demo.airwallex.com" },
    });
    assert.equal(settings?.clientId, "env-client");
    assert.equal(settings?.holdingAccountId, "env-hold");
  });

  it("returns nothing when neither source has a client id and API key", () => {
    assert.equal(airwallexSettingsFromSources({ env: {}, row: null }), null);
  });
});
