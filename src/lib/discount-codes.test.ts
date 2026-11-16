import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateCountryTax, type CountryTaxRule } from "@/lib/country-tax";
import { allocateByLargestRemainder } from "@/lib/largest-remainder";
import {
  allocateRemainderToFinal,
  createUsageLedger,
  discountReport,
  ineligibilityReason,
  LAUNCH_APPLIES_TO,
  normalizeDiscountCode,
  parseOfferDraft,
  presentPartyDiscount,
  priceCollaboration,
  quoteSubscription,
  rejectDiscountChange,
  reviseOffer,
  subscriptionProviderCharge,
  type DiscountOffer,
} from "@/lib/discount-codes";

const at = "2026-03-15T12:00:00.000Z";

function rule(partial: Partial<CountryTaxRule> & Pick<CountryTaxRule, "countryCode" | "family" | "method">): CountryTaxRule {
  return {
    id: partial.id ?? `${partial.countryCode}-${partial.family}`,
    version: 1,
    countryCode: partial.countryCode,
    family: partial.family,
    chargeId: partial.chargeId ?? "",
    chargeLabel: partial.chargeLabel ?? partial.family,
    method: partial.method,
    ratePercent: partial.ratePercent ?? null,
    inclusive: false,
    effective: true,
    conflict: false,
  };
}

function offer(partial: Partial<DiscountOffer> & Pick<DiscountOffer, "productCharge">): DiscountOffer {
  return {
    id: partial.id ?? "offer_1",
    version: partial.version ?? 1,
    normalizedCode: partial.normalizedCode ?? "BRIEF20",
    displayCode: partial.displayCode ?? partial.normalizedCode ?? "BRIEF20",
    productCharge: partial.productCharge,
    kind: partial.kind ?? "percentage",
    percentBps: partial.percentBps ?? 2_000,
    fixedCents: partial.fixedCents ?? null,
    currency: partial.currency ?? "USD",
    countryCode: partial.countryCode ?? "US",
    planCode: partial.planCode ?? "",
    planName: partial.planName ?? "",
    billingInterval: partial.billingInterval ?? "",
    serviceLevel: partial.serviceLevel ?? "contracted",
    startsAt: partial.startsAt ?? "2026-01-01T00:00:00.000Z",
    endsAt: partial.endsAt ?? "2026-12-31T23:59:59.999Z",
    totalUses: partial.totalUses ?? 50,
    usesPerCustomer: partial.usesPerCustomer ?? 1,
    lifecycle: partial.lifecycle ?? "active",
    reservedCount: partial.reservedCount ?? 0,
    redeemedCount: partial.redeemedCount ?? 0,
    refundedCount: partial.refundedCount ?? 0,
  };
}

const collaborationRules = [
  rule({ countryCode: "US", family: "influencer_service", method: "percentage", ratePercent: 0 }),
  rule({ countryCode: "US", family: "business_fee", method: "percentage", ratePercent: 10, chargeId: "business_fee" }),
  rule({ countryCode: "US", family: "influencer_fee", method: "percentage", ratePercent: 0 }),
];

