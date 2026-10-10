import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { cardsFromStoredCollaborationMatches } from "./matching";
import { platformDisplayName } from "./seed-data";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("stored collaboration match cards", () => {
  it("keeps a saved pair and drops an empty title", () => {
    const cards = cardsFromStoredCollaborationMatches([
      { title: "Beauty Creator + Skincare Brand", tags: ["beauty"], image: "/uploads/pairs/beauty.jpg" },
      { title: "   ", tags: ["food"] },
    ]);
    assert.equal(cards.length, 1);
    assert.equal(cards[0]!.title, "Beauty Influencer");
    assert.equal(cards[0]!.subtitle, "+ Skincare Brand");
    assert.equal(cards[0]!.specialty, "beauty");
    assert.equal(cards[0]!.image, "/uploads/pairs/beauty.jpg");
  });

  it("leaves a tagless match unlabeled", () => {
    const cards = cardsFromStoredCollaborationMatches([{ title: "Beauty Creator", tags: [] }]);
    assert.equal(cards[0]!.specialty, "");
  });

  it("drops a sample photo and keeps an uploaded cover", () => {
    const cards = cardsFromStoredCollaborationMatches([
      { title: "Hair Stylist", tags: ["hair"], image: "/demo/creators/creator-sofia.jpg" },
      { title: "Beauty Creator", tags: ["beauty"], image: "/uploads/pairs/beauty.jpg" },
    ]);
    assert.equal(cards.length, 2);
    assert.equal(cards[0]!.image, "");
    assert.equal(cards[1]!.image, "/uploads/pairs/beauty.jpg");
  });

  it("shows the niche photo for a saved pair and hides a creator sample photo", () => {
    const cards = cardsFromStoredCollaborationMatches([
      { title: "Interior Designer + Woodwork Influencer", tags: ["Design"], image: "" },
      { title: "Food Influencer + Kitchen Brand", tags: ["Food"], image: "/demo/categories/cat-food.jpg" },
      { title: "Custom Pair", tags: ["Beauty"], image: "/demo/creators/creator-sofia.jpg" },
    ]);
    assert.equal(cards[0]!.image, "/demo/categories/cat-home.jpg");
    assert.equal(cards[1]!.image, "/demo/categories/cat-food.jpg");
    assert.equal(cards[2]!.image, "");
  });
});

describe("public sample surfaces", () => {
  it("draws the card page from published creators and saved plans", () => {
    const card = source("src/app/card/page.tsx");
    assert.equal(card.includes("sofia-martinez"), false);
    assert.equal(card.includes("$19"), false);
    assert.equal(card.includes("$29"), false);
    assert.match(card, /loadPlanMatrix\("creator"\)/);
  });

  it("does not paint invented follower counts on the homepage", () => {
    const home = source("src/app/page.tsx");
    assert.equal(home.includes("sofia-martinez"), false);
    assert.equal(home.includes("2.4M"), false);
    assert.equal(home.includes("3.1M"), false);
    assert.equal(home.includes("Samsung"), false);
    assert.equal(home.includes("L'ORÉAL"), false);
    assert.equal(home.includes("Nike"), false);
    assert.equal(home.includes("Adobe"), false);
    assert.equal(home.includes("/demo/cta-community.jpg"), false);
    assert.equal(home.includes("categoryImageFor"), false);
    assert.equal(home.includes("Follow on"), false);
    assert.match(home, /platformDisplayName/);
    assert.match(home, /\/c\/\$\{featuredCreator\.slug\}/);
    assert.equal(platformDisplayName("YOUTUBE"), "YouTube");
    assert.equal(platformDisplayName("TIKTOK"), "TikTok");
    assert.equal(platformDisplayName("WEBSITE"), "Website");
    assert.notEqual(platformDisplayName("YOUTUBE"), platformDisplayName("TIKTOK"));
    assert.match(home, /sponsored\.partners/);
    const business = source("src/app/business/page.tsx");
    const marketing = source("src/components/business-marketing.tsx");
    assert.equal(business.includes("Why this match"), false);
    assert.equal(business.includes("Strong specialty fit"), false);
    assert.equal(business.includes('?? "lifestyle"'), false);
    assert.equal(marketing.includes("Why this match"), false);
    assert.match(business, /publicStoredImage/);
  });

  it("does not label a blank specialty, title, or country", () => {
    const home = source("src/app/page.tsx");
    const discover = source("src/app/discover/page.tsx");
    const account = source("src/app/creator/page.tsx");
    const mentors = source("src/app/mentorship/page.tsx");
    assert.equal(home.includes(': "Creator"'), false);
    assert.equal(discover.includes('?? "Influencer"'), false);
    assert.match(discover, /filterCreators\(directory\.creators/);
    assert.equal(discover.includes("searchCreators"), false);
    assert.equal(account.includes('|| "Influencer"'), false);
    assert.equal(mentors.includes('?? "Global"'), false);
  });

  it("does not insert sample marketplace rows on a read", () => {
    const listings = source("src/lib/marketplace-listings.ts");
    assert.equal(listings.includes("await ensureMarketplaceListings()"), false);
    assert.equal(listings.includes("createMany"), false);
    const seed = source("prisma/seed.ts");
    assert.equal(seed.includes("BUSINESS_REQUESTS"), false);
    assert.equal(seed.includes("CREATOR_OPPORTUNITIES"), false);
    assert.equal(seed.includes("SEED_CREATORS"), false);
    assert.equal(seed.includes("prisma.creator.upsert"), false);
    const collab = source("src/app/collaboration/page.tsx");
    const hub = source("src/app/collaboration/hub/page.tsx");
    const matching = source("src/lib/matching.ts");
    assert.equal(collab.includes("POPULAR_MATCH_CHIPS"), false);
    assert.equal(hub.includes("POPULAR_MATCH_CHIPS"), false);
    assert.equal(matching.includes("POPULAR_MATCH_CHIPS"), false);
    assert.match(collab, /cardsFromStoredCollaborationMatches/);
    assert.match(hub, /cardsFromStoredCollaborationMatches/);
    const profile = source("src/app/creators/[slug]/page.tsx");
    assert.equal(profile.includes("leading global brands"), false);
    assert.equal(profile.includes("kinder, more colorful"), false);
    assert.equal(profile.includes("brighter, more confident"), false);
    assert.equal(profile.includes("all her info"), false);
    assert.equal(profile.includes("Last 30 Days"), false);
    assert.equal(profile.includes("Read More"), false);
    assert.equal(profile.includes("Open to exciting brand partnerships"), false);
    assert.match(profile, /profilePlace/);
    assert.equal(profile.includes("/demo/"), true);
    const adminMatching = source("src/app/admin/matching/page.tsx");
    assert.equal(adminMatching.includes("manual pilot"), false);
    assert.equal(adminMatching.includes("Phase 4 ops"), false);
  });

  it("does not insert a sample introduction", () => {
    const matching = source("src/lib/managed-matching.ts");
    assert.equal(matching.includes("intro-demo-1"), false);
    assert.equal(matching.includes("demo-business"), false);
    assert.equal(matching.includes("Luminous Beauty"), false);
  });

  it("does not prefill a sample creator on a new deal", () => {
    const payments = source("src/app/payments/page.tsx");
    assert.equal(payments.includes("sofia-martinez"), false);
    assert.equal(payments.includes("Luminous Beauty"), false);
  });
});
