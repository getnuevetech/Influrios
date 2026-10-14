import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  budgetToGrossDollars,
  campaignCommercialFromBrief,
  campaignEditLocked,
  campaignScopeFromBrief,
  contractHrefFromCampaign,
} from "./campaign-contract";

describe("campaign-contract helpers", () => {
  it("parses budget into a gross dollar string", () => {
    assert.equal(budgetToGrossDollars("$1,250.00", "USD"), "1250");
    assert.equal(budgetToGrossDollars("500", "NGN"), "500");
    assert.equal(budgetToGrossDollars("", "USD"), "");
  });

  it("builds scope and commercial lines from a brief", () => {
    const brief = {
      goal: "Launch",
      summary: "Summer drops",
      collabType: "Sponsored post",
      timeframe: "Q3",
      platform: "Instagram",
      specialty: "Beauty",
    };
    assert.match(campaignScopeFromBrief(brief), /Launch/);
    assert.match(campaignScopeFromBrief(brief), /Instagram/);
    assert.match(campaignCommercialFromBrief(brief), /Sponsored post/);
    assert.match(campaignCommercialFromBrief(brief), /Beauty/);
  });

  it("prefills the contract href from campaign intent fields", () => {
    const href = contractHrefFromCampaign({
      creatorSlug: "maya",
      brief: {
        id: "brief_1",
        title: "Summer Glow",
        goal: "Awareness",
        specialty: "beauty",
        budget: "2000",
        budgetCurrency: "USD",
        collabType: "Reel",
        timeframe: "June",
        location: "US",
        platform: "Instagram",
        summary: "3 posts",
        createdAt: new Date().toISOString(),
        status: "active",
      },
    });
    assert.match(href, /creator=maya/);
    assert.match(href, /brief=brief_1/);
    assert.match(href, /title=Summer/);
    assert.match(href, /gross=2000/);
    assert.match(href, /scope=/);
  });

  it("locks closed campaigns from further edits", () => {
    assert.equal(campaignEditLocked({ status: "closed" }), true);
    assert.equal(campaignEditLocked({ status: "active" }), false);
    assert.equal(campaignEditLocked({ status: "draft" }), false);
  });
});
