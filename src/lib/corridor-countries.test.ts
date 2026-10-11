import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { countryCodeFromLocation } from "./contract-wizard";
import {
  corridorCountryByCode,
  corridorCountryLabel,
  corridorCurrencyOptions,
  countriesAvailableForCorridor,
  requireCorridorCountry,
} from "./corridor-countries";

describe("corridor countries", () => {
  it("lists Kenya and the United States with their currency letters", () => {
    const kenya = corridorCountryByCode("KE");
    const unitedStates = corridorCountryByCode("us");
    assert.ok(kenya);
    assert.equal(kenya.name, "Kenya");
    assert.equal(corridorCountryLabel(kenya), "Kenya — KES");
    assert.ok(unitedStates);
    assert.equal(corridorCountryLabel(unitedStates), "United States — USD");
    assert.equal(corridorCountryByCode("JP")?.currency, "JPY");
    assert.throws(() => requireCorridorCountry("ZZ"), /Choose a country/);
  });

  it("hides countries that already have a corridor", () => {
    const available = countriesAvailableForCorridor(["KE", "us"]);
    assert.equal(available.some((row) => row.code === "KE"), false);
    assert.equal(available.some((row) => row.code === "US"), false);
    assert.equal(available.some((row) => row.code === "JP"), true);
  });

  it("offers currency letters, including a stored code", () => {
    const options = corridorCurrencyOptions("KES");
    assert.equal(options.includes("USD"), true);
    assert.equal(options.includes("KES"), true);
    assert.equal(options.includes("ABC"), false);
    assert.equal(corridorCurrencyOptions("ABC").includes("ABC"), true);
  });

  it("maps a catalog country name onto its code", () => {
    assert.equal(countryCodeFromLocation("Japan"), "JP");
    assert.equal(countryCodeFromLocation("Kenya"), "KE");
    assert.equal(countryCodeFromLocation("USA"), "US");
  });

  it("adds a country from a dropdown and groups corridors", () => {
    const page = readFileSync("src/app/admin/corridors/page.tsx", "utf8");
    assert.match(page, /<select name="countryCode"/);
    assert.match(page, /<select name="currency"/);
    assert.match(page, /<select name="collectionProviderCode"/);
    assert.match(page, /<select name="payoutFallbackCurrency"/);
    assert.equal(/<input[^>]*name="currency"/.test(page), false);
    assert.equal(/<input[^>]*name="collectionProviderCode"/.test(page), false);
    assert.equal(page.includes("corridorCountryLabel"), true);
    const actions = readFileSync("src/app/admin/corridors/actions.ts", "utf8");
    assert.equal(actions.includes("createCorridor"), true);
    assert.equal(actions.includes("saveCorridorGroup"), true);
  });
});