describe("discount codes", () => {
  it("normalizes codes and keeps first-invoice subscription offers on one charge", () => {
    assert.equal(normalizeDiscountCode("  welcome20 "), "WELCOME20");
    assert.equal(LAUNCH_APPLIES_TO, "First invoice only");
    const parsed = parseOfferDraft({
      code: "welcome20",
      productCharge: "subscription",
      kind: "percentage",
      value: "20",
      currency: "USD",
      countryCode: "us",
      planCode: "plus",
      planName: "Plus",
      billingInterval: "month",
      serviceLevel: "",
      startsAt: "2026-01-01",
      endsAt: "2026-03-31",
      totalUses: "100",
      usesPerCustomer: "1",
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.draft.normalizedCode, "WELCOME20");
    assert.equal(parsed.draft.percentBps, 2_000);
    assert.equal(parsed.draft.billingInterval, "month");
    const rejected = parseOfferDraft({
      code: "too-big",
      productCharge: "subscription",
      kind: "percentage",
      value: "101",
      currency: "USD",
      countryCode: "US",
      planCode: "plus",
      planName: "Plus",
      billingInterval: "month",
      serviceLevel: "",
      startsAt: "2026-01-01",
      endsAt: "2026-03-31",
      totalUses: "10",
      usesPerCustomer: "1",
    });
    assert.equal(rejected.ok, false);
  });

  it("discounts a subscription's first invoice and shows due today plus the renewal price", () => {
    const quoted = quoteSubscription({
      typedCode: "WELCOME20",
      offer: offer({
        productCharge: "subscription",
        normalizedCode: "WELCOME20",
        planCode: "plus",
        planName: "Plus",
        billingInterval: "month",
        serviceLevel: "",
      }),
      plan: { code: "plus", name: "Plus", amountCents: 1_900, interval: "month" },
      countryCode: "US",
      currency: "USD",
      accountId: "user_1",
      checkoutAt: at,
      priorUses: 0,
      rules: [rule({ countryCode: "US", family: "subscription", method: "percentage", ratePercent: 8, chargeId: "plus" })],
    });
    assert.equal(quoted.ok, true);
    if (!quoted.ok) return;
    const tax = calculateCountryTax({
      rules: [rule({ countryCode: "US", family: "subscription", method: "percentage", ratePercent: 8, chargeId: "plus" })],
      family: "subscription",
      chargeId: "plus",
      countryCode: "US",
      baseCents: 1_520,
      currency: "USD",
      at,
    });
    assert.equal(quoted.discountCents, 380);
    assert.equal(quoted.subtotalCents, 1_520);
    assert.equal(quoted.taxCents, tax.taxCents);
    assert.ok((quoted.taxCents ?? 0) > 0);
    assert.equal(quoted.dueTodayCents, 1_520 + (tax.taxCents ?? 0));
    assert.equal(quoted.renewalOn, "2026-04-15");
    assert.equal(quoted.renewalPriceCents, 1_900);
    assert.equal(quoted.renewalDiscountCents, 0);
    assert.equal(quoted.appliesTo, "First invoice only");
    assert.equal(quoted.moneyMoved, false);
    assert.equal(quoted.accessGranted, false);
    assert.equal(quoted.payoutPaid, false);
  });

  it("keeps an invalid code and returns the plan it belongs to", () => {
    const typed = "welcome20 ";
    const quoted = quoteSubscription({
      typedCode: typed,
      offer: offer({
        productCharge: "subscription",
        normalizedCode: "WELCOME20",
        planCode: "plus",
        planName: "Plus",
        billingInterval: "month",
        serviceLevel: "",
      }),
      plan: { code: "starter", name: "Starter", amountCents: 1_900, interval: "month" },
      countryCode: "US",
      currency: "USD",
      accountId: "user_1",
      checkoutAt: at,
      priorUses: 0,
      rules: [rule({ countryCode: "US", family: "subscription", method: "percentage", ratePercent: 0, chargeId: "starter" })],
    });
    assert.equal(quoted.ok, false);
    if (quoted.ok) return;
    assert.equal(quoted.typedCode, typed);
    assert.equal(quoted.reason, "This code is valid for monthly Plus subscriptions.");
    assert.equal(quoted.moneyMoved, false);
  });

  it("prices a 20% business-fee code on $3,500 + $175 and allocates the discounted fee", () => {
    const priced = priceCollaboration({
      grossCents: 350_000,
      businessFeeCents: 17_500,
      influencerFeeCents: 8_750,
      weightsBps: [6_000, 4_000],
      businessTyped: "BRIEF20",
      businessOffer: offer({ productCharge: "business_collaboration_fee", normalizedCode: "BRIEF20" }),
      influencerOffer: null,
      countryCode: "US",
      currency: "USD",
      serviceLevel: "contracted",
      accountId: "biz_1",
      at,
      rules: collaborationRules,
      quoteRef: "agreement_1",
    });
    assert.equal(priced.ok, true);
    if (!priced.ok) return;
    const feeTax = calculateCountryTax({
      rules: collaborationRules,
      family: "business_fee",
      chargeId: "business_fee",
      countryCode: "US",
      baseCents: 14_000,
      currency: "USD",
      at,
    });
    assert.equal(priced.businessDiscountCents, 3_500);
    assert.equal(priced.beforeTaxBusinessPaysCents, 364_000);
    assert.equal(priced.grossCents, 350_000);
    assert.equal(priced.influencerReceivesBeforeTaxCents, 341_250);
    assert.equal(priced.netInfluencerFeeCents, 8_750);
    assert.equal(priced.businessFeeTaxCents, feeTax.taxCents);
    assert.equal(feeTax.taxCents, 1_400);
    assert.ok(priced.businessFeeTaxCents > 0);
    assert.equal(priced.businessPaysCents, 364_000 + (feeTax.taxCents ?? 0));
    const transferred = priced.milestones.reduce((sum, row) => sum + row.businessFeeCents, 0);
    assert.equal(transferred, 14_000);
    assert.equal(priced.milestones.reduce((sum, row) => sum + row.grossCents, 0), 350_000);
    assert.equal(priced.adjustments[0]?.code, "BRIEF20");
    assert.equal(priced.moneyMoved, false);
    assert.equal(priced.payoutPaid, false);
    assert.equal(priced.charged, false);
  });

  it("puts milestone rounding remainder on the final milestone", () => {
    const rows = allocateRemainderToFinal(3, [5_000, 5_000]);
    assert.deepEqual(rows, [1, 2]);
    assert.deepEqual(allocateByLargestRemainder(3, [5_000, 5_000]), [2, 1]);
  });

  it("increases influencer net without changing what the business pays", () => {
    const businessOnly = priceCollaboration({
      grossCents: 350_000,
      businessFeeCents: 17_500,
      influencerFeeCents: 8_750,
      weightsBps: [10_000],
      businessTyped: "BRIEF20",
      businessOffer: offer({ id: "biz", productCharge: "business_collaboration_fee", normalizedCode: "BRIEF20" }),
      influencerOffer: null,
      countryCode: "US",
      currency: "USD",
      serviceLevel: "contracted",
      accountId: "biz_1",
      at,
      rules: collaborationRules,
    });
    const both = priceCollaboration({
      grossCents: 350_000,
      businessFeeCents: 17_500,
      influencerFeeCents: 8_750,
      weightsBps: [10_000],
      businessTyped: "BRIEF20",
      influencerTyped: "EARN20",
      businessOffer: offer({ id: "biz", productCharge: "business_collaboration_fee", normalizedCode: "BRIEF20" }),
      influencerOffer: offer({ id: "earn", productCharge: "influencer_collaboration_fee", normalizedCode: "EARN20" }),
      countryCode: "US",
      currency: "USD",
      serviceLevel: "contracted",
      accountId: "creator_1",
      at,
      rules: collaborationRules,
    });
    assert.equal(businessOnly.ok, true);
    assert.equal(both.ok, true);
    if (!businessOnly.ok || !both.ok) return;
    assert.equal(both.influencerSavingsCents, 1_750);
    assert.equal(both.influencerReceivesBeforeTaxCents, businessOnly.influencerReceivesBeforeTaxCents + 1_750);
    assert.equal(both.beforeTaxBusinessPaysCents, 364_000);
    assert.equal(both.beforeTaxBusinessPaysCents, businessOnly.beforeTaxBusinessPaysCents);
    assert.equal(both.grossCents, 350_000);
    const influencerOnly = priceCollaboration({
      grossCents: 350_000,
      businessFeeCents: 17_500,
      influencerFeeCents: 8_750,
      weightsBps: [10_000],
      influencerTyped: "EARN20",
      businessOffer: null,
      influencerOffer: offer({ id: "earn", productCharge: "influencer_collaboration_fee", normalizedCode: "EARN20" }),
      countryCode: "US",
      currency: "USD",
      serviceLevel: "contracted",
      accountId: "creator_1",
      at,
      rules: collaborationRules,
    });
    assert.equal(influencerOnly.ok, true);
    if (!influencerOnly.ok) return;
    assert.equal(influencerOnly.beforeTaxBusinessPaysCents, 367_500);
    assert.equal(influencerOnly.influencerReceivesBeforeTaxCents, 343_000);
  });

  it("lets one customer take the last use and rejects the other", async () => {
    const ledger = createUsageLedger([
      offer({ id: "last", productCharge: "business_collaboration_fee", totalUses: 1, usesPerCustomer: 1 }),
    ]);
    const context = {
      charge: "business_collaboration_fee" as const,
      countryCode: "US",
      currency: "USD",
      serviceLevel: "contracted",
    };
    const [first, second] = await Promise.all([
      ledger.reserve({ offerId: "last", accountId: "a", idempotencyKey: "a", now: at, amountCents: 3_500, context }),
      ledger.reserve({ offerId: "last", accountId: "b", idempotencyKey: "b", now: at, amountCents: 3_500, context }),
    ]);
    const results = [first, second];
    assert.equal(results.filter((row) => row.ok).length, 1);
    const rejected = results.find((row) => !row.ok);
    assert.equal(rejected && !rejected.ok ? rejected.reason : "", "This code has no uses left.");
    const winner = results.find((row) => row.ok);
    assert.equal(winner && winner.ok ? winner.kind : "", "created");
  });

  it("keeps a signed code read-only and still honors it after the code expires", async () => {
    const view = presentPartyDiscount({
      role: "business",
      signedPartyCount: 1,
      adjustments: [
        {
          charge: "business_collaboration_fee",
          code: "BRIEF20",
          offerId: "offer_1",
          version: 1,
          currency: "USD",
          payerAccountId: "biz_1",
          originalCents: 17_500,
          discountCents: 3_500,
          netCents: 14_000,
          quoteRef: "agreement_1",
          line: "business_collaboration_fee",
        },
      ],
    });
    assert.equal(view.editable, false);
    assert.equal(view.readOnly, true);
    assert.equal(view.code, "BRIEF20");
    assert.equal(view.savingsCents, 3_500);
    assert.equal(rejectDiscountChange({ signedPartyCount: 1 }).ok, false);
    assert.equal(rejectDiscountChange({ signedPartyCount: 0 }).ok, true);

    const ledger = createUsageLedger([
      offer({ id: "signed", productCharge: "business_collaboration_fee", endsAt: "2026-03-01T00:00:00.000Z" }),
    ]);
    const reserved = await ledger.reserve({
      offerId: "signed",
      accountId: "biz_1",
      idempotencyKey: "signed-quote",
      now: "2026-02-01T00:00:00.000Z",
      amountCents: 3_500,
      context: { charge: "business_collaboration_fee", countryCode: "US", currency: "USD", serviceLevel: "contracted" },
    });
    assert.equal(reserved.ok, true);
    const later = ineligibilityReason(offer({ productCharge: "business_collaboration_fee", endsAt: "2026-03-01T00:00:00.000Z" }), {
      charge: "business_collaboration_fee",
      countryCode: "US",
      currency: "USD",
      serviceLevel: "contracted",
      accountId: "biz_2",
      now: at,
      priorUses: 0,
    });
    assert.match(later ?? "", /expired/);
    if (!reserved.ok) return;
    const consumed = await ledger.consume({ id: reserved.reservation.id, settlementId: "set_1", providerConfirmed: true });
    assert.equal(consumed.ok, true);
    assert.equal(consumed.ok, true);
    assert.equal(consumed.reservation?.status, "consumed");
    assert.equal(consumed.payoutPaid, false);
  });

  it("consumes a settlement once, keeps the use after refund, and reports the totals", async () => {
    const ledger = createUsageLedger([offer({ id: "use", productCharge: "subscription", planCode: "plus", billingInterval: "month", serviceLevel: "" })]);
    const reserved = await ledger.reserve({
      offerId: "use",
      accountId: "user_1",
      idempotencyKey: "checkout_1",
      now: at,
      amountCents: 380,
      context: { charge: "subscription", countryCode: "US", currency: "USD", planCode: "plus", billingInterval: "month" },
    });
    assert.equal(reserved.ok, true);
    if (!reserved.ok) return;
    const blocked = await ledger.consume({ id: reserved.reservation.id, settlementId: "in_1", providerConfirmed: false });
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.match(blocked.reason, /provider confirms/);
    const first = await ledger.consume({ id: reserved.reservation.id, settlementId: "in_1", providerConfirmed: true });
    const second = await ledger.consume({ id: reserved.reservation.id, settlementId: "in_1", providerConfirmed: true });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(second.kind, "replay");
    assert.equal(ledger.snapshot("use")?.redeemedCount, 1);
    const refunded = await ledger.refund({
      id: reserved.reservation.id,
      providerConfirmed: true,
      originalBaseCents: 1_520,
      refundBaseCents: 760,
      taxCents: 122,
      reason: "8% on the discounted first invoice.",
      at: "2026-04-01T00:00:00.000Z",
    });
    assert.equal(refunded.ok, true);
    if (!refunded.ok) return;
    assert.equal(refunded.useConsumed, true);
    assert.equal(refunded.restoredUse, false);
    assert.equal(refunded.tax.taxCents > 0, true);
    assert.equal(ledger.snapshot("use")?.redeemedCount, 1);
    const report = discountReport([
      { charge: "business_collaboration_fee", currency: "USD", state: "issued", amountCents: 3_500 },
      { charge: "business_collaboration_fee", currency: "USD", state: "reserved", amountCents: 3_500 },
      { charge: "business_collaboration_fee", currency: "USD", state: "redeemed", amountCents: 3_500 },
      { charge: "business_collaboration_fee", currency: "USD", state: "refunded", amountCents: 1_000 },
    ]);
    assert.equal(report[0]?.issuedCents, 3_500);
    assert.equal(report[0]?.redeemedCents, 3_500);
    assert.equal(report[0]?.refundedCents, 1_000);
  });

  it("does not subtract the same discount from the provider price", () => {
    const charge = subscriptionProviderCharge({ amountCents: 1_900, discountCents: 380, couponId: "coupon_once" });
    assert.equal(charge.unitAmountCents, 1_900);
    assert.equal(charge.couponId, "coupon_once");
    assert.equal(charge.duration, "once");
    assert.equal(charge.subtractedFromPrice, false);
    assert.equal(charge.moneyMoved, false);
  });

  it("preserves a redeemed version when the offer changes", () => {
    const current = offer({ productCharge: "business_collaboration_fee", id: "offer_1", version: 1 });
    const next = reviseOffer(current, { percentBps: 1_000 }, true);
    assert.equal(next.version, 2);
    assert.notEqual(next.id, current.id);
    assert.equal(next.normalizedCode, current.normalizedCode);
    assert.equal(current.percentBps, 2_000);
  });

  it("handles a fully discounted first invoice without granting access", () => {
    const quoted = quoteSubscription({
      typedCode: "FREE",
      offer: offer({
        productCharge: "subscription",
        normalizedCode: "FREE",
        percentBps: 10_000,
        planCode: "plus",
        planName: "Plus",
        billingInterval: "month",
        serviceLevel: "",
      }),
      plan: { code: "plus", name: "Plus", amountCents: 1_900, interval: "month" },
      countryCode: "US",
      currency: "USD",
      accountId: "user_1",
      checkoutAt: at,
      priorUses: 0,
      rules: [rule({ countryCode: "US", family: "subscription", method: "percentage", ratePercent: 8, chargeId: "plus" })],
    });
    assert.equal(quoted.ok, true);
    if (!quoted.ok) return;
    assert.equal(quoted.subtotalCents, 0);
    assert.equal(quoted.dueTodayCents, 0);
    assert.equal(quoted.invoiceKind, "zero_total");
    assert.equal(quoted.accessGranted, false);
    assert.equal(quoted.renewalPriceCents, 1_900);
    assert.equal(quoted.moneyMoved, false);
  });
});
