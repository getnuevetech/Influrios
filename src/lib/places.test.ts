import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalPlaceName, samePlace } from "./place-names";
import { countryCount, searchCities, searchCountries } from "./places";
import { SEED_CREATORS, filterCreators } from "./seed-data";

describe("place names", () => {
  it("treats USA and UK as the catalog countries", () => {
    assert.equal(canonicalPlaceName("USA"), "united states");
    assert.equal(canonicalPlaceName("U.K."), "united kingdom");
    assert.equal(samePlace("South Korea", "south korea"), true);
  });
});

describe("place search", () => {
  it("covers the world and lets a country limit the cities", () => {
    assert.ok(countryCount() >= 240);
    const nigeria = searchCountries("nige");
    assert.ok(nigeria.some((hit) => hit.name === "Nigeria"));
    const lagos = searchCities("lag", "Nigeria");
    assert.ok(lagos.some((hit) => hit.name === "Lagos" && hit.country === "Nigeria"));
    const lagosInFrance = searchCities("lag", "France");
    assert.equal(lagosInFrance.some((hit) => hit.name === "Lagos" && hit.country === "Nigeria"), false);
    const paris = searchCities("paris");
    assert.equal(paris[0]?.name, "Paris");
    assert.ok(paris.some((hit) => hit.name === "Paris" && hit.country === "France"));
    assert.ok(paris.findIndex((hit) => hit.name === "Paris") < paris.findIndex((hit) => hit.name === "Parisi"));
  });

  it("matches a United States filter to a profile stored as USA", () => {
    const matched = filterCreators(SEED_CREATORS, { country: ["United States"], city: "Los Angeles" });
    assert.ok(matched.some((creator) => creator.slug === "sofia-martinez"));
    const london = filterCreators(SEED_CREATORS, { country: ["United Kingdom"] });
    assert.ok(london.some((creator) => creator.locationCity === "London"));
    assert.equal(london.some((creator) => creator.locationCountry === "USA"), false);
  });
});
