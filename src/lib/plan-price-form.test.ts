import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { displayPrice } from "./plan-presentation";
import {
  annualOfferKey,
  annualOfferViews,
  annualPricingCents,
  centsFromMonthlyDollarInput,
  planPriceFieldsFromStored,
  resolveRecurringOffer,
  sharedAnnualFields,
  writeBillingAnnualOffers,
  writeSharedAnnualOffer,
  type AnnualOfferRecord,
} from "./billing-interval";

const BILLING_SKUS = ["creator_plus", "creator_pro", "business_pro", "agency"] as const;

describe("admin plan dollar prices", () => {
  it("opens a plan stored as 2500 cents as 25.00 dollars", () => {
    assert.deepEqual(planPriceFieldsFromStored({ amountCents: 2500, annual: null }), {
      monthlyDollars: "25.00",
      annualDollars: "",
      annualPriceId: "",
    });
    assert.equal(displayPrice(2500, "$19/mo"), "$25");
  });

  it("saves 19.00 dollars as 1900 cents", () => {
    const parsed = centsFromMonthlyDollarInput("19.00");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.cents, 1900);
    assert.equal(planPriceFieldsFromStored({ amountCents: parsed.cents, annual: null }).monthlyDollars, "19.00");
  });

  it("saves a new plan annual dollar amount that annual pricing reads", () => {
    const monthly = centsFromMonthlyDollarInput("49.00");
    assert.equal(monthly.ok, true);
    if (!monthly.ok) return;
    assert.equal(monthly.cents, 4900);
    const written = writeSharedAnnualOffer({}, "STUDIO", {
      amount: "490.00",
      priceId: "price_1YearStudio",
      monthlyPriceIds: ["price_1MonthStudio"],
    });
    assert.equal(written.ok, true);
    if (!written.ok) return;
    assert.equal(written.key, "STUDIO");
    assert.equal(written.offer?.amountCents, 49000);
    assert.equal(annualPricingCents(written.store, "STUDIO"), 49000);
    assert.equal(sharedAnnualFields(written.store, "STUDIO").amount, "490.00");
    const priced = resolveRecurringOffer({
      sku: "STUDIO",
      interval: "year",
      monthly: { amountCents: monthly.cents, priceId: "price_1MonthStudio", currency: "USD" },
      annual: written.offer,
    });
    assert.equal(priced.ok, true);
    if (!priced.ok) return;
    assert.equal(priced.offer.amountCents, 49000);
    assert.equal(priced.offer.priceId, "price_1YearStudio");
  });

  it("leaves annual unpublished when the annual price is blank", () => {
    const cleared = writeSharedAnnualOffer(
      { STUDIO: { amountCents: 49000, priceId: "price_1YearStudio", currency: "USD" } },
      "STUDIO",
      { amount: "", priceId: "", monthlyPriceIds: ["price_1MonthStudio"] },
    );
    assert.equal(cleared.ok, true);
    if (!cleared.ok) return;
    assert.equal(cleared.offer, null);
    assert.equal(annualPricingCents(cleared.store, "STUDIO"), null);
    const unpublished = resolveRecurringOffer({
      sku: "STUDIO",
      interval: "year",
      monthly: { amountCents: 4900, priceId: "price_1MonthStudio", currency: "USD" },
      annual: null,
    });
    assert.equal(unpublished.ok, false);
    assert.deepEqual(annualOfferViews(cleared.store), { amounts: {}, checkout: {} });
  });

  it("saves 190.00 with no yearly price id and does not offer annual checkout", () => {
    const written = writeSharedAnnualOffer({}, "PLUS", {
      amount: "190.00",
      priceId: "",
      monthlyPriceIds: ["price_1MonthPlus"],
    });
    assert.equal(written.ok, true);
    if (!written.ok) return;
    assert.equal(written.offer?.amountCents, 19000);
    assert.equal(written.offer?.priceId, "");
    assert.equal(annualPricingCents(written.store, "PLUS"), 19000);
    assert.deepEqual(sharedAnnualFields(written.store, "PLUS"), { amount: "190.00", priceId: "" });
    const views = annualOfferViews(written.store);
    assert.equal(views.amounts.creator_plus, 19000);
    assert.equal(views.checkout.creator_plus, undefined);
    const checkout = resolveRecurringOffer({
      sku: "creator_plus",
      interval: "year",
      monthly: { amountCents: 1900, priceId: "price_1MonthPlus", currency: "USD" },
      annual: written.offer,
    });
    assert.equal(checkout.ok, false);
    if (checkout.ok) return;
    assert.match(checkout.reason, /not available/);
    const fromBilling = writeBillingAnnualOffers(
      {},
      {
        creator_plus: { amount: "190.00", priceId: "" },
        creator_pro: { amount: "", priceId: "" },
        business_pro: { amount: "", priceId: "" },
        agency: { amount: "", priceId: "" },
      },
      { creator_plus: "price_1MonthPlus" },
      BILLING_SKUS,
    );
    assert.equal(fromBilling.ok, true);
    if (!fromBilling.ok) return;
    assert.equal(fromBilling.store.creator_plus?.amountCents, 19000);
    assert.equal(fromBilling.store.creator_plus?.priceId, "");
    assert.equal(annualPricingCents(fromBilling.store, "creator_plus"), 19000);
    assert.equal(annualOfferViews(fromBilling.store).checkout.creator_plus, undefined);
  });

  it("saves the annual amount and the yearly price id, and checkout uses that price id", () => {
    const written = writeSharedAnnualOffer({}, "PLUS", {
      amount: "190.00",
      priceId: "price_1YearPlus",
      monthlyPriceIds: ["price_1MonthPlus"],
    });
    assert.equal(written.ok, true);
    if (!written.ok) return;
    assert.equal(written.offer?.amountCents, 19000);
    assert.equal(written.offer?.priceId, "price_1YearPlus");
    assert.equal(annualOfferViews(written.store).checkout.creator_plus, true);
    const checkout = resolveRecurringOffer({
      sku: "creator_plus",
      interval: "year",
      monthly: { amountCents: 1900, priceId: "price_1MonthPlus", currency: "USD" },
      annual: written.offer,
    });
    assert.equal(checkout.ok, true);
    if (!checkout.ok) return;
    assert.equal(checkout.offer.amountCents, 19000);
    assert.equal(checkout.offer.priceId, "price_1YearPlus");
  });

  it("rejects a yearly price id that matches the monthly id and keeps the previous annual amount", () => {
    const saved = writeSharedAnnualOffer({}, "PLUS", {
      amount: "190.00",
      priceId: "",
      monthlyPriceIds: ["price_1MonthPlus"],
    });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    const before = structuredClone(saved.store);
    const sameId = writeSharedAnnualOffer(saved.store, "PLUS", {
      amount: "180.00",
      priceId: "price_1MonthPlus",
      monthlyPriceIds: ["price_1MonthPlus"],
    });
    assert.equal(sameId.ok, false);
    if (sameId.ok) return;
    assert.match(sameId.error, /annual Stripe price id/);
    assert.deepEqual(saved.store, before);
    assert.equal(saved.store.creator_plus.amountCents, 19000);
    const badPrefix = writeSharedAnnualOffer(saved.store, "PLUS", {
      amount: "190.00",
      priceId: "year_plus",
      monthlyPriceIds: ["price_1MonthPlus"],
    });
    assert.equal(badPrefix.ok, false);
    if (badPrefix.ok) return;
    assert.match(badPrefix.error, /annual Stripe price id/);
    assert.match(badPrefix.error, /price_/);
    assert.equal(saved.store.creator_plus.amountCents, 19000);
  });

  it("keeps the plan form and billing.annualOffers on the same record", () => {
    assert.equal(annualOfferKey("PLUS"), "creator_plus");
    assert.equal(annualOfferKey("creator_plus"), "creator_plus");
    const fromPlan = writeSharedAnnualOffer({}, "PLUS", {
      amount: "190.00",
      priceId: "price_1YearPlus",
      monthlyPriceIds: ["price_1MonthPlus"],
    });
    assert.equal(fromPlan.ok, true);
    if (!fromPlan.ok) return;
    assert.deepEqual(sharedAnnualFields(fromPlan.store, "creator_plus"), {
      amount: "190.00",
      priceId: "price_1YearPlus",
    });
    assert.equal(fromPlan.store.creator_plus, fromPlan.store[annualOfferKey("PLUS")]);
    const fromBilling = writeBillingAnnualOffers(
      fromPlan.store,
      {
        creator_plus: { amount: "180.00", priceId: "price_1YearPlus" },
        creator_pro: { amount: "", priceId: "" },
        business_pro: { amount: "", priceId: "" },
        agency: { amount: "", priceId: "" },
      },
      { creator_plus: "price_1MonthPlus" },
      BILLING_SKUS,
    );
    assert.equal(fromBilling.ok, true);
    if (!fromBilling.ok) return;
    assert.deepEqual(sharedAnnualFields(fromBilling.store, "PLUS"), {
      amount: "180.00",
      priceId: "price_1YearPlus",
    });
    assert.equal(annualPricingCents(fromBilling.store, "PLUS"), 18000);
    const sameId = writeSharedAnnualOffer(fromBilling.store, "PLUS", {
      amount: "180.00",
      priceId: "price_1MonthPlus",
      monthlyPriceIds: ["price_1MonthPlus"],
    });
    assert.equal(sameId.ok, false);
  });

  it("preserves a new plan when billing activity saves the catalog offers", () => {
    const studio = writeSharedAnnualOffer({}, "STUDIO", {
      amount: "490.00",
      priceId: "price_1YearStudio",
      monthlyPriceIds: ["price_1MonthStudio"],
    });
    assert.equal(studio.ok, true);
    if (!studio.ok || !studio.offer) return;
    const kept = writeBillingAnnualOffers(studio.store, {}, {}, BILLING_SKUS);
    assert.equal(kept.ok, true);
    if (!kept.ok) return;
    const record: AnnualOfferRecord = kept.store.STUDIO;
    assert.deepEqual(record, studio.offer);
    assert.equal(annualPricingCents(kept.store, "STUDIO"), 49000);
  });

  it("wires both admin screens to the dollar fields and the shared annual record", () => {
    const form = readFileSync("src/app/admin/plans/plans-features.tsx", "utf8");
    const page = readFileSync("src/app/admin/plans/page.tsx", "utf8");
    const actions = readFileSync("src/app/admin/plans/actions.ts", "utf8");
    const billing = readFileSync("src/lib/billing.ts", "utf8");
    const activity = readFileSync("src/app/admin/billing/page.tsx", "utf8");
    assert.equal((form.match(/Monthly price \(USD\)/g) ?? []).length, 1);
    assert.equal((form.match(/Annual price \(USD\)/g) ?? []).length, 1);
    assert.equal(form.includes("Monthly price (cents)"), false);
    assert.equal(form.includes('name="amountCents"'), false);
    assert.match(form, /name="monthlyPrice"/);
    assert.match(form, /name="annualPrice"/);
    assert.match(form, /name="stripePriceId"/);
    assert.match(form, /name="annualStripePriceId"/);
    assert.match(form, /<PlanPriceFields \/>/);
    assert.match(form, /monthlyDollars=\{editingPlan\.monthlyDollars\}/);
    assert.equal(form.includes('from "@/lib/billing"'), false);
    assert.equal(form.includes('from "@/lib/db"'), false);
    assert.equal(form.includes('from "@/lib/entitlements-db"'), false);
    assert.match(page, /planPriceFieldsFromStored/);
    assert.match(page, /annual\[annualOfferKey\(plan\.code\)\]/);
    assert.equal(page.includes("export {"), false);
    assert.match(actions, /centsFromMonthlyDollarInput/);
    assert.match(actions, /savePlanAnnualOffer/);
    assert.match(billing, /const ANNUAL_KEY = "billing\.annualOffers"/);
    assert.match(billing, /writeSharedAnnualOffer/);
    assert.match(billing, /writeBillingAnnualOffers/);
    assert.match(activity, /dollarInputFromCents\(offer\.amountCents\)/);
    const pricing = readFileSync("src/app/pricing/page.tsx", "utf8");
    const businessPlans = readFileSync("src/app/business/plans/page.tsx", "utf8");
    const memberBilling = readFileSync("src/app/billing/page.tsx", "utf8");
    const businessBilling = readFileSync("src/app/business/billing/page.tsx", "utf8");
    const publicPage = readFileSync("src/components/plans/public-plan-page.tsx", "utf8");
    const member = readFileSync("src/components/plans/member-plan-page.tsx", "utf8");
    for (const source of [pricing, businessPlans, memberBilling, businessBilling]) {
      assert.match(source, /annualOfferViews/);
      assert.match(source, /annualBySku=\{views\.amounts\}/);
      assert.match(source, /annualCheckoutBySku=\{views\.checkout\}/);
      assert.equal(source.includes("export {"), false);
    }
    assert.match(publicPage, /annualCheckoutBySku/);
    assert.match(member, /annualCheckoutBySku/);
    assert.equal(publicPage.includes('from "@/lib/billing"'), false);
    assert.equal(member.includes('from "@/lib/billing"'), false);
    assert.equal(publicPage.includes('from "@/lib/db"'), false);
    assert.equal(member.includes('from "@/lib/db"'), false);
  });
});
