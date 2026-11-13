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

describe("dashboard influencer card", () => {
  it("mounts the real card without the contact action and leaves the public card intact", () => {
    const panel = readFileSync("src/app/creator/dashboard-card.tsx", "utf8");
    const page = readFileSync("src/app/creator/page.tsx", "utf8");
    const publicCard = readFileSync("src/app/c/[slug]/page.tsx", "utf8");
    const cardView = readFileSync("src/components/influencer-card-view.tsx", "utf8");
    assert.match(page, /DashboardInfluencerCard/);
    assert.match(panel, /PublicInfluencerCard/);
    assert.match(panel, /hideCta/);
    assert.match(panel, /CardPreviewDialog/);
    assert.equal(panel.includes("actionRecordCardCta"), false);
    assert.equal(panel.includes("Contact"), false);
    assert.match(publicCard, /PublicInfluencerCard/);
    assert.equal(publicCard.includes("hideCta"), false);
    assert.match(cardView, /actionRecordCardCta/);
    assert.match(cardView, /hideCta/);
  });
});

describe("payout setup label", () => {
  it("keeps released earnings separate from payout setup", () => {
    assert.equal(dashboardEarningsLabel(false), "Released this month");
    assert.equal(dashboardEarningsLabel(true), "Released this month");
    assert.notEqual(dashboardEarningsLabel(false), "Payouts processing");
    assert.notEqual(dashboardEarningsLabel(true), "Payouts processing");
    assert.notEqual(dashboardEarningsLabel(true), "Awaiting payout setup");
    const earnings = readFileSync("src/app/creator/earnings/page.tsx", "utf8");
    assert.match(earnings, /Awaiting payout setup/);
    assert.equal(earnings.includes("processingCents={0}"), false);
    assert.equal(earnings.includes("returnedCents={0}"), false);
    assert.equal(earnings.includes('item.stage === "Released" ? "Payout confirmed"'), false);
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
