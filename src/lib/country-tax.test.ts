import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  COUNTRY_TAX_FIELDS,
  calculateCountryTax,
  collaborationCheckout,
  countryProductOptions,
  countryRuleSelection,
  countryRulesAfterDelete,
  countryRulesToRetire,
  countrySaveBlockers,
  dedupeCountryRules,
  flagRuleConflicts,
  mapLegacyInclusivePrice,
  mapStoredPolicy,
  matchCountryRule,
  milestoneTaxReplay,
  paidPlanAvailability,
  parseCountryProduct,
  partialRefundTax,
  planCountryTaxRule,
  presentCountryCharge,
  renewalUsesSameTax,
  statedChargePrice,
  stripeTaxMode,
  subscriptionOffers,
  subscriptionPricePreview,
  taxCalculationLabel,
  type CountryTaxRule,
} from "@/lib/country-tax";

function rule(partial: Partial<CountryTaxRule> & Pick<CountryTaxRule, "countryCode" | "family" | "method">): CountryTaxRule {
  return {
    id: partial.id ?? `${partial.countryCode}-${partial.family}-${partial.chargeId ?? "all"}`,
    version: partial.version ?? 1,
    countryCode: partial.countryCode,
    family: partial.family,
    chargeId: partial.chargeId ?? "",
    chargeLabel: partial.chargeLabel ?? partial.family,
    method: partial.method,
    ratePercent: partial.ratePercent ?? null,
    inclusive: partial.inclusive ?? false,
    effective: partial.effective ?? true,
    conflict: false,
  };
}

const at = "2026-11-13T00:00:00.000Z";

describe("country tax rules", () => {
  it("saves one country and charge rule and reopens the same values", () => {
    const saved = planCountryTaxRule({
      countryCode: "us",
      family: "subscription",
      chargeId: "",
      chargeLabel: "Subscriptions",
      method: "percentage",
      ratePercent: "8",
      existing: [],
    });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    assert.equal(saved.rule.countryCode, "US");
    assert.equal(saved.rule.ratePercent, 8);
    assert.equal(saved.summary, "US · Subscriptions · 8%");
    const reopened = mapStoredPolicy({
      id: "rule_1",
      version: 2,
      appliesTo: "subscription",
      linkedIds: [],
      countryCode: "US",
      calculationMethod: "percentage",
      ratePercent: "8",
      status: "ready",
      chargeLabel: "Subscriptions",
    });
    assert.equal(reopened?.countryCode, saved.rule.countryCode);
    assert.equal(reopened?.family, saved.rule.family);
    assert.equal(reopened?.method, "percentage");
    assert.equal(reopened?.ratePercent, 8);
    assert.equal(reopened?.chargeId, "");
    const labels = Object.values(COUNTRY_TAX_FIELDS).join(" ");
    assert.match(labels, /Country/);
    assert.match(labels, /Product \/ charge/);
    assert.match(labels, /Tax calculation/);
    assert.match(labels, /Tax rate \(%\)/);
    assert.doesNotMatch(labels, /Product tax category|Payment integration|Provider account|Filing|Registration|Tax-responsible/);
  });

  it("rejects an empty rate, accepts an approved zero, and rejects an overlapping rule", () => {
    const empty = planCountryTaxRule({
      countryCode: "US",
      family: "subscription",
      chargeId: "",
      chargeLabel: "Subscriptions",
      method: "percentage",
      ratePercent: "",
      existing: [],
    });
    assert.equal(empty.ok, false);
    const zero = planCountryTaxRule({
      countryCode: "US",
      family: "subscription",
      chargeId: "",
      chargeLabel: "Subscriptions",
      method: "percentage",
      ratePercent: "0",
      existing: [],
    });
    assert.equal(zero.ok, true);
    if (!zero.ok) return;
    const again = planCountryTaxRule({
      countryCode: "US",
      family: "subscription",
      chargeId: "",
      chargeLabel: "Subscriptions",
      method: "percentage",
      ratePercent: "5",
      existing: [zero.rule],
    });
    assert.equal(again.ok, false);
    const named = planCountryTaxRule({
      countryCode: "US",
      family: "subscription",
      chargeId: "PLUS",
      chargeLabel: "Plus",
      method: "percentage",
      ratePercent: "8",
      existing: [zero.rule],
    });
    assert.equal(named.ok, true);
  });

  it("keeps countries and charges isolated, and lets an exact product win", () => {
    const rules = flagRuleConflicts([
      rule({ countryCode: "US", family: "subscription", method: "percentage", ratePercent: 8 }),
      rule({ countryCode: "GB", family: "subscription", method: "percentage", ratePercent: 20 }),
      rule({ countryCode: "US", family: "subscription", chargeId: "PRO", method: "percentage", ratePercent: 5, chargeLabel: "Pro" }),
      rule({ countryCode: "US", family: "business_fee", method: "percentage", ratePercent: 8 }),
      rule({ countryCode: "US", family: "influencer_service", method: "percentage", ratePercent: 0 }),
      rule({ countryCode: "US", family: "other", chargeId: "addon", method: "percentage", ratePercent: 3, chargeLabel: "Add-on" }),
    ]);
    const us = calculateCountryTax({ rules, chargeId: "PLUS", family: "subscription", countryCode: "US", baseCents: 1900, currency: "USD", at });
    const gb = calculateCountryTax({ rules, chargeId: "PLUS", family: "subscription", countryCode: "GB", baseCents: 1900, currency: "USD", at });
    const pro = calculateCountryTax({ rules, chargeId: "PRO", family: "subscription", countryCode: "US", baseCents: 1900, currency: "USD", at });
    const fee = calculateCountryTax({ rules, chargeId: "business_fee", family: "business_fee", countryCode: "US", baseCents: 5000, currency: "USD", at });
    const addon = calculateCountryTax({ rules, chargeId: "addon", family: "other", countryCode: "US", baseCents: 1000, currency: "USD", at });
    assert.equal(us.taxCents, 152);
    assert.equal(gb.taxCents, 380);
    assert.equal(pro.taxCents, 95);
    assert.equal(fee.taxCents, 400);
    assert.equal(addon.taxCents, 30);
    const changed = rules.map((item) => item.countryCode === "GB" ? { ...item, ratePercent: 10 } : item);
    const usAfter = calculateCountryTax({ rules: changed, chargeId: "PLUS", family: "subscription", countryCode: "US", baseCents: 1900, currency: "USD", at });
    assert.equal(usAfter.taxCents, 152);
    assert.equal(matchCountryRule(rules, { countryCode: "GB", family: "subscription", chargeId: "PLUS" }).ok, true);
    assert.equal(matchCountryRule(rules, { countryCode: "DE", family: "subscription", chargeId: "PLUS" }).ok, false);
  });

  it("flags two rules at the same specificity and does not guess a rate", () => {
    const rules = flagRuleConflicts([
      rule({ id: "a", countryCode: "US", family: "business_fee", method: "percentage", ratePercent: 8 }),
      rule({ id: "b", countryCode: "US", family: "business_fee", method: "percentage", ratePercent: 10 }),
    ]);
    assert.equal(rules.every((item) => item.conflict), true);
    const result = calculateCountryTax({ rules, chargeId: "business_fee", family: "business_fee", countryCode: "US", baseCents: 5000, currency: "USD", at });
    assert.equal(result.ok, false);
    assert.equal(result.status, "conflict");
    assert.equal(result.taxCents, null);
    assert.equal(result.storedAsZero, false);
  });
});

