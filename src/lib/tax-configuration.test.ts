import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TAX_COPY,
  activationEffects,
  adminTaxFieldLabels,
  buildTaxRows,
  decidePreview,
  filterTaxRows,
  manualTaxAmount,
  parseProviderTaxCalculation,
  parseRegistrationList,
  planTaxConfiguration,
  planTaxGate,
  reviewSummary,
  storedRateToPercent,
  subjectCovers,
  subscriptionGaps,
} from "@/lib/tax-configuration";

const readyPolicy = {
  id: "pol_ready",
  appliesTo: "subscription",
  status: "ready",
  linkedIds: ["PLUS", "creator_plus"],
  countryCode: "US",
  regionCode: "CA",
  providerCode: "stripe",
  providerAccountId: "acct_1",
  calculationMethod: "automatic",
  taxCategory: "txcd_10103000",
  liableEntity: "platform",
  rateBps: null,
  jurisdiction: "",
  hasEffectiveFrom: false,
};

describe("per-product tax readiness", () => {
  it("lets a free plan through while a paid plan is missing its own setting", () => {
    const starter = planTaxGate({ amountCents: 0, checkout: false, gaps: ["Tax configuration for this plan"] });
    const pro = planTaxGate({ amountCents: 2900, checkout: true, gaps: ["Product tax category"] });
    assert.equal(starter.kind, "free");
    assert.equal(starter.kind === "free" && starter.cancelsPaidSubscription, false);
    assert.equal(pro.kind, "unavailable");
    if (pro.kind === "unavailable") {
      assert.equal(pro.message, "This plan is temporarily unavailable.");
      assert.equal(pro.missing, "Product tax category");
      assert.doesNotMatch(pro.message, /review billing details/i);
    }
  });

  it("does not let one paid plan's gap block another paid plan", () => {
    const plus = planTaxGate({
      amountCents: 1900,
      checkout: true,
      gaps: subscriptionGaps({ planKeys: ["PLUS", "creator_plus"], taxPolicyId: "pol_ready", policies: [readyPolicy] }),
    });
    const pro = planTaxGate({
      amountCents: 2900,
      checkout: true,
      gaps: subscriptionGaps({ planKeys: ["PRO"], taxPolicyId: "", policies: [readyPolicy] }),
    });
    assert.equal(plus.kind, "checkout");
    if (plus.kind === "checkout") assert.equal(plus.message, "Tax calculated at checkout");
    assert.equal(pro.kind, "unavailable");
    if (pro.kind === "unavailable") assert.equal(pro.missing, "Tax configuration for this plan");
  });

  it("keeps a fee configuration from covering influencer services", () => {
    assert.equal(subjectCovers("business_fee", "influencer_services"), false);
    assert.equal(subjectCovers("influencer_fee", "influencer_services"), false);
    assert.equal(subjectCovers("influencer_services", "influencer_services"), true);
  });
});

describe("tax configuration planning", () => {
  const base = {
    seriesName: "Subscription · US",
    appliesTo: "subscription",
    linkedIds: ["PLUS"],
    allowedIds: ["PLUS"],
    countryCode: "US",
    regionCode: "CA",
    environment: "sandbox",
    providerCode: "stripe",
    providerAccountId: "acct_1",
    eligibleProviders: ["stripe"],
    eligibleAccountIds: ["acct_1"],
    calculationMethod: "automatic",
    taxCategory: "txcd_10103000",
    priceDisplay: "exclusive",
    liableEntity: "platform",
    registrationStatus: "active",
    filingArrangement: "provider_files",
    ratePercent: "",
    jurisdiction: "",
    effectiveFrom: "",
    effectiveTo: "",
    intent: "activate" as const,
  };

  it("rejects a typed responsible entity and a manual rate on automatic calculation", () => {
    const typed = planTaxConfiguration({ ...base, liableEntity: "Whoever can collect" });
    assert.equal(typed.ok, false);
    const rated = planTaxConfiguration({ ...base, ratePercent: "8.25" });
    assert.equal(rated.ok, false);
    if (!rated.ok) assert.match(rated.error, /manual rate/i);
  });

  it("activates only the selected scope and does not enable funding", () => {
    const planned = planTaxConfiguration(base);
    assert.equal(planned.ok, true);
    if (!planned.ok) return;
    assert.equal(planned.planned.status, "ready");
    assert.equal(planned.planned.fundingEnabled, false);
    assert.equal(planned.planned.signedRecordsChanged, false);
    assert.equal(planned.planned.collaborationReadinessChanged, false);
    assert.deepEqual(planned.planned.planIds, ["PLUS"]);
    assert.deepEqual(planned.planned.feeRuleIds, []);
    assert.deepEqual(planned.planned.serviceIds, []);
    assert.equal(planned.planned.rateBps, null);
    const effects = activationEffects("business_fee");
    assert.equal(effects.fundingEnabled, false);
    assert.equal(effects.scope, "business_fee");
  });

  it("keeps a manual rate off the screen's basis-point vocabulary", () => {
    const labels = adminTaxFieldLabels().join(" ");
    assert.doesNotMatch(labels, /basis|bps|customer/i);
    assert.match(labels, /Tax rate \(%\)/);
    const planned = planTaxConfiguration({
      ...base,
      appliesTo: "business_fee",
      linkedIds: ["fee_1"],
      allowedIds: ["fee_1"],
      calculationMethod: "manual",
      priceDisplay: "inclusive",
      ratePercent: "8.25",
      jurisdiction: "US-CA",
      effectiveFrom: "2026-01-01",
    });
    assert.equal(planned.ok, true);
    if (!planned.ok) return;
    assert.equal(planned.planned.rateBps, 825);
    assert.equal(storedRateToPercent(825), "8.25");
    assert.deepEqual(planned.planned.feeRuleIds, ["fee_1"]);
    assert.deepEqual(planned.planned.serviceIds, []);
  });
});

