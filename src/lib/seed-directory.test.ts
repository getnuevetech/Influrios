import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { COLLAB_MATCH_PRESETS, SEED_CREATORS } from "./seed-data";
import {
  collaborationMatchesAreDefaultSeed,
  featuredCardsAreDefaultSeed,
  isUntouchedSeedCreator,
} from "./seed-directory";

describe("sample directory personas", () => {
  it("removes an unclaimed sample and keeps a claimed or edited profile", () => {
    const sample = SEED_CREATORS[0]!;
    assert.equal(
      isUntouchedSeedCreator({
        slug: sample.slug,
        displayName: sample.displayName,
        bio: sample.bio,
        claimed: false,
        profileState: "UNCLAIMED",
        userId: null,
      }),
      true,
    );
    assert.equal(
      isUntouchedSeedCreator({
        slug: sample.slug,
        displayName: sample.displayName,
        bio: sample.bio,
        claimed: true,
        profileState: "CLAIMED",
        userId: "user_1",
      }),
      false,
    );
    assert.equal(
      isUntouchedSeedCreator({
        slug: sample.slug,
        displayName: "Ada Lovelace",
        bio: sample.bio,
        claimed: false,
        profileState: "UNCLAIMED",
        userId: null,
      }),
      false,
    );
  });

  it("recognizes the default homepage sample set and keeps a custom card", () => {
    assert.equal(
      featuredCardsAreDefaultSeed(SEED_CREATORS.map((creator) => creator.slug)),
      true,
    );
    assert.equal(featuredCardsAreDefaultSeed(["ada"]), false);
    assert.equal(collaborationMatchesAreDefaultSeed(COLLAB_MATCH_PRESETS), true);
    assert.equal(
      collaborationMatchesAreDefaultSeed([
        { title: "Real pair", leftSlug: "ada", rightSlug: "grace" },
      ]),
      false,
    );
  });

  it("does not insert sample creators and the migration deletes each untouched bio", () => {
    const seed = readFileSync("prisma/seed.ts", "utf8");
    const cms = readFileSync("src/lib/cms.ts", "utf8");
    const sql = readFileSync(
      "prisma/migrations/20261009020000_remove_seed_creators/migration.sql",
      "utf8",
    );
    assert.equal(seed.includes("SEED_CREATORS"), false);
    assert.equal(seed.includes("prisma.creator.upsert"), false);
    assert.match(seed, /removeUntouchedSeedCreators/);
    assert.equal(cms.includes("SEED_CREATORS"), false);
    assert.equal(cms.includes("COLLAB_MATCH_PRESETS"), false);
    for (const creator of SEED_CREATORS) {
      assert.match(sql, new RegExp(creator.slug));
      assert.match(sql, new RegExp(creator.bio.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.match(sql, /claimed = false/);
    assert.match(sql, /"profileState" = 'UNCLAIMED'/);
  });
});
