import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnnualPlanPrices } from "@/app/admin/plans/annual-plan-prices";
import { MemberPlanPage } from "@/components/plans/member-plan-page";
import { estimatePlanPrice, formatPlanMoney, intervalTaxLine } from "@/lib/admin-subscription-view";
import { CHECKOUT_TAX_NOTE, MISSING_YEARLY_STRIPE_PRICE_ID, formatOfferAmount } from "@/lib/billing-interval";
import type { CountryTaxRule } from "@/lib/country-tax";
import type { PlanMatrix } from "@/lib/plan-matrix";
import { formatUsd } from "@/lib/tax-configuration";

const rules: CountryTaxRule[] = [{
  id: "us-subscription",
  version: 1,
  countryCode: "US",
  family: "subscription",
  chargeId: "",
  chargeLabel: "Subscriptions",
  method: "percentage",
  ratePercent: 7,
  inclusive: false,
  effective: true,
  conflict: false,
}];

function column(input: { code: string; sku: string; name: string; amountCents: number }): PlanMatrix["plans"][number] {
  return {
    code: input.code,
    sku: input.sku,
    name: input.name,
    description: "",
    priceLabel: "",
    amountCents: input.amountCents,
    audience: "creator",
    checkout: input.amountCents > 0,
    highlights: ["A saved feature"],
    recommended: false,
    features: [],
  };
}

const matrix: PlanMatrix = {
  source: "saved",
  rows: [],
  plans: [
    column({ code: "STARTER", sku: "creator_starter", name: "Starter", amountCents: 0 }),
    column({ code: "PLUS", sku: "creator_plus", name: "Plus", amountCents: 2500 }),
  ],
};

function accountCards(input: { interval: "month" | "year"; checkout: boolean; country: string }) {
  return renderToStaticMarkup(
    <MemberPlanPage
      audience="creator"
      eyebrow="Influencer"
      title="Billing & plan"
      currentCode={null}
      currentAmountCents={null}
      matrix={matrix}
      history={[]}
      portalOn={false}
      hasCustomer={false}
      subscriptionStatus={null}
      interval={input.interval}
      annualBySku={{ creator_plus: 30000 }}
      annualCheckoutBySku={input.checkout ? { creator_plus: true } : {}}
      billingCountry={input.country}
      taxRules={rules}
      taxKeysByCode={{ PLUS: ["PLUS", "creator_plus"], STARTER: ["STARTER"] }}
    />,
  );
}

describe("saved annual price and one tax line", () => {
  const annual = intervalTaxLine({ amountCents: 30000, countryCode: "US", keys: ["PLUS", "creator_plus"], rules });
  const monthly = intervalTaxLine({ amountCents: 2500, countryCode: "US", keys: ["PLUS", "creator_plus"], rules });
  const monthlyEstimate = estimatePlanPrice({ amountCents: 2500, countryCode: "US", keys: ["PLUS", "creator_plus"], rules });

  it("renders the annual amount and one tax line on the account cards and the admin list", () => {
    assert.equal(annual.taxLineCount, 1);
    assert.equal(monthly.taxLineCount, 1);
    assert.equal(monthly.taxCents, monthlyEstimate.taxCents);
    assert.equal(monthly.totalCents, monthly.baseCents + (monthly.taxCents ?? 0));
    assert.equal(annual.totalCents, annual.baseCents + (annual.taxCents ?? 0));
    assert.ok(annual.taxCents != null && monthly.taxCents != null && annual.totalCents != null && monthly.totalCents != null);

    const cards = accountCards({ interval: "year", checkout: false, country: "US" });
    assert.match(cards, new RegExp(formatOfferAmount(30000).replace("$", "\\$")));
    assert.match(cards, new RegExp(formatUsd(annual.taxCents).replace("$", "\\$")));
    assert.match(cards, new RegExp(formatUsd(annual.totalCents).replace("$", "\\$")));
    assert.equal(cards.split("Tax ").length - 1, 1);
    assert.match(cards, /Free/);
    assert.equal(cards.includes("Annual checkout is not available for this plan yet."), false);
    assert.match(cards, new RegExp(MISSING_YEARLY_STRIPE_PRICE_ID.replace(/[.]/g, "\\.")));
    assert.equal(cards.includes("View monthly"), false);
    assert.match(cards, /\$300/);

    const list = renderToStaticMarkup(
      <AnnualPlanPrices
        plans={[
          {
            code: "STARTER",
            name: "Starter",
            annualBase: "",
            annualTax: "",
            annualTotal: "",
          },
          {
            code: "PLUS",
            name: "Plus",
            annualBase: formatPlanMoney(annual.baseCents),
            annualTax: formatPlanMoney(annual.taxCents),
            annualTotal: formatPlanMoney(annual.totalCents),
          },
        ]}
      />,
    );
    assert.match(list, /Annual pricing/);
    assert.match(list, new RegExp(formatPlanMoney(annual.baseCents).replace("$", "\\$")));
    assert.match(list, new RegExp(formatPlanMoney(annual.taxCents).replace("$", "\\$")));
    assert.match(list, new RegExp(formatPlanMoney(annual.totalCents).replace("$", "\\$")));
    assert.equal(list.includes("Annual checkout is not available"), false);
    assert.equal(list.includes("not available"), false);
    const starter = list.slice(list.indexOf("Starter"), list.indexOf("Plus"));
    assert.equal(starter.includes("$"), false);
  });

  it("keeps monthly tax on the same function and the total as base plus that line", () => {
    const cards = accountCards({ interval: "month", checkout: false, country: "US" });
    assert.ok(monthly.taxCents != null && monthly.totalCents != null);
    assert.match(cards, new RegExp(formatUsd(monthly.taxCents).replace("$", "\\$")));
    assert.match(cards, new RegExp(formatUsd(monthly.totalCents).replace("$", "\\$")));
    assert.equal(cards.split("Tax ").length - 1, 1);
    assert.equal(monthly.totalCents, 2500 + monthly.taxCents);
    assert.equal(cards.includes(MISSING_YEARLY_STRIPE_PRICE_ID), false);
  });

  it("does not invent tax when the billing location is unknown", () => {
    const cards = accountCards({ interval: "year", checkout: false, country: "" });
    assert.match(cards, /\$300/);
    assert.equal(cards.includes("Tax "), false);
    assert.equal(cards.split(CHECKOUT_TAX_NOTE).length - 1, 1);
  });

  it("makes annual checkout available when the yearly price id is saved", () => {
    const cards = accountCards({ interval: "year", checkout: true, country: "US" });
    assert.match(cards, /Choose Plus annual/);
    assert.equal(cards.includes(MISSING_YEARLY_STRIPE_PRICE_ID), false);
    assert.equal(cards.includes("Annual checkout is not available for this plan yet."), false);
    assert.match(cards, /\$300/);
    const page = readFileSync(new URL("../app/admin/plans/page.tsx", import.meta.url), "utf8");
    assert.match(page, /intervalTaxLine/);
    assert.equal(page.includes("export {"), false);
    assert.equal(page.includes("export function"), false);
  });
});
