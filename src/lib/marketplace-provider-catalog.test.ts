import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  approvedProviderPickerOptions,
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

describe("marketplace provider save does not silently use Primary", () => {
  it("requires an explicit provider code on save and keeps the selection after redirect", () => {
    const ledger = readFileSync("src/lib/marketplace-ledger.ts", "utf8");
    const actions = readFileSync("src/app/admin/marketplace/actions.ts", "utf8");
    const page = readFileSync("src/app/admin/marketplace/page.tsx", "utf8");
    assert.equal(ledger.includes("(input.code || PROVIDER_CODE)"), false);
    assert.match(ledger, /if \(!code\) throw new Error\("Choose a marketplace provider from the list\."\)/);
    assert.match(actions, /code=\$\{encodeURIComponent\(savedCode\)\}/);
    assert.match(page, /providerFormDefault/);
    assert.match(page, /params\.code/);
  });
});

describe("approved provider picker from gateways", () => {
  it("lists gateways and keeps a legacy selected code that is not on gateways yet", () => {
    const base = buildMarketplaceProviderOptions({
      paymentGateways: [
        { code: "stripe", name: "Stripe", enabled: true },
        { code: "paystack", name: "Paystack", enabled: true },
      ],
    });
    const options = approvedProviderPickerOptions(base, ["harbor", "stripe"]);
    assert.equal(options.some((row) => row.code === "paystack"), true);
    assert.equal(options.some((row) => row.code === "harbor"), true);
    assert.equal(options.some((row) => row.code === "primary"), true);
  });

  it("saves approved providers from checkbox multi-select, not free text", () => {
    const actions = readFileSync("src/app/admin/marketplace/actions.ts", "utf8");
    const page = readFileSync("src/app/admin/marketplace/page.tsx", "utf8");
    const field = readFileSync("src/app/admin/marketplace/approved-providers-field.tsx", "utf8");
    assert.match(actions, /formData\.getAll\("approvedProviderIds"\)/);
    assert.match(page, /ApprovedProvidersField/);
    assert.equal(page.includes("comma or JSON"), false);
    assert.match(field, /name="approvedProviderIds"/);
    assert.match(field, /type="checkbox"/);
  });
});
