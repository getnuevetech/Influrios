/**
 * Site CMS — banners, featured cards, value proposition.
 * Content lives on CmsSection.payload (Postgres). Banner image bytes stay under
 * public/uploads/banners. One-time import from data/cms.json when present.
 */
import { promises as fs } from "fs";
import path from "path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CATEGORY_IMAGES, publicStoredImage } from "@/lib/seed-data";

export type BannerSlot = "hero" | "sponsored" | "cta" | "cardPromo";

export type BannerConfig = {
  id: BannerSlot;
  label: string;
  enabled: boolean;
  /** Height scale relative to default (1 = 100%). Landing uses 0.8 = −20%. */
  heightScale: number;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  /** One or more banner images (admin-uploadable). First is primary. */
  images: string[];
  /** Names an admin saved for the sponsored banner. Empty means the public row is omitted. */
  partners: string[];
};

export type CardFeatureFlags = {
  showBadge: boolean;
  showHeart: boolean;
  showVerified: boolean;
  showLocation: boolean;
  showSpecialties: boolean;
  showSocials: boolean;
  showFollowerCounts: boolean;
  showQr: boolean;
  showStatus: boolean;
  /** Platforms visible on this card (empty = all) */
  visiblePlatforms: string[];
};

export type ManagedCard = {
  slug: string;
  visible: boolean;
  order: number;
  features: CardFeatureFlags;
};

export type FeaturedCardsConfig = {
  /** Width scale (1.2 = +20%) */
  widthScale: number;
  socialIconSize: number;
  qrSize: number;
  cards: ManagedCard[];
};

export type HomepageCategoryItem = {
  slug: string;
  image: string;
};

export type HomepageCategoriesConfig = {
  title: string;
  ctaLabel: string;
  ctaHref: string;
  items: HomepageCategoryItem[];
};

export type HomepageCollabMatch = {
  title: string;
  tags: string[];
  leftSlug: string;
  rightSlug: string;
  image?: string;
};

export type HomepageCollaborationConfig = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  matches: HomepageCollabMatch[];
};

export type SiteCms = {
  banners: Record<BannerSlot, BannerConfig>;
  featuredCards: FeaturedCardsConfig;
  valueProposition: ValuePropositionStrip;
  categories: HomepageCategoriesConfig;
  collaborationMatches: HomepageCollaborationConfig;
};

export type ValuePropositionItem = {
  key: string;
  enabled: boolean;
  sortOrder: number;
  iconKey: "card" | "intelligence" | "network" | "payments";
  title: string;
  description: string;
  microLabel: string;
  linkUrl: string;
  accentToken: "violet" | "blue" | "rose" | "emerald";
};

export type ValuePropositionStrip = {
  enabled: boolean;
  eyebrow: string;
  headline: string;
  headlineHighlight: string;
  subtitle: string;
  closingTaglineLine1: string;
  closingTaglineLine2: string;
  items: ValuePropositionItem[];
  updatedAt?: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const LEGACY_STORE_PATH = path.join(DATA_DIR, "cms.json");
const LEGACY_MIGRATED_PATH = path.join(DATA_DIR, "cms.json.migrated");
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "banners");

const BANNER_SECTION_KEYS: Record<BannerSlot, string> = {
  hero: "hero",
  sponsored: "sponsored",
  cta: "cta",
  cardPromo: "card_promo",
};

const FEATURED_SECTION_KEY = "featured";
const VALUE_PROP_SECTION_KEY = "value_proposition";
const CATEGORIES_SECTION_KEY = "categories";
const COLLABORATION_SECTION_KEY = "collaboration";

function defaultCategoryItems(): HomepageCategoryItem[] {
  return Object.keys(CATEGORY_IMAGES).map((slug) => ({ slug, image: "" }));
}

function defaultCollaborationMatches(): HomepageCollabMatch[] {
  return [];
}

const DEFAULT_CATEGORIES: HomepageCategoriesConfig = {
  title: "Explore Influencer Categories",
  ctaLabel: "View all categories",
  ctaHref: "/categories",
  items: defaultCategoryItems(),
};

const DEFAULT_COLLABORATION_MATCHES: HomepageCollaborationConfig = {
  title: "Collaboration Matches",
  subtitle: "Complementary influencers who unlock stronger campaigns.",
  ctaLabel: "View more matches",
  ctaHref: "/collaboration",
  matches: defaultCollaborationMatches(),
};

