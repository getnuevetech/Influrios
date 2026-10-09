import type { Prisma } from "@prisma/client";
import { listPublishedClaimCreators } from "@/lib/claim";
import { prisma } from "@/lib/db";
import { rethrowIfNextDynamicError } from "@/lib/next-dynamic";
import { isPlanCode } from "@/lib/entitlements";
import {
  defaultAvatarForGender,
  defaultBannerForSeed,
  normalizeProfileGender,
} from "@/lib/profile-media";
import {
  SPECIALTY_TAXONOMY,
  languageOptionsFor,
  locationOptionsFor,
  type CreatorSearchQuery,
  type SeedCreator,
  type SeedSocial,
} from "@/lib/seed-data";
import type { SynonymLink } from "@/lib/taxonomy";

const CACHE_MS = 5_000;

export type TaxonomyNode = {
  slug: string;
  name: string;
  active: boolean;
  children: { slug: string; name: string; active: boolean }[];
};

export type MenuItem = { id: string; menu: string; label: string; href: string; sortOrder: number; visible: boolean };

export type HomepageSection = {
  id: string;
  key: string;
  title: string;
  sortOrder: number;
  enabled: boolean;
  status: "draft" | "published";
  updatedBy: string | null;
};

export const DEFAULT_HOMEPAGE_SECTIONS: Omit<HomepageSection, "id" | "updatedBy">[] = [
  { key: "hero", title: "Hero", sortOrder: 0, enabled: true, status: "published" },
  { key: "categories", title: "Categories", sortOrder: 1, enabled: true, status: "published" },
  { key: "featured", title: "Featured influencers", sortOrder: 2, enabled: true, status: "published" },
  { key: "sponsored", title: "Sponsored", sortOrder: 3, enabled: true, status: "published" },
  { key: "value_proposition", title: "Value proposition", sortOrder: 4, enabled: true, status: "published" },
  { key: "collaboration", title: "Collaboration matches", sortOrder: 5, enabled: true, status: "published" },
  { key: "card_promo", title: "Influencer Card", sortOrder: 6, enabled: true, status: "published" },
  { key: "cta", title: "Closing call to action", sortOrder: 7, enabled: true, status: "published" },
  { key: "statistics", title: "Statistics", sortOrder: 8, enabled: false, status: "draft" },
  { key: "faq", title: "FAQ", sortOrder: 9, enabled: false, status: "draft" },
];

export const DEFAULT_MENUS: { menu: string; label: string; href: string; sortOrder: number }[] = [
  { menu: "header", label: "Home", href: "/", sortOrder: 0 },
  { menu: "header", label: "Discover", href: "/discover", sortOrder: 1 },
  { menu: "header", label: "Categories", href: "/categories", sortOrder: 2 },
  { menu: "header", label: "Collaboration", href: "/collaboration", sortOrder: 3 },
  { menu: "header", label: "For Businesses", href: "/business", sortOrder: 4 },
  { menu: "header", label: "Pricing", href: "/pricing", sortOrder: 5 },
  { menu: "footer_platform", label: "Home", href: "/", sortOrder: 0 },
  { menu: "footer_platform", label: "Discover", href: "/discover", sortOrder: 1 },
  { menu: "footer_platform", label: "Collaboration", href: "/collaboration", sortOrder: 2 },
  { menu: "footer_platform", label: "Influencer Card", href: "/card", sortOrder: 3 },
];

const DEFAULT_SYNONYMS = [
  { term: "woodwork", slug: "woodworking" },
  { term: "makeup-artist", slug: "makeup" },
];

type Cache = {
  at: number;
  creators: SeedCreator[];
  taxonomy: TaxonomyNode[];
  synonyms: SynonymLink[];
  sections: HomepageSection[];
  menus: MenuItem[];
};

let cache: Cache | null = null;

export function invalidateDirectoryCache() {
  cache = null;
}

/** Directory cards do not invent a rank. The status line follows the stored open-to-collab flag. */
export function directoryLabels(openToCollab: boolean): { badge: string; statusLabel: string } {
  return {
    badge: "",
    statusLabel: openToCollab ? "Open to partnerships" : "Not open to partnerships",
  };
}

/** City and country from the stored profile. A blank side is omitted. */
export function profilePlace(city: string, country: string): string {
  return [city.trim(), country.trim()].filter(Boolean).join(", ");
}

function isCreatorPlan(plan: string): plan is "STARTER" | "PLUS" | "PRO" {
  return isPlanCode(plan);
}

