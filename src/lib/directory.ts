import type { PlanTier, Prisma, SocialPlatform } from "@prisma/client";
import { listPublishedClaimCreators } from "@/lib/claim";
import { toPublicProfile } from "@/lib/onboarding";
import { prisma } from "@/lib/db";
import { isPlanCode } from "@/lib/entitlements";
import {
  SEED_CREATORS,
  SPECIALTY_TAXONOMY,
  filterCreators,
  languageOptionsFor,
  locationOptionsFor,
  type CreatorSearchQuery,
  type SeedCreator,
  type SeedSocial,
} from "@/lib/seed-data";
import { canonicalSpecialty, type SynonymLink } from "@/lib/taxonomy";

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

const DEFAULT_MENUS: { menu: string; label: string; href: string; sortOrder: number }[] = [
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

function isCreatorPlan(plan: PlanTier): plan is "STARTER" | "PLUS" | "PRO" {
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
    image: "/demo/creators/creator-sofia.jpg",
    badge: "Rising Star",
    statusLabel: "Open to partnerships",
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
  const seed = SEED_CREATORS.find((creator) => creator.slug === row.slug);
  const base = seed ?? blankCreator(row.slug, row.displayName);
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
  const publicBase = toPublicProfile(base);
  return {
    ...publicBase,
    slug: row.slug,
    displayName: row.displayName,
    title: row.title || base.title,
    bio: row.bio || base.bio,
    locationCity: row.locationCity || base.locationCity,
    locationCountry: row.locationCountry || base.locationCountry,
    languages: row.languages.length ? row.languages : base.languages,
    planTier,
    specialties: specialties.length ? specialties : base.specialties,
    socials: socials.length ? socials : base.socials,
    openToCollab: row.openToCollab,
    image: base.image || row.avatarUrl || blankCreator(row.slug, row.displayName).image,
    verified: row.profileState === "VERIFIED" || row.identityVerified === "VERIFIED" ? true : base.verified,
  };
}

function fallbackSnapshot(): Cache {
  const taxonomy: TaxonomyNode[] = SPECIALTY_TAXONOMY.map((parent) => ({
    slug: parent.slug,
    name: parent.name,
    active: true,
    children: (parent.children ?? []).map((child) => ({ ...child, active: true })),
  }));
  return {
    at: Date.now(),
    creators: SEED_CREATORS.map((creator) => toPublicProfile(creator)),
    taxonomy,
    synonyms: DEFAULT_SYNONYMS,
    sections: DEFAULT_HOMEPAGE_SECTIONS.map((section, index) => ({
      ...section,
      id: `fallback-${section.key}`,
      updatedBy: null,
      sortOrder: index,
    })),
    menus: DEFAULT_MENUS.map((item, index) => ({ ...item, id: `fallback-${index}`, visible: true })),
  };
}

async function ensureDirectory() {
  const specialtyCount = await prisma.specialty.count();
  if (specialtyCount === 0) {
    for (const [index, parent] of SPECIALTY_TAXONOMY.entries()) {
      const created = await prisma.specialty.upsert({
        where: { slug: parent.slug },
        update: {},
        create: { slug: parent.slug, name: parent.name, sortOrder: index, active: true },
      });
      for (const [childIndex, child] of (parent.children ?? []).entries()) {
        await prisma.specialty.upsert({
          where: { slug: child.slug },
          update: {},
          create: {
            slug: child.slug,
            name: child.name,
            parentId: created.id,
            sortOrder: childIndex,
            active: true,
          },
        });
      }
    }
  }

  if ((await prisma.creator.count()) === 0) {
    const specialties = await prisma.specialty.findMany();
    const specialtyIds = new Map(specialties.map((row) => [row.slug, row.id]));
    for (const creator of SEED_CREATORS) {
      const row = await prisma.creator.create({
        data: {
          slug: creator.slug,
          displayName: creator.displayName,
          title: creator.title,
          bio: creator.bio,
          locationCity: creator.locationCity,
          locationCountry: creator.locationCountry,
          languages: creator.languages,
          avatarUrl: creator.image,
          coverUrl: creator.coverImage,
          planTier: creator.planTier,
          openToCollab: creator.openToCollab,
          claimed: false,
          profileState: "UNCLAIMED",
        },
      });
      for (const [index, slug] of creator.specialties.entries()) {
        const specialtyId = specialtyIds.get(slug);
        if (!specialtyId) continue;
        await prisma.creatorSpecialty.create({
          data: { creatorId: row.id, specialtyId, isPrimary: index === 0, source: "PLATFORM_VERIFIED" },
        });
      }
      for (const social of creator.socials) {
        await prisma.socialAccount.create({
          data: {
            creatorId: row.id,
            platform: social.platform as SocialPlatform,
            handle: social.handle,
            url: social.url,
            followers: social.followers,
            source: "PLATFORM_VERIFIED",
          },
        });
      }
      await prisma.influenceCard.create({
        data: {
          creatorId: row.id,
          slug: creator.slug,
          shortAlias: creator.planTier === "STARTER" ? null : creator.slug.split("-")[0],
          published: true,
          theme: creator.planTier.toLowerCase(),
        },
      });
      if (creator.offer) {
        await prisma.collaborationOffer.create({ data: { creatorId: row.id, summary: creator.offer } });
      }
      if (creator.need) {
        await prisma.collaborationNeed.create({ data: { creatorId: row.id, summary: creator.need } });
      }
    }
  }

  const sectionKeys = new Set((await prisma.cmsSection.findMany({ select: { key: true } })).map((row) => row.key));
  for (const section of DEFAULT_HOMEPAGE_SECTIONS) {
    if (sectionKeys.has(section.key)) continue;
    await prisma.cmsSection.create({ data: section });
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
  } catch {
    // scripts
  }
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  try {
    cache = await readDirectory();
    return cache;
  } catch (error) {
    console.error("directory: using seed fallback", error);
    return fallbackSnapshot();
  }
}

export async function getDirectoryCreator(slug: string): Promise<SeedCreator | null> {
  const directory = await getDirectory();
  return directory.creators.find((creator) => creator.slug === slug) ?? null;
}

export async function searchDirectory(query: CreatorSearchQuery) {
  const directory = await getDirectory();
  const specialtyValues = query.specialty
    ? (Array.isArray(query.specialty) ? query.specialty : [query.specialty]).map(
        (value) => canonicalSpecialty(value, directory.synonyms) ?? value,
      )
    : undefined;
  const q = canonicalSpecialty(query.q, directory.synonyms);
  const textQuery = query.q && q !== query.q.toLowerCase().trim() ? q : query.q;
  return filterCreators(
    directory.creators,
    { ...query, specialty: specialtyValues, q: textQuery },
    directory.synonyms,
  );
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
    await prisma.analyticsEvent.create({
      data: {
        eventType,
        metaJson: meta as Prisma.InputJsonValue,
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
