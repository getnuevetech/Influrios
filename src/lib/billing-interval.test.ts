import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { safeNextPath } from "./account-policy";
import {
  CHECKOUT_TAX_NOTE,
  annualCodeOnMonthly,
  carryPlanSelection,
  displayedPriceBreakdown,
  exclusiveDue,
  newPurchaseIntent,
  recordChangeDecision,
  renewalScheduleFields,
  resolveRecurringOffer,
  sameTierSwitchPreview,
  viewInterval,
} from "./billing-interval";

const monthly = { amountCents: 2900, priceId: "price_month_pro", currency: "USD" };
const annual = { amountCents: 29000, priceId: "price_year_pro", currency: "USD" };

describe("new annual purchase", () => {
  it("uses the annual price and never the monthly price", () => {
    const resolved = resolveRecurringOffer({ sku: "creator_pro", interval: "year", monthly, annual });
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    assert.equal(resolved.offer.priceId, "price_year_pro");
    assert.equal(resolved.offer.amountCents, 29000);
    assert.equal(resolved.offer.interval, "year");
    assert.equal(resolved.usedMonthlyFallback, false);
    const purchase = newPurchaseIntent(resolved.offer);
    assert.equal(purchase.mode, "checkout");
    assert.equal(purchase.priceId, "price_year_pro");
    assert.equal(purchase.markedPaid, false);
    assert.equal(purchase.createsSubscription, true);
  });

  it("refuses an annual checkout when only the monthly price exists", () => {
    const missing = resolveRecurringOffer({ sku: "creator_pro", interval: "year", monthly, annual: null });
    assert.equal(missing.ok, false);
    const samePrice = resolveRecurringOffer({
      sku: "creator_pro",
      interval: "year",
      monthly,
      annual: { ...annual, priceId: monthly.priceId },
    });
    assert.equal(samePrice.ok, false);
    if (!samePrice.ok) assert.match(samePrice.reason, /not available/);
  });
});

describe("existing subscriber switch", () => {
  it("schedules the same tier at the next renewal and does not charge today", () => {
    const preview = sameTierSwitchPreview({
      sameTier: true,
      fromInterval: "month",
      toInterval: "year",
      periodEnd: "2026-12-01T00:00:00.000Z",
      annualAmountCents: 19000,
      taxCents: null,
    });
    assert.equal(preview.applies, true);
    if (!preview.applies) return;
    assert.equal(preview.timing, "next_renewal");
    assert.equal(preview.dueTodayCents, 0);
    assert.equal(preview.effectiveOn, "2026-12-01");
    assert.equal(preview.subscriptionCount, 1);
    assert.equal(preview.entitlementsChangeNow, false);
    assert.equal(preview.createsSubscription, false);
    assert.equal(preview.markedPaid, false);
    assert.equal(preview.firstChargeCents, null);
  });

  it("records the change only after the provider confirms it", () => {
    assert.deepEqual(recordChangeDecision({ providerConfirmed: false }), { recorded: false, markedPaid: false });
    assert.deepEqual(recordChangeDecision({ providerConfirmed: true }), { recorded: true, markedPaid: false });
  });

  it("keeps the current quantity on the existing subscription schedule", () => {
    const fields = renewalScheduleFields({
      currentPriceId: "price_month_plus",
      nextPriceId: "price_year_plus",
      phaseStart: 1_700_000_000,
      phaseEnd: 1_702_592_000,
      quantity: 1,
    });
    assert.equal(fields["phases[0][items][0][quantity]"], "1");
    assert.equal(fields["phases[1][items][0][price]"], "price_year_plus");
    assert.equal(fields["phases[0][proration_behavior]"], "none");
    assert.equal(fields.end_behavior, "release");
    assert.equal("mode" in fields, false);
  });
});

describe("browsing annual", () => {
  it("does not change the subscription", () => {
    const view = viewInterval({ subscribedInterval: "month", viewedInterval: "year" });
    assert.equal(view.subscriptionChanged, false);
    assert.equal(view.subscribedInterval, "month");
    assert.equal(view.viewedInterval, "year");
  });
});

describe("annual discount code on monthly Pro", () => {
  const offer = { planCode: "pro", planName: "Pro", billingInterval: "year" as const, eligible: true };

  it("offers annual review and keeps the code only when annual is chosen", () => {
    const offered = annualCodeOnMonthly({
      typedCode: "AGB",
      planCode: "PRO",
      planName: "Pro",
      annualPurchasable: true,
      offer,
      choice: null,
    });
    assert.equal(offered.offerReviewAnnual, true);
    assert.equal(offered.offerContinueMonthly, true);
    assert.equal(offered.appliedCode, "");
    assert.equal(offered.typedCode, "AGB");
    assert.equal(offered.interval, "month");

    const reviewed = annualCodeOnMonthly({
      typedCode: "AGB",
      planCode: "PRO",
      planName: "Pro",
      annualPurchasable: true,
      offer,
      choice: "review-annual",
    });
    assert.equal(reviewed.interval, "year");
    assert.equal(reviewed.appliedCode, "AGB");
    assert.equal(reviewed.typedCode, "AGB");

    const stayed = annualCodeOnMonthly({
      typedCode: "AGB",
      planCode: "PRO",
      planName: "Pro",
      annualPurchasable: true,
      offer,
      choice: "continue-monthly",
    });
    assert.equal(stayed.interval, "month");
    assert.equal(stayed.appliedCode, "");
    assert.equal(stayed.typedCode, "");
  });

  it("keeps an invalid code and explains it", () => {
    const invalid = annualCodeOnMonthly({
      typedCode: "NOPE",
      planCode: "PRO",
      planName: "Pro",
      annualPurchasable: true,
      offer: null,
      choice: null,
    });
    assert.equal(invalid.typedCode, "NOPE");
    assert.equal(invalid.appliedCode, "");
    assert.equal(invalid.offerReviewAnnual, false);
    assert.match(invalid.message, /not valid/);
  });

  it("does not offer annual review when the annual price is missing", () => {
    const missing = annualCodeOnMonthly({
      typedCode: "AGB",
      planCode: "PRO",
      planName: "Pro",
      annualPurchasable: false,
      offer,
      choice: null,
    });
    assert.equal(missing.offerReviewAnnual, false);
    assert.equal(missing.appliedCode, "");
    assert.match(missing.message, /not available/);
  });
});

