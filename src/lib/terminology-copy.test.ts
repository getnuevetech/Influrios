import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeInfluencerRoleTitle } from "./terminology-copy";

describe("terminology-copy", () => {
  it("rewrites Creator as platform role in match titles", () => {
    assert.equal(normalizeInfluencerRoleTitle("Beauty Creator + Skincare Brand"), "Beauty Influencer + Skincare Brand");
    assert.equal(normalizeInfluencerRoleTitle("Creators looking for brands"), "Influencers looking for brands");
  });

  it("preserves Content Creator as a self-description designation", () => {
    assert.equal(normalizeInfluencerRoleTitle("Content Creator"), "Content Creator");
    assert.equal(
      normalizeInfluencerRoleTitle("Influencer & Content Creator"),
      "Influencer & Content Creator",
    );
  });
});