describe("subscription price preview", () => {
  const rules = [rule({ countryCode: "US", family: "subscription", method: "percentage", ratePercent: 8, chargeLabel: "Subscriptions" })];

  it("previews $19 as $20.52 and $29 as $31.32 without replacing the base", () => {
    const nineteen = subscriptionPricePreview({ rules, planId: "PLUS", countryCode: "US", baseCents: 1900, currency: "USD" });
    assert.equal(nineteen.taxCents, 152);
    assert.equal(nineteen.totalCents, 2052);
    assert.equal(nineteen.savedBaseCents, 1900);
    assert.equal(nineteen.overwritten, false);
    const twentyNine = subscriptionPricePreview({ rules, planId: "PLUS", countryCode: "US", baseCents: 2900, currency: "USD" });
    assert.equal(twentyNine.taxCents, 232);
    assert.equal(twentyNine.totalCents, 3132);
    assert.equal(twentyNine.savedBaseCents, 2900);
    const cycle = renewalUsesSameTax({ baseCents: 1900, ratePercent: 8 });
    assert.equal(cycle.checkoutTaxCents, 152);
    assert.equal(cycle.renewalTaxCents, 152);
    assert.equal(cycle.appliedTwice, false);
  });

  it("lets Starter through when Pro has no rule, and does not treat a US sample as nationwide", () => {
    const starter = paidPlanAvailability({ amountCents: 0, checkout: false, countryCode: "US", planId: "STARTER", rules });
    const pro = paidPlanAvailability({ amountCents: 2900, checkout: true, countryCode: "DE", planId: "PRO", rules });
    assert.equal(starter.kind, "free");
    assert.equal(pro.kind, "unavailable");
    if (pro.kind === "unavailable") assert.equal(pro.missing, COUNTRY_TAX_FIELDS.missingRule);
    const locationRules = [rule({ countryCode: "US", family: "subscription", method: "location" })];
    const guessed = calculateCountryTax({
      rules: locationRules,
      chargeId: "PLUS",
      family: "subscription",
      countryCode: "US",
      baseCents: 1900,
      currency: "USD",
      at,
      location: { country: "US", region: "CA", postalCode: "94107" },
      providerResult: null,
    });
    assert.equal(guessed.ok, false);
    assert.equal(guessed.taxCents, null);
    assert.equal(guessed.storedAsZero, false);
    assert.notEqual(guessed.taxCents, 152);
    const missingAddress = calculateCountryTax({
      rules: locationRules,
      chargeId: "PLUS",
      family: "subscription",
      countryCode: "US",
      baseCents: 1900,
      currency: "USD",
      at,
      location: { country: "US" },
    });
    assert.equal(missingAddress.status, "missing_location");
    const zero = calculateCountryTax({
      rules: locationRules,
      chargeId: "PLUS",
      family: "subscription",
      countryCode: "US",
      baseCents: 1900,
      currency: "USD",
      at,
      location: { country: "US", region: "CA", postalCode: "94107" },
      providerResult: { ok: true, taxCents: 0, reason: "Not collecting in this location." },
    });
    assert.equal(zero.ok, true);
    assert.equal(zero.taxCents, 0);
    assert.match(zero.reason, /Not collecting/);
    const failed = calculateCountryTax({
      rules: locationRules,
      chargeId: "PLUS",
      family: "subscription",
      countryCode: "US",
      baseCents: 1900,
      currency: "USD",
      at,
      location: { country: "US", region: "CA", postalCode: "94107" },
      providerResult: { ok: false, detail: "The tax provider timed out." },
    });
    assert.equal(failed.ok, false);
    assert.equal(failed.taxCents, null);
    assert.equal(failed.storedAsZero, false);
    assert.deepEqual(stripeTaxMode("location", false), { automaticTax: true, exclusiveRate: false });
    assert.deepEqual(stripeTaxMode("percentage", false), { automaticTax: false, exclusiveRate: true });
    assert.equal(stripeTaxMode("percentage", false).automaticTax && stripeTaxMode("percentage", false).exclusiveRate, false);
  });
});

