import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampPasswordMin,
  DEFAULT_FOOTER_STATS,
  DEFAULT_FOOTER_TAGLINE,
  isVerifiedFooterStat,
  statKeyFromLabel,
} from "./site-config";

describe("footer stats defaults", () => {
  it("keeps placeholder templates disabled and unverified", () => {
    assert.deepEqual(
      DEFAULT_FOOTER_STATS.map((stat) => `${stat.value} ${stat.label}`),
      [
        "50K+ Influencers Worldwide",
        "100+ Categories & Niches",
        "12K+ Active Collaborations",
        "5K+ Business Matches",
      ],
    );
    assert.ok(DEFAULT_FOOTER_STATS.every((stat) => stat.enabled === false && !stat.verified && !stat.source));
    assert.equal(DEFAULT_FOOTER_TAGLINE, "A growing creator economy together.");
  });

  it("publishes only enabled sourced stats that are not stale", () => {
    const now = new Date("2026-10-04T12:00:00.000Z");
    assert.equal(
      isVerifiedFooterStat(
        {
          enabled: true,
          source: "Directory census",
          asOf: new Date("2026-09-01T00:00:00.000Z"),
          maxAgeDays: 90,
        },
        now,
      ),
      true,
    );
    assert.equal(
      isVerifiedFooterStat(
        {
          enabled: true,
          source: "",
          asOf: new Date("2026-09-01T00:00:00.000Z"),
        },
        now,
      ),
      false,
    );
    assert.equal(
      isVerifiedFooterStat(
        {
          enabled: true,
          source: "Ops",
          asOf: new Date("2026-01-01T00:00:00.000Z"),
          maxAgeDays: 90,
        },
        now,
      ),
      false,
    );
    assert.equal(
      isVerifiedFooterStat({
        enabled: false,
        source: "Ops",
        asOf: now,
      }),
      false,
    );
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
