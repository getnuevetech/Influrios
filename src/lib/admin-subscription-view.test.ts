import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { CountryTaxRule } from "@/lib/country-tax";
import {
  estimatePlanPrice,
  formatPlanMoney,
  intervalTaxLine,
  filterCheckoutActivity,
  previewRateChip,
  presentCheckoutSession,
  presentPlanPrice,
} from "@/lib/admin-subscription-view";

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
    conflict: partial.conflict ?? false,
  };
}

const family = rule({ countryCode: "US", family: "subscription", method: "percentage", ratePercent: 8 });

describe("plan price estimates", () => {
  it("uses the saved percentage and leaves a free plan at zero", () => {
    const starter = estimatePlanPrice({ amountCents: 0, countryCode: "US", keys: ["STARTER"], rules: [family] });
    const plus = estimatePlanPrice({ amountCents: 1900, countryCode: "US", keys: ["PLUS"], rules: [family] });
    const pro = estimatePlanPrice({ amountCents: 2900, countryCode: "US", keys: ["PRO"], rules: [family] });
    assert.equal(starter.method, "free");
    assert.equal(starter.taxCents, 0);
    assert.equal(starter.totalCents, 0);
    assert.equal(plus.taxCents, 152);
    assert.equal(plus.totalCents, 2052);
    assert.equal(pro.taxCents, 232);
    assert.equal(pro.totalCents, 3132);
    assert.equal(previewRateChip([starter, plus, pro]), "8% preview");
    assert.equal(presentPlanPrice(plus).base, "$19.00");
    assert.equal(presentPlanPrice(plus).tax, "$1.52");
    assert.equal(presentPlanPrice(plus).total, "$20.52");
  });

  it("does not invent an 8% chip when the saved rule is different or missing", () => {
    const ten = rule({ countryCode: "US", family: "subscription", method: "percentage", ratePercent: 10 });
    const plus = estimatePlanPrice({ amountCents: 1900, countryCode: "US", keys: ["PLUS"], rules: [ten] });
    assert.equal(plus.taxCents, 190);
    assert.equal(plus.totalCents, 2090);
    assert.equal(previewRateChip([plus]), "10% preview");
    const missing = estimatePlanPrice({ amountCents: 1900, countryCode: "US", keys: ["PLUS"], rules: [] });
    assert.equal(missing.taxCents, null);
    assert.equal(missing.totalCents, null);
    assert.equal(missing.baseCents, 1900);
    assert.equal(previewRateChip([missing]), null);
    assert.equal(presentPlanPrice(missing).tax, "—");
  });

  it("prefers the plan rule over the family rule when the saved id matches", () => {
    const rules = [
      family,
      rule({ countryCode: "US", family: "subscription", chargeId: "plan_plus", method: "percentage", ratePercent: 10 }),
    ];
    const plus = estimatePlanPrice({
      amountCents: 1900,
      countryCode: "US",
      keys: ["plan_plus", "PLUS", "creator_plus"],
      rules,
    });
    const pro = estimatePlanPrice({ amountCents: 2900, countryCode: "US", keys: ["PRO"], rules });
    assert.equal(plus.taxCents, 190);
    assert.equal(plus.ratePercent, 10);
    assert.equal(pro.taxCents, 232);
    assert.equal(pro.ratePercent, 8);
    assert.equal(previewRateChip([plus, pro]), "Saved tax rules");
  });

  it("does not turn a location rule into a percentage", () => {
    const located = rule({ countryCode: "US", family: "subscription", method: "location" });
    const plus = estimatePlanPrice({ amountCents: 1900, countryCode: "US", keys: ["PLUS"], rules: [located] });
    assert.equal(plus.method, "location");
    assert.equal(plus.taxCents, null);
    assert.equal(previewRateChip([plus]), "Location rule");
  });
});

