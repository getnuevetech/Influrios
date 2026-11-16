import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { displayPrice } from "./plan-presentation";
import {
  annualOfferKey,
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
  });
});
