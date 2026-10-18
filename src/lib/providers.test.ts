import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { marketplaceProviderLabel } from "./marketplace-ledger";
import { decryptSecret, encryptSecret, resetProviderSecretKeyCacheForTests } from "./provider-secrets";
import {
  aiEndpointAllowed,
  assessGateway,
  buildGatewayRemovalBlockers,
  countryDisplayName,
  routeAiFunction,
  signingCanQueue,
} from "./providers";

describe("provider secrets", () => {
  it("round-trips a gateway secret without storing plaintext", () => {
    resetProviderSecretKeyCacheForTests();
    const cipher = encryptSecret("flw_secret_test");
    assert.equal(cipher.includes("flw_secret_test"), false);
    assert.equal(decryptSecret(cipher), "flw_secret_test");
    assert.equal(decryptSecret("nope"), null);
  });
});

describe("payment country routes", () => {
  it("marks a configured gateway ready when enabled with a secret — assignment is admin-only", () => {
    const nigeria = assessGateway({
      countryCode: "ng",
      providerCode: "flutterwave",
      providerName: "Flutterwave",
      routeActive: true,
      providerEnabled: true,
      hasSecret: true,
    });
    const us = assessGateway({
      countryCode: "US",
      providerCode: "stripe",
      providerName: "Stripe",
      routeActive: true,
      providerEnabled: true,
      hasSecret: true,
    });
    assert.equal(nigeria.ready, true);
    assert.equal(nigeria.providerCode, "flutterwave");
    assert.equal(us.providerCode, "stripe");
    const catalog = readFileSync("src/lib/providers.ts", "utf8");
    assert.equal(catalog.includes('gateway: "flutterwave"'), false);
    assert.equal(catalog.includes("GATEWAY_SHELLS"), false);
  });

  it("does not call a disabled or keyless gateway ready", () => {
    assert.equal(
      assessGateway({ countryCode: "NG", providerCode: "flutterwave", routeActive: true, providerEnabled: false, hasSecret: true }).reason,
      "disabled",
    );
    assert.equal(
      assessGateway({ countryCode: "NG", providerCode: "flutterwave", routeActive: true, providerEnabled: true, hasSecret: false }).reason,
      "missing_secret",
    );
    assert.equal(assessGateway({ countryCode: "JP" }).reason, "no_route");
  });

  it("names Nigeria from the starter route list when no country row name is passed", () => {
    assert.equal(countryDisplayName("NG"), "Nigeria");
    assert.equal(countryDisplayName("ng", "Federal Republic of Nigeria"), "Federal Republic of Nigeria");
  });

  it("blocks gateway removal while countries or the default backup still depend on it", () => {
    const blockers = buildGatewayRemovalBlockers({
      countries: [{ countryCode: "NG", countryName: "Nigeria" }],
      isDefaultBackup: true,
    });
    assert.equal(blockers.length, 2);
    assert.match(blockers[0]!, /Nigeria \(NG\)/);
    assert.match(blockers[1]!, /default backup/);
    assert.deepEqual(buildGatewayRemovalBlockers({ countries: [], isDefaultBackup: false }), []);
  });
});

describe("ai function routing", () => {
  it("keeps the platform fallback until a provider is enabled with a secret", () => {
    assert.equal(routeAiFunction({ functionKey: "collaboration_match_explanation" }).mode, "fallback");
    assert.equal(
      routeAiFunction({
        functionKey: "collaboration_match_explanation",
        providerCode: "openai",
        providerEnabled: false,
        hasSecret: true,
      }).mode,
      "fallback",
    );
    const live = routeAiFunction({
      functionKey: "profile_topic_classification",
      providerCode: "openai",
      providerEnabled: true,
      hasSecret: true,
      routeEnabled: true,
    });
    assert.equal(live.mode, "provider");
    if (live.mode === "provider") assert.equal(live.providerCode, "openai");
  });

  it("allows only the documented model hosts", () => {
    assert.equal(aiEndpointAllowed("https://api.openai.com/v1"), true);
    assert.equal(aiEndpointAllowed("https://api.anthropic.com"), true);
    assert.equal(aiEndpointAllowed("http://api.openai.com"), false);
    assert.equal(aiEndpointAllowed("https://evil.example"), false);
  });
});

describe("entered provider names", () => {
  it("does not save a blank search or Connect name as a product label", () => {
    const search = readFileSync("src/app/admin/search/actions.ts", "utf8");
    const gateways = readFileSync("src/app/admin/gateways/actions.ts", "utf8");
    const searchPage = readFileSync("src/app/admin/search/page.tsx", "utf8");
    const gatewayPage = readFileSync("src/app/admin/gateways/page.tsx", "utf8");
    assert.equal(search.includes('|| "Meilisearch"'), false);
    assert.equal(gateways.includes('|| "Stripe Connect"'), false);
    assert.equal(gateways.includes('|| "stripe"'), false);
    assert.match(searchPage, /name="name" required/);
    assert.match(gatewayPage, /action=\{actionSaveConnect\}[\s\S]*name="name" required/);
  });

  it("shows a stored marketplace provider name and leaves a blank name as the code", () => {
    assert.equal(marketplaceProviderLabel("Airwallex", "primary"), "Airwallex (primary)");
    assert.equal(marketplaceProviderLabel("  ", "primary"), "primary");
    assert.equal(marketplaceProviderLabel(null, "primary"), "primary");
    const ledger = readFileSync("src/lib/marketplace-ledger.ts", "utf8");
    const page = readFileSync("src/app/admin/marketplace/page.tsx", "utf8");
    const catalog = readFileSync("src/app/admin/marketplace/provider-catalog.ts", "utf8");
    assert.equal(ledger.includes('?? "Marketplace provider"'), false);
    assert.equal(ledger.includes('name: "Marketplace provider"'), false);
    assert.equal(ledger.includes("airwallex"), false);
    assert.match(catalog, /buildMarketplaceProviderOptions/);
    assert.match(catalog, /paymentGateways/);
    assert.match(page, /listProviders\("payment"\)/);
    assert.match(page, /name="code"/);
    assert.match(page, /name="enabled"/);
    assert.match(page, /Webhook signing secret/);
    assert.match(page, /Choose a provider/);
    assert.match(page, /providerFormDefault/);
    assert.match(ledger, /ensureMarketplaceProviderForCode/);
    assert.equal(ledger.includes("(input.code || PROVIDER_CODE)"), false);
    assert.equal(page.includes("disabled\n                      defaultValue={row.code}"), false);
    assert.equal(page.includes("disabled\n                      defaultValue"), false);
  });
});

describe("document signing", () => {
  it("queues only an accepted collaboration with one enabled channel", () => {
    assert.equal(signingCanQueue({ enabled: true, hasSecret: true, collaborationStatus: "sent" }).ok, false);
    assert.equal(
      signingCanQueue({ enabled: false, hasSecret: false, collaborationStatus: "accepted", providerCode: "docusign" }).ok,
      false,
    );
    assert.equal(
      signingCanQueue({ enabled: true, hasSecret: true, collaborationStatus: "accepted", providerCode: "docusign" }).ok,
      true,
    );
    assert.equal(
      signingCanQueue({ enabled: true, hasSecret: false, collaborationStatus: "accepted", providerCode: "influrios" }).ok,
      true,
    );
    assert.equal(signingCanQueue({ enabled: true, hasSecret: false, collaborationStatus: "accepted" }).ok, false);
    assert.equal(
      signingCanQueue({ enabled: false, hasSecret: false, collaborationStatus: "accepted", providerCode: "influrios" }).ok,
      false,
    );
  });
});