describe("interval tax line", () => {
  const seven = rule({ countryCode: "US", family: "subscription", method: "percentage", ratePercent: 7 });

  it("taxes the interval price once and adds that line to the base", () => {
    const monthly = intervalTaxLine({ amountCents: 2500, countryCode: "US", keys: ["PLUS"], rules: [seven] });
    const annual = intervalTaxLine({ amountCents: 30000, countryCode: "US", keys: ["PLUS"], rules: [seven] });
    const fromEstimate = estimatePlanPrice({ amountCents: 2500, countryCode: "US", keys: ["PLUS"], rules: [seven] });
    assert.equal(monthly.taxLineCount, 1);
    assert.equal(monthly.taxCents, fromEstimate.taxCents);
    assert.equal(monthly.totalCents, monthly.baseCents + (monthly.taxCents ?? 0));
    assert.equal(annual.taxLineCount, 1);
    assert.equal(annual.totalCents, annual.baseCents + (annual.taxCents ?? 0));
    assert.notEqual(annual.taxCents, monthly.taxCents);
    assert.equal(monthly.taxCents, 175);
    assert.equal(annual.taxCents, 2100);
    const free = intervalTaxLine({ amountCents: 0, countryCode: "US", keys: ["STARTER"], rules: [seven] });
    assert.equal(free.free, true);
    assert.equal(free.totalCents, 0);
    assert.equal(free.taxLineCount, 0);
    const unknown = intervalTaxLine({ amountCents: 30000, countryCode: "", keys: ["PLUS"], rules: [seven] });
    assert.equal(unknown.taxLineCount, 0);
    assert.equal(unknown.taxCents, null);
    assert.equal(unknown.baseCents, 30000);
    assert.equal(formatPlanMoney(annual.totalCents ?? 0), "$321.00");
  });
});

describe("checkout activity display", () => {
  const now = Date.parse("2026-11-12T18:00:00.000Z");
  const reference = "cs_test_a1b2c3d4e5f6g7h8";

  function row(status: "open" | "completed" | "canceled", createdAt: string, id = "local_1") {
    return presentCheckoutSession({
      id,
      sku: "creator_plus",
      mode: "stripe",
      status,
      customerEmail: "alex@example.com",
      creatorSlug: "alex-reed",
      stripeSessionId: reference,
      createdAt,
      accountName: "Alex Reed",
      planName: "Plus",
      stripeMode: "sandbox",
    });
  }

  it("labels completed, open, and canceled without rewriting the provider reference", () => {
    const completed = row("completed", "2026-11-12T15:00:00.000Z", "local_done");
    const open = row("open", "2026-11-12T12:00:00.000Z", "local_open");
    const expired = row("canceled", "2026-11-11T12:00:00.000Z", "local_old");
    assert.equal(completed.displayStatus, "completed");
    assert.equal(open.displayStatus, "open");
    assert.equal(expired.displayStatus, "expired");
    assert.equal(completed.reference, reference);
    assert.equal(expired.reference, reference);
    assert.equal(completed.environment, "Sandbox");
    assert.equal(completed.account, "Alex Reed");
    assert.equal(completed.dateLabel, "Nov 12");
    assert.equal(expired.dateLabel, "Nov 11");
    assert.equal("url" in completed, false);
    const filtered = filterCheckoutActivity([completed, open, expired], {
      query: reference,
      status: "expired",
      range: "all",
      now,
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.reference, reference);
    assert.equal(filtered[0]?.id, "local_old");
  });

  it("filters by account text and date without changing the stored reference", () => {
    const recent = row("open", "2026-11-10T12:00:00.000Z", "recent");
    const old = row("completed", "2026-10-01T12:00:00.000Z", "old");
    const byName = filterCheckoutActivity([recent, old], { query: "alex reed", status: "all", range: "30", now });
    assert.deepEqual(byName.map((item) => item.id), ["recent"]);
    assert.equal(byName[0]?.reference, reference);
    const none = filterCheckoutActivity([recent], { query: "sam lee", status: "all", range: "all", now });
    assert.equal(none.length, 0);
  });
});

describe("subscription admin pages", () => {
  it("keeps the plan page free of a second tax form and the billing page free of charges", () => {
    const plans = readFileSync("src/app/admin/plans/page.tsx", "utf8");
    const features = readFileSync("src/app/admin/plans/plans-features.tsx", "utf8");
    const billing = readFileSync("src/app/admin/billing/page.tsx", "utf8");
    const activity = readFileSync("src/app/admin/billing/billing-activity.tsx", "utf8");
    for (const source of [plans, features]) {
      assert.equal(source.includes("PlanTaxPanel"), false);
      assert.equal(source.includes("plan-tax-panel"), false);
      assert.equal(source.includes("Enter preview address"), false);
    }
    for (const source of [billing, activity]) {
      assert.equal(source.includes("completeCheckout"), false);
      assert.equal(source.includes("cancelCheckout"), false);
      assert.equal(source.includes("actionStartCheckout"), false);
    }
    for (const source of [plans, billing]) {
      const exported = [...source.matchAll(/^export (default |const |function |async function |type |interface )/gm)].map((match) =>
        match[1].trim(),
      );
      assert.deepEqual(exported, ["const", "const", "default"]);
    }
  });
});
