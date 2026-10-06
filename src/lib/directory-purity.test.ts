import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allCreatorMatches, findMatchesFor, scoreCreatorPair } from "./matching";
import { indexCreatorsBySlug, SEED_CREATORS } from "./seed-data";
import { assertLegacyDemoPayments, isLegacyDemoPaymentsAdminHref } from "./legacy-demo-payments";

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
  it("always refuses Phase 9/10 demo writes", async () => {
    await assert.rejects(() => assertLegacyDemoPayments(), /marketplace ledger/i);
  });

  it("only treats /admin/payments as a legacy-only admin href", () => {
    assert.equal(isLegacyDemoPaymentsAdminHref("/admin/payments"), true);
    assert.equal(isLegacyDemoPaymentsAdminHref("/admin/trust"), false);
    assert.equal(isLegacyDemoPaymentsAdminHref("/admin/marketplace"), false);
  });
});