describe("collaboration checkout fixture", () => {
  const rules = [
    rule({ countryCode: "US", family: "influencer_service", method: "percentage", ratePercent: 0, chargeLabel: "Influencer service" }),
    rule({ countryCode: "US", family: "business_fee", method: "percentage", ratePercent: 8, chargeLabel: "Business collaboration fee" }),
    rule({ countryCode: "US", family: "influencer_fee", method: "percentage", ratePercent: 8, chargeLabel: "Influencer fee" }),
  ];

  it("shows $1,054 due, $4 business tax, and a $973 influencer net", () => {
    const checkout = collaborationCheckout({
      rules,
      countryCode: "US",
      currency: "USD",
      compensationCents: 100_000,
      businessFeeCents: 5_000,
      influencerFeeCents: 2_500,
      at,
    });
    assert.equal(checkout.ok, true);
    if (!checkout.ok) return;
    assert.equal(checkout.businessPaysCents, 105_400);
    assert.equal(checkout.businessTaxCents, 400);
    assert.equal(checkout.influencerNetCents, 97_300);
    assert.equal(checkout.influencerTaxCents, 200);
    assert.equal(checkout.operationsCents, 7_500);
    assert.equal(checkout.taxLiabilityCents, 600);
    assert.equal(checkout.moneyMoved, false);
    assert.equal(checkout.payoutPaid, false);
    assert.deepEqual(checkout.receipt, checkout.lines);
    assert.equal(checkout.lines.find((line) => line.label === "Total to fund")?.amountCents, 105_400);
    assert.equal(checkout.lines.find((line) => line.label === "Tax")?.amountCents, 400);
    const subtotal = checkout.lines.find((line) => line.label === "Subtotal")?.amountCents ?? 0;
    const tax = checkout.lines.find((line) => line.label === "Tax")?.amountCents ?? 0;
    assert.equal(subtotal + tax, checkout.businessPaysCents);
    assert.equal(checkout.chargedAgain, false);
    assert.equal(checkout.showDetails, true);
    assert.match(checkout.details[0]?.reason ?? "", /Approved 0%/);
  });

  it("carries the original tax through two releases and a replay, and refunds only that tax", () => {
    const checkout = collaborationCheckout({
      rules,
      countryCode: "US",
      currency: "USD",
      compensationCents: 100_000,
      businessFeeCents: 5_000,
      influencerFeeCents: 2_500,
      at,
    });
    assert.equal(checkout.ok, true);
    if (!checkout.ok) return;
    const lines = checkout.determinations.map((line) => ({
      event: line.event,
      subjectId: line.subjectId,
      taxCents: line.taxCents,
      reason: line.reason,
    }));
    const replay = milestoneTaxReplay({ lines, weightsBps: [4000, 6000] });
    assert.equal(replay.ok, true);
    if (!replay.ok) return;
    assert.equal(replay.chargedAgain, false);
    const carried = replay.payouts.reduce((sum, payout) => sum + payout.taxCents, 0);
    assert.equal(carried, 600);
    assert.equal(replay.payouts[0]?.taxCents, 240);
    assert.equal(replay.payouts[1]?.taxCents, 360);
    const refund = partialRefundTax({ originalBaseCents: 5_000, refundBaseCents: 2_500, taxCents: 400, reason: "8% on the base price." });
    assert.equal(refund.ok, true);
    if (!refund.ok) return;
    assert.equal(refund.taxCents, 200);
    assert.equal(refund.recalculated, false);
    const blank = partialRefundTax({ originalBaseCents: 5_000, refundBaseCents: 2_500, taxCents: 0, reason: " " });
    assert.equal(blank.ok, false);
    if (!blank.ok) assert.equal(blank.storedAsZero, false);
  });
});

