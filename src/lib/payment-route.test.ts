import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  decidePaymentRoute,
  freezeRouteAccounts,
  holdingAccountForCollection,
  payoutAccountForCollection,
  newCheckoutAllowed,
  readRouteAccounts,
  readRouteSnapshot,
} from "./payment-route";
import { creatorMaySubmitWork, submissionIsComplete, visibleSubmissions } from "./milestone-delivery";

describe("payment route decision", () => {
  it("keeps collection and holding distinct and flags two answers for the same job", () => {
    const split = decidePaymentRoute({
      countryCode: "ng",
      corridorActive: true,
      corridorCurrency: "NGN",
      corridorCollectionProvider: "flutterwave",
      jurisdictionCurrency: "NGN",
      jurisdictionMinorDigits: 2,
      jurisdictionHoldingProvider: "primary",
      jurisdictionProtectedPayments: true,
      gatewayProvider: "flutterwave",
      gatewayActive: true,
    });
    assert.equal(split.collectionProvider, "flutterwave");
    assert.equal(split.holdingProvider, "primary");
    assert.equal(split.conflicts.length, 0);
    assert.equal(split.ready, true);

    const splitRails = decidePaymentRoute({
      countryCode: "CM",
      corridorActive: true,
      corridorCurrency: "XAF",
      corridorCollectionProvider: "flutterwave",
      jurisdictionCurrency: "XAF",
      jurisdictionHoldingProvider: "primary",
      jurisdictionProtectedPayments: true,
      gatewayProvider: "stripe",
      gatewayActive: true,
    });
    assert.equal(splitRails.conflicts.length, 0);
    assert.equal(splitRails.collectionProvider, "flutterwave");
    assert.equal(splitRails.payoutRouteProvider, "stripe");
    assert.equal(splitRails.ready, true);

    const conflict = decidePaymentRoute({
      countryCode: "NG",
      corridorCurrency: "NGN",
      jurisdictionCurrency: "USD",
      corridorCollectionProvider: "airwallex",
      jurisdictionHoldingProvider: "primary",
      jurisdictionProtectedPayments: true,
      gatewayProvider: "stripe",
      gatewayActive: true,
      corridorActive: true,
    });
    assert.equal(conflict.conflicts.length, 1);
    assert.match(conflict.conflicts[0], /NGN/);
    const separateJobs = decidePaymentRoute({
      countryCode: "NG",
      corridorActive: true,
      corridorCurrency: "NGN",
      corridorCollectionProvider: "flutterwave",
      jurisdictionCurrency: "NGN",
      jurisdictionMinorDigits: 2,
      jurisdictionHoldingProvider: "primary",
      jurisdictionProtectedPayments: true,
      gatewayProvider: "stripe",
      gatewayActive: true,
    });
    assert.equal(separateJobs.conflicts.length, 0);
    assert.equal(separateJobs.collectionProvider, "flutterwave");
    assert.equal(separateJobs.payoutRouteProvider, "stripe");
    assert.equal(conflict.ready, false);
    const again = readRouteSnapshot(conflict);
    assert.equal(again?.version, conflict.version);
  });

  it("stores the decision on a new prefund and checks out with that collection provider", () => {
    const ledger = readFileSync("src/lib/marketplace-ledger.ts", "utf8");
    const checkout = readFileSync("src/app/payments/actions.ts", "utf8");
    assert.match(ledger, /decidePaymentRoute/);
    assert.match(ledger, /routeSnapshotJson: routeSnapshot/);
    assert.match(ledger, /routeDecision.conflicts.length > 0/);
    assert.match(checkout, /storedRoute\?\.collectionProvider \|\| funding.collectionProviderCode/);
    assert.match(checkout, /newCheckoutAllowed/);
    assert.match(ledger, /freezeRouteAccounts/);
    const groups = readFileSync("src/lib/payment-country-groups.ts", "utf8");
    assert.equal(groups.includes("setCountryGateway"), false);
    assert.match(readFileSync("src/lib/providers/airwallex-runtime.ts", "utf8"), /holdingAccountForCollection/);
    assert.match(readFileSync("src/lib/providers/airwallex-runtime.ts", "utf8"), /payoutAccountForCollection/);
    const storedPayout = payoutAccountForCollection({
      frozenPayoutAccountId: "acct-at-checkout",
      livePayoutAccountId: "acct-changed-later",
    });
    assert.equal(storedPayout.accountId, "acct-at-checkout");
    assert.equal(storedPayout.shouldStore, false);
    const firstPayout = payoutAccountForCollection({ frozenPayoutAccountId: "", livePayoutAccountId: "acct-live" });
    assert.equal(firstPayout.shouldStore, true);
    const frozen = freezeRouteAccounts({
      requiresHoldingAccount: true,
      holdingAccountId: "hold-at-sign",
      operationsAccountId: "ops-at-sign",
    });
    assert.equal(frozen.ok, true);
    if (!frozen.ok) return;
    const snapshot = { version: "v", countryCode: "NG", accounts: frozen.accounts };
    assert.equal(readRouteAccounts(snapshot)?.holdingAccountId, "hold-at-sign");
    const collection = holdingAccountForCollection({
      frozenHoldingAccountId: "hold-at-sign",
      liveHoldingAccountId: "hold-changed-later",
    });
    assert.equal(collection.ok && collection.holdingAccountId, "hold-at-sign");
    const missing = freezeRouteAccounts({ requiresHoldingAccount: true, holdingAccountId: " ", operationsAccountId: "" });
    assert.equal(missing.ok, false);
    assert.equal(newCheckoutAllowed({ corridorActive: false, fundingStatus: "awaiting_provider" }).ok, false);
    assert.equal(newCheckoutAllowed({ corridorActive: true, fundingStatus: "held" }).ok, false);
    assert.equal(newCheckoutAllowed({ corridorActive: false, fundingStatus: "held" }).ok, false);
    assert.equal(newCheckoutAllowed({ corridorActive: true, fundingStatus: "awaiting_provider" }).ok, true);
  });
});

