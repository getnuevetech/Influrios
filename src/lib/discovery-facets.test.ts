import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { draftFromSession } from "./claim";
import { creatorIndexDocument, creatorIndexFilter } from "./creator-index";
import { narrowIndexedCreators } from "./creator-search";
import { discoveryFacetSlug } from "./discovery-facets";
import { filterCreators, type SeedCreator } from "./seed-data";
import type { OnboardingSession } from "@prisma/client";

function creator(overrides: Partial<SeedCreator> = {}): SeedCreator {
  return {
    slug: "ada",
    displayName: "Ada",
    title: "",
    bio: "",
    locationCity: "",
    locationCountry: "",
    languages: [],
    avatarColor: "#633CFF",
    image: "",
    badge: "",
    statusLabel: "",
    planTier: "STARTER",
    specialties: [],
    socials: [],
    openToCollab: true,
    ...overrides,
  };
}

describe("discovery facets", () => {
  it("turns an entered name into a catalog slug", () => {
    assert.equal(discoveryFacetSlug("Tutorial"), "tutorial");
    assert.equal(discoveryFacetSlug("Live demonstration"), "live-demonstration");
    assert.equal(discoveryFacetSlug(""), null);
    assert.equal(discoveryFacetSlug("   "), null);
  });

  it("keeps a creator only when a chosen style or mode matches", () => {
    const tutorial = creator({ slug: "ada", contentStyles: ["tutorial"] });
    const blank = creator({ slug: "ben" });
    const ugc = creator({ slug: "cara", commercialModes: ["ugc"] });
    const roster = [tutorial, blank, ugc];
    assert.deepEqual(
      filterCreators(roster, { contentStyle: "tutorial" }).map((row) => row.slug),
      ["ada"],
    );
    assert.deepEqual(
      filterCreators(roster, {}).map((row) => row.slug),
      ["ada", "ben", "cara"],
    );
    assert.deepEqual(filterCreators([tutorial, blank], { commercialMode: "ugc" }), []);
    assert.deepEqual(
      filterCreators([ugc], { commercialMode: "ugc" }).map((row) => row.slug),
      ["cara"],
    );
    assert.deepEqual(filterCreators([ugc], { commercialMode: "sponsorship" }), []);
  });

  it("filters the search index by the stored style and mode", () => {
    const filter = creatorIndexFilter({ contentStyle: "tutorial", commercialMode: "ugc" });
    assert.match(filter ?? "", /contentStyles = "tutorial"/);
    assert.match(filter ?? "", /commercialModes = "ugc"/);
    const document = creatorIndexDocument(creator({ contentStyles: ["tutorial"], commercialModes: ["ugc"] }));
    assert.deepEqual(document.contentStyles, ["tutorial"]);
    assert.deepEqual(document.commercialModes, ["ugc"]);
    const empty = creatorIndexDocument(creator());
    assert.deepEqual(empty.contentStyles, []);
    assert.deepEqual(empty.commercialModes, []);
  });

  it("applies the same style filter after an index hit list", () => {
    const hits = [creator({ slug: "ada", contentStyles: ["tutorial"] }), creator({ slug: "ben" })];
    assert.deepEqual(
      narrowIndexedCreators(hits, { contentStyle: "tutorial" }).map((row) => row.slug),
      ["ada"],
    );
  });

  it("restores stored facet slugs onto a claim draft", () => {
    const row = {
      id: "draft_ada",
      state: "DRAFT",
      inputHandle: "@ada",
      platform: "INSTAGRAM",
      draftSlug: "ada",
      email: null,
      ownerName: null,
      emailVerifiedAt: null,
      socialVerifiedAt: null,
      publishedAt: null,
      verifyMethod: "UNSENT",
      payload: {
        displayName: "Ada",
        contentStyles: ["Tutorial", "tutorial"],
        commercialModes: ["UGC"],
      },
      userId: null,
      createdAt: new Date("2026-10-12T00:00:00.000Z"),
      updatedAt: new Date("2026-10-12T00:00:00.000Z"),
    } as OnboardingSession;
    const restored = draftFromSession(row);
    assert.deepEqual(restored.contentStyles, ["tutorial"]);
    assert.deepEqual(restored.commercialModes, ["ugc"]);
  });

  it("does not invent a content style when the query omits one", () => {
    const filters = readFileSync("src/components/discover-filters.tsx", "utf8");
    const discover = readFileSync("src/app/discover/page.tsx", "utf8");
    const seed = readFileSync("src/lib/seed-data.ts", "utf8");
    const demo = readFileSync("src/lib/presentation-demo.ts", "utf8");
    const profileSave = readFileSync("src/app/claim/actions.ts", "utf8");
    const facetSave = readFileSync("src/app/dashboard/facet-actions.ts", "utf8");
    assert.match(filters, /name="contentStyle"/);
    assert.match(filters, /name="commercialMode"/);
    assert.match(discover, /name="contentStyle"/);
    assert.match(discover, /name="commercialMode"/);
    assert.equal(seed.includes('|| "tutorial"'), false);
    assert.equal(demo.includes("contentStyles"), false);
    const dashboardSave = profileSave.slice(
      profileSave.indexOf("export async function actionUpdateDashboardProfile"),
      profileSave.indexOf("export async function actionUpdateProfileMedia"),
    );
    assert.equal(dashboardSave.includes("contentStyle"), false);
    assert.equal(dashboardSave.includes("commercialMode"), false);
    assert.match(facetSave, /getAll\("contentStyle"\)/);
    assert.match(facetSave, /getAll\("commercialMode"\)/);
  });
});