const SECTION_META: Record<string, { title: string; sortOrder: number; enabled: boolean; status: string }> = {
  hero: { title: "Hero", sortOrder: 0, enabled: true, status: "published" },
  categories: { title: "Categories", sortOrder: 1, enabled: true, status: "published" },
  featured: { title: "Featured influencers", sortOrder: 2, enabled: true, status: "published" },
  sponsored: { title: "Sponsored", sortOrder: 3, enabled: true, status: "published" },
  value_proposition: { title: "Value proposition", sortOrder: 4, enabled: true, status: "published" },
  collaboration: { title: "Collaboration matches", sortOrder: 5, enabled: true, status: "published" },
  card_promo: { title: "Influencer Card", sortOrder: 6, enabled: true, status: "published" },
  cta: { title: "Closing call to action", sortOrder: 7, enabled: true, status: "published" },
  statistics: { title: "Statistics", sortOrder: 8, enabled: false, status: "draft" },
  faq: { title: "FAQ", sortOrder: 9, enabled: false, status: "draft" },
};

const DEFAULT_FEATURES: CardFeatureFlags = {
  showBadge: true,
  showHeart: true,
  showVerified: true,
  showLocation: true,
  showSpecialties: true,
  showSocials: true,
  showFollowerCounts: true,
  showQr: true,
  showStatus: true,
  visiblePlatforms: [],
};

function defaultCards(): ManagedCard[] {
  return [];
}

const DEFAULT_VALUE_PROPOSITION: ValuePropositionStrip = {
  enabled: true,
  eyebrow: "Why Influrios",
  headline: "More than a directory.",
  headlineHighlight: "An ecosystem for influence.",
  subtitle:
    "Influence. Identity. Opportunity. — Discover the right influence. Build your influencer identity. Collaborate with confidence.",
  closingTaglineLine1: "More than a directory.",
  closingTaglineLine2: "An ecosystem for influence.",
  items: [
    {
      key: "influrios_card",
      enabled: true,
      sortOrder: 0,
      iconKey: "card",
      title: "Influrios Card",
      description:
        "One professional identity for your socials, specialty, contact details and opportunities.",
      microLabel: "Showcase Yourself",
      linkUrl: "/card",
      accentToken: "violet",
    },
    {
      key: "influence_intelligence",
      enabled: true,
      sortOrder: 1,
      iconKey: "intelligence",
      title: "Influence Intelligence",
      description: "Discover influencers by what they truly influence — not just follower count.",
      microLabel: "Find the Right Match",
      linkUrl: "/discover",
      accentToken: "blue",
    },
    {
      key: "collaboration_network",
      enabled: true,
      sortOrder: 2,
      iconKey: "network",
      title: "Collaboration Network",
      description:
        "Connect influencers, complementary specialists and businesses around real opportunities.",
      microLabel: "Create Opportunities",
      linkUrl: "/collaboration",
      accentToken: "rose",
    },
    {
      key: "protected_payments",
      enabled: true,
      sortOrder: 3,
      iconKey: "payments",
      title: "Protected Payments",
      description:
        "Fund collaborations securely and release payments as agreed milestones are completed.",
      microLabel: "Collaborate with Confidence",
      linkUrl: "/payments",
      accentToken: "emerald",
    },
  ],
};

