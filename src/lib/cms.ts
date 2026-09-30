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
  valueProposition: ValuePropositionStrip;
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

const DEFAULT_VALUE_PROPOSITION: ValuePropositionStrip = {
  enabled: true,
  eyebrow: "Why Influrios",
  headline: "More than a directory.",
  headlineHighlight: "An ecosystem for influence.",
  subtitle:
    "Influence. Identity. Opportunity. — Discover the right influence. Build your creator identity. Collaborate with confidence.",
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
      description: "Discover creators by what they truly influence — not just follower count.",
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
        "Connect creators, complementary specialists and businesses around real opportunities.",
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
  valueProposition: DEFAULT_VALUE_PROPOSITION,
};

async function ensureStore(): Promise<SiteCms> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as SiteCms;
    const banners = { ...DEFAULT_CMS.banners } as SiteCms["banners"];
    for (const key of Object.keys(DEFAULT_CMS.banners) as BannerSlot[]) {
      const incoming = parsed.banners?.[key];
      if (!incoming) continue;
      const merged = { ...DEFAULT_CMS.banners[key], ...incoming, id: key };
      // Empty admin fields must not blank the public CTA / titles.
      for (const field of ["title", "subtitle", "ctaLabel", "ctaHref"] as const) {
        const val = merged[field];
        if (typeof val !== "string" || !val.trim()) {
          merged[field] = DEFAULT_CMS.banners[key][field];
        }
      }
      banners[key] = merged;
    }
    return {
      banners,
      featuredCards: {
        ...DEFAULT_CMS.featuredCards,
        ...parsed.featuredCards,
        cards: parsed.featuredCards?.cards?.length
          ? parsed.featuredCards.cards
          : DEFAULT_CMS.featuredCards.cards,
      },
      valueProposition: {
        ...DEFAULT_VALUE_PROPOSITION,
        ...(parsed as SiteCms).valueProposition,
        items:
          (parsed as SiteCms).valueProposition?.items?.length
            ? (parsed as SiteCms).valueProposition!.items
            : DEFAULT_VALUE_PROPOSITION.items,
      },
    };
  } catch {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(STORE_PATH, JSON.stringify(DEFAULT_CMS, null, 2));
    } catch {
      // Read-only FS during some build contexts — fall back to defaults in memory
    }
    return structuredClone(DEFAULT_CMS);
  }
}

async function saveStore(cms: SiteCms) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(cms, null, 2));
  } catch {
    /* ignore write failures in read-only environments */
  }
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

export async function updateValueProposition(patch: Partial<ValuePropositionStrip>) {
  const cms = await ensureStore();
  cms.valueProposition = {
    ...cms.valueProposition,
    ...patch,
    items: patch.items ?? cms.valueProposition.items,
    updatedAt: new Date().toISOString(),
  };
  await saveStore(cms);
  return cms.valueProposition;
}

export async function restoreDefaultValueProposition() {
  const cms = await ensureStore();
  cms.valueProposition = {
    ...structuredClone(DEFAULT_VALUE_PROPOSITION),
    updatedAt: new Date().toISOString(),
  };
  await saveStore(cms);
  return cms.valueProposition;
}

export { DEFAULT_FEATURES, DEFAULT_VALUE_PROPOSITION };