function blankCreator(slug: string, name: string): SeedCreator {
  return {
    slug,
    displayName: name,
    title: "",
    bio: "",
    locationCity: "",
    locationCountry: "",
    languages: [],
    avatarColor: "#633CFF",
    image: "/brand/avatars/generic.png",
    coverImage: "/brand/banners/rooftop-crew.png",
    gender: "unspecified",
    badge: "",
    statusLabel: "",
    planTier: "STARTER",
    specialties: [],
    socials: [],
    openToCollab: true,
  };
}

type DirectoryRow = Prisma.CreatorGetPayload<{
  include: {
    specialties: { include: { specialty: true } };
    socialAccounts: true;
  };
}>;

function mergeCreator(row: DirectoryRow): SeedCreator {
  const gender = normalizeProfileGender(row.gender);
  const specialties = [...row.specialties]
    .filter((link) => link.specialty.active)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
    .map((link) => link.specialty.slug);
  const socials: SeedSocial[] = row.socialAccounts.map((social) => ({
    platform: social.platform as SeedSocial["platform"],
    handle: social.handle,
    url: social.url,
    followers: social.followers ?? 0,
  }));
  const planTier = isCreatorPlan(row.planTier) ? row.planTier : "STARTER";
  const avatar = row.avatarUrl && !row.avatarUrl.includes("/demo/creators/") ? row.avatarUrl : defaultAvatarForGender(gender);
  const cover = row.coverUrl && !row.coverUrl.includes("/demo/sofia/") ? row.coverUrl : defaultBannerForSeed(row.slug);
  return {
    ...blankCreator(row.slug, row.displayName),
    slug: row.slug,
    displayName: row.displayName,
    title: row.title ?? "",
    bio: row.bio ?? "",
    locationCity: row.locationCity ?? "",
    locationCountry: row.locationCountry ?? "",
    languages: row.languages,
    planTier,
    specialties,
    socials,
    openToCollab: row.openToCollab,
    ...directoryLabels(row.openToCollab),
    image: avatar,
    coverImage: cover,
    gender,
    verified: row.identityVerified === "VERIFIED",
  };
}

async function ensureSpecialties() {
  const rows = await prisma.specialty.findMany({ select: { id: true, slug: true } });
  const bySlug = new Map(rows.map((row) => [row.slug, row.id]));
  for (const [index, parent] of SPECIALTY_TAXONOMY.entries()) {
    let parentId = bySlug.get(parent.slug);
    if (!parentId) {
      try {
        const created = await prisma.specialty.create({
          data: { slug: parent.slug, name: parent.name, sortOrder: index, active: true },
        });
        parentId = created.id;
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        if (code !== "P2002") throw error;
        const existing = await prisma.specialty.findUnique({ where: { slug: parent.slug } });
        if (!existing) throw error;
        parentId = existing.id;
      }
      bySlug.set(parent.slug, parentId);
    }
    for (const [childIndex, child] of (parent.children ?? []).entries()) {
      if (bySlug.has(child.slug)) continue;
      try {
        const created = await prisma.specialty.create({
          data: {
            slug: child.slug,
            name: child.name,
            parentId,
            sortOrder: childIndex,
            active: true,
          },
        });
        bySlug.set(child.slug, created.id);
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        if (code !== "P2002") throw error;
        const existing = await prisma.specialty.findUnique({ where: { slug: child.slug } });
        if (!existing) throw error;
        bySlug.set(child.slug, existing.id);
      }
    }
  }
}

async function ensureDirectory() {
  await ensureSpecialties();

  const sectionKeys = new Set((await prisma.cmsSection.findMany({ select: { key: true } })).map((row) => row.key));
  for (const section of DEFAULT_HOMEPAGE_SECTIONS) {
    if (sectionKeys.has(section.key)) continue;
    try {
      await prisma.cmsSection.create({ data: section });
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code !== "P2002") throw error;
    }
  }

  if ((await prisma.siteMenuItem.count()) === 0) {
    await prisma.siteMenuItem.createMany({ data: DEFAULT_MENUS });
  }

  if ((await prisma.specialtySynonym.count()) === 0) {
    for (const synonym of DEFAULT_SYNONYMS) {
      const specialty = await prisma.specialty.findUnique({ where: { slug: synonym.slug } });
      if (!specialty) continue;
      await prisma.specialtySynonym.create({
        data: { term: synonym.term, specialtyId: specialty.id },
      });
    }
  }

  await linkOfferNeedsToPrimarySpecialty();
}