const DEFAULT_CMS: SiteCms = {
  banners: {
    hero: {
      id: "hero",
      label: "Hero banner",
      enabled: true,
      heightScale: 0.8,
      title: "Find the Right Influencers. Build Powerful Collaborations.",
      subtitle:
        "Discover influencers by specialty, match with collaborators, and connect businesses to the right influence.",
      ctaLabel: "Search",
      ctaHref: "/discover",
      images: [],
      partners: [],
    },
    sponsored: {
      id: "sponsored",
      label: "Sponsored opportunity banner",
      enabled: true,
      heightScale: 1,
      title: "Partner with Innovative Brands That Value Influencers.",
      subtitle: "Exclusive collaboration opportunities with leading global brands.",
      ctaLabel: "View Opportunities",
      ctaHref: "/collaboration",
      images: [],
      partners: [],
    },
    cardPromo: {
      id: "cardPromo",
      label: "Influencer Card promo (pre-footer)",
      enabled: true,
      heightScale: 1,
      title: "Your Influencer Card, Everywhere.",
      subtitle: "One portable commercial identity for socials, specialties, and brand reach.",
      ctaLabel: "Create Your Influencer Card",
      ctaHref: "/claim",
      images: [],
      partners: [],
    },
    cta: {
      id: "cta",
      label: "Bottom community CTA banner",
      enabled: true,
      heightScale: 0.8,
      title: "Join a Global Community of Influencers and Businesses",
      subtitle:
        "Whether you're an influencer looking for opportunities or a business ready to collaborate, Influrios is your hub.",
      ctaLabel: "Join as an Influencer",
      ctaHref: "/claim",
      images: [],
      partners: [],
    },
  },
  featuredCards: {
    widthScale: 1.2,
    socialIconSize: 22,
    qrSize: 22,
    cards: defaultCards(),
  },
  valueProposition: DEFAULT_VALUE_PROPOSITION,
  categories: DEFAULT_CATEGORIES,
  collaborationMatches: DEFAULT_COLLABORATION_MATCHES,
};

/** One partner name per line. Duplicates and blank lines are dropped. */
export function partnerNamesFromText(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const name = line.trim().replace(/\s+/g, " ");
    if (!name || name.length > 48) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= 8) break;
  }
  return names;
}

/** Uploaded banner files. Retired /demo/ art is omitted. */
export function publicBannerImages(images: string[]): string[] {
  return images.map((src) => publicStoredImage(src)).filter((src) => src.length > 0);
}

/** Drop retired /demo/ paths from a stored CMS payload. Other fields stay. */
export function cmsPayloadWithoutDemoMedia(payload: Record<string, unknown>): {
  payload: Record<string, unknown>;
  changed: boolean;
} {
  let changed = false;
  const next: Record<string, unknown> = { ...payload };

  if (Array.isArray(payload.images)) {
    const images = payload.images.flatMap((item) => (typeof item === "string" ? [publicStoredImage(item)] : []));
    const kept = images.filter((src) => src.length > 0);
    const before = payload.images.filter((item): item is string => typeof item === "string");
    if (kept.length !== before.length || kept.some((src, index) => src !== before[index])) {
      next.images = kept;
      changed = true;
    }
  }

  if (Array.isArray(payload.items)) {
    next.items = payload.items.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return item;
      const row = item as Record<string, unknown>;
      if (typeof row.image !== "string") return item;
      const image = publicStoredImage(row.image);
      if (image === row.image) return item;
      changed = true;
      return { ...row, image };
    });
  }

  if (Array.isArray(payload.matches)) {
    next.matches = payload.matches.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return item;
      const row = item as Record<string, unknown>;
      if (typeof row.image !== "string") return item;
      const image = publicStoredImage(row.image);
      if (image === row.image) return item;
      changed = true;
      if (!image) {
        const copy = { ...row };
        delete copy.image;
        return copy;
      }
      return { ...row, image };
    });
  }

  return { payload: next, changed };
}

/** Merge a stored banner with defaults so empty admin fields do not blank the public CTA. */
export function mergeBannerConfig(slot: BannerSlot, incoming?: Partial<BannerConfig> | null): BannerConfig {
  const base = DEFAULT_CMS.banners[slot];
  if (!incoming) return { ...base, images: [...base.images], partners: [...base.partners] };
  const merged: BannerConfig = {
    ...base,
    ...incoming,
    id: slot,
    images: Array.isArray(incoming.images)
      ? incoming.images.map((src) => publicStoredImage(src)).filter((src) => src.length > 0)
      : [...base.images],
    partners: Array.isArray(incoming.partners)
      ? partnerNamesFromText(incoming.partners.join("\n"))
      : [...base.partners],
  };
  for (const field of ["title", "subtitle", "ctaLabel", "ctaHref"] as const) {
    const val = merged[field];
    if (typeof val !== "string" || !val.trim()) merged[field] = base[field];
  }
  return merged;
}

export function mergeFeaturedCards(incoming?: Partial<FeaturedCardsConfig> | null): FeaturedCardsConfig {
  const base = DEFAULT_CMS.featuredCards;
  return {
    ...base,
    ...incoming,
    cards: incoming?.cards?.length ? incoming.cards : structuredClone(base.cards),
  };
}

