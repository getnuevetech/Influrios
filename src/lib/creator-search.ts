import { prisma } from "@/lib/db";
import {
  creatorIndexStats,
  deleteCreatorDocument,
  replaceCreatorIndex,
  searchCreatorIndex,
  upsertCreatorDocument,
  pushIndexSynonyms,
} from "@/lib/creator-index";
import { loadMeiliConfig } from "@/lib/search-settings";
import { filterCreators, type CreatorSearchQuery, type SeedCreator } from "@/lib/seed-data";
import { canonicalSpecialty } from "@/lib/taxonomy";

export const SEARCH_HOST_ERROR = "Save a Meilisearch host in admin or set MEILI_HOST. Nothing was searched.";

type DirectorySlice = {
  creators: SeedCreator[];
  synonyms: { term: string; slug: string }[];
};

function envFrom(config: { host: string; apiKey: string }) {
  return { MEILI_HOST: config.host, MEILI_API_KEY: config.apiKey };
}

/** Keep Meilisearch hit order and drop slugs that are no longer a public creator. */
export function creatorsInHitOrder(creators: SeedCreator[], slugs: string[]): SeedCreator[] {
  const bySlug = new Map(creators.map((creator) => [creator.slug, creator]));
  return slugs.flatMap((slug) => {
    const creator = bySlug.get(slug);
    return creator ? [creator] : [];
  });
}

/** Followers, city, and sort stay on the hit list. Text and specialty already ran in the index. */
export function narrowIndexedCreators(creators: SeedCreator[], query: CreatorSearchQuery): SeedCreator[] {
  return filterCreators(creators, {
    followersMin: query.followersMin,
    followersMax: query.followersMax,
    engagementMin: query.engagementMin,
    engagementMax: query.engagementMax,
    city: query.city,
    state: query.state,
    location: query.location,
    openToCollab: query.openToCollab,
    collabType: query.collabType,
    rate: query.rate,
    sort: query.sort,
  });
}

let filledEmptyIndex = false;

export async function searchIndexedCreators(query: CreatorSearchQuery, directory: DirectorySlice): Promise<SeedCreator[]> {
  const config = await loadMeiliConfig();
  if (!config) throw new Error(SEARCH_HOST_ERROR);
  const env = envFrom(config);
  let documents = 0;
  try {
    documents = (await creatorIndexStats(env)).numberOfDocuments;
  } catch {
    documents = 0;
  }
  if (!filledEmptyIndex && documents === 0 && directory.creators.length > 0) {
    await reindexCreatorsAndRecord();
    filledEmptyIndex = true;
  }
  const specialties = (Array.isArray(query.specialty) ? query.specialty : query.specialty ? [query.specialty] : []).map(
    (value) => canonicalSpecialty(value, directory.synonyms) ?? value,
  );
  const q = query.q ? canonicalSpecialty(query.q, directory.synonyms) ?? query.q : query.q;
  const indexed = await searchCreatorIndex({ ...query, specialty: specialties, q }, env);
  return narrowIndexedCreators(creatorsInHitOrder(directory.creators, indexed.slugs), query);
}

export async function reindexCreators() {
  const config = await loadMeiliConfig();
  if (!config) throw new Error(SEARCH_HOST_ERROR);
  const { getDirectory } = await import("@/lib/directory");
  const directory = await getDirectory();
  const replaced = await replaceCreatorIndex(directory.creators, directory.synonyms, envFrom(config));
  filledEmptyIndex = true;
  return { postgresCount: directory.creators.length, indexed: replaced.indexed };
}

export async function reindexCreatorsAndRecord() {
  try {
    const result = await reindexCreators();
    await prisma.job
      .create({
        data: {
          kind: "reindex_creators",
          status: "succeeded",
          payload: result,
        },
      })
      .catch(() => undefined);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The search index was not rebuilt.";
    await prisma.job
      .create({
        data: {
          kind: "reindex_creators",
          status: "failed",
          lastError: message,
          payload: {},
        },
      })
      .catch(() => undefined);
    throw error;
  }
}

export async function syncCreatorSearch(slug: string) {
  const clean = slug.trim();
  if (!clean) return;
  try {
    const config = await loadMeiliConfig();
    if (!config) return;
    const { loadPublicCreator, invalidateDirectoryCache } = await import("@/lib/directory");
    invalidateDirectoryCache();
    const creator = await loadPublicCreator(clean);
    const env = envFrom(config);
    if (!creator) await deleteCreatorDocument(clean, env);
    else await upsertCreatorDocument(creator, env);
  } catch (error) {
    console.error("creator index sync", error);
  }
}

export async function pushTaxonomySynonyms() {
  try {
    const config = await loadMeiliConfig();
    if (!config) return;
    const rows = await prisma.specialtySynonym.findMany({ include: { specialty: { select: { slug: true } } } });
    await pushIndexSynonyms(
      rows.map((row) => ({ term: row.term, slug: row.specialty.slug })),
      envFrom(config),
    );
  } catch (error) {
    console.error("search synonyms", error);
  }
}

export async function searchIndexStatus() {
  const config = await loadMeiliConfig();
  const postgresCount = await prisma.creator.count({ where: { profileState: { not: "RESTRICTED" } } });
  let indexCount: number | null = null;
  if (config) {
    try {
      indexCount = (await creatorIndexStats(envFrom(config))).numberOfDocuments;
    } catch {
      indexCount = null;
    }
  }
  const last = await prisma.job.findFirst({
    where: { kind: "reindex_creators" },
    orderBy: { createdAt: "desc" },
  });
  return {
    postgresCount,
    indexCount,
    host: config?.host ?? "",
    lastStatus: last?.status ?? null,
    lastReindexAt: last?.updatedAt ?? null,
    lastError: last?.lastError ?? null,
  };
}
