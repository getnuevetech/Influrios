import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_BUSINESS_LANDING,
  DEFAULT_COLLABORATION_LANDING,
  DEFAULT_INFLUENCER_IDENTITY,
  isRoleOnlySearchQuery,
  mergeBusinessLanding,
  mergeCollaborationLanding,
  mergeInfluencerIdentity,
} from "./landing-pages";

describe("landing-pages CMS defaults", () => {
  it("keeps approved collaboration hero headline", () => {
    assert.equal(
      DEFAULT_COLLABORATION_LANDING.hero.title,
      "Find the Right Collaboration. Build Bigger Opportunities.",
    );
    assert.equal(DEFAULT_COLLABORATION_LANDING.dualPath.influencer.cta.label, "Join as an Influencer");
    assert.equal(DEFAULT_COLLABORATION_LANDING.mentorship.title, "Influencer Mentorship");
  });

  it("keeps approved business hero copy", () => {
    assert.match(DEFAULT_BUSINESS_LANDING.hero.title, /Find the Right Influencers/);
    assert.equal(DEFAULT_BUSINESS_LANDING.capabilities.items.length, 8);
    assert.equal(DEFAULT_BUSINESS_LANDING.plans.items.find((p) => p.popular)?.name, "Growth");
  });

  it("merges partial patches without wiping arrays", () => {
    const collab = mergeCollaborationLanding({
      hero: { title: "Custom Collab Hero" } as never,
    });
    assert.equal(collab.hero.title, "Custom Collab Hero");
    assert.ok(collab.hero.subtitle.length > 10);
    assert.equal(collab.howItWorks.steps.length, 6);

    const business = mergeBusinessLanding({
      hero: { title: "Custom Biz" } as never,
    });
    assert.equal(business.hero.title, "Custom Biz");
    assert.equal(business.capabilities.items.length, 8);
    assert.equal(business.recommended.title, "Influencers on Influrios");
    assert.equal(business.recommended.subtitle.includes("Example matches"), false);
  });

  it("replaces the retired example-match heading", () => {
    const business = mergeBusinessLanding({
      recommended: {
        title: "Recommended Influencers for Your Business",
        subtitle: "Example matches from the Influrios directory — open a profile when you are ready.",
        ctaLabel: "Browse",
        ctaHref: "/discover",
      },
    });
    assert.equal(business.recommended.title, "Influencers on Influrios");
    assert.equal(business.recommended.subtitle, "Published directory profiles. Open a profile to see what is stored.");
    assert.equal(business.recommended.ctaLabel, "Browse");
  });

  it("exposes influencer self-description options from the terminology addendum", () => {
    const identity = mergeInfluencerIdentity(null);
    assert.ok(identity.selfDescriptions.includes("Influencer"));
    assert.ok(identity.selfDescriptions.includes("Content Creator"));
    assert.equal(DEFAULT_INFLUENCER_IDENTITY.selfDescriptions.length, 13);
  });

  it("keeps an uploaded landing image and drops demo art", () => {
    const collab = mergeCollaborationLanding({
      hero: { images: ["/uploads/banners/hero.jpg", "/demo/categories/cat-beauty.jpg"] } as never,
    });
    assert.deepEqual(collab.hero.images, ["/uploads/banners/hero.jpg"]);
    assert.deepEqual(DEFAULT_COLLABORATION_LANDING.hero.images, []);
    const business = mergeBusinessLanding({
      hero: { images: ["/demo/cta-community.jpg"] } as never,
      whyChoose: { image: "/uploads/banners/why.jpg" } as never,
    });
    assert.deepEqual(business.hero.images, []);
    assert.equal(business.whyChoose.image, "/uploads/banners/why.jpg");
    assert.equal(DEFAULT_BUSINESS_LANDING.whyChoose.image, "");
  });

  it("treats creator / influencer role queries as role-only searches", () => {
    assert.equal(isRoleOnlySearchQuery("creator"), true);
    assert.equal(isRoleOnlySearchQuery("Content Creator"), true);
    assert.equal(isRoleOnlySearchQuery("influencer"), true);
    assert.equal(isRoleOnlySearchQuery("beauty creator"), false);
  });
});
