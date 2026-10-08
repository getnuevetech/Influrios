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
  const verified =
    query.verified === true || query.verified === "1" || query.verified === "true" || query.verified === "on";
  if (verified) parts.push("verified = true");
  return parts.length ? parts.join(" AND ") : undefined;
}

const ROLE_SYNONYMS: Record<string, string[]> = {
  creator: ["influencer", "content creator"],
  influencer: ["creator", "content creator"],
  "content creator": ["creator", "influencer"],
};

/** Role words plus taxonomy terms. Each term searches as its specialty slug, and the reverse. */
export function meiliSynonymMap(links: { term: string; slug: string }[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(ROLE_SYNONYMS)) map[key] = [...values];
  for (const link of links) {
    const term = link.term.trim().toLowerCase();
    const slug = link.slug.trim().toLowerCase();
    if (!term || !slug || term === slug) continue;
    map[slug] = [...new Set([...(map[slug] ?? []), term])];
    map[term] = [...new Set([...(map[term] ?? []), slug])];
  }
  return map;
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

async function finishTask(body: unknown, env: MeiliEnv, fetchImpl: typeof fetch) {
  const uid = body && typeof body === "object" && "taskUid" in body ? Number((body as { taskUid: number }).taskUid) : NaN;
  if (!Number.isFinite(uid)) return;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const task = await meili(`/tasks/${uid}`, { method: "GET" }, env, fetchImpl);
    const status = task && typeof task === "object" && "status" in task ? String((task as { status: string }).status) : "";
    if (status === "succeeded") return;
    if (status === "failed") throw new Error("Search index update failed.");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export async function ensureCreatorIndex(
  env: MeiliEnv = process.env,
  fetchImpl: typeof fetch = fetch,
  synonyms: { term: string; slug: string }[] = [],
) {
  if (!meiliConfigured(env)) throw new Error("MEILI_HOST is required.");
  await meili(`/indexes/${INDEX}`, { method: "POST", body: JSON.stringify({ uid: INDEX, primaryKey: "slug" }) }, env, fetchImpl).catch((error: Error) => {
    if (!/already exists|index_already_exists/i.test(error.message)) throw error;
  });
  const settings = await meili(
    `/indexes/${INDEX}/settings`,
    {
      method: "PATCH",
      body: JSON.stringify({
        searchableAttributes: ["displayName", "bio", "specialties", "languages", "locationCity", "locationCountry"],
        filterableAttributes: ["specialties", "locationCountry", "languages", "platforms", "planTier", "verified"],
        synonyms: meiliSynonymMap(synonyms),
      }),
    },
    env,
    fetchImpl,
  );
  await finishTask(settings, env, fetchImpl);
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
    verified: creator.verified === true,
    image: creator.image,
  };
}

export async function upsertCreatorDocument(
  creator: SeedCreator,
  env: MeiliEnv = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  if (!meiliConfigured(env)) return { indexed: false as const };
  const saved = await meili(
    `/indexes/${INDEX}/documents`,
    { method: "POST", body: JSON.stringify([creatorIndexDocument(creator)]) },
    env,
    fetchImpl,
  );
  await finishTask(saved, env, fetchImpl);
  return { indexed: true as const };
}

export async function deleteCreatorDocument(
  slug: string,
  env: MeiliEnv = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  if (!meiliConfigured(env)) return { indexed: false as const };
  const removed = await meili(
    `/indexes/${INDEX}/documents/${encodeURIComponent(slug)}`,
    { method: "DELETE" },
    env,
    fetchImpl,
  ).catch((error: Error) => {
    if (/404/.test(error.message)) return null;
    throw error;
  });
  if (removed) await finishTask(removed, env, fetchImpl);
  return { indexed: true as const };
}

export async function creatorIndexStats(
  env: MeiliEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<{ numberOfDocuments: number }> {
  if (!meiliConfigured(env)) throw new Error("MEILI_HOST is required.");
  const body = await meili(`/indexes/${INDEX}/stats`, { method: "GET" }, env, fetchImpl);
  const count =
    body && typeof body === "object" && "numberOfDocuments" in body
      ? Number((body as { numberOfDocuments: number }).numberOfDocuments)
      : 0;
  return { numberOfDocuments: Number.isFinite(count) ? count : 0 };
}

export async function replaceCreatorIndex(
  creators: SeedCreator[],
  synonyms: { term: string; slug: string }[],
  env: MeiliEnv = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  if (!meiliConfigured(env)) throw new Error("MEILI_HOST is required.");
  await meili(`/indexes/${INDEX}`, { method: "DELETE" }, env, fetchImpl).catch((error: Error) => {
    if (!/404|not found/i.test(error.message)) throw error;
  });
  await ensureCreatorIndex(env, fetchImpl, synonyms);
  if (!creators.length) return { indexed: 0 };
  const saved = await meili(
    `/indexes/${INDEX}/documents`,
    { method: "POST", body: JSON.stringify(creators.map(creatorIndexDocument)) },
    env,
    fetchImpl,
  );
  await finishTask(saved, env, fetchImpl);
  return { indexed: creators.length };
}

export async function pushIndexSynonyms(
  links: { term: string; slug: string }[],
  env: MeiliEnv = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  if (!meiliConfigured(env)) return { pushed: false as const };
  await ensureCreatorIndex(env, fetchImpl, links);
  const saved = await meili(
    `/indexes/${INDEX}/settings`,
    { method: "PATCH", body: JSON.stringify({ synonyms: meiliSynonymMap(links) }) },
    env,
    fetchImpl,
  );
  await finishTask(saved, env, fetchImpl);
  return { pushed: true as const, synonyms: meiliSynonymMap(links) };
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
