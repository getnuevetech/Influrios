import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clampPasswordMin, DEFAULT_FOOTER_STATS, DEFAULT_FOOTER_TAGLINE, statKeyFromLabel } from "./site-config";

describe("footer stats defaults", () => {
  it("keeps the approved counters", () => {
    assert.deepEqual(
      DEFAULT_FOOTER_STATS.map((stat) => `${stat.value} ${stat.label}`),
      [
        "50K+ Influencers Worldwide",
        "100+ Categories & Niches",
        "12K+ Active Collaborations",
        "5K+ Business Matches",
      ],
    );
    assert.equal(DEFAULT_FOOTER_TAGLINE, "A growing creator economy together.");
  });
});

describe("site config helpers", () => {
  it("clamps the password minimum into the allowed range", () => {
    assert.equal(clampPasswordMin(4), 8);
    assert.equal(clampPasswordMin(12), 12);
    assert.equal(clampPasswordMin(200), 64);
  });

  it("builds a stable key from a label", () => {
    assert.equal(statKeyFromLabel("Business Matches"), "business-matches");
  });
});
