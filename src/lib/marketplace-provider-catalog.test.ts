import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMarketplaceProviderOptions,
  marketplaceProviderCatalogLabel,
} from "@/app/admin/marketplace/provider-catalog";

describe("marketplace provider options from gateways", () => {
  it("always includes Primary and merges live Payment gateways", () => {
    const options = buildMarketplaceProviderOptions({
      paymentGateways: [
        { code: "airwallex", name: "Airwallex", enabled: true },
        { code: "stripe", name: "Stripe", enabled: false },
        { code: "demo", name: "Demo", enabled: true },
      ],
    });
    assert.deepEqual(
      options.map((row) => row.code),
      ["primary", "airwallex", "stripe"],
    );
    assert.match(options.find((row) => row.code === "airwallex")?.detail ?? "", /Payment gateways/);
    assert.match(options.find((row) => row.code === "stripe")?.detail ?? "", /disabled/);
  });

  it("keeps a saved marketplace provider that is not on Payment gateways yet", () => {
    const options = buildMarketplaceProviderOptions({
      paymentGateways: [{ code: "stripe", name: "Stripe", enabled: true }],
      configuredMarketplace: [{ code: "harbor", name: "Harbor" }],
    });
    assert.equal(options.some((row) => row.code === "harbor"), true);
    assert.equal(marketplaceProviderCatalogLabel("harbor", null, options), "Harbor");
    assert.equal(marketplaceProviderCatalogLabel("primary"), "Primary marketplace");
  });

  it("picks up a newly added gateway code automatically", () => {
    const before = buildMarketplaceProviderOptions({
      paymentGateways: [{ code: "stripe", name: "Stripe", enabled: true }],
    });
    assert.equal(before.some((row) => row.code === "paystack"), false);
    const after = buildMarketplaceProviderOptions({
      paymentGateways: [
        { code: "stripe", name: "Stripe", enabled: true },
        { code: "paystack", name: "Paystack", enabled: true },
      ],
    });
    assert.equal(after.some((row) => row.code === "paystack"), true);
  });
});
