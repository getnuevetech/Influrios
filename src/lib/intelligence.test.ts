import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildAudienceSnapshot,
  intelligenceExportToCsv,
  nicheTrendsFromCounts,
  relationshipSignalNote,
  requestSpecialtiesForCollaboration,
  type IntelligenceExport,
} from "./intelligence";
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

describe("niche counts", () => {
  it("compares open requests with creator counts and does not invent growth", () => {
    const rows = nicheTrendsFromCounts({
      supply: [
        { specialty: "beauty", creators: 2 },
        { specialty: "Beauty", creators: 1 },
        { specialty: "travel", creators: 4 },
        { specialty: "tech", creators: 1 },
        { specialty: "", creators: 9 },
      ],
      requests: ["beauty", " beauty ", "travel", "food", "tech", "", null],
    });
    const beauty = rows.find((row) => row.specialty === "beauty");
    const travel = rows.find((row) => row.specialty === "travel");
    const food = rows.find((row) => row.specialty === "food");
    assert.equal(beauty?.requestCount, 2);
    assert.equal(beauty?.creatorSupply, 3);
    assert.equal(beauty?.balance, "more_creators");
    assert.equal(travel?.requestCount, 1);
    assert.equal(travel?.creatorSupply, 4);
    assert.equal(food?.requestCount, 1);
    assert.equal(food?.creatorSupply, 0);
    assert.equal(food?.balance, "more_requests");
    assert.equal(rows.find((row) => row.specialty === "tech")?.balance, "even");
    assert.equal(rows.some((row) => row.specialty === ""), false);
    assert.equal(rows[0]?.specialty, "beauty");

    assert.deepEqual(requestSpecialtiesForCollaboration({ offerSpecialty: "Beauty", needSpecialty: "beauty" }), [
      "beauty",
    ]);
    assert.deepEqual(
      requestSpecialtiesForCollaboration({ offerSpecialty: "beauty", needSpecialty: "travel" }),
      ["beauty", "travel"],
    );
    assert.deepEqual(requestSpecialtiesForCollaboration({ offerSpecialty: "  ", needSpecialty: null }), []);
  });

  it("keeps a blank relationship note blank", () => {
    assert.equal(relationshipSignalNote("  Studio day  "), "Studio day");
    assert.equal(relationshipSignalNote("   "), "");
    assert.equal(relationshipSignalNote(undefined), "");
    const lib = readFileSync("src/lib/intelligence.ts", "utf8");
    const page = readFileSync("src/app/business/intelligence/page.tsx", "utf8");
    const admin = readFileSync("src/app/admin/intelligence/page.tsx", "utf8");
    assert.equal(lib.includes('|| "Managed introduction"'), false);
    assert.match(page, /sig\.note \?/);
    assert.match(admin, /s\.note \?/);
  });

  it("does not describe niche rows as synthetic demand or scored fits", () => {
    const lib = readFileSync("src/lib/intelligence.ts", "utf8");
    const page = readFileSync("src/app/business/intelligence/page.tsx", "utf8");
    const admin = readFileSync("src/app/admin/intelligence/page.tsx", "utf8");
    assert.equal(lib.includes("growthPct"), false);
    assert.equal(lib.includes("demandIndex"), false);
    assert.equal(lib.includes("Cap for demo"), false);
    assert.equal(lib.includes("strength:"), false);
    assert.equal(page.includes("synthetic pilot"), false);
    assert.equal(page.includes("getWorkspace()"), false);
    assert.match(page, /getAccountSession\(\)/);
    assert.match(page, /getWorkspace\(account\.id\)/);
    assert.equal(page.includes("niche demand"), false);
    assert.equal(page.includes("% growth"), false);
    assert.equal(page.includes("sig.strength"), false);
    assert.equal(admin.includes("Rising niches"), false);
    assert.equal(admin.includes("Demand index"), false);
  });
});
