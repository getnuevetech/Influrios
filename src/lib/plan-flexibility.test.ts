import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FAQ_AUDIENCES, FAQ_SEED, isFaqAudience } from "./faq-catalog";
import { EMPTY_ENTITLEMENTS, PLAN_ENTITLEMENTS, campaignLinksMaxFromRows, normalizePlanCode } from "./entitlements";
import { canAddCampaignLink } from "./short-link-phase4";

describe("flexible plan codes", () => {
  it("accepts launch codes and new codes", () => {
    assert.equal(normalizePlanCode("studio"), "STUDIO");
    assert.equal(normalizePlanCode("business pro"), "BUSINESS_PRO");
    assert.equal(normalizePlanCode("a"), null);
    assert.equal(normalizePlanCode("1PLAN"), null);
  });

  it("keeps campaign links off the empty plan and on the launch Pro default", () => {
    assert.equal(EMPTY_ENTITLEMENTS.campaignLinksMax, 0);
    assert.equal(EMPTY_ENTITLEMENTS.nfc, false);
    assert.equal(PLAN_ENTITLEMENTS.PLUS.campaignLinksMax, 0);
    assert.equal(PLAN_ENTITLEMENTS.PLUS.nfc, true);
    assert.equal(PLAN_ENTITLEMENTS.PRO.campaignLinksMax, 0);
    assert.equal(campaignLinksMaxFromRows([]), 0);
    assert.equal(
      campaignLinksMaxFromRows([{ featureKey: "card.campaign_links.max", enabled: true, limitInt: 12, valueText: null }]),
      12,
    );
    assert.equal(canAddCampaignLink({ campaignMax: 12, campaignCount: 4 }), true);
  });
});

describe("faq catalog", () => {
  it("covers every audience and explains NFC write and transfer", () => {
    for (const audience of FAQ_AUDIENCES) {
      assert.equal(isFaqAudience(audience), true);
      assert.ok(FAQ_SEED.some((entry) => entry.audience === audience));
    }
    const write = FAQ_SEED.find((entry) => entry.key === "nfc-write");
    const transfer = FAQ_SEED.find((entry) => entry.key === "nfc-transfer");
    assert.ok(write);
    assert.match(write!.answer, /Write to NFC tag/);
    assert.match(write!.answer, /iPhone/);
    assert.ok(transfer);
    assert.match(transfer!.answer, /Write to NFC tag/);
    assert.match(transfer!.answer, /suspend/i);
    const plans = FAQ_SEED.find((entry) => entry.key === "how-plans-work");
    assert.match(plans!.answer, /campaign links/);
  });
});