describe("saved tax rule identity", () => {
  const plans = [{ id: "plan_starter", name: "Starter", keys: ["plan_starter", "STARTER", "creator_starter"] }];
  const fees = [{ id: "fee_addon", label: "Setup fee" }];

  it("reopens a chosen plan in both selects and lists that plan", () => {
    const selection = countryRuleSelection({ family: "subscription", linkedIds: ["STARTER", "creator_starter"], plans });
    assert.deepEqual(selection, { product: "subscription:plan_starter", appliesTo: "plan_starter" });
    const parsed = parseCountryProduct({ product: selection.product, appliesTo: selection.appliesTo, plans, fees });
    assert.deepEqual(parsed, { family: "subscription", chargeId: "plan_starter", label: "Starter" });
    const label = presentCountryCharge({
      family: "subscription",
      linkedIds: ["STARTER"],
      storedLabel: "Subscription · US · unlinked",
      plans,
      fees,
    });
    assert.equal(label, "Starter");
    assert.equal(/unlinked/i.test(label), false);
    const stored = mapStoredPolicy({
      id: "rule_starter",
      appliesTo: "subscription",
      linkedIds: ["plan_starter"],
      countryCode: "US",
      calculationMethod: "percentage",
      rateBps: 800,
      status: "ready",
    });
    assert.equal(stored?.chargeId, "plan_starter");
    assert.equal(stored?.method, "percentage");
    assert.equal(stored?.ratePercent, 8);
    const again = countryRuleSelection({ family: "subscription", linkedIds: ["plan_starter"], plans });
    assert.equal(again.product, "subscription:plan_starter");
    assert.equal(again.appliesTo, "plan_starter");
  });

  it("keeps all subscription plans on the country default and never says unlinked", () => {
    const label = presentCountryCharge({
      family: "subscription",
      linkedIds: [],
      storedLabel: "Subscription · US · unlinked",
      plans,
    });
    assert.equal(label, "All subscription plans");
    assert.equal(/unlinked/i.test(`${label} ${COUNTRY_TAX_FIELDS.allPlans}`), false);
    const selection = countryRuleSelection({ family: "subscription", linkedIds: [], plans });
    assert.deepEqual(selection, { product: "family:subscription", appliesTo: "all" });
    const parsed = parseCountryProduct({ product: "family:subscription", appliesTo: "all", plans });
    assert.deepEqual(parsed, { family: "subscription", chargeId: "", label: "All subscription plans" });
    const productWins = parseCountryProduct({ product: "subscription:plan_starter", appliesTo: "all", plans });
    assert.equal(productWins.chargeId, "plan_starter");
    assert.equal(productWins.label, "Starter");
    const familyWins = parseCountryProduct({ product: "family:subscription", appliesTo: "plan_starter", plans });
    assert.equal(familyWins.chargeId, "");
    assert.equal(familyWins.label, "All subscription plans");
    const planned = planCountryTaxRule({
      countryCode: "US",
      family: "subscription",
      chargeId: "",
      chargeLabel: "Subscription · US · unlinked",
      method: "percentage",
      ratePercent: "8",
      existing: [],
    });
    assert.equal(planned.ok, true);
    if (!planned.ok) return;
    assert.equal(planned.rule.chargeLabel, "All subscription plans");
    assert.equal(/unlinked/i.test(planned.summary), false);
    assert.equal(planned.rule.ratePercent, 8);
  });

  it("keeps a real product and the saved calculation", () => {
    const service = parseCountryProduct({ product: "family:influencer_service", appliesTo: "all", plans });
    assert.equal(service.family, "influencer_service");
    assert.equal(service.label, "Influencer service");
    assert.equal(countryRuleSelection({ family: "influencer_service", linkedIds: [], plans }).product, "family:influencer_service");
    const listed = presentCountryCharge({
      family: "influencer_service",
      linkedIds: [],
      storedLabel: "Influencer services · US · unlinked",
      plans,
    });
    assert.equal(listed, "Influencer service");
    const addon = parseCountryProduct({ product: "other:fee_addon", appliesTo: "all", plans, fees });
    assert.deepEqual(addon, { family: "other", chargeId: "fee_addon", label: "Setup fee" });
    assert.equal(presentCountryCharge({ family: "other", linkedIds: ["fee_addon"], plans, fees }), "Setup fee");
    const location = planCountryTaxRule({
      countryCode: "US",
      family: "subscription",
      chargeId: "plan_starter",
      chargeLabel: "Starter",
      method: "location",
      ratePercent: "",
      existing: [],
    });
    assert.equal(location.ok, true);
    if (!location.ok) return;
    assert.equal(location.rule.method, "location");
    assert.equal(location.rule.ratePercent, null);
    const reopened = mapStoredPolicy({
      id: "rule_location",
      appliesTo: "subscription",
      linkedIds: ["plan_starter"],
      countryCode: "US",
      calculationMethod: "location",
      status: "ready",
    });
    assert.equal(reopened?.method, "location");
    assert.equal(reopened?.ratePercent, null);
    const priced = calculateCountryTax({
      rules: [rule({ countryCode: "US", family: "subscription", chargeId: "plan_starter", method: "percentage", ratePercent: 8, chargeLabel: "Starter" })],
      chargeId: "plan_starter",
      family: "subscription",
      countryCode: "US",
      baseCents: 1900,
      currency: "USD",
      at,
    });
    assert.equal(priced.taxCents, 152);
    assert.equal(priced.ok, true);
  });

  it("updates the edited rule and drops the duplicate unlinked row", () => {
    const unlinked = rule({ id: "old", countryCode: "US", family: "subscription", method: "percentage", ratePercent: 8, chargeLabel: "Subscriptions" });
    const copy = rule({ id: "copy", countryCode: "US", family: "subscription", method: "percentage", ratePercent: 8, chargeLabel: "Subscriptions" });
    const starter = rule({ id: "starter", countryCode: "US", family: "subscription", chargeId: "plan_starter", method: "percentage", ratePercent: 5, chargeLabel: "Starter" });
    const blockers = countrySaveBlockers({ editingId: "old", rules: [unlinked, copy, starter] });
    assert.deepEqual(blockers.map((item) => item.id), ["starter"]);
    const moved = planCountryTaxRule({
      countryCode: "US",
      family: "subscription",
      chargeId: "plan_starter",
      chargeLabel: "Starter",
      method: "percentage",
      ratePercent: "8",
      existing: countrySaveBlockers({ editingId: "old", rules: [unlinked, copy] }),
      exceptId: "old",
    });
    assert.equal(moved.ok, true);
    if (!moved.ok) return;
    assert.equal(moved.rule.chargeId, "plan_starter");
    assert.equal(moved.rule.chargeLabel, "Starter");
    assert.equal(moved.rule.ratePercent, 8);
    const retire = countryRulesToRetire({
      keepId: "old",
      countryCode: "US",
      family: "subscription",
      chargeIds: ["plan_starter", ""],
      rules: [unlinked, copy],
    });
    assert.deepEqual(retire, ["copy"]);
    const shown = dedupeCountryRules([copy, unlinked]);
    assert.equal(shown.length, 1);
    assert.equal(shown[0]?.id, "copy");
    const taxed = calculateCountryTax({
      rules: shown,
      chargeId: "PLUS",
      family: "subscription",
      countryCode: "US",
      baseCents: 1900,
      currency: "USD",
      at,
    });
    assert.equal(taxed.ok, true);
    assert.equal(taxed.taxCents, 152);
    const conflicted = flagRuleConflicts(dedupeCountryRules([
      rule({ id: "a", countryCode: "US", family: "subscription", method: "percentage", ratePercent: 8 }),
      rule({ id: "b", countryCode: "US", family: "subscription", method: "percentage", ratePercent: 10 }),
    ]));
    assert.equal(conflicted.length, 2);
    assert.equal(conflicted.every((item) => item.conflict), true);
    const sameRule = planCountryTaxRule({
      countryCode: "US",
      family: "subscription",
      chargeId: "",
      chargeLabel: "Subscriptions",
      method: "location",
      ratePercent: "",
      existing: [unlinked],
      exceptId: "old",
    });
    assert.equal(sameRule.ok, true);
    if (sameRule.ok) assert.equal(sameRule.rule.method, "location");
  });

  it("wires edit to the saved policy instead of the series title", () => {
    const client = readFileSync("src/app/admin/payment-settings/tax-settings-client.tsx", "utf8");
    const action = readFileSync("src/app/admin/payment-standard/actions.ts", "utf8");
    assert.equal(client.includes("chargeLabel: record.name"), false);
    assert.equal(client.includes("unlinked"), false);
    assert.match(client, /policyId/);
    assert.match(action, /replaceTaxConfiguration/);
    assert.match(action, /policyId/);
    assert.equal(client.includes("COUNTRY_TAX_FIELDS.appliesTo"), false);
    assert.match(client, /COUNTRY_TAX_FIELDS\.productOrCharge/);
    assert.match(client, /actionDeleteTaxRule/);
    assert.match(client, /fixed inset-0 z-50 flex items-center justify-center/);
    assert.match(client, /Edit tax rule/);
    assert.match(client, /Add tax rule/);
    assert.equal(client.includes("<AccountDialog"), false);
    assert.match(client, /countryProductOptions/);
    assert.equal(client.includes("setAppliesTo"), false);
    const options = countryProductOptions({
      plans: [{ id: "plan_plus", name: "Plus" }, { id: "plan_pro", name: "Pro" }],
      fees: [
        { id: "fee_biz", label: "Business fee", purpose: "business_fee" },
        { id: "fee_setup", label: "Setup fee", purpose: "other" },
      ],
    });
    assert.deepEqual(options.map((item) => item.label), [
      "All subscription plans",
      "Plus",
      "Pro",
      "Influencer service",
      "Business collaboration fee",
      "Influencer collaboration fee",
      "Setup fee",
    ]);
    assert.equal(options.filter((item) => item.value.startsWith("subscription:")).length, 2);
  });

  it("deletes one saved rule and leaves the others in the list and in new calculations", () => {
    const plans = [{ id: "plan_starter", name: "Starter", keys: ["plan_starter", "STARTER"] }, { id: "plan_plus", name: "Plus" }];
    const starter = rule({ id: "starter", countryCode: "US", family: "subscription", chargeId: "plan_starter", method: "percentage", ratePercent: 8, chargeLabel: "Starter" });
    const plus = rule({ id: "plus", countryCode: "GB", family: "subscription", chargeId: "plan_plus", method: "location", ratePercent: null, chargeLabel: "Plus" });
    const fee = rule({ id: "fee", countryCode: "US", family: "business_fee", method: "percentage", ratePercent: 5, chargeLabel: "Business collaboration fee" });
    const blank = countryRulesAfterDelete([starter, plus, fee], " ");
    assert.deepEqual(blank.map((item) => item.id), ["starter", "plus", "fee"]);
    const remaining = countryRulesAfterDelete([starter, plus, fee], "starter");
    assert.deepEqual(remaining.map((item) => item.id), ["plus", "fee"]);
    assert.equal(remaining[0]?.countryCode, "GB");
    assert.equal(remaining[0]?.method, "location");
    assert.equal(presentCountryCharge({ family: "subscription", linkedIds: ["plan_plus"], plans }), "Plus");
    assert.equal(taxCalculationLabel(remaining[0]!), COUNTRY_TAX_FIELDS.location);
    assert.equal(/unlinked/i.test(presentCountryCharge({ family: "subscription", linkedIds: ["plan_starter"], plans, storedLabel: "Subscription · US · unlinked" })), false);
    const still = calculateCountryTax({
      rules: remaining,
      chargeId: "fee",
      family: "business_fee",
      countryCode: "US",
      baseCents: 1_000,
      currency: "USD",
      at,
    });
    assert.equal(still.ok, true);
    assert.equal(still.taxCents, 50);
    const gone = calculateCountryTax({
      rules: remaining,
      chargeId: "plan_starter",
      family: "subscription",
      countryCode: "US",
      baseCents: 1_900,
      currency: "USD",
      at,
    });
    assert.equal(gone.ok, false);
    assert.equal(gone.status, "missing_rule");
    const retired = mapStoredPolicy({
      id: "starter",
      appliesTo: "subscription",
      linkedIds: ["plan_starter"],
      countryCode: "US",
      calculationMethod: "percentage",
      rateBps: 800,
      status: "replaced",
    });
    assert.equal(retired?.effective, false);
    const ignored = calculateCountryTax({
      rules: retired ? [retired, fee] : [fee],
      chargeId: "plan_starter",
      family: "subscription",
      countryCode: "US",
      baseCents: 1_900,
      currency: "USD",
      at,
    });
    assert.equal(ignored.status, "missing_rule");
    const keptFee = calculateCountryTax({
      rules: [fee],
      chargeId: "business_fee",
      family: "business_fee",
      countryCode: "US",
      baseCents: 1_000,
      currency: "USD",
      at,
    });
    assert.equal(keptFee.taxCents, 50);
    const refund = partialRefundTax({ originalBaseCents: 1_000, refundBaseCents: 500, taxCents: 50, reason: "5% on the base price." });
    assert.equal(refund.ok, true);
    if (refund.ok) assert.equal(refund.taxCents, 25);

    const client = readFileSync("src/app/admin/payment-settings/tax-settings-client.tsx", "utf8");
    const action = readFileSync("src/app/admin/payment-standard/actions.ts", "utf8");
    const store = readFileSync("src/lib/payment-standard-store.ts", "utf8");
    const page = readFileSync("src/app/admin/payment-settings/page.tsx", "utf8");
    const settings = readFileSync("src/lib/tax-settings.ts", "utf8");
    assert.equal(client.includes("unlinked"), false);
    assert.match(client, /actionDeleteTaxRule/);
    assert.match(client, /COUNTRY_TAX_FIELDS\.confirmDelete/);
    assert.match(client, /canEdit \? <button/);
    const actionBody = sourceOf(action, "export async function actionDeleteTaxRule");
    assert.match(actionBody, /hasPermission\(session, "tax\.edit"\)/);
    assert.ok(actionBody.indexOf("tax.edit") < actionBody.indexOf("deleteTaxRule"));
    assert.equal(actionBody.includes("entitlementPlan"), false);
    assert.equal(actionBody.includes("collaborationFeeRule"), false);
    assert.equal(actionBody.includes("milestoneSettlement"), false);
    assert.match(actionBody, /deleteTaxRule\(policyId\)/);
    const storeBody = sourceOf(store, "export async function deleteTaxRule");
    assert.match(storeBody, /taxPolicyVersion\.update/);
    assert.match(storeBody, /where: \{ id: policyId \}/);
    assert.equal(storeBody.includes("entitlementPlan"), false);
    assert.equal(storeBody.includes("collaborationFeeRule"), false);
    assert.equal(storeBody.includes("deleteMany"), false);
    assert.match(settings, /status !== "replaced"/);
    assert.match(page, /export default async function PaymentSettingsPage/);
    assert.equal(page.includes("export {"), false);
    assert.equal(page.includes("export function"), false);
    assert.equal(page.includes("export async function"), false);
  });
});

