import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { isDefaultMemberHome } from "./account-policy";
import { CREATOR_DASHBOARD, dashboardEarningsLabel, openSetupReminders } from "./account-nav";
import { homePathForRole } from "./accounts";

describe("influencer landing", () => {
  it("sends Your account, login, and Dashboard to the same page", () => {
    assert.equal(homePathForRole("CREATOR"), CREATOR_DASHBOARD);
    assert.equal(homePathForRole(null), CREATOR_DASHBOARD);
    assert.equal(isDefaultMemberHome(CREATOR_DASHBOARD), true);
    const shell = readFileSync("src/components/account-shell.tsx", "utf8");
    const header = readFileSync("src/components/marketing-header.tsx", "utf8");
    assert.match(shell, /href: "\/creator", label: "Dashboard"/);
    assert.match(header, /Your account/);
    assert.match(header, /active === "business" \? "\/business\/home" : "\/creator"/);
    assert.equal(shell.includes("Upgrade now"), false);
  });
});

describe("settings split", () => {
  it("keeps contracts and billing out of the old account summary", () => {
    const account = readFileSync("src/app/account/page.tsx", "utf8");
    const settings = readFileSync("src/components/account-settings.tsx", "utf8");
    const shell = readFileSync("src/components/account-shell.tsx", "utf8");
    const contracts = readFileSync("src/app/collaboration/contracts/page.tsx", "utf8");
    assert.equal(account.includes("listContractsForUser"), false);
    assert.equal(settings.includes("listContractsForUser"), false);
    assert.equal(account.includes("No contracts on this account"), false);
    assert.equal(settings.includes("No contracts on this account"), false);
    assert.match(settings, /Billing & Plan/);
    assert.match(settings, /Verification/);
    assert.match(settings, /Connections/);
    assert.match(shell, /href: "\/account", label: "Settings"/);
    assert.match(shell, /Billing & Plan/);
    assert.match(contracts, /Contracts/);
  });
});

describe("payout setup label", () => {
  it("names blocked earnings Awaiting payout setup", () => {
    assert.equal(dashboardEarningsLabel(false), "Awaiting payout setup");
    assert.notEqual(dashboardEarningsLabel(false), "Payouts processing");
    assert.equal(dashboardEarningsLabel(true), "Payouts processing");
    const earnings = readFileSync("src/app/creator/earnings/page.tsx", "utf8");
    assert.match(earnings, /Awaiting payout setup/);
    const open = openSetupReminders({
      emailVerified: true,
      published: true,
      socialConnected: true,
      payoutReady: false,
    });
    assert.deepEqual(
      open.map((item) => item.id),
      ["payout"],
    );
    assert.equal(
      openSetupReminders({
        emailVerified: true,
        published: true,
        socialConnected: true,
        payoutReady: true,
      }).length,
      0,
    );
  });
});
