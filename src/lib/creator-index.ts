import type { CreatorSearchQuery, SeedCreator } from "@/lib/seed-data";

const INDEX = "creators";

type MeiliEnv = {
  MEILI_HOST?: string;
  MEILI_API_KEY?: string;
  [key: string]: string | undefined;
};

export function meiliConfigured(env: MeiliEnv = process.env): boolean {
  return Boolean(env.MEILI_HOST?.trim());
}

function quote(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Meilisearch filter for the Discover query. Role synonyms are index settings, not filters. */
export function creatorIndexFilter(query: CreatorSearchQuery): string | undefined {
  const parts: string[] = [];
  const specialties = (Array.isArray(query.specialty) ? query.specialty : query.specialty ? [query.specialty] : [])
    .map((value) => value.trim())
    .filter(Boolean);
  if (specialties.length) parts.push(`(${specialties.map((value) => `specialties = ${quote(value)}`).join(" OR ")})`);
  const countries = (Array.isArray(query.country) ? query.country : query.country ? [query.country] : [])
    .map((value) => value.trim())
    .filter(Boolean);
  if (countries.length) parts.push(`(${countries.map((value) => `locationCountry = ${quote(value)}`).join(" OR ")})`);
  if (query.language?.trim()) parts.push(`languages = ${quote(query.language.trim())}`);
  const platforms = (Array.isArray(query.platform) ? query.platform : query.platform ? [query.platform] : [])
    .map((value) => value.trim())
    .filter(Boolean);
  if (platforms.length) parts.push(`(${platforms.map((value) => `platforms = ${quote(value)}`).join(" OR ")})`);
  return parts.length ? parts.join(" AND ") : undefined;
}

function host(env: MeiliEnv) {
  return (env.MEILI_HOST ?? "").replace(/\/$/, "");
}

async function meili(path: string, init: RequestInit, env: MeiliEnv, fetchImpl: typeof fetch) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (env.MEILI_API_KEY) headers.set("authorization", `Bearer ${env.MEILI_API_KEY}`);
  const response = await fetchImpl(`${host(env)}${path}`, { ...init, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Search index ${response.status}: ${text.slice(0, 200)}`);
  }
  return response.json() as Promise<unknown>;
}

export async function ensureCreatorIndex(env: MeiliEnv = process.env, fetchImpl: typeof fetch = fetch) {
  if (!meiliConfigured(env)) throw new Error("MEILI_HOST is required.");
  await meili(`/indexes/${INDEX}`, { method: "POST", body: JSON.stringify({ uid: INDEX, primaryKey: "slug" }) }, env, fetchImpl).catch((error: Error) => {
    if (!/already exists|index_already_exists/i.test(error.message)) throw error;
  });
  await meili(
    `/indexes/${INDEX}/settings`,
    {
      method: "PATCH",
      body: JSON.stringify({
        searchableAttributes: ["displayName", "bio", "specialties", "languages", "locationCity", "locationCountry"],
        filterableAttributes: ["specialties", "locationCountry", "languages", "platforms", "planTier"],
        synonyms: {
          creator: ["influencer", "content creator"],
          influencer: ["creator", "content creator"],
          "content creator": ["creator", "influencer"],
        },
      }),
    },
    env,
    fetchImpl,
  );
}

export function creatorIndexDocument(creator: SeedCreator) {
  return {
    slug: creator.slug,
    displayName: creator.displayName,
    bio: creator.bio,
    specialties: creator.specialties,
    languages: creator.languages,
    locationCity: creator.locationCity,
    locationCountry: creator.locationCountry,
    platforms: creator.socials.map((social) => social.platform),
    planTier: creator.planTier,
    image: creator.image,
  };
}

export async function upsertCreatorDocument(
  creator: SeedCreator,
  env: MeiliEnv = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  if (!meiliConfigured(env)) return { indexed: false as const };
  await meili(
    `/indexes/${INDEX}/documents`,
    { method: "POST", body: JSON.stringify([creatorIndexDocument(creator)]) },
    env,
    fetchImpl,
  );
  return { indexed: true as const };
}

export async function searchCreatorIndex(
  query: CreatorSearchQuery,
  env: MeiliEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<{ slugs: string[] }> {
  if (!meiliConfigured(env)) throw new Error("MEILI_HOST is required.");
  const filter = creatorIndexFilter(query);
  const body = await meili(
    `/indexes/${INDEX}/search`,
    {
      method: "POST",
      body: JSON.stringify({ q: query.q ?? "", filter, limit: 100 }),
    },
    env,
    fetchImpl,
  );
  const hits = (body as { hits?: { slug?: string }[] }).hits ?? [];
  return { slugs: hits.map((hit) => hit.slug).filter((slug): slug is string => Boolean(slug)) };
}