function sourceOf(file: string, signature: string) {
  const start = file.indexOf(signature);
  assert.ok(start >= 0, signature);
  const next = file.indexOf("\nexport ", start + signature.length);
  return file.slice(start, next === -1 ? undefined : next);
}

describe("country subscription prices", () => {
  const plans = [
    { code: "STARTER", amountCents: 0, checkout: false, keys: ["STARTER"] },
    { code: "PLUS", amountCents: 1900, checkout: true, keys: ["PLUS", "creator_plus", "plan_plus"] },
    { code: "PRO", amountCents: 2900, checkout: true, keys: ["PRO", "creator_pro", "plan_pro"] },
  ];

  it("shows 10% on Plus and Pro when a family rule covers every subscription", () => {
    const rules = [
      rule({ id: "family", countryCode: "US", family: "subscription", method: "percentage", ratePercent: 10, chargeLabel: "Subscriptions" }),
      rule({ id: "plus", countryCode: "US", family: "subscription", chargeId: "plan_plus", method: "percentage", ratePercent: 10, chargeLabel: "Plus" }),
    ];
    const offers = subscriptionOffers({ countryCode: "US", rules, plans });
    const starter = offers.find((item) => item.code === "STARTER");
    const plus = offers.find((item) => item.code === "PLUS");
    const pro = offers.find((item) => item.code === "PRO");
    assert.equal(starter?.kind, "free");
    assert.equal(starter?.taxCents, 0);
    assert.equal(starter?.totalCents, 0);
    assert.equal(plus?.kind, "checkout");
    assert.equal(plus?.taxCents, 190);
    assert.equal(plus?.totalCents, 2090);
    assert.equal(plus?.ratePercent, 10);
    assert.equal(pro?.kind, "checkout");
    assert.equal(pro?.taxCents, 290);
    assert.equal(pro?.totalCents, 3190);
    assert.equal(pro?.ratePercent, 10);
    assert.notEqual(pro?.kind, "unavailable");
  });

  it("lets a Plus rule cover only Plus and leaves Pro on the family rate", () => {
    const rules = [
      rule({ id: "family", countryCode: "US", family: "subscription", method: "percentage", ratePercent: 8, chargeLabel: "Subscriptions" }),
      rule({ id: "plus", countryCode: "US", family: "subscription", chargeId: "plan_plus", method: "percentage", ratePercent: 10, chargeLabel: "Plus" }),
    ];
    const offers = subscriptionOffers({ countryCode: "US", rules, plans });
    const plus = offers.find((item) => item.code === "PLUS");
    const pro = offers.find((item) => item.code === "PRO");
    assert.equal(plus?.taxCents, 190);
    assert.equal(plus?.totalCents, 2090);
    assert.equal(pro?.kind, "checkout");
    assert.equal(pro?.taxCents, 232);
    assert.equal(pro?.totalCents, 3132);
    const plusOnly = subscriptionOffers({
      countryCode: "US",
      rules: [rule({ countryCode: "US", family: "subscription", chargeId: "plan_plus", method: "percentage", ratePercent: 10 })],
      plans,
    });
    assert.equal(plusOnly.find((item) => item.code === "PLUS")?.kind, "checkout");
    assert.equal(plusOnly.find((item) => item.code === "PRO")?.kind, "unavailable");
  });

  it("states an other charge's tax and adds it once", () => {
    const priced = statedChargePrice({
      rules: [rule({ countryCode: "US", family: "other", chargeId: "addon", method: "percentage", ratePercent: 10, chargeLabel: "Add-on" })],
      chargeId: "addon",
      family: "other",
      countryCode: "US",
      baseCents: 1_000,
      currency: "USD",
      at,
      label: "Add-on",
    });
    assert.equal(priced.ok, true);
    if (!priced.ok) return;
    assert.equal(priced.taxCents, 100);
    assert.equal(priced.totalCents, 1_100);
    assert.match(priced.statement, /10%/);
    assert.equal(priced.chargedAgain, false);
    assert.equal(priced.lines.reduce((sum, line) => line.label === "Total to fund" ? sum : sum + line.amountCents, 0), priced.totalCents);
    const again = statedChargePrice({
      rules: [rule({ countryCode: "US", family: "other", chargeId: "addon", method: "percentage", ratePercent: 10 })],
      chargeId: "addon",
      family: "other",
      countryCode: "US",
      baseCents: 1_000,
      currency: "USD",
      at,
    });
    assert.equal(again.ok && again.totalCents, 1_100);
  });

  it("adds collaboration service tax to the breakdown once", () => {
    const checkout = collaborationCheckout({
      rules: [
        rule({ countryCode: "US", family: "influencer_service", method: "percentage", ratePercent: 10 }),
        rule({ countryCode: "US", family: "business_fee", method: "percentage", ratePercent: 10 }),
        rule({ countryCode: "US", family: "influencer_fee", method: "percentage", ratePercent: 10 }),
      ],
      countryCode: "US",
      currency: "USD",
      compensationCents: 10_000,
      businessFeeCents: 500,
      influencerFeeCents: 200,
      at,
    });
    assert.equal(checkout.ok, true);
    if (!checkout.ok) return;
    const tax = checkout.lines.find((line) => line.label === "Tax")?.amountCents;
    const total = checkout.lines.find((line) => line.label === "Total to fund")?.amountCents;
    assert.equal(tax, 1_000 + 50);
    assert.equal(total, 10_000 + 500 + 1_050);
    assert.equal(checkout.businessPaysCents, total);
    assert.equal(checkout.influencerTaxCents, 20);
    assert.match(checkout.lines.find((line) => line.label === "Tax")?.reason ?? "", /10%/);
    const replay = milestoneTaxReplay({
      lines: checkout.determinations.map((line) => ({
        event: line.event,
        subjectId: line.subjectId,
        taxCents: line.taxCents,
        reason: line.reason,
      })),
      weightsBps: [10_000],
    });
    assert.equal(replay.ok, true);
    if (!replay.ok) return;
    assert.equal(replay.chargedAgain, false);
    assert.equal(replay.payouts[0]?.taxCents, 1_000 + 50 + 20);
  });
});

