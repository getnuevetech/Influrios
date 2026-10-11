import { DEFAULT_FEATURES, type CardFeatureFlags } from "@/lib/cms";
import type { CreatorMatch } from "@/lib/matching";
import type { StoredMatchCard } from "@/lib/matching";
import { productSwitch } from "@/lib/product-switches";
import type { SeedCreator } from "@/lib/seed-data";

const DEMO_WHY =
  "Demo preview. This pair is a sample for the landing page, not a live match score.";

function demoPerson(input: {
  slug: string;
  displayName: string;
  title: string;
  specialty: string;
  city: string;
  country: string;
  image: string;
  socials: SeedCreator["socials"];
  engagementRate: string;
}): SeedCreator {
  return {
    slug: input.slug,
    displayName: input.displayName,
    title: input.title,
    bio: "Demo profile for the Influrios landing pages. This is not a live influencer.",
    locationCity: input.city,
    locationCountry: input.country,
    languages: ["English"],
    avatarColor: "#633CFF",
    image: input.image,
    coverImage: input.image,
    badge: "Demo",
    statusLabel: "Demo",
    planTier: "PLUS",
    specialties: [input.specialty],
    socials: input.socials,
    openToCollab: true,
    offer: "Demo preview of a collaboration offer.",
    need: "Demo preview of a collaboration need.",
    verified: true,
    stats: {
      engagementRate: input.engagementRate,
      engagementDelta: "",
      totalReach: "",
      reachDelta: "",
      avgViews: "",
      viewsDelta: "",
      collaborations: "",
      collabDelta: "",
    },
    collabPrefs: ["Sponsored Content", "Brand Campaigns"],
    bannerTagline: input.title,
    featuredContent: [
      {
        id: `${input.slug}-post`,
        category: input.specialty,
        platform: input.socials[0]?.platform ?? "INSTAGRAM",
        image: `/demo/categories/cat-${input.specialty === "home-interior" ? "home" : input.specialty}.jpg`,
        views: "18K",
        likes: "1.2K",
      },
    ],
  };
}

function social(
  slug: string,
  platform: SeedCreator["socials"][number]["platform"],
  handle: string,
  followers: number,
): SeedCreator["socials"][number] {
  return { platform, handle, url: `/creators/${slug}`, followers };
}

const CREATORS: SeedCreator[] = [
  demoPerson({
    slug: "demo-amara",
    displayName: "Amara Cole",
    title: "Beauty influencer",
    specialty: "beauty",
    city: "Accra",
    country: "Ghana",
    image: "/demo/creators/creator-amara.jpg",
    engagementRate: "4.6%",
    socials: [
      social("demo-amara", "INSTAGRAM", "amara.demo", 128_000),
      social("demo-amara", "TIKTOK", "amara.demo", 58_000),
    ],
  }),
  demoPerson({
    slug: "demo-daniel",
    displayName: "Daniel Park",
    title: "Food influencer",
    specialty: "food",
    city: "Seoul",
    country: "South Korea",
    image: "/demo/creators/creator-daniel.jpg",
    engagementRate: "5.1%",
    socials: [
      social("demo-daniel", "YOUTUBE", "daniel.demo", 210_000),
      social("demo-daniel", "INSTAGRAM", "daniel.demo", 74_000),
    ],
  }),
  demoPerson({
    slug: "demo-jordan",
    displayName: "Jordan Hale",
    title: "Fashion influencer",
    specialty: "fashion",
    city: "London",
    country: "United Kingdom",
    image: "/demo/creators/creator-jordan.jpg",
    engagementRate: "3.9%",
    socials: [
      social("demo-jordan", "INSTAGRAM", "jordan.demo", 96_000),
      social("demo-jordan", "TIKTOK", "jordan.demo", 142_000),
    ],
  }),
  demoPerson({
    slug: "demo-marcus",
    displayName: "Marcus Reid",
    title: "Fitness influencer",
    specialty: "fitness",
    city: "Austin",
    country: "United States",
    image: "/demo/creators/creator-marcus.jpg",
    engagementRate: "4.2%",
    socials: [
      social("demo-marcus", "INSTAGRAM", "marcus.demo", 188_000),
      social("demo-marcus", "YOUTUBE", "marcus.demo", 64_000),
    ],
  }),
  demoPerson({
    slug: "demo-priya",
    displayName: "Priya Shah",
    title: "Home influencer",
    specialty: "home-interior",
    city: "Mumbai",
    country: "India",
    image: "/demo/creators/creator-priya.jpg",
    engagementRate: "3.4%",
    socials: [social("demo-priya", "INSTAGRAM", "priya.demo", 81_000)],
  }),
  demoPerson({
    slug: "demo-sofia",
    displayName: "Sofia Lane",
    title: "Tech influencer",
    specialty: "tech",
    city: "Lisbon",
    country: "Portugal",
    image: "/demo/creators/creator-sofia.jpg",
    engagementRate: "4.8%",
    socials: [
      social("demo-sofia", "TIKTOK", "sofia.demo", 156_000),
      social("demo-sofia", "INSTAGRAM", "sofia.demo", 99_000),
    ],
  }),
];