export function mergeValueProposition(incoming?: Partial<ValuePropositionStrip> | null): ValuePropositionStrip {
  return {
    ...DEFAULT_VALUE_PROPOSITION,
    ...incoming,
    items: incoming?.items?.length ? incoming.items : structuredClone(DEFAULT_VALUE_PROPOSITION.items),
  };
}

export function mergeHomepageCategories(
  incoming?: Partial<HomepageCategoriesConfig> | null,
): HomepageCategoriesConfig {
  return {
    ...DEFAULT_CATEGORIES,
    ...incoming,
    items: incoming?.items?.length
      ? incoming.items.map((item) => ({ ...item, image: publicStoredImage(item.image) }))
      : structuredClone(DEFAULT_CATEGORIES.items),
  };
}

export function mergeHomepageCollaboration(
  incoming?: Partial<HomepageCollaborationConfig> | null,
): HomepageCollaborationConfig {
  return {
    ...DEFAULT_COLLABORATION_MATCHES,
    ...incoming,
    matches: incoming?.matches?.length
      ? incoming.matches.map((match) => {
          const image = publicStoredImage(match.image);
          if (!image) {
            const copy = { ...match };
            delete copy.image;
            return copy;
          }
          return { ...match, image };
        })
      : structuredClone(DEFAULT_COLLABORATION_MATCHES.matches),
  };
}

export function assembleSiteCms(input: {
  banners?: Partial<Record<BannerSlot, Partial<BannerConfig> | null>>;
  featuredCards?: Partial<FeaturedCardsConfig> | null;
  valueProposition?: Partial<ValuePropositionStrip> | null;
  categories?: Partial<HomepageCategoriesConfig> | null;
  collaborationMatches?: Partial<HomepageCollaborationConfig> | null;
}): SiteCms {
  const banners = {} as SiteCms["banners"];
  for (const slot of Object.keys(DEFAULT_CMS.banners) as BannerSlot[]) {
    banners[slot] = mergeBannerConfig(slot, input.banners?.[slot]);
  }
  return {
    banners,
    featuredCards: mergeFeaturedCards(input.featuredCards),
    valueProposition: mergeValueProposition(input.valueProposition),
    categories: mergeHomepageCategories(input.categories),
    collaborationMatches: mergeHomepageCollaboration(input.collaborationMatches),
  };
}

function asObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function bannerFromPayload(slot: BannerSlot, raw: Prisma.JsonValue | null | undefined): BannerConfig {
  const obj = asObject(raw);
  if (!obj) return mergeBannerConfig(slot);
  return mergeBannerConfig(slot, {
    label: typeof obj.label === "string" ? obj.label : undefined,
    enabled: typeof obj.enabled === "boolean" ? obj.enabled : undefined,
    heightScale: typeof obj.heightScale === "number" ? obj.heightScale : undefined,
    title: typeof obj.title === "string" ? obj.title : undefined,
    subtitle: typeof obj.subtitle === "string" ? obj.subtitle : undefined,
    ctaLabel: typeof obj.ctaLabel === "string" ? obj.ctaLabel : undefined,
    ctaHref: typeof obj.ctaHref === "string" ? obj.ctaHref : undefined,
    images: Array.isArray(obj.images) ? obj.images.filter((item): item is string => typeof item === "string") : undefined,
    partners: Array.isArray(obj.partners)
      ? obj.partners.filter((item): item is string => typeof item === "string")
      : undefined,
  });
}

function featuredFromPayload(raw: Prisma.JsonValue | null | undefined): FeaturedCardsConfig {
  const obj = asObject(raw);
  if (!obj) return mergeFeaturedCards();
  return mergeFeaturedCards({
    widthScale: typeof obj.widthScale === "number" ? obj.widthScale : undefined,
    socialIconSize: typeof obj.socialIconSize === "number" ? obj.socialIconSize : undefined,
    qrSize: typeof obj.qrSize === "number" ? obj.qrSize : undefined,
    cards: Array.isArray(obj.cards) ? (obj.cards as ManagedCard[]) : undefined,
  });
}

