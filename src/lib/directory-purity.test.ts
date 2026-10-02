import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allCreatorMatches, findMatchesFor, scoreCreatorPair } from "./matching";
import { indexCreatorsBySlug, SEED_CREATORS } from "./seed-data";
import { assertLegacyDemoPayments } from "./legacy-demo-payments";
import { setProductSwitchForTests } from "./product-switches";

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

describe("legacy demo payments switch", () => {
  it("refuses Phase 9/10 demo writes when the switch is off", async () => {
    setProductSwitchForTests("legacy_demo_payments", false);
    await assert.rejects(() => assertLegacyDemoPayments(), /marketplace ledger/i);
    setProductSwitchForTests("legacy_demo_payments", null);
  });

  it("allows Phase 9/10 demo writes when the switch is on", async () => {
    setProductSwitchForTests("legacy_demo_payments", true);
    await assertLegacyDemoPayments();
    setProductSwitchForTests("legacy_demo_payments", null);
  });
});
