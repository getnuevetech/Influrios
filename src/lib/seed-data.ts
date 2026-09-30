export type SeedSocial = {
  platform: "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "X" | "WEBSITE";
  handle: string;
  url: string;
  followers: number;
};

export type SeedContent = {
  id: string;
  category: string;
  platform: string;
  image: string;
  views: string;
  likes: string;
};

export type SeedCreator = {
  slug: string;
  displayName: string;
  title: string;
  bio: string;
  locationCity: string;
  locationState?: string;
  locationCountry: string;
  languages: string[];
  avatarColor: string;
  image: string;
  coverImage?: string;
  badge: string;
  statusLabel: string;
  planTier: "STARTER" | "PLUS" | "PRO";
  specialties: string[];
  socials: SeedSocial[];
  openToCollab: boolean;
  offer?: string;
  need?: string;
  age?: number;
  email?: string;
  verified?: boolean;
  stats?: {
    engagementRate: string;
    engagementDelta: string;
    totalReach: string;
    reachDelta: string;
    avgViews: string;
    viewsDelta: string;
    collaborations: string;
    collabDelta: string;
  };
  demographics?: {
    female: number;
    male: number;
    locations: { name: string; pct: number }[];
    ages: { range: string; pct: number }[];
  };
  collabPrefs?: string[];
  polaroids?: { image: string; caption: string }[];
  featuredContent?: SeedContent[];
  linktree?: string;
  bannerTagline?: string;
  bannerScriptTags?: string;
  brands?: { name: string; logo: string }[];
};

export const CATEGORY_IMAGES: Record<string, string> = {
  beauty: "/demo/categories/cat-beauty.jpg",
  fashion: "/demo/categories/cat-fashion.jpg",
  food: "/demo/categories/cat-food.jpg",
  "home-interior": "/demo/categories/cat-home.jpg",
  hair: "/demo/categories/cat-hair.jpg",
  suppliers: "/demo/categories/cat-suppliers.jpg",
  travel: "/demo/categories/cat-travel.jpg",
  fitness: "/demo/categories/cat-fitness.jpg",
  tech: "/demo/categories/cat-tech.jpg",
  lifestyle: "/demo/categories/cat-lifestyle.jpg",
};

export const SPECIALTY_TAXONOMY: {
  slug: string;
  name: string;
  children?: { slug: string; name: string }[];
}[] = [
  {
    slug: "beauty",
    name: "Beauty",
    children: [
      { slug: "natural-hair", name: "Natural Hair" },
      { slug: "protective-styles", name: "Protective Styles" },
      { slug: "skincare", name: "Skincare" },
      { slug: "makeup", name: "Makeup" },
      { slug: "self-care", name: "Self Care" },
    ],
  },
  {
    slug: "fashion",
    name: "Fashion",
    children: [
      { slug: "streetwear", name: "Streetwear" },
      { slug: "sustainable-fashion", name: "Sustainable Fashion" },
    ],
  },
  {
    slug: "food",
    name: "Food",
    children: [
      { slug: "recipes", name: "Recipes" },
      { slug: "restaurant-reviews", name: "Restaurant Reviews" },
    ],
  },
  {
    slug: "home-interior",
    name: "Home & Interior",
    children: [
      { slug: "interior-design", name: "Interior Design" },
      { slug: "woodworking", name: "Woodworking" },
      { slug: "custom-cabinetry", name: "Custom Cabinetry" },
    ],
  },
  {
    slug: "hair",
    name: "Hair",
    children: [
      { slug: "hair-styling", name: "Hair Styling" },
      { slug: "hair-supply", name: "Hair Supply" },
    ],
  },
  {
    slug: "travel",
    name: "Travel",
    children: [
      { slug: "budget-travel", name: "Budget Travel" },
      { slug: "luxury-travel", name: "Luxury Travel" },
    ],
  },
  {
    slug: "fitness",
    name: "Fitness",
    children: [
      { slug: "training", name: "Training" },
      { slug: "nutrition", name: "Nutrition" },
    ],
  },
  {
    slug: "tech",
    name: "Tech",
    children: [
      { slug: "consumer-tech", name: "Consumer Tech" },
      { slug: "smart-home", name: "Smart Home" },
      { slug: "cybersecurity", name: "Cybersecurity" },
    ],
  },
  { slug: "lifestyle", name: "Lifestyle" },
  { slug: "suppliers", name: "Suppliers" },
];

