import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  CATEGORY_IMAGES,
  SPECIALTY_TAXONOMY,
  categoryImageFor,
  filterCreators,
  type SeedCreator,
} from "./seed-data";
import { canonicalSpecialty } from "./taxonomy";

const synonyms = [
  { term: "woodwork", slug: "woodworking" },
  { term: "makeup-artist", slug: "makeup" },
];

const creators: SeedCreator[] = [
  {
    slug: "ada",
    displayName: "Ada",
    title: "Maker",
    bio: "Builds rooms",
    locationCity: "Austin",
    locationCountry: "USA",
    languages: ["English"],
    avatarColor: "#111",
    image: "/ada.jpg",
    badge: "Rising Star",
    statusLabel: "Open",
    planTier: "STARTER",
    specialties: ["woodworking"],
    socials: [],
    openToCollab: true,
    verified: true,
  },
];

describe("taxonomy synonyms", () => {
  it("resolves an alias to the specialty slug", () => {
    assert.equal(canonicalSpecialty("Woodwork", synonyms), "woodworking");
    assert.equal(canonicalSpecialty("woodworking", synonyms), "woodworking");
    assert.equal(canonicalSpecialty("beauty", synonyms), "beauty");
  });

  it("matches creators when the query uses the alias", () => {
    const specialty = canonicalSpecialty("woodwork", synonyms);
    const found = filterCreators(creators, { specialty }, synonyms);
    assert.deepEqual(found.map((c) => c.slug), ["ada"]);
  });
});

describe("category images", () => {
  it("maps every parent specialty to a distinct on-disk image", () => {
    const images = SPECIALTY_TAXONOMY.map((parent) => categoryImageFor(parent.slug));
    assert.equal(images.length, SPECIALTY_TAXONOMY.length);
    assert.equal(new Set(images).size, SPECIALTY_TAXONOMY.length);
    for (const parent of SPECIALTY_TAXONOMY) {
      assert.ok(CATEGORY_IMAGES[parent.slug], `missing CATEGORY_IMAGES entry for ${parent.slug}`);
      const relative = CATEGORY_IMAGES[parent.slug]!;
      assert.ok(
        existsSync(join(process.cwd(), "public", relative.replace(/^\//, ""))),
        `missing file for ${parent.slug}: ${relative}`,
      );
    }
  });
});
