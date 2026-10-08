import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { hidesMarketingChrome } from "./chrome-routes";
import {
  cardHighlights,
  comparisonRows,
  displayPrice,
  highlightLine,
  highlightsFor,
  planActionLabel,
  planPageReturn,
  presentFeature,
  recommendedPlanCode,
} from "./plan-presentation";

describe("plan presentation", () => {
  it("recommends the center plan and keeps checkout on the member page that started it", () => {
    assert.equal(
      recommendedPlanCode([
        { code: "STARTER", amountCents: 0 },
        { code: "PLUS", amountCents: 1900 },
        { code: "PRO", amountCents: 2900 },
      ]),
      "PLUS",
    );
    assert.equal(
      recommendedPlanCode([
        { code: "BUSINESS_FREE", amountCents: 0 },
        { code: "BUSINESS_PRO", amountCents: 9900 },
      ]),
      "BUSINESS_PRO",
    );
    assert.equal(recommendedPlanCode([{ code: "STARTER", amountCents: 0 }]), null);
    assert.equal(planPageReturn("/business/plans"), "/business/plans");
    assert.equal(planPageReturn("https://evil.example/billing"), "/billing");
    assert.equal(planPageReturn("/admin/billing"), "/billing");
  });

  it("shows a saved limit and hides a zero campaign-link count", () => {
    assert.deepEqual(
      presentFeature("card.social_links.max", {
        featureKey: "card.social_links.max",
        enabled: true,
        limitInt: 5,
        valueText: null,
      }),
      { included: true, text: "5" },
    );
    assert.equal(
      presentFeature("card.campaign_links.max", {
        featureKey: "card.campaign_links.max",
        enabled: true,
        limitInt: 0,
        valueText: null,
      }).included,
      false,
    );
    const lines = highlightsFor(
      [
        { featureKey: "card.qr.enabled", enabled: true, limitInt: null, valueText: null },
        { featureKey: "card.campaign_links.max", enabled: true, limitInt: 0, valueText: null },
        { featureKey: "card.social_links.max", enabled: true, limitInt: 4, valueText: null },
      ],
      ["card.qr.enabled", "card.campaign_links.max", "card.social_links.max"],
    );
    assert.deepEqual(lines, ["QR code", "4 social links"]);
    assert.equal(
      highlightLine("business.shortlist.max", {
        featureKey: "business.shortlist.max",
        enabled: true,
        limitInt: 5,
        valueText: null,
      }),
      "Shortlist of 5",
    );
    assert.equal(
      highlightLine("card.social_links.max", {
        featureKey: "card.social_links.max",
        enabled: true,
        limitInt: 1,
        valueText: null,
      }),
      "1 social link",
    );
  });

  it("builds a comparison only from features some public plan includes", () => {
    const rows = comparisonRows(
      [
        {
          code: "STARTER",
          features: [{ featureKey: "card.nfc.enabled", enabled: false, limitInt: null, valueText: null }],
        },
        {
          code: "PLUS",
          features: [{ featureKey: "card.nfc.enabled", enabled: true, limitInt: null, valueText: null }],
        },
      ],
      ["card.nfc.enabled", "card.media_kit.enabled"],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].label, "NFC tag URL");
    assert.equal(rows[0].cells[0].included, false);
    assert.equal(rows[0].cells[1].included, true);
    assert.equal(planActionLabel({ name: "Plus", amountCents: 1900, current: false, currentAmountCents: 0 }), "Upgrade to Plus");
    assert.equal(planActionLabel({ name: "Plus", amountCents: 1900, current: true, currentAmountCents: 1900 }), "Current plan");
    assert.deepEqual(
      cardHighlights(
        [
          {
            name: "Starter",
            features: [{ featureKey: "card.qr.enabled", enabled: true, limitInt: null, valueText: null }],
          },
          {
            name: "Plus",
            features: [
              { featureKey: "card.qr.enabled", enabled: true, limitInt: null, valueText: null },
              { featureKey: "card.nfc.enabled", enabled: true, limitInt: null, valueText: null },
            ],
          },
        ],
        1,
        ["card.qr.enabled", "card.nfc.enabled"],
      ),
      ["Everything in Starter", "NFC tag URL"],
    );
    assert.equal(displayPrice(0, "Free"), "$0");
    assert.equal(displayPrice(1900, "$19/mo"), "$19");
  });

  it("hides the marketing header on plan pages and signed-in account screens", () => {
    assert.equal(hidesMarketingChrome("/pricing"), true);
    assert.equal(hidesMarketingChrome("/business/plans"), true);
    assert.equal(hidesMarketingChrome("/billing"), true);
    assert.equal(hidesMarketingChrome("/billing/success"), true);
    assert.equal(hidesMarketingChrome("/creator"), true);
    assert.equal(hidesMarketingChrome("/dashboard/profile"), true);
    assert.equal(hidesMarketingChrome("/business"), false);
    assert.equal(hidesMarketingChrome("/discover"), false);
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    const frame = readFileSync("src/components/chrome-frame.tsx", "utf8");
    assert.match(layout, /ChromeFrame/);
    assert.match(frame, /usePathname/);
    assert.equal(layout.includes("x-pathname"), false);
  });
});
