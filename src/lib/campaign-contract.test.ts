import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  budgetToGrossDollars,
  currencyForPlaceName,
  campaignCommercialFromBrief,
  campaignEditLocked,
  campaignScopeFromBrief,
  contractHrefFromCampaign,
  contractOfferReady,
  contractTermsFromRequest,
  preferContractField,
} from "./campaign-contract";

describe("campaign-contract helpers", () => {
  it("uses the country currency for a campaign", () => {
    assert.equal(currencyForPlaceName("Nigeria"), "NGN");
    assert.equal(currencyForPlaceName("US"), "USD");
    assert.equal(currencyForPlaceName(""), null);
  });

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
        deliverables: "",
        responseDeadline: null,
        createdAt: new Date().toISOString(),
        status: "active",
      },
    });
    assert.match(href, /creator=maya/);
    assert.match(href, /brief=brief_1/);
    assert.match(href, /title=Summer/);
    assert.match(href, /gross=2000/);
    assert.match(href, /currency=USD/);
    assert.match(href, /scope=/);
  });

  it("copies request title, scope, value, and currency into the contract", () => {
    const terms = contractTermsFromRequest({
      brief: {
        title: "Summer Glow",
        goal: "Awareness",
        summary: "3 posts",
        collabType: "Reel",
        timeframe: "June",
        platform: "Instagram",
        specialty: "beauty",
        budget: "2000",
        budgetCurrency: "NGN",
      },
      deliverables: "One reel and two stories",
      offerText: "Paid on delivery",
    });
    assert.equal(terms.title, "Summer Glow");
    assert.match(terms.scope, /3 posts/);
    assert.match(terms.scope, /One reel/);
    assert.match(terms.commercial, /Paid on delivery/);
    assert.equal(terms.gross, "2000");
    assert.equal(terms.currency, "NGN");
    assert.equal(preferContractField("3 posts", terms.scope), terms.scope);
    assert.equal(preferContractField("A different title", "Summer Glow"), "A different title");
  });

  it("opens create-contract only after the business shortlists an accepted influencer", () => {
    assert.equal(contractOfferReady({ status: "ACCEPTED", creatorSlug: "maya", shortlistedSlugs: [] }), false);
    assert.equal(contractOfferReady({ status: "VIEWED", creatorSlug: "maya", shortlistedSlugs: ["maya"] }), false);
    assert.equal(contractOfferReady({ status: "ACCEPTED", creatorSlug: "maya", shortlistedSlugs: ["maya"] }), true);
  });

  it("locks closed campaigns from further edits", () => {
    assert.equal(campaignEditLocked({ status: "closed" }), true);
    assert.equal(campaignEditLocked({ status: "active" }), false);
    assert.equal(campaignEditLocked({ status: "draft" }), false);
  });
});
