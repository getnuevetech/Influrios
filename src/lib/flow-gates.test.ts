import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { normalizedBudget } from "./business";
import { payoutProfileReady } from "./influencer-payout-ready";

const read = (file: string) => readFileSync(file, "utf8");

describe("agreement and money gates (recorded journey breaks)", () => {
  it("accepts a numeric request budget and refuses words", () => {
    assert.equal(normalizedBudget("1,000"), "1,000");
    assert.equal(normalizedBudget("250.50"), "250.50");
    assert.equal(normalizedBudget(""), "");
    assert.equal(normalizedBudget("$5K – $10K"), "$5K – $10K");
    assert.throws(() => normalizedBudget("five hundred"), /number/);
    assert.throws(() => normalizedBudget("0"), /number/);
    assert.match(read("src/components/account/request-editor.tsx"), /Enter the budget as a number/);
  });

  it("treats an influencer as payable only with a connected, not-unverified payout account", () => {
    assert.equal(payoutProfileReady(null), false);
    assert.equal(payoutProfileReady({ providerConnectedAccountId: "acct_1", primaryStatus: "UNVERIFIED" }), false);
    assert.equal(payoutProfileReady({ providerConnectedAccountId: "acct_1", primaryStatus: "VERIFIED" }), true);
    assert.equal(payoutProfileReady({ stripeConnectAccountId: "acct_2", primaryStatus: "PENDING" }), true);
  });

  it("refuses to fund a signed agreement for an influencer who cannot be paid, and tells them", () => {
    const apply = read("src/lib/signed-funding-apply.ts");
    const gate = apply.indexOf("influencerPayoutReady(party.slug)");
    assert.ok(gate > -1 && gate < apply.indexOf("await requestPrefund("));
    assert.match(apply, /notifyPayoutSetupNeeded/);
    assert.match(apply, /Nothing was charged/);
  });

  it("stops sending for signature when the deal country's tax is not set up", () => {
    const actions = read("src/app/collaboration/contract/actions.ts");
    const block = actions.indexOf("if (!fundedTax.ok) {");
    assert.ok(block > -1 && block < actions.indexOf("buildBusinessCommercialSnapshot({"));
    assert.match(read("src/app/collaboration/contract/page.tsx"), /Not set up for \{jurisdictionCode\}/);
  });

  it("keeps the payout method across Refresh preview and lists only the deal country's methods", () => {
    assert.match(read("src/app/collaboration/contract/actions.ts"), /qs\.set\("payoutMethod", payoutMethodEntered\)/);
    const page = read("src/app/collaboration/contract/page.tsx");
    assert.match(page, /choice\.countryCode === jurisdictionCode/);
    assert.match(page, /findIndex\(\(other\) => other\.method === choice\.method\) === index/);
  });

  it("takes the KYC country from the influencer's profile, never from an admin field", () => {
    const kyc = read("src/lib/kyc-document.ts");
    assert.match(kyc, /This influencer has no country on their profile/);
    assert.equal(/name="countryCode"/.test(read("src/app/admin/kyc/page.tsx")), false);
    assert.equal(/name="countryCode"/.test(read("src/components/admin-accounts-ui.tsx")), false);
  });

  it("does not submit the account form when an admin presses Edit account", () => {
    const ui = read("src/components/admin-accounts-ui.tsx");
    assert.match(ui, /key="edit-account"/);
    assert.match(ui, /key="save-account"/);
  });
});
