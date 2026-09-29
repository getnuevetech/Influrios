import { promises as fs } from "fs";
import path from "path";
import { SEED_CREATORS } from "@/lib/seed-data";

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

export type SiteCms = {
  banners: Record<BannerSlot, BannerConfig>;
  featuredCards: FeaturedCardsConfig;
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "cms.json");
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "banners");

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
  return SEED_CREATORS.map((c, i) => ({
    slug: c.slug,
    visible: true,
    order: i,
    features: { ...DEFAULT_FEATURES },
  }));
}

const DEFAULT_CMS: SiteCms = {
  banners: {
    hero: {
      id: "hero",
      label: "Hero banner",
      enabled: true,
      heightScale: 0.8,
      title: "Find the Right Influencers. Build Powerful Collaborations.",
      subtitle:
        "Discover creators by specialty, match with collaborators, and connect businesses to the right influence.",
      ctaLabel: "Search",
      ctaHref: "/discover",
      images: [],
    },
    sponsored: {
      id: "sponsored",
      label: "Sponsored opportunity banner",
      enabled: true,
      heightScale: 1,
      title: "Partner with Innovative Brands That Value Creators.",
      subtitle: "Exclusive collaboration opportunities with leading global brands.",
      ctaLabel: "View Opportunities",
      ctaHref: "/collaboration",
      images: ["/demo/content/content-collab-1.jpg", "/demo/creators/creator-sofia.jpg"],
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
    },
    cta: {
      id: "cta",
      label: "Bottom community CTA banner",
      enabled: true,
      heightScale: 0.8,
      title: "Join a Global Community of Creators and Businesses",
      subtitle:
        "Whether you're an influencer looking for opportunities or a business ready to collaborate, Influrios is your hub.",
      ctaLabel: "Join as a Creator",
      ctaHref: "/claim",
      images: ["/demo/cta-community.jpg"],
    },
  },
  featuredCards: {
    widthScale: 1.2,
    socialIconSize: 22,
    qrSize: 22,
    cards: defaultCards(),
  },
};

async function ensureStore(): Promise<SiteCms> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as SiteCms;
    // Merge defaults for any missing keys
    return {
      banners: { ...DEFAULT_CMS.banners, ...parsed.banners },
      featuredCards: {
        ...DEFAULT_CMS.featuredCards,
        ...parsed.featuredCards,
        cards: parsed.featuredCards?.cards?.length
          ? parsed.featuredCards.cards
          : DEFAULT_CMS.featuredCards.cards,
      },
    };
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(DEFAULT_CMS, null, 2));
    return structuredClone(DEFAULT_CMS);
  }
}

async function saveStore(cms: SiteCms) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(cms, null, 2));
}

export async function getCms(): Promise<SiteCms> {
  return ensureStore();
}

export async function updateBanner(id: BannerSlot, patch: Partial<BannerConfig>) {
  const cms = await ensureStore();
  cms.banners[id] = { ...cms.banners[id], ...patch, id };
  await saveStore(cms);
  return cms.banners[id];
}

export async function updateFeaturedCardsConfig(patch: Partial<FeaturedCardsConfig>) {
  const cms = await ensureStore();
  cms.featuredCards = { ...cms.featuredCards, ...patch };
  await saveStore(cms);
  return cms.featuredCards;
}

export async function updateManagedCard(slug: string, patch: Partial<ManagedCard>) {
  const cms = await ensureStore();
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
  await saveStore(cms);
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
  const cms = await ensureStore();
  cms.banners[id].images = [...cms.banners[id].images, imagePath];
  await saveStore(cms);
  return cms.banners[id];
}

export async function removeBannerImage(id: BannerSlot, imagePath: string) {
  const cms = await ensureStore();
  cms.banners[id].images = cms.banners[id].images.filter((i) => i !== imagePath);
  await saveStore(cms);
  return cms.banners[id];
}

export { DEFAULT_FEATURES };
