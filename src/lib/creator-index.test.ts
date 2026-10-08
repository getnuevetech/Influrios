import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { creatorsInHitOrder } from "./creator-search";
import {
  creatorIndexFilter,
  deleteCreatorDocument,
  meiliSynonymMap,
  pushIndexSynonyms,
  searchCreatorIndex,
  upsertCreatorDocument,
} from "./creator-index";
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

  it("maps taxonomy terms and role synonyms", () => {
    const map = meiliSynonymMap([{ term: "woodwork", slug: "woodworking" }]);
    assert.ok(map.woodworking?.includes("woodwork"));
    assert.ok(map.woodwork?.includes("woodworking"));
    assert.ok(map.creator?.includes("influencer"));
  });

  it("pushes a taxonomy synonym change into index settings", async () => {
    const bodies: string[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      if (init?.body) bodies.push(String(init.body));
      return new Response("{}", { status: 202 });
    };
    const result = await pushIndexSynonyms(
      [{ term: "woodwork", slug: "woodworking" }],
      { MEILI_HOST: "http://meili:7700", MEILI_API_KEY: "key" },
      fetchImpl,
    );
    assert.equal(result.pushed, true);
    const patch = bodies
      .map((body) => JSON.parse(body) as { synonyms?: Record<string, string[]> })
      .find((body) => body.synonyms?.woodwork);
    assert.ok(patch?.synonyms?.woodwork?.includes("woodworking"));
    assert.ok(patch?.synonyms?.creator?.includes("influencer"));
  });

  it("drops a deleted creator from the next search", async () => {
    const docs = new Map<string, { slug: string }>([
      ["sofia-martinez", { slug: "sofia-martinez" }],
      ["gone", { slug: "gone" }],
    ]);
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "DELETE" && url.includes("/documents/")) {
        const slug = decodeURIComponent(url.split("/documents/")[1] ?? "");
        docs.delete(slug);
        return new Response("{}", { status: 202 });
      }
      if (url.endsWith("/search")) {
        return new Response(JSON.stringify({ hits: [...docs.values()] }), { status: 200 });
      }
      return new Response("{}", { status: 202 });
    };
    const env = { MEILI_HOST: "http://meili:7700", MEILI_API_KEY: "key" };
    await deleteCreatorDocument("gone", env, fetchImpl);
    const found = await searchCreatorIndex({ q: "" }, env, fetchImpl);
    assert.deepEqual(found.slugs, ["sofia-martinez"]);
  });

  it("omits a slug that is no longer a public creator", () => {
    const ordered = creatorsInHitOrder([{ slug: "sofia-martinez" } as SeedCreator], ["gone", "sofia-martinez"]);
    assert.deepEqual(
      ordered.map((creator) => creator.slug),
      ["sofia-martinez"],
    );
  });

  it("does not fill Discover from the sample creator list", () => {
    const source = readFileSync("src/lib/directory.ts", "utf8");
    assert.equal(source.includes("SEED_CREATORS"), false);
    assert.equal(source.includes("filterCreators"), false);
  });
});
