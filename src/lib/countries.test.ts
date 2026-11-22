import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { COUNTRIES, countryByCode, requireCountry, resolveCountry } from "./countries";
import { countryCodeFromLocation } from "./contract-wizard";

const read = (file: string) => readFileSync(file, "utf8");

describe("one country list for the whole app", () => {
  it("reads codes, catalog names and old spellings as the same country", () => {
    assert.equal(COUNTRIES.length >= 240, true);
    for (const value of ["US", "us", "United States", "USA", "U.S.A.", "united states of america"]) {
      assert.equal(resolveCountry(value)?.code, "US", value);
    }
    assert.equal(resolveCountry("UK")?.code, "GB");
    assert.equal(resolveCountry("Côte d'Ivoire")?.code ?? resolveCountry("Ivory Coast")?.code, "CI");
    assert.equal(countryByCode("ng")?.name, "Nigeria");
    assert.equal(resolveCountry("Narnia"), null);
    assert.equal(requireCountry("Narnia").ok, false);
  });

  it("knows every country, not only the eleven it was hard-coded with", () => {
    assert.equal(countryCodeFromLocation("South Africa"), "ZA");
    assert.equal(countryCodeFromLocation("Brazil"), "BR");
    assert.equal(countryCodeFromLocation("Kenya"), "KE");
    assert.equal(countryCodeFromLocation(""), null);
  });

  it("has no typed country inputs left", () => {
    const place = read("src/components/place-fields.tsx");
    assert.match(place, /<select\s+name=\{lockCountry \? undefined : countryName\}/);
    assert.equal(/placeholder="Search countries"/.test(place), false);
    assert.match(read("src/components/settings-editors.tsx"), /<CountrySelect name="country"/);
    assert.match(read("src/app/mentorship/page.tsx"), /<CountrySelect/);
    assert.match(read("src/app/admin/payment-settings/route-draft-form.tsx"), /<CountrySelect name="countryCode" valueKind="code"/);
    assert.match(read("src/components/admin-accounts-ui.tsx"), /<CountrySelect name="verifiedCountryCode" valueKind="code"/);
  });

  it("refuses unknown countries on save and stores the catalog name", () => {
    assert.match(read("src/lib/claim.ts"), /Choose your country from the list\./);
    assert.match(read("src/app/business/profile/actions.ts"), /resolveCountry\(countryRaw\)/);
    assert.match(read("src/app/business/signup-actions.ts"), /Choose the country from the list\./);
    assert.match(read("src/app/admin/accounts/actions.ts"), /resolveCountry\(countryRaw\)/);
  });

  it("lets verified KYC without a stored country use the profile country for agreements", () => {
    assert.match(read("src/app/collaboration/contract/actions.ts"), /kyc\.countryCode \|\| countryCodeFromLocation\(dbCreator\?\.locationCountry\)/);
  });
});
