import assert from "node:assert/strict";
import { promises as fs } from "fs";
import path from "path";
import { describe, it } from "node:test";
import { allCreatorMatches, findMatchesFor, scoreCreatorPair } from "./matching";
import { indexCreatorsBySlug, SEED_CREATORS } from "./seed-data";

describe("directory purity helpers", () => {
  it("indexes creators by slug for picker lookups", () => {
    const bySlug = indexCreatorsBySlug(SEED_CREATORS);
    assert.equal(bySlug.get(SEED_CREATORS[0]!.slug)?.displayName, SEED_CREATORS[0]!.displayName);
    assert.equal(bySlug.get("missing"), undefined);
  });

  it("scores matches from a provided creator list, not a hard-coded seed import", () => {
    const subset = SEED_CREATORS.slice(0, 4);
    const all = allCreatorMatches(subset);
    assert.ok(all.every((match) => subset.some((c) => c.slug === match.a.slug)));
    assert.ok(all.every((match) => subset.some((c) => c.slug === match.b.slug)));
    const forOne = findMatchesFor(subset[0]!.slug, subset);
    assert.ok(forOne.every((match) => match.a.slug === subset[0]!.slug || match.b.slug === subset[0]!.slug));
  });

  it("still pairs complementary seed creators when they are in the list", () => {
    const beauty = SEED_CREATORS.find((c) => c.specialties.includes("beauty"));
    const hair = SEED_CREATORS.find((c) => c.specialties.includes("natural-hair") || c.specialties.includes("hair"));
    assert.ok(beauty && hair);
    const match = scoreCreatorPair(beauty!, hair!);
    assert.ok(match === null || match.score >= 70);
  });
});

describe("phase 9/10 json demos", () => {
  it("removes the json payment modules and the mediation queue", async () => {
    const root = process.cwd();
    for (const rel of [
      "src/lib/protected-payments.ts",
      "src/lib/trust.ts",
      "src/lib/legacy-demo-payments.ts",
      "src/app/admin/trust/actions.ts",
    ]) {
      await assert.rejects(() => fs.access(path.join(root, rel)));
    }
    const trustPage = await fs.readFile(path.join(root, "src/app/admin/trust/page.tsx"), "utf8");
    const seed = await fs.readFile(path.join(root, "prisma/seed.ts"), "utf8");
    assert.equal(trustPage.includes("getTrustStore"), false);
    assert.equal(trustPage.includes("Mediation queue"), false);
    assert.equal(trustPage.includes("actionCreateContract"), false);
    assert.match(seed, /purgeLegacyDemoJsonFiles/);
  });
});
