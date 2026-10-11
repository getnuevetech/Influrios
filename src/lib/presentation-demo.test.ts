import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PRODUCT_SWITCHES } from "./product-switches";
import {
  demoBusinessRequests,
  demoCardStrip,
  demoCollaborationPairs,
  demoCreatorBySlug,
  demoCreatorMatches,
  demoCreators,
  demoOpportunities,
  demoPopularMatchCards,
  isDemoCreatorSlug,
} from "./presentation-demo";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("presentation demo catalog", () => {
  it("keeps every demo profile on the catalog and labels it as a demo", () => {
    const creators = demoCreators();
    assert.ok(creators.length >= 6);
    for (const creator of creators) {
      assert.match(creator.slug, /^demo-/);
      assert.equal(isDemoCreatorSlug(creator.slug), true);
      assert.equal(demoCreatorBySlug(creator.slug)?.displayName, creator.displayName);
      assert.match(creator.bio, /demo/i);
      assert.equal(creator.badge, "Demo");
      assert.match(creator.image, /^\/demo\/creators\//);
    }
    assert.equal(isDemoCreatorSlug("sofia-martinez"), false);
    assert.ok(demoCardStrip().length >= 4);
    assert.equal(
      demoCardStrip().every((row) => row.features.showHeart === false),
      true,
    );
    assert.ok(demoCollaborationPairs().length >= 3);
    assert.ok(demoCreatorMatches().length >= 4);
    for (const match of demoCreatorMatches()) {
      assert.match(match.why, /demo/i);
      assert.equal(isDemoCreatorSlug(match.a.slug), true);
      assert.equal(isDemoCreatorSlug(match.b.slug), true);
    }
    for (const card of demoPopularMatchCards()) {
      assert.match(card.image, /^\/demo\/categories\//);
    }
    assert.ok(demoBusinessRequests().length >= 3);
    assert.equal(
      demoOpportunities().every((row) => isDemoCreatorSlug(row.creatorSlug)),
      true,
    );
    const spec = PRODUCT_SWITCHES.find((row) => row.key === "public_pages_live");
    assert.equal(spec?.enabled, false);
  });

  it("keeps the homepage influencer strip on the demo catalog", () => {
    const home = source("src/app/page.tsx");
    assert.match(home, /demoCardStrip\(\)/);
    assert.match(home, /demoCreators\(\)\[0\]/);
    assert.match(home, /publicPagesUseLive/);
    assert.equal(home.includes('planTier !== "STARTER"'), false);
    assert.equal(home.includes("sofia-martinez"), false);
    const collab = source("src/app/collaboration/page.tsx");
    const persistAt = collab.indexOf("await persistTopMatches");
    const liveAt = collab.indexOf("if (livePages)");
    assert.ok(liveAt >= 0 && persistAt > liveAt);
    const catalog = source("src/lib/presentation-demo.ts");
    assert.equal(catalog.includes("prisma.creator"), false);
    assert.equal(catalog.includes("SEED_CREATORS"), false);
    const profile = source("src/app/creators/[slug]/page.tsx");
    assert.ok(profile.indexOf("demoCreatorBySlug") >= 0);
    assert.ok(profile.indexOf("if (!preview)") < profile.indexOf("await recordDirectoryEvent"));
    const qr = source("src/app/api/qr/[slug]/route.ts");
    assert.ok(qr.indexOf("if (isDemoCreatorSlug") < qr.indexOf("await getDirectoryCreator"));
    const discover = source("src/app/discover/page.tsx");
    assert.match(discover, /publicPagesUseLive/);
    assert.match(discover, /demoCreators\(\)/);
    assert.ok(discover.indexOf("if (livePages)") < discover.indexOf("await recordDirectoryEvent"));
    const admin = source("src/app/admin/homepage/page.tsx");
    assert.match(admin, /public_pages_live|Show live profiles/);
    assert.match(admin, /actionSavePresentationMode/);
  });
});