export const SEED_CREATORS: SeedCreator[] = [
  {
    slug: "sofia-martinez",
    displayName: "Sofia Martinez",
    title: "Beauty & Lifestyle Creator",
    bio: "Helping people create brighter, more confident routines through honest beauty content, travel moments, and brand stories that feel real.",
    locationCity: "Los Angeles",
    locationState: "California",
    locationCountry: "USA",
    languages: ["English", "Spanish"],
    avatarColor: "#633CFF",
    image: "/demo/creators/creator-sofia.jpg",
    coverImage: "/demo/sofia/sofia-banner.jpg",
    badge: "Top Creator",
    statusLabel: "Open to Collaborations",
    planTier: "PLUS",
    verified: true,
    specialties: ["beauty", "lifestyle", "fashion", "travel", "self-care"],
    socials: [
      { platform: "INSTAGRAM", handle: "@sofia.m", url: "https://instagram.com/sofia.m", followers: 2_400_000 },
      { platform: "TIKTOK", handle: "@sofiam", url: "https://tiktok.com/@sofiam", followers: 1_800_000 },
      { platform: "YOUTUBE", handle: "Sofia Martinez", url: "https://youtube.com/@sofiam", followers: 620_000 },
      { platform: "X", handle: "@sofiam", url: "https://x.com/sofiam", followers: 480_000 },
      { platform: "WEBSITE", handle: "sofiamartinez.com", url: "https://sofiamartinez.com", followers: 120_000 },
    ],
    openToCollab: true,
    offer: "Beauty tutorials and product education",
    need: "Skincare brands and hair-care specialists",
    age: 27,
    email: "sofia@influrios.com",
    linktree: "linktr.ee/sofiamartinez",
    bannerTagline: "Create a Brighter You",
    bannerScriptTags: "Beauty / Lifestyle / Travel / Good Vibes / Always",
    brands: [
      { name: "L'Oréal", logo: "/demo/brands/loreal.svg" },
      { name: "Sephora", logo: "/demo/brands/sephora.svg" },
      { name: "Laneige", logo: "/demo/brands/laneige.svg" },
      { name: "Glossier", logo: "/demo/brands/glossier.svg" },
      { name: "Amazon", logo: "/demo/brands/amazon.svg" },
      { name: "Airbnb", logo: "/demo/brands/airbnb.svg" },
      { name: "Samsung", logo: "/demo/brands/samsung.svg" },
      { name: "eos", logo: "/demo/brands/eos.svg" },
    ],
    stats: {
      engagementRate: "4.8%",
      engagementDelta: "+12% from last month",
      totalReach: "12.6M",
      reachDelta: "+28% from last month",
      avgViews: "1.2M",
      viewsDelta: "+18% from last month",
      collaborations: "120+",
      collabDelta: "+32% from last year",
    },
    demographics: {
      female: 72,
      male: 28,
      locations: [
        { name: "Los Angeles, USA", pct: 24 },
        { name: "New York, USA", pct: 18 },
        { name: "London, UK", pct: 12 },
        { name: "Toronto, Canada", pct: 8 },
        { name: "Sydney, Australia", pct: 6 },
      ],
      ages: [
        { range: "13-17", pct: 8 },
        { range: "18-24", pct: 32 },
        { range: "25-34", pct: 36 },
        { range: "35-44", pct: 18 },
        { range: "45+", pct: 6 },
      ],
    },
    collabPrefs: [
      "Sponsored Content",
      "Events & Experiences",
      "Product Reviews",
      "Travel Partnerships",
      "Brand Campaigns",
      "Long-term Ambassadorships",
    ],
    polaroids: [
      { image: "/demo/sofia/sofia-polaroid-1.jpg", caption: "Good Beauty. Real Life." },
      { image: "/demo/sofia/sofia-polaroid-2.jpg", caption: "Explore More." },
      { image: "/demo/sofia/sofia-polaroid-3.jpg", caption: "Same Girl. Bigger Dreams." },
    ],
    featuredContent: [
      { id: "1", category: "Beauty", platform: "Instagram", image: "/demo/content/content-beauty-1.jpg", views: "1.2M", likes: "89K" },
      { id: "2", category: "Lifestyle", platform: "TikTok", image: "/demo/content/content-beauty-2.jpg", views: "2.4M", likes: "210K" },
      { id: "3", category: "Travel", platform: "YouTube", image: "/demo/content/content-travel-1.jpg", views: "980K", likes: "72K" },
      { id: "4", category: "Fashion", platform: "Instagram", image: "/demo/content/content-lifestyle-1.jpg", views: "1.1M", likes: "68K" },
      { id: "5", category: "Beauty", platform: "TikTok", image: "/demo/content/content-fashion-1.jpg", views: "1.9M", likes: "154K" },
      { id: "6", category: "Brand Collaborations", platform: "Instagram", image: "/demo/content/content-collab-1.jpg", views: "850K", likes: "46K" },
    ],
  },
  {
    slug: "daniel-kim",
    displayName: "Daniel Kim",
    title: "Travel & Tech Creator",
    bio: "Destination storytelling with a focus on tourism partnerships and multi-city itineraries.",
    locationCity: "Seoul",
    locationState: "Seoul",
    locationCountry: "South Korea",
    languages: ["English", "Korean"],
    avatarColor: "#2979FF",
    image: "/demo/creators/creator-daniel.jpg",
    badge: "Rising Star",
    statusLabel: "Open to Collaborations",
    planTier: "PLUS",
    verified: true,
    specialties: ["travel"],
    socials: [
      { platform: "INSTAGRAM", handle: "@daniel.travels", url: "https://instagram.com/daniel.travels", followers: 890_000 },
      { platform: "YOUTUBE", handle: "@danieltravels", url: "https://youtube.com/@danieltravels", followers: 210_000 },
    ],
    openToCollab: true,
    offer: "Travel itinerary content",
    need: "Local food creators",
  },
  {
    slug: "priya-sharma",
    displayName: "Priya Sharma",
    title: "Food & Lifestyle Creator",
    bio: "Room transformations and accessible design for urban apartments.",
    locationCity: "Mumbai",
    locationState: "Maharashtra",
    locationCountry: "India",
    languages: ["English", "Hindi"],
    avatarColor: "#7B46F6",
    image: "/demo/creators/creator-priya.jpg",
    badge: "Business Friendly",
    statusLabel: "Great for Brand Collaborations",
    planTier: "PRO",
    verified: true,
    specialties: ["home-interior", "interior-design", "woodworking"],
    socials: [
      { platform: "INSTAGRAM", handle: "@priya.spaces", url: "https://instagram.com/priya.spaces", followers: 1_200_000 },
      { platform: "YOUTUBE", handle: "Priya Spaces", url: "https://youtube.com/@priyaspaces", followers: 740_000 },
      { platform: "TIKTOK", handle: "@priyaspaces", url: "https://tiktok.com/@priyaspaces", followers: 980_000 },
      { platform: "WEBSITE", handle: "priyaspaces.com", url: "https://priyaspaces.com", followers: 95_000 },
    ],
    openToCollab: true,
    offer: "Interior design transformations",
    need: "Custom woodwork / cabinetry creators",
  },
  {
    slug: "marcus-lee",
    displayName: "Marcus Lee",
    title: "Fitness & Wellness Creator",
    bio: "Strength training and recovery education for busy professionals.",
    locationCity: "Austin",
    locationState: "Texas",
    locationCountry: "USA",
    languages: ["English"],
    avatarColor: "#111A5A",
    image: "/demo/creators/creator-marcus.jpg",
    badge: "Fast Growing",
    statusLabel: "Open to Collaborations",
    planTier: "PLUS",
    verified: true,
    specialties: ["fitness", "training"],
    socials: [
      { platform: "INSTAGRAM", handle: "@marcus.fit", url: "https://instagram.com/marcus.fit", followers: 640_000 },
      { platform: "YOUTUBE", handle: "Marcus Lee Fit", url: "https://youtube.com/@marcusleefit", followers: 410_000 },
      { platform: "TIKTOK", handle: "@marcusfit", url: "https://tiktok.com/@marcusfit", followers: 1_100_000 },
    ],
    openToCollab: true,
    offer: "Training program content",
    need: "Nutrition creators",
  },
  {
    slug: "amara-okonkwo",
    displayName: "Amara Okonkwo",
    title: "Natural Hair Educator",
    bio: "Protective styles and natural-hair education for beauty audiences in Houston and beyond.",
    locationCity: "Houston",
    locationState: "Texas",
    locationCountry: "USA",
    languages: ["English"],
    avatarColor: "#E879F9",
    image: "/demo/creators/creator-amara.jpg",
    badge: "Rising Star",
    statusLabel: "Open to Collaborations",
    planTier: "STARTER",
    verified: false,
    specialties: ["natural-hair", "beauty", "hair"],
    socials: [
      { platform: "INSTAGRAM", handle: "@amara.hair", url: "https://instagram.com/amara.hair", followers: 312_000 },
    ],
    openToCollab: true,
    offer: "Natural-hair tutorials",
    need: "Hair product suppliers",
  },
  {
    slug: "jordan-blake",
    displayName: "Jordan Blake",
    title: "Fashion & Lifestyle Creator",
    bio: "Consumer tech reviews and integrated smart-home walkthroughs.",
    locationCity: "London",
    locationState: "England",
    locationCountry: "UK",
    languages: ["English"],
    avatarColor: "#4979FF",
    image: "/demo/creators/creator-jordan.jpg",
    badge: "High Engagement",
    statusLabel: "Great for Brand Collaborations",
    planTier: "PLUS",
    verified: true,
    specialties: ["tech", "smart-home", "consumer-tech"],
    socials: [
      { platform: "YOUTUBE", handle: "Jordan Blake Tech", url: "https://youtube.com/@jordanblake", followers: 1_500_000 },
      { platform: "INSTAGRAM", handle: "@jordan.tech", url: "https://instagram.com/jordan.tech", followers: 420_000 },
      { platform: "X", handle: "@jordanblake", url: "https://x.com/jordanblake", followers: 210_000 },
    ],
    openToCollab: true,
    offer: "Product demos and install walkthroughs",
    need: "Home security creators",
  },
];