describe("one tax line", () => {
  it("shows the base price and one note when the location is unknown", () => {
    const shown = displayedPriceBreakdown({ locationKnown: false, baseCents: 1900, taxCents: 250, claimedTotalCents: 2750 });
    assert.equal(shown.kind, "unknown");
    assert.equal(shown.baseCents, 1900);
    assert.equal(shown.taxLineCount, 0);
    assert.equal(shown.note, CHECKOUT_TAX_NOTE);
    assert.equal("totalCents" in shown, false);
  });

  it("does not display a total that is not the base plus the calculated tax", () => {
    const mismatched = displayedPriceBreakdown({
      locationKnown: true,
      baseCents: 1900,
      taxCents: 250,
      ratePercent: 10,
      claimedTotalCents: 2750,
    });
    assert.equal(mismatched.kind, "exclusive");
    if (mismatched.kind !== "exclusive") return;
    assert.equal(mismatched.taxLineCount, 1);
    assert.equal(mismatched.totalCents, 2150);
    assert.equal(mismatched.ratePercent, null);
    assert.equal(mismatched.ignoredClaimedTotal, true);
  });

  it("shows ten percent of a 1900 cent base as 190 tax and 2090 due", () => {
    const matched = displayedPriceBreakdown({
      locationKnown: true,
      baseCents: 1900,
      taxCents: 190,
      ratePercent: 10,
      claimedTotalCents: 2090,
    });
    assert.equal(matched.kind, "exclusive");
    if (matched.kind !== "exclusive") return;
    assert.equal(matched.taxCents, 190);
    assert.equal(matched.totalCents, 2090);
    assert.equal(matched.ratePercent, 10);
    assert.equal(matched.taxLineCount, 1);
  });

  it("adds the one tax line to a discounted fixture", () => {
    const due = exclusiveDue({ baseCents: 29000, discountCents: 5800, taxCents: 2320 });
    assert.equal(due.subtotalCents, 23200);
    assert.equal(due.dueTodayCents, 25520);
    assert.equal(due.taxLineCount, 1);
  });
});

describe("selection survives sign-in", () => {
  it("keeps the plan and annual interval through the login return path", () => {
    const next = carryPlanSelection({
      returnTo: "/billing",
      sku: "creator_pro",
      planCode: "PRO",
      interval: "year",
    });
    const safe = safeNextPath(next);
    assert.match(safe, /interval=year/);
    assert.match(safe, /sku=creator_pro/);
    assert.match(safe, /plan=PRO/);
  });
});

describe("pricing page structure", () => {
  it("keeps comparison closed, drops the general FAQ, and stays out of server-only modules on the client", () => {
    const pricing = readFileSync(new URL("../app/pricing/page.tsx", import.meta.url), "utf8");
    const business = readFileSync(new URL("../app/business/plans/page.tsx", import.meta.url), "utf8");
    const publicPage = readFileSync(new URL("../components/plans/public-plan-page.tsx", import.meta.url), "utf8");
    const member = readFileSync(new URL("../components/plans/member-plan-page.tsx", import.meta.url), "utf8");
    const checkout = readFileSync(new URL("../components/plans/plan-checkout.tsx", import.meta.url), "utf8");
    const compare = readFileSync(new URL("../components/plans/compare-features.tsx", import.meta.url), "utf8");
    for (const source of [pricing, business, publicPage]) {
      assert.equal(source.includes("Frequently asked questions"), false);
      assert.equal(source.includes('listPublishedFaq("general")'), false);
    }
    assert.equal(publicPage.split("<CompareFeatures").length - 1, 1);
    assert.equal(member.split("<CompareFeatures").length - 1, 1);
    assert.equal(compare.includes("useState(false)"), true);
    assert.match(member, /Switch \$\{plan\.name\} to annual/);
    for (const source of [checkout, compare, publicPage]) {
      assert.equal(source.includes('from "fs"'), false);
      assert.equal(source.includes("@/lib/db"), false);
      assert.equal(source.includes("@/lib/billing\""), false);
      assert.equal(source.includes("discount-codes"), false);
      assert.equal(source.includes("collaboration-fees"), false);
    }
  });
});