function valuePropFromPayload(raw: Prisma.JsonValue | null | undefined): ValuePropositionStrip {
  const obj = asObject(raw);
  if (!obj) return mergeValueProposition();
  return mergeValueProposition(obj as Partial<ValuePropositionStrip>);
}

function categoriesFromPayload(raw: Prisma.JsonValue | null | undefined): HomepageCategoriesConfig {
  const obj = asObject(raw);
  if (!obj) return mergeHomepageCategories();
  const items = Array.isArray(obj.items)
    ? obj.items
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const row = item as Record<string, unknown>;
          if (typeof row.slug !== "string" || typeof row.image !== "string") return null;
          return { slug: row.slug, image: row.image };
        })
        .filter((item): item is HomepageCategoryItem => Boolean(item))
    : undefined;
  return mergeHomepageCategories({
    title: typeof obj.title === "string" ? obj.title : undefined,
    ctaLabel: typeof obj.ctaLabel === "string" ? obj.ctaLabel : undefined,
    ctaHref: typeof obj.ctaHref === "string" ? obj.ctaHref : undefined,
    items,
  });
}

function collaborationFromPayload(
  raw: Prisma.JsonValue | null | undefined,
): HomepageCollaborationConfig {
  const obj = asObject(raw);
  if (!obj) return mergeHomepageCollaboration();
  const matches = Array.isArray(obj.matches)
    ? obj.matches
        .map((item): HomepageCollabMatch | null => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const row = item as Record<string, unknown>;
          if (typeof row.title !== "string" || typeof row.leftSlug !== "string" || typeof row.rightSlug !== "string") {
            return null;
          }
          const match: HomepageCollabMatch = {
            title: row.title,
            leftSlug: row.leftSlug,
            rightSlug: row.rightSlug,
            tags: Array.isArray(row.tags)
              ? row.tags.filter((tag): tag is string => typeof tag === "string")
              : [],
          };
          if (typeof row.image === "string") match.image = row.image;
          return match;
        })
        .filter((item): item is HomepageCollabMatch => Boolean(item))
    : undefined;
  return mergeHomepageCollaboration({
    title: typeof obj.title === "string" ? obj.title : undefined,
    subtitle: typeof obj.subtitle === "string" ? obj.subtitle : undefined,
    ctaLabel: typeof obj.ctaLabel === "string" ? obj.ctaLabel : undefined,
    ctaHref: typeof obj.ctaHref === "string" ? obj.ctaHref : undefined,
    matches,
  });
}

function bannerPayload(banner: BannerConfig): Prisma.InputJsonValue {
  return {
    kind: "banner",
    label: banner.label,
    enabled: banner.enabled,
    heightScale: banner.heightScale,
    title: banner.title,
    subtitle: banner.subtitle,
    ctaLabel: banner.ctaLabel,
    ctaHref: banner.ctaHref,
    images: banner.images,
    partners: banner.partners,
  };
}

function featuredPayload(config: FeaturedCardsConfig): Prisma.InputJsonValue {
  return {
    kind: "featured",
    widthScale: config.widthScale,
    socialIconSize: config.socialIconSize,
    qrSize: config.qrSize,
    cards: config.cards,
  };
}

function valuePropPayload(strip: ValuePropositionStrip): Prisma.InputJsonValue {
  return {
    kind: "value_proposition",
    ...strip,
  };
}

function categoriesPayload(config: HomepageCategoriesConfig): Prisma.InputJsonValue {
  return {
    kind: "categories",
    title: config.title,
    ctaLabel: config.ctaLabel,
    ctaHref: config.ctaHref,
    items: config.items,
  };
}

function collaborationPayload(config: HomepageCollaborationConfig): Prisma.InputJsonValue {
  return {
    kind: "collaboration",
    title: config.title,
    subtitle: config.subtitle,
    ctaLabel: config.ctaLabel,
    ctaHref: config.ctaHref,
    matches: config.matches,
  };
}

async function upsertSectionPayload(key: string, payload: Prisma.InputJsonValue) {
  const meta = SECTION_META[key] ?? { title: key, sortOrder: 99, enabled: true, status: "published" };
  await prisma.cmsSection.upsert({
    where: { key },
    create: {
      key,
      title: meta.title,
      sortOrder: meta.sortOrder,
      enabled: meta.enabled,
      status: meta.status,
      payload,
    },
    update: { payload },
  });
}