export const COLLAB_MATCH_PRESETS = [
  {
    title: "Interior Designer + Woodwork Creator",
    image: "/demo/categories/cat-home.jpg",
    tags: ["Design", "Craft", "Home Decor"],
    leftSlug: "sofia-martinez",
    rightSlug: "daniel-kim",
  },
  {
    title: "Hair Stylist + Hair Supplier",
    image: "/demo/categories/cat-hair.jpg",
    tags: ["Beauty", "Hair", "Supply"],
    leftSlug: "amara-okonkwo",
    rightSlug: "priya-sharma",
  },
  {
    title: "Food Creator + Kitchen Brand",
    image: "/demo/categories/cat-food.jpg",
    tags: ["Food", "Kitchen", "Brand"],
    leftSlug: "marcus-lee",
    rightSlug: "jordan-blake",
  },
  {
    title: "Travel Influencer + Tourism Brand",
    image: "/demo/categories/cat-travel.jpg",
    tags: ["Travel", "Tourism"],
    leftSlug: "priya-sharma",
    rightSlug: "sofia-martinez",
  },
];

export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(n);
}

export function getCreatorBySlug(slug: string) {
  return SEED_CREATORS.find((c) => c.slug === slug);
}

export function searchCreators(query: {
  q?: string;
  specialty?: string;
  location?: string;
  country?: string;
  state?: string;
  city?: string;
  platform?: string;
  language?: string;
  followersMin?: string | number;
  followersMax?: string | number;
  engagementMin?: string | number;
  openToCollab?: string | boolean;
  verified?: string | boolean;
  sort?: string;
}) {
  const q = query.q?.toLowerCase().trim();
  const specialty = query.specialty?.toLowerCase();
  const location = query.location?.toLowerCase();
  const country = query.country?.toLowerCase();
  const state = query.state?.toLowerCase();
  const city = query.city?.toLowerCase();
  const platform = query.platform?.toUpperCase();
  const language = query.language?.toLowerCase();
  const followersMin = Number(query.followersMin || 0) || 0;
  const followersMax = Number(query.followersMax || 0) || 0;
  const engagementMin = Number(query.engagementMin || 0) || 0;
  const openOnly =
    query.openToCollab === true ||
    query.openToCollab === "1" ||
    query.openToCollab === "true" ||
    query.openToCollab === "on";
  const verifiedOnly =
    query.verified === true ||
    query.verified === "1" ||
    query.verified === "true" ||
    query.verified === "on";

  let results = SEED_CREATORS.filter((c) => {
    if (q) {
      const hay =
        `${c.displayName} ${c.title} ${c.bio} ${c.specialties.join(" ")} ${c.locationCity} ${c.locationCountry}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (specialty && !c.specialties.some((s) => s === specialty || s.includes(specialty))) return false;
    if (location) {
      const loc = `${c.locationCity} ${c.locationState ?? ""} ${c.locationCountry}`.toLowerCase();
      if (!loc.includes(location)) return false;
    }
    if (country && c.locationCountry.toLowerCase() !== country) return false;
    if (state && (c.locationState ?? "").toLowerCase() !== state) return false;
    if (city && c.locationCity.toLowerCase() !== city) return false;
    if (platform && !c.socials.some((s) => s.platform === platform)) return false;
    if (language && !c.languages.some((l) => l.toLowerCase() === language)) return false;
    const followers = totalFollowers(c);
    if (followersMin && followers < followersMin) return false;
    if (followersMax && followers > followersMax) return false;
    if (engagementMin) {
      const rate = parseFloat(c.stats?.engagementRate ?? "0");
      if (rate < engagementMin) return false;
    }
    if (openOnly && !c.openToCollab) return false;
    if (verifiedOnly && c.verified === false) return false;
    return true;
  });

  const sort = query.sort || "relevant";
  if (sort === "followers") {
    results = [...results].sort((a, b) => totalFollowers(b) - totalFollowers(a));
  } else if (sort === "engagement") {
    results = [...results].sort(
      (a, b) => parseFloat(b.stats?.engagementRate ?? "0") - parseFloat(a.stats?.engagementRate ?? "0"),
    );
  } else if (sort === "name") {
    results = [...results].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  return results;
}

export function getLocationOptions() {
  const countries = new Map<string, Map<string, Set<string>>>();
  for (const c of SEED_CREATORS) {
    const country = c.locationCountry;
    const state = c.locationState || "—";
    if (!countries.has(country)) countries.set(country, new Map());
    const states = countries.get(country)!;
    if (!states.has(state)) states.set(state, new Set());
    states.get(state)!.add(c.locationCity);
  }
  return [...countries.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([country, states]) => ({
      country,
      states: [...states.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([state, cities]) => ({
          state,
          cities: [...cities].sort(),
        })),
    }));
}

export function getLanguageOptions() {
  const set = new Set<string>();
  for (const c of SEED_CREATORS) for (const l of c.languages) set.add(l);
  return [...set].sort();
}

export function specialtyLabel(slug: string): string {
  for (const parent of SPECIALTY_TAXONOMY) {
    if (parent.slug === slug) return parent.name;
    const child = parent.children?.find((c) => c.slug === slug);
    if (child) return child.name;
  }
  return slug;
}

export function totalFollowers(creator: SeedCreator): number {
  return creator.socials.reduce((sum, s) => sum + s.followers, 0);
}
