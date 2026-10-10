import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  CATEGORY_IMAGES,
  SPECIALTY_TAXONOMY,
  categoryImageFor,
  filterCreators,
  publicCategoryImage,
  publicStoredImage,
  uploadedImages,
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
  it("shows a shipped specialty photo and an uploaded replacement", () => {
    const images = SPECIALTY_TAXONOMY.map((parent) => categoryImageFor(parent.slug));
    assert.equal(images.length, SPECIALTY_TAXONOMY.length);
    assert.equal(new Set(images).size, SPECIALTY_TAXONOMY.length);
    for (const parent of SPECIALTY_TAXONOMY) {
      const shipped = publicCategoryImage(parent.slug, "");
      assert.match(CATEGORY_IMAGES[parent.slug] ?? "", /^\/demo\/categories\//);
      assert.equal(shipped, CATEGORY_IMAGES[parent.slug]);
      assert.equal(existsSync(path.join("public", shipped)), true);
      assert.equal(publicStoredImage(categoryImageFor(parent.slug)), "");
      assert.equal(publicCategoryImage(parent.slug, "/uploads/banners/beauty.jpg"), "/uploads/banners/beauty.jpg");
    }
    assert.equal(publicCategoryImage("not-a-specialty", ""), "");
    assert.equal(publicCategoryImage("beauty", "/demo/creators/creator-sofia.jpg"), CATEGORY_IMAGES.beauty);
    assert.equal(publicStoredImage("/uploads/banners/beauty.jpg"), "/uploads/banners/beauty.jpg");
    assert.deepEqual(
      uploadedImages(["/demo/categories/cat-beauty.jpg", "/uploads/banners/beauty.jpg", ""]),
      ["/uploads/banners/beauty.jpg"],
    );
  });
});