async function linkOfferNeedsToPrimarySpecialty() {
  const [offers, needs] = await Promise.all([
    prisma.collaborationOffer.findMany({
      where: { specialtyId: null },
      include: { creator: { include: { specialties: { orderBy: { isPrimary: "desc" }, take: 1 } } } },
    }),
    prisma.collaborationNeed.findMany({
      where: { specialtyId: null },
      include: { creator: { include: { specialties: { orderBy: { isPrimary: "desc" }, take: 1 } } } },
    }),
  ]);
  for (const offer of offers) {
    const specialtyId = offer.creator.specialties[0]?.specialtyId;
    if (!specialtyId) continue;
    await prisma.collaborationOffer.update({ where: { id: offer.id }, data: { specialtyId } });
  }
  for (const need of needs) {
    const specialtyId = need.creator.specialties[0]?.specialtyId;
    if (!specialtyId) continue;
    await prisma.collaborationNeed.update({ where: { id: need.id }, data: { specialtyId } });
  }
}

async function readDirectory(): Promise<Cache> {
  await ensureDirectory();
  const [rows, specialties, synonymRows, sections, menus] = await Promise.all([
    prisma.creator.findMany({
      where: { profileState: { not: "RESTRICTED" } },
      include: { specialties: { include: { specialty: true } }, socialAccounts: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.specialty.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.specialtySynonym.findMany({ include: { specialty: true } }),
    prisma.cmsSection.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.siteMenuItem.findMany({ orderBy: [{ menu: "asc" }, { sortOrder: "asc" }] }),
  ]);

  const dbCreators = rows.map(mergeCreator);
  const slugs = new Set(dbCreators.map((creator) => creator.slug));
  let claims: SeedCreator[] = [];
  try {
    claims = (await listPublishedClaimCreators()).filter((creator) => !slugs.has(creator.slug));
  } catch {
    claims = [];
  }

  const parents = specialties.filter((row) => !row.parentId);
  const taxonomy: TaxonomyNode[] = parents.map((parent) => ({
    slug: parent.slug,
    name: parent.name,
    active: parent.active,
    children: specialties
      .filter((child) => child.parentId === parent.id)
      .map((child) => ({ slug: child.slug, name: child.name, active: child.active })),
  }));

  return {
    at: Date.now(),
    creators: [...dbCreators, ...claims],
    taxonomy,
    synonyms: synonymRows.map((row) => ({ term: row.term, slug: row.specialty.slug })),
    sections: sections.map((section) => ({
      id: section.id,
      key: section.key,
      title: section.title,
      sortOrder: section.sortOrder,
      enabled: section.enabled,
      status: section.status === "draft" ? "draft" : "published",
      updatedBy: section.updatedBy,
    })),
    menus: menus.map((item) => ({
      id: item.id,
      menu: item.menu,
      label: item.label,
      href: item.href,
      sortOrder: item.sortOrder,
      visible: item.visible,
    })),
  };
}

export async function getDirectory(): Promise<Cache> {
  try {
    const { connection } = await import("next/server");
    await connection();
  } catch (error) {
    rethrowIfNextDynamicError(error);
    // Scripts and unit tests have no request scope.
  }
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  try {
    cache = await readDirectory();
    return cache;
  } catch (error) {
    console.error("directory: postgres read failed", error);
    throw error;
  }
}

export async function getDirectoryCreator(slug: string): Promise<SeedCreator | null> {
  const directory = await getDirectory();
  return directory.creators.find((creator) => creator.slug === slug) ?? null;
}

/** Product read API — every match, picker, and ranking path should use this (or getDirectoryCreator). */
export async function listDirectoryCreators(): Promise<SeedCreator[]> {
  const directory = await getDirectory();
  return directory.creators;
}

export async function directoryHasCreator(slug: string): Promise<boolean> {
  return Boolean(await getDirectoryCreator(slug));
}

export { indexCreatorsBySlug } from "@/lib/seed-data";

export async function loadPublicCreator(slug: string): Promise<SeedCreator | null> {
  const row = await prisma.creator.findUnique({
    where: { slug },
    include: { specialties: { include: { specialty: true } }, socialAccounts: true },
  });
  if (!row || row.profileState === "RESTRICTED") return null;
  return mergeCreator(row);
}

export async function searchDirectory(query: CreatorSearchQuery) {
  const directory = await getDirectory();
  const { searchIndexedCreators } = await import("@/lib/creator-search");
  return searchIndexedCreators(query, directory);
}

export async function publicTaxonomy() {
  const directory = await getDirectory();
  return directory.taxonomy
    .filter((node) => node.active)
    .map((node) => ({
      ...node,
      children: node.children.filter((child) => child.active),
    }));
}

export async function directoryLocations() {
  const directory = await getDirectory();
  return locationOptionsFor(directory.creators);
}

export async function directoryLanguages() {
  const directory = await getDirectory();
  return languageOptionsFor(directory.creators);
}

export async function recordDirectoryEvent(
  eventType: string,
  meta: Record<string, unknown>,
  creatorId?: string | null,
) {
  try {
    const { canonicalDirectoryEvent, withLegacyEventMeta } = await import("@/lib/terminology-events");
    const canonical = canonicalDirectoryEvent(eventType);
    await prisma.analyticsEvent.create({
      data: {
        eventType: canonical,
        metaJson: withLegacyEventMeta(eventType, meta) as Prisma.InputJsonValue,
        creatorId: creatorId ?? undefined,
      },
    });
  } catch (error) {
    console.error("analytics event failed", error);
  }
}

export async function updateSpecialtyActive(input: { actor: string; slug: string; active: boolean }) {
  const before = await prisma.specialty.findUnique({ where: { slug: input.slug } });
  if (!before) throw new Error("Specialty not found");
  const after = await prisma.specialty.update({
    where: { slug: input.slug },
    data: { active: input.active },
  });
  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: "taxonomy.active",
      objectType: "Specialty",
      objectId: after.id,
      before: { active: before.active },
      after: { active: after.active },
    },
  });
  invalidateDirectoryCache();
}