async function readLegacyCms(): Promise<SiteCms | null> {
  try {
    const raw = await fs.readFile(LEGACY_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<SiteCms>;
    return assembleSiteCms({
      banners: parsed.banners,
      featuredCards: parsed.featuredCards,
      valueProposition: parsed.valueProposition,
      categories: parsed.categories,
      collaborationMatches: parsed.collaborationMatches,
    });
  } catch {
    return null;
  }
}

async function markLegacyMigrated() {
  try {
    await fs.rename(LEGACY_STORE_PATH, LEGACY_MIGRATED_PATH);
  } catch {
    try {
      await fs.unlink(LEGACY_STORE_PATH);
    } catch {
      /* ignore */
    }
  }
}

async function writeCmsToDb(cms: SiteCms) {
  for (const slot of Object.keys(cms.banners) as BannerSlot[]) {
    await upsertSectionPayload(BANNER_SECTION_KEYS[slot], bannerPayload(cms.banners[slot]));
  }
  await upsertSectionPayload(FEATURED_SECTION_KEY, featuredPayload(cms.featuredCards));
  await upsertSectionPayload(VALUE_PROP_SECTION_KEY, valuePropPayload(cms.valueProposition));
  await upsertSectionPayload(CATEGORIES_SECTION_KEY, categoriesPayload(cms.categories));
  await upsertSectionPayload(COLLABORATION_SECTION_KEY, collaborationPayload(cms.collaborationMatches));
}

async function contentPayloadCount() {
  return prisma.cmsSection.count({
    where: {
      key: {
        in: [
          ...Object.values(BANNER_SECTION_KEYS),
          FEATURED_SECTION_KEY,
          VALUE_PROP_SECTION_KEY,
          CATEGORIES_SECTION_KEY,
          COLLABORATION_SECTION_KEY,
        ],
      },
      payload: { not: Prisma.DbNull },
    },
  });
}

async function ensureCmsStore(): Promise<SiteCms> {
  const filled = await contentPayloadCount();
  if (filled === 0) {
    const legacy = await readLegacyCms();
    if (legacy) {
      await writeCmsToDb(legacy);
      await markLegacyMigrated();
    } else {
      await writeCmsToDb(structuredClone(DEFAULT_CMS));
    }
  } else {
    for (const slot of Object.keys(DEFAULT_CMS.banners) as BannerSlot[]) {
      const key = BANNER_SECTION_KEYS[slot];
      const row = await prisma.cmsSection.findUnique({ where: { key }, select: { payload: true } });
      if (!row || row.payload == null) {
        await upsertSectionPayload(key, bannerPayload(DEFAULT_CMS.banners[slot]));
      }
    }
    for (const [key, payload] of [
      [FEATURED_SECTION_KEY, featuredPayload(DEFAULT_CMS.featuredCards)],
      [VALUE_PROP_SECTION_KEY, valuePropPayload(DEFAULT_CMS.valueProposition)],
      [CATEGORIES_SECTION_KEY, categoriesPayload(DEFAULT_CMS.categories)],
      [COLLABORATION_SECTION_KEY, collaborationPayload(DEFAULT_CMS.collaborationMatches)],
    ] as const) {
      const row = await prisma.cmsSection.findUnique({ where: { key }, select: { payload: true } });
      if (!row || row.payload == null) await upsertSectionPayload(key, payload);
    }
  }

  const keys = [
    ...Object.values(BANNER_SECTION_KEYS),
    FEATURED_SECTION_KEY,
    VALUE_PROP_SECTION_KEY,
    CATEGORIES_SECTION_KEY,
    COLLABORATION_SECTION_KEY,
  ];
  const rows = await prisma.cmsSection.findMany({ where: { key: { in: keys } } });
  const byKey = new Map(rows.map((row) => [row.key, row.payload]));

  return assembleSiteCms({
    banners: {
      hero: bannerFromPayload("hero", byKey.get("hero")),
      sponsored: bannerFromPayload("sponsored", byKey.get("sponsored")),
      cta: bannerFromPayload("cta", byKey.get("cta")),
      cardPromo: bannerFromPayload("cardPromo", byKey.get("card_promo")),
    },
    featuredCards: featuredFromPayload(byKey.get(FEATURED_SECTION_KEY)),
    valueProposition: valuePropFromPayload(byKey.get(VALUE_PROP_SECTION_KEY)),
    categories: categoriesFromPayload(byKey.get(CATEGORIES_SECTION_KEY)),
    collaborationMatches: collaborationFromPayload(byKey.get(COLLABORATION_SECTION_KEY)),
  });
}

async function persistCms(cms: SiteCms) {
  await writeCmsToDb(cms);
  try {
    const { invalidateDirectoryCache } = await import("@/lib/directory");
    invalidateDirectoryCache();
  } catch {
    /* scripts without directory module */
  }
}

export async function getCms(): Promise<SiteCms> {
  return ensureCmsStore();
}

export async function updateBanner(id: BannerSlot, patch: Partial<BannerConfig>) {
  const cms = await ensureCmsStore();
  cms.banners[id] = mergeBannerConfig(id, { ...cms.banners[id], ...patch, id });
  await persistCms(cms);
  return cms.banners[id];
}

export async function updateFeaturedCardsConfig(patch: Partial<FeaturedCardsConfig>) {
  const cms = await ensureCmsStore();
  cms.featuredCards = mergeFeaturedCards({ ...cms.featuredCards, ...patch });
  await persistCms(cms);
  return cms.featuredCards;
}

export async function updateHomepageCategories(patch: Partial<HomepageCategoriesConfig>) {
  const cms = await ensureCmsStore();
  cms.categories = mergeHomepageCategories({ ...cms.categories, ...patch });
  await persistCms(cms);
  return cms.categories;
}

export async function updateHomepageCollaboration(patch: Partial<HomepageCollaborationConfig>) {
  const cms = await ensureCmsStore();
  cms.collaborationMatches = mergeHomepageCollaboration({
    ...cms.collaborationMatches,
    ...patch,
  });
  await persistCms(cms);
  return cms.collaborationMatches;
}

export async function updateManagedCard(slug: string, patch: Partial<ManagedCard>) {
  const cms = await ensureCmsStore();
  const idx = cms.featuredCards.cards.findIndex((c) => c.slug === slug);
  if (idx < 0) {
    cms.featuredCards.cards.push({
      slug,
      visible: true,
      order: cms.featuredCards.cards.length,
      ...patch,
      features: { ...DEFAULT_FEATURES, ...(patch.features ?? {}) },
    });
  } else {
    const prev = cms.featuredCards.cards[idx];
    cms.featuredCards.cards[idx] = {
      ...prev,
      ...patch,
      features: { ...prev.features, ...(patch.features ?? {}) },
    };
  }
  await persistCms(cms);
  return cms.featuredCards.cards.find((c) => c.slug === slug)!;
}

export async function saveBannerUpload(filename: string, bytes: Buffer) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const unique = `${Date.now()}-${safe}`;
  const full = path.join(UPLOAD_DIR, unique);
  await fs.writeFile(full, bytes);
  return `/uploads/banners/${unique}`;
}

