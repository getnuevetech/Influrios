import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { COUNTRIES, countryByCode, countryFromLocationString, requireCountry, resolveCountry } from "./countries";
import { memberBillingCountry } from "./tax-settings";
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
    assert.equal(/name="verifiedCountryCode"/.test(read("src/components/admin-accounts-ui.tsx")), false);
  });

  it("refuses unknown countries on save and stores the catalog name", () => {
    assert.match(read("src/lib/claim.ts"), /Choose your country from the list\./);
    assert.match(read("src/app/business/profile/actions.ts"), /resolveCountry\(countryRaw\)/);
    assert.match(read("src/app/business/signup-actions.ts"), /Choose the country from the list\./);
    assert.match(read("src/app/admin/accounts/actions.ts"), /resolveCountry\(countryRaw\)/);
  });

  it("uses the profile country for agreements and KYC only for completion", () => {
    const actions = read("src/app/collaboration/contract/actions.ts");
    assert.match(actions, /const influencerCountry = countryCodeFromLocation\(dbCreator\?\.locationCountry\)/);
    assert.match(actions, /select: \{ status: true \}/);
    assert.equal(/kyc\.countryCode/.test(actions), false);
  });

  it("uses the Company profile country for business and agency accounts everywhere", () => {
    assert.equal(countryFromLocationString("Houston, Texas, United States")?.code, "US");
    assert.equal(countryFromLocationString("United States")?.code, "US");
    assert.equal(countryFromLocationString("Lagos, Nigeria")?.code, "NG");
    assert.equal(countryFromLocationString(""), null);
    // Profile country first; an old verified code only when the profile has none.
    assert.equal(memberBillingCountry({ location: "Lagos, Nigeria", verifiedCountryCode: "US" }), "NG");
    assert.equal(memberBillingCountry({ location: "", verifiedCountryCode: "US" }), "US");
    const contract = read("src/app/collaboration/contract/actions.ts");
    assert.match(contract, /countryFromLocationString\(businessProfile\?\.geography\)/);
    assert.match(contract, /Set your business country on Company profile/);
    const invites = read("src/app/collaboration/business/actions.ts");
    assert.match(invites, /countryFromLocationString\(business\.geography\)/);
    assert.equal(/influencer\?\.countryCode/.test(invites), false);
    const admin = read("src/app/admin/accounts/actions.ts");
    assert.match(admin, /verifiedTicked \? profileCountryCode : null/);
  });

  it("shows KYC in admin as a completion log, not a per-influencer KYC type", () => {
    const page = read("src/app/admin/kyc/page.tsx");
    assert.match(page, /Completed \$\{/);
    assert.equal(/kycTypeByCode/.test(page), false);
  });

  it("pays the influencer by their profile country, with no second stored country", () => {
    assert.equal(/fallback/.test(read("src/lib/providers/airwallex-runtime.ts").match(/const country =[^;]+;/)?.[0] ?? ""), false);
    assert.match(read("src/lib/payout-readiness.ts"), /const countryCode = countryCodeFromLocation\(input\.locationCountry \?\? null\);/);
    assert.equal(/payoutProfile\?\.primaryCountryCode \?\? ""\)\.trim/.test(read("src/app/creator/earnings/page.tsx")), false);
    assert.match(read("src/app/collaboration/contract/page.tsx"), /const payoutCountry = countryCodeFromLocation\(creator\?\.locationCountry\)/);
  });
});