export async function addSpecialtySynonym(input: { actor: string; slug: string; term: string }) {
  const term = input.term.toLowerCase().trim().replace(/\s+/g, "-");
  if (!term) throw new Error("Term required");
  const specialty = await prisma.specialty.findUnique({ where: { slug: input.slug } });
  if (!specialty) throw new Error("Specialty not found");
  const row = await prisma.specialtySynonym.create({
    data: { term, specialtyId: specialty.id },
  });
  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: "taxonomy.synonym_add",
      objectType: "SpecialtySynonym",
      objectId: row.id,
      after: { term, slug: input.slug },
    },
  });
  invalidateDirectoryCache();
  const { pushTaxonomySynonyms } = await import("@/lib/creator-search");
  await pushTaxonomySynonyms();
}

export async function removeSpecialtySynonym(input: { actor: string; id: string }) {
  const row = await prisma.specialtySynonym.delete({ where: { id: input.id } });
  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: "taxonomy.synonym_remove",
      objectType: "SpecialtySynonym",
      objectId: row.id,
      before: { term: row.term },
    },
  });
  invalidateDirectoryCache();
  const { pushTaxonomySynonyms } = await import("@/lib/creator-search");
  await pushTaxonomySynonyms();
}

export async function updateHomepageSection(input: {
  actor: string;
  key: string;
  sortOrder: number;
  enabled: boolean;
  status: "draft" | "published";
}) {
  const before = await prisma.cmsSection.findUnique({ where: { key: input.key } });
  if (!before) throw new Error("Section not found");
  const after = await prisma.cmsSection.update({
    where: { key: input.key },
    data: {
      sortOrder: input.sortOrder,
      enabled: input.enabled,
      status: input.status,
      updatedBy: input.actor,
    },
  });
  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: "cms.section_update",
      objectType: "CmsSection",
      objectId: after.id,
      before: { sortOrder: before.sortOrder, enabled: before.enabled, status: before.status },
      after: { sortOrder: after.sortOrder, enabled: after.enabled, status: after.status },
    },
  });
  invalidateDirectoryCache();
}

export async function updateMenuItem(input: {
  actor: string;
  id: string;
  label: string;
  href: string;
  sortOrder: number;
  visible: boolean;
}) {
  const before = await prisma.siteMenuItem.findUnique({ where: { id: input.id } });
  if (!before) throw new Error("Menu item not found");
  const after = await prisma.siteMenuItem.update({
    where: { id: input.id },
    data: {
      label: input.label,
      href: input.href,
      sortOrder: input.sortOrder,
      visible: input.visible,
    },
  });
  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: "cms.menu_update",
      objectType: "SiteMenuItem",
      objectId: after.id,
      before: { label: before.label, href: before.href, sortOrder: before.sortOrder, visible: before.visible },
      after: { label: after.label, href: after.href, sortOrder: after.sortOrder, visible: after.visible },
    },
  });
  invalidateDirectoryCache();
}