export async function addBannerImage(id: BannerSlot, imagePath: string) {
  const cms = await ensureCmsStore();
  cms.banners[id].images = [...cms.banners[id].images, imagePath];
  await persistCms(cms);
  return cms.banners[id];
}

export async function removeBannerImage(id: BannerSlot, imagePath: string) {
  const cms = await ensureCmsStore();
  cms.banners[id].images = cms.banners[id].images.filter((i) => i !== imagePath);
  await persistCms(cms);
  return cms.banners[id];
}

export async function updateValueProposition(patch: Partial<ValuePropositionStrip>) {
  const cms = await ensureCmsStore();
  cms.valueProposition = mergeValueProposition({
    ...cms.valueProposition,
    ...patch,
    items: patch.items ?? cms.valueProposition.items,
    updatedAt: new Date().toISOString(),
  });
  await persistCms(cms);
  return cms.valueProposition;
}

export async function restoreDefaultValueProposition() {
  const cms = await ensureCmsStore();
  cms.valueProposition = {
    ...structuredClone(DEFAULT_VALUE_PROPOSITION),
    updatedAt: new Date().toISOString(),
  };
  await persistCms(cms);
  return cms.valueProposition;
}

export { DEFAULT_FEATURES, DEFAULT_VALUE_PROPOSITION, DEFAULT_CMS, BANNER_SECTION_KEYS };