describe("legacy inclusive prices", () => {
  it("keeps the stored customer total and does not add tax again", () => {
    const mapped = mapLegacyInclusivePrice({ storedCents: 2052, inclusive: true, ratePercent: 8 });
    assert.equal(mapped.customerTotalCents, 2052);
    assert.equal(mapped.baseCents, 1900);
    assert.equal(mapped.taxIncludedCents, 152);
    assert.equal(mapped.addTaxAgain, false);
    assert.equal(mapped.repriced, false);
    const unknown = mapLegacyInclusivePrice({ storedCents: 1900, inclusive: true, ratePercent: null });
    assert.equal(unknown.customerTotalCents, 1900);
    assert.equal(unknown.addTaxAgain, false);
    const exclusive = mapLegacyInclusivePrice({ storedCents: 1900, inclusive: false, ratePercent: 8 });
    assert.equal(exclusive.baseCents, 1900);
    assert.equal(exclusive.addTaxAgain, false);
    const filing = mapStoredPolicy({
      id: "old",
      appliesTo: "subscription",
      linkedIds: ["PLUS"],
      countryCode: "US",
      calculationMethod: "manual",
      rateBps: 800,
      status: "ready",
      chargeLabel: "Plus",
    });
    assert.equal(filing?.method, "percentage");
    assert.equal(filing?.ratePercent, 8);
    assert.equal(filing?.chargeId, "PLUS");
  });
});
