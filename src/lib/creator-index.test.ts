import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { creatorIndexFilter, searchCreatorIndex, upsertCreatorDocument } from "./creator-index";
import type { SeedCreator } from "./seed-data";

describe("creator search index", () => {
  it("builds a specialty and country filter", () => {
    const filter = creatorIndexFilter({ specialty: ["beauty", "fashion"], country: "USA", language: "English" });
    assert.match(filter ?? "", /specialties = "beauty"/);
    assert.match(filter ?? "", /specialties = "fashion"/);
    assert.match(filter ?? "", /locationCountry = "USA"/);
    assert.match(filter ?? "", /languages = "English"/);
  });

  it("upserts and searches through the index client", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push(`${init?.method ?? "GET"} ${String(input)}`);
      if (String(input).endsWith("/search")) {
        return new Response(JSON.stringify({ hits: [{ slug: "sofia-martinez" }] }), { status: 200 });
      }
      return new Response("{}", { status: 202 });
    };
    const env = { MEILI_HOST: "http://meili:7700", MEILI_API_KEY: "key" };
    const creator = {
      slug: "sofia-martinez",
      displayName: "Sofia",
      bio: "Beauty",
      specialties: ["beauty"],
      languages: ["English"],
      locationCity: "Miami",
      locationCountry: "USA",
      socials: [{ platform: "INSTAGRAM", handle: "s", url: "https://example.com", followers: 1 }],
      planTier: "PRO",
      image: "/demo/creators/creator-sofia.jpg",
    } as SeedCreator;
    const saved = await upsertCreatorDocument(creator, env, fetchImpl);
    assert.equal(saved.indexed, true);
    const found = await searchCreatorIndex({ q: "beauty", specialty: "beauty" }, env, fetchImpl);
    assert.deepEqual(found.slugs, ["sofia-martinez"]);
    assert.ok(calls.some((call) => call.includes("/indexes/creators/search")));
  });

  it("refuses to search without MEILI_HOST", async () => {
    await assert.rejects(() => searchCreatorIndex({ q: "beauty" }, {}), /MEILI_HOST is required/);
  });
});