const BY_SLUG = new Map(CREATORS.map((creator) => [creator.slug, creator]));

export function demoCreators(): SeedCreator[] {
  return CREATORS;
}

export function demoCreatorBySlug(slug: string): SeedCreator | null {
  return BY_SLUG.get(slug) ?? null;
}

export function isDemoCreatorSlug(slug: string): boolean {
  return BY_SLUG.has(slug);
}

/** Homepage influencer strip. Always this catalog, including after live profiles are turned on. */
export function demoCardStrip(): { creator: SeedCreator; features: CardFeatureFlags }[] {
  const features: CardFeatureFlags = { ...DEFAULT_FEATURES, showHeart: false };
  return CREATORS.map((creator) => ({ creator, features }));
}

export type DemoCollabPair = {
  title: string;
  tags: string[];
  left: SeedCreator;
  right: SeedCreator;
};

export function demoCollaborationPairs(): DemoCollabPair[] {
  const [amara, daniel, jordan, marcus, priya, sofia] = CREATORS;
  return [
    { title: "Beauty influencer + Fashion influencer", tags: ["Beauty", "Fashion"], left: amara!, right: jordan! },
    { title: "Food influencer + Tech influencer", tags: ["Food", "Tech"], left: daniel!, right: sofia! },
    { title: "Fitness influencer + Home influencer", tags: ["Fitness", "Home"], left: marcus!, right: priya! },
  ];
}

function demoMatch(a: SeedCreator, b: SeedCreator, score: number): CreatorMatch {
  return {
    a,
    b,
    score,
    breakdown: {
      audienceAlignment: score - 4,
      contentCompatibility: score - 2,
      goalSynergy: score - 6,
      engagementPotential: score - 1,
    },
    reasons: ["Demo preview"],
    why: DEMO_WHY,
    complementarySpecialties: [a.specialties[0] ?? "", b.specialties[0] ?? ""].filter(Boolean),
  };
}

export function demoCreatorMatches(): CreatorMatch[] {
  const [amara, daniel, jordan, marcus, priya, sofia] = CREATORS;
  return [
    demoMatch(amara!, jordan!, 88),
    demoMatch(daniel!, sofia!, 84),
    demoMatch(marcus!, priya!, 81),
    demoMatch(jordan!, marcus!, 79),
  ];
}

export function demoPopularMatchCards(): StoredMatchCard[] {
  return [
    { title: "Beauty influencer", subtitle: "+ Skincare brand", specialty: "beauty", image: "/demo/categories/cat-beauty.jpg" },
    { title: "Food influencer", subtitle: "+ Kitchen brand", specialty: "food", image: "/demo/categories/cat-food.jpg" },
    { title: "Travel influencer", subtitle: "+ Hospitality brand", specialty: "travel", image: "/demo/categories/cat-travel.jpg" },
    { title: "Fitness influencer", subtitle: "+ Wellness brand", specialty: "fitness", image: "/demo/categories/cat-fitness.jpg" },
    { title: "Fashion influencer", subtitle: "+ Apparel brand", specialty: "fashion", image: "/demo/categories/cat-fashion.jpg" },
    { title: "Tech influencer", subtitle: "+ Gadget brand", specialty: "tech", image: "/demo/categories/cat-tech.jpg" },
  ];
}

export type DemoBusinessRequest = {
  id: string;
  brand: string;
  budget: string;
  location: string;
  summary: string;
  logoUrl: string | null;
};

export function demoBusinessRequests(): DemoBusinessRequest[] {
  return [
    {
      id: "demo-request-northline",
      brand: "Northline Studio",
      budget: "Demo budget",
      location: "Accra",
      summary: "Demo preview of a business request. This is not a live campaign.",
      logoUrl: null,
    },
    {
      id: "demo-request-harbor",
      brand: "Harbor & Co.",
      budget: "Demo budget",
      location: "Lisbon",
      summary: "Demo preview of a business request. This is not a live campaign.",
      logoUrl: null,
    },
    {
      id: "demo-request-fieldday",
      brand: "Fieldday Goods",
      budget: "Demo budget",
      location: "Austin",
      summary: "Demo preview of a business request. This is not a live campaign.",
      logoUrl: null,
    },
  ];
}

export type DemoOpportunity = {
  id: string;
  creatorSlug: string;
  lookingFor: string;
};

export function demoOpportunities(): DemoOpportunity[] {
  return [
    { id: "demo-opp-amara", creatorSlug: "demo-amara", lookingFor: "a skincare collaboration" },
    { id: "demo-opp-daniel", creatorSlug: "demo-daniel", lookingFor: "a food series partner" },
    { id: "demo-opp-jordan", creatorSlug: "demo-jordan", lookingFor: "an apparel launch" },
    { id: "demo-opp-marcus", creatorSlug: "demo-marcus", lookingFor: "a training series" },
  ];
}

/** Stored public profiles. Off, and any read error, keeps the demo set. */
export async function publicPagesUseLive(): Promise<boolean> {
  return productSwitch("public_pages_live");
}
