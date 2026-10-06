import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAudienceSnapshot, intelligenceExportToCsv, type IntelligenceExport } from "./intelligence";
import type { SeedCreator } from "./seed-data";

function sampleCreator(overrides: Partial<SeedCreator> = {}): SeedCreator {
  return {
    slug: "ada-maker",
    displayName: "Ada Maker",
    title: "Maker",
    bio: "Builds rooms",
    locationCity: "Austin",
    locationCountry: "USA",
    languages: ["English"],
    avatarColor: "#633CFF",
    image: "/demo/creators/creator-sofia.jpg",
    badge: "Rising Star",
    statusLabel: "Open",
    planTier: "STARTER",
    specialties: ["woodworking"],
    socials: [{ platform: "INSTAGRAM", handle: "@ada", url: "https://instagram.com/ada", followers: 1200 }],
    openToCollab: true,
    ...overrides,
  };
}

describe("intelligence snapshots", () => {
  it("uses claimed demographics and does not invent a split", () => {
    const snapshot = buildAudienceSnapshot(
      sampleCreator({
        demographics: {
          female: 60,
          male: 30,
          locations: [{ name: "Austin", pct: 40 }],
          ages: [{ range: "25-34", pct: 50 }],
        },
        stats: {
          engagementRate: "4.1%",
          engagementDelta: "",
          totalReach: "12K",
          reachDelta: "",
          avgViews: "",
          viewsDelta: "",
          collaborations: "",
          collabDelta: "",
        },
      }),
    );
    assert.equal(snapshot.creatorSlug, "ada-maker");
    assert.equal(snapshot.source, "claimed_metrics");
    assert.equal(snapshot.gender.other, 10);
    assert.equal(snapshot.engagementRate, "4.1%");
    assert.deepEqual(snapshot.primaryPlatforms, ["INSTAGRAM"]);

    const empty = buildAudienceSnapshot(sampleCreator());
    assert.equal(empty.source, "unavailable");
    assert.equal(empty.gender.female, 0);
    assert.equal(empty.ages.length, 0);
    assert.equal(empty.topLocations.length, 0);
    assert.equal(empty.engagementRate, "");
    assert.ok(empty.totalReach);
  });
});

describe("intelligence export csv", () => {
  it("escapes quotes and includes snapshot columns", () => {
    const payload: IntelligenceExport = {
      exportedAt: "2026-10-02T00:00:00.000Z",
      source: "influrios-intelligence-directory",
      snapshots: [
        {
          creatorSlug: "ada",
          displayName: 'Ada "Maker"',
          source: "claimed_metrics",
          refreshedAt: "2026-10-02T00:00:00.000Z",
          gender: { female: 50, male: 40, other: 10 },
          ages: [],
          topLocations: [{ name: "Austin", pct: 20 }],
          engagementRate: "3%",
          totalReach: "1K",
          primaryPlatforms: ["INSTAGRAM"],
        },
      ],
      trends: [],
      signals: [],
    };
    const csv = intelligenceExportToCsv(payload);
    assert.ok(csv.includes("creatorSlug"));
    assert.ok(csv.includes('"Ada ""Maker"""'));
    assert.ok(csv.includes("Austin"));
  });
});
