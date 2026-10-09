import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { cardsFromStoredCollaborationMatches } from "./matching";

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

  it("drops a sample photo and keeps an uploaded cover", () => {
    const cards = cardsFromStoredCollaborationMatches([
      { title: "Hair Stylist", tags: ["hair"], image: "/demo/creators/creator-sofia.jpg" },
      { title: "Beauty Creator", tags: ["beauty"], image: "/uploads/pairs/beauty.jpg" },
    ]);
    assert.equal(cards.length, 2);
    assert.equal(cards[0]!.image, "");
    assert.equal(cards[1]!.image, "/uploads/pairs/beauty.jpg");
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
    assert.match(home, /sponsored\.partners/);
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
