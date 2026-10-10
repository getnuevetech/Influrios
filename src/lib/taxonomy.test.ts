import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CATEGORY_IMAGES,
  SPECIALTY_TAXONOMY,
  categoryImageFor,
  filterCreators,
  publicCategoryImage,
  publicNicheImage,
  publicStoredImage,
  nicheImageForMatchTitle,
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
  it("keeps retired category photos off the public page", () => {
    const images = SPECIALTY_TAXONOMY.map((parent) => categoryImageFor(parent.slug));
    assert.equal(images.length, SPECIALTY_TAXONOMY.length);
    assert.equal(new Set(images).size, SPECIALTY_TAXONOMY.length);
    for (const parent of SPECIALTY_TAXONOMY) {
      assert.match(CATEGORY_IMAGES[parent.slug] ?? "", /^\/demo\/categories\//);
      assert.equal(publicStoredImage(categoryImageFor(parent.slug)), "");
      assert.equal(publicCategoryImage(parent.slug), categoryImageFor(parent.slug));
      assert.equal(publicNicheImage(categoryImageFor(parent.slug)), categoryImageFor(parent.slug));
    }
    assert.equal(publicStoredImage("/uploads/banners/beauty.jpg"), "/uploads/banners/beauty.jpg");
    assert.equal(publicCategoryImage("beauty", "/uploads/banners/beauty.jpg"), "/uploads/banners/beauty.jpg");
    assert.equal(publicNicheImage("/demo/creators/creator-sofia.jpg"), "");
    assert.equal(publicNicheImage("/demo/cta-community.jpg"), "");
    assert.equal(nicheImageForMatchTitle("Interior Designer + Woodwork Influencer"), "/demo/categories/cat-home.jpg");
    assert.equal(nicheImageForMatchTitle("Custom pair"), "");
  });
});
