import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  COUNTRY_TAX_FIELDS,
  calculateCountryTax,
  collaborationCheckout,
  countryRuleSelection,
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
  stripeTaxMode,
  subscriptionPricePreview,
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
    assert.match(labels, /Product or charge/);
    assert.match(labels, /Tax calculation/);
    assert.match(labels, /Rate \(%\)/);
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

  it("keeps all equivalent plans labeled Subscriptions and never says unlinked", () => {
    const label = presentCountryCharge({
      family: "subscription",
      linkedIds: [],
      storedLabel: "Subscription · US · unlinked",
      plans,
    });
    assert.equal(label, "Subscriptions");
    assert.equal(/unlinked/i.test(`${label} ${COUNTRY_TAX_FIELDS.allPlans}`), false);
    const selection = countryRuleSelection({ family: "subscription", linkedIds: [], plans });
    assert.deepEqual(selection, { product: "family:subscription", appliesTo: "all" });
    const parsed = parseCountryProduct({ product: "family:subscription", appliesTo: "all", plans });
    assert.deepEqual(parsed, { family: "subscription", chargeId: "", label: "Subscriptions" });
    const cleared = parseCountryProduct({ product: "subscription:plan_starter", appliesTo: "all", plans });
    assert.equal(cleared.chargeId, "");
    assert.equal(cleared.label, "Subscriptions");
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
    assert.equal(planned.rule.chargeLabel, "Subscriptions");
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