describe("tax preview decisions", () => {
  it("separates a missing address, a missing setting, a provider failure, and a real zero", () => {
    const address = decidePreview({
      audience: "customer",
      phase: "calculate",
      method: "automatic",
      addressReady: false,
      amountCents: 2900,
      rateBps: null,
      inclusive: false,
      jurisdiction: "",
      liableEntity: "platform",
      subjectSelected: true,
      providerResult: null,
    });
    assert.equal(address.kind, "address");
    assert.equal(address.customerMessage, TAX_COPY.address);
    assert.equal(address.taxCents, null);

    const missing = decidePreview({ ...address, addressReady: true, method: "", providerResult: null, liableEntity: "platform", subjectSelected: true, phase: "calculate", audience: "admin", amountCents: 2900, rateBps: null, inclusive: false, jurisdiction: "" });
    assert.equal(missing.kind, "configuration");
    assert.equal(missing.customerMessage, TAX_COPY.unavailable);
    assert.match(missing.correction, /calculation method/i);
    assert.equal(missing.taxCents, null);

    const provider = decidePreview({
      audience: "customer",
      phase: "calculate",
      method: "automatic",
      addressReady: true,
      amountCents: 2900,
      rateBps: null,
      inclusive: false,
      jurisdiction: "",
      liableEntity: "platform",
      subjectSelected: true,
      providerResult: { ok: false, detail: "Stripe Tax is not enabled on this account." },
    });
    assert.equal(provider.ok, false);
    assert.equal(provider.kind, "provider");
    assert.equal(provider.taxCents, null);
    assert.equal(provider.customerMessage, TAX_COPY.provider);
    assert.match(provider.correction, /not enabled/i);

    const zero = parseProviderTaxCalculation({
      tax_amount_exclusive: 0,
      amount_total: 2900,
      tax_breakdown: [{ taxability_reason: "not_collecting" }],
    });
    assert.equal(zero.ok, true);
    if (!zero.ok) return;
    const shown = decidePreview({
      audience: "customer",
      phase: "calculate",
      method: "automatic",
      addressReady: true,
      amountCents: 2900,
      rateBps: null,
      inclusive: false,
      jurisdiction: "",
      liableEntity: "platform",
      subjectSelected: true,
      providerResult: zero,
    });
    assert.equal(shown.ok, true);
    assert.equal(shown.taxCents, 0);
    assert.match(shown.reason, /not collecting/i);
    assert.match(shown.legalNote, /does not establish/i);

    const unread = parseProviderTaxCalculation({ error: { message: "Calculation failed." } });
    assert.equal(unread.ok, false);
    const offer = decidePreview({
      audience: "customer",
      phase: "offer",
      method: "automatic",
      addressReady: false,
      amountCents: 2900,
      rateBps: null,
      inclusive: false,
      jurisdiction: "",
      liableEntity: "platform",
      subjectSelected: true,
      providerResult: null,
    });
    assert.equal(offer.kind, "not_calculated");
    assert.equal(offer.customerMessage, "Tax calculated at checkout");
    assert.equal(offer.taxCents, null);
  });

  it("uses an approved manual rate and refuses to invent one", () => {
    const missing = manualTaxAmount({ amountCents: 1900, rateBps: null, inclusive: false, jurisdiction: "US-CA" });
    assert.equal(missing.ok, false);
    assert.equal(missing.taxCents, null);
    const zero = manualTaxAmount({ amountCents: 1900, rateBps: 0, inclusive: false, jurisdiction: "US-CA" });
    assert.equal(zero.ok && zero.taxCents, 0);
    assert.match(zero.ok ? zero.reason : "", /0%/);
    const added = manualTaxAmount({ amountCents: 2000, rateBps: 1000, inclusive: false, jurisdiction: "US-CA" });
    assert.equal(added.ok && added.taxCents, 200);
    assert.equal(added.ok && added.totalCents, 2200);
  });

  it("reads registration status from the provider payload", () => {
    assert.equal(parseRegistrationList({ data: [{ status: "active" }] }), "active");
    assert.equal(parseRegistrationList({ data: [] }), "none");
    assert.equal(parseRegistrationList(null), "unavailable");
  });
});

describe("tax settings list", () => {
  it("shows separate subjects and the matching next action", () => {
    const rows = buildTaxRows([
      {
        id: "1",
        name: "Subscription · US",
        appliesTo: "subscription",
        calculationMethod: "automatic",
        providerCode: "stripe",
        accountLabel: "Platform account",
        status: "ready",
        countryCode: "US",
      },
    ]);
    const subscription = rows.find((row) => row.appliesTo === "subscription");
    const services = rows.find((row) => row.appliesTo === "influencer_services");
    assert.equal(subscription?.action, "View setup");
    assert.equal(subscription?.calculation, "Stripe Tax");
    assert.equal(services?.status, "needs_review");
    assert.equal(services?.action, "Review treatment");
    assert.equal(services?.calculation, "Not configured");
    const filtered = filterTaxRows(rows, { country: "US", status: "ready" });
    assert.equal(filtered.length, 1);
    const summary = reviewSummary({
      appliesTo: "business_fee",
      countryName: "United States",
      method: "automatic",
      providerLabel: "Stripe",
      accountLabel: "Platform account",
      environment: "sandbox",
      entity: "platform",
      priceDisplay: "exclusive",
      category: "txcd_20030000",
      gaps: [],
      registrationStatus: "not_synced",
    });
    assert.match(summary.notes.join(" "), /does not enable collaboration funding/i);
    assert.match(summary.notes.join(" "), /does not set tax on the influencer/i);
  });
});
