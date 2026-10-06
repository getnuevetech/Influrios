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
  it("builds a demo snapshot with gender remainder and platforms", () => {
    const snapshot = buildAudienceSnapshot(
      sampleCreator({
        demographics: {
          female: 60,
          male: 30,
          locations: [{ name: "Austin", pct: 40 }],
          ages: [{ range: "25-34", pct: 50 }],
        },
      }),
    );
    assert.equal(snapshot.creatorSlug, "ada-maker");
    assert.equal(snapshot.source, "demo_seed");
    assert.equal(snapshot.gender.other, 10);
    assert.ok(snapshot.engagementRate);
    assert.deepEqual(snapshot.primaryPlatforms, ["INSTAGRAM"]);
  });

  it("labels follower-backed creators as directory_metrics", () => {
    const snapshot = buildAudienceSnapshot(sampleCreator());
    assert.equal(snapshot.source, "directory_metrics");
    assert.ok(snapshot.totalReach);
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
          source: "directory_metrics",
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
