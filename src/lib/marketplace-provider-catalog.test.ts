import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  marketplaceProviderCatalogLabel,
  marketplaceProvidersAvailableToAdd,
} from "./marketplace-ledger";

describe("marketplace provider catalog", () => {
  it("labels known codes without inventing free-text names", () => {
    assert.equal(marketplaceProviderCatalogLabel("primary"), "Primary marketplace");
    assert.equal(marketplaceProviderCatalogLabel("airwallex"), "Airwallex");
    assert.equal(marketplaceProviderCatalogLabel("custom", "Harbor"), "Harbor");
  });

  it("offers only providers that are not already configured", () => {
    const available = marketplaceProvidersAvailableToAdd(["primary", "airwallex"]);
    assert.equal(available.some((row) => row.code === "primary"), false);
    assert.equal(available.some((row) => row.code === "airwallex"), false);
    assert.equal(available.some((row) => row.code === "stripe"), true);
  });
});