describe("milestone delivery", () => {
  it("lets each assigned influencer submit and hides another influencer's versions", () => {
    const shares = [
      { label: "ada", shareBps: 6000 },
      { label: "ben", shareBps: 4000 },
    ];
    assert.equal(creatorMaySubmitWork({ actorSlug: "ben", creatorSlug: "ada", shareSnapshotJson: shares }), true);
    assert.equal(creatorMaySubmitWork({ actorSlug: "cleo", creatorSlug: "ada", shareSnapshotJson: shares }), false);
    const rows = [
      { creatorSlug: "ada", version: 1 },
      { creatorSlug: "ben", version: 1 },
    ];
    assert.equal(visibleSubmissions(rows, "creator", "ben").length, 1);
    assert.equal(visibleSubmissions(rows, "business", null).length, 2);
    assert.equal(submissionIsComplete({ note: "", linkUrl: "" }).ok, false);
    assert.equal(submissionIsComplete({ note: "Cut is ready", linkUrl: "http://example.com" }).ok, false);
    assert.equal(submissionIsComplete({ note: "", linkUrl: "https://example.com/cut" }).ok, true);
  });

  it("keeps submit off the business and requires a version", () => {
    const actions = readFileSync("src/app/payments/actions.ts", "utf8");
    const page = readFileSync("src/app/payments/page.tsx", "utf8");
    assert.match(actions, /Only the assigned influencer can submit work/);
    assert.match(actions, /submitMilestoneWork/);
    assert.match(page, /!businessViewer && deal.status === "held"/);
    assert.match(readFileSync("src/app/collaboration/work/[fundingId]/page.tsx", "utf8"), /Version \{row.version\}/);
  });
});
