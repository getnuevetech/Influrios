import { samePlace } from "@/lib/place-names";

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
  /** Presentation gender for default avatars — not demographics audience gender. */
  gender?: "male" | "female" | "unspecified";
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
  parenting: "/demo/categories/cat-parenting.jpg",
  finance: "/demo/categories/cat-finance.jpg",
  gaming: "/demo/categories/cat-gaming.jpg",
  music: "/demo/categories/cat-music.jpg",
  comedy: "/demo/categories/cat-comedy.jpg",
  education: "/demo/categories/cat-education.jpg",
  sports: "/demo/categories/cat-sports.jpg",
  automotive: "/demo/categories/cat-automotive.jpg",
  pets: "/demo/categories/cat-pets.jpg",
  photography: "/demo/categories/cat-photography.jpg",
  art: "/demo/categories/cat-art.jpg",
  business: "/demo/categories/cat-business.jpg",
  health: "/demo/categories/cat-health.jpg",
  outdoors: "/demo/categories/cat-outdoors.jpg",
  sustainability: "/demo/categories/cat-sustainability.jpg",
  entertainment: "/demo/categories/cat-entertainment.jpg",
  dance: "/demo/categories/cat-dance.jpg",
  books: "/demo/categories/cat-books.jpg",
  diy: "/demo/categories/cat-diy.jpg",
  weddings: "/demo/categories/cat-weddings.jpg",
  "real-estate": "/demo/categories/cat-real-estate.jpg",
  luxury: "/demo/categories/cat-luxury.jpg",
  science: "/demo/categories/cat-science.jpg",
  news: "/demo/categories/cat-news.jpg",
  spirituality: "/demo/categories/cat-spirituality.jpg",
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
      { slug: "nails", name: "Nails" },
      { slug: "fragrance", name: "Fragrance" },
    ],
  },
  {
    slug: "fashion",
    name: "Fashion",
    children: [
      { slug: "streetwear", name: "Streetwear" },
      { slug: "sustainable-fashion", name: "Sustainable Fashion" },
      { slug: "menswear", name: "Menswear" },
      { slug: "modest-fashion", name: "Modest Fashion" },
    ],
  },
  {
    slug: "food",
    name: "Food",
    children: [
      { slug: "recipes", name: "Recipes" },
      { slug: "restaurant-reviews", name: "Restaurant Reviews" },
      { slug: "baking", name: "Baking" },
      { slug: "vegan", name: "Vegan" },
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
      { slug: "adventure-travel", name: "Adventure Travel" },
      { slug: "solo-travel", name: "Solo Travel" },
    ],
  },
  {
    slug: "fitness",
    name: "Fitness",
    children: [
      { slug: "training", name: "Training" },
      { slug: "nutrition", name: "Nutrition" },
      { slug: "yoga", name: "Yoga" },
      { slug: "running", name: "Running" },
    ],
  },
  {
    slug: "tech",
    name: "Tech",
    children: [
      { slug: "consumer-tech", name: "Consumer Tech" },
      { slug: "smart-home", name: "Smart Home" },
      { slug: "cybersecurity", name: "Cybersecurity" },
      { slug: "apps", name: "Apps" },
      { slug: "ai-tools", name: "AI Tools" },
    ],
  },
  {
    slug: "lifestyle",
    name: "Lifestyle",
    children: [
      { slug: "relationships", name: "Relationships" },
      { slug: "productivity", name: "Productivity" },
    ],
  },
  { slug: "suppliers", name: "Suppliers" },
  {
    slug: "parenting",
    name: "Parenting",
    children: [
      { slug: "family", name: "Family" },
      { slug: "kids-activities", name: "Kids Activities" },
      { slug: "pregnancy", name: "Pregnancy" },
    ],
  },
  {
    slug: "finance",
    name: "Finance",
    children: [
      { slug: "personal-finance", name: "Personal Finance" },
      { slug: "investing", name: "Investing" },
      { slug: "crypto", name: "Crypto" },
    ],
  },
  {
    slug: "gaming",
    name: "Gaming",
    children: [
      { slug: "esports", name: "Esports" },
      { slug: "game-reviews", name: "Game Reviews" },
      { slug: "streaming", name: "Streaming" },
    ],
  },
  {
    slug: "music",
    name: "Music",
    children: [
      { slug: "singing", name: "Singing" },
      { slug: "music-production", name: "Music Production" },
      { slug: "dj", name: "DJ" },
    ],
  },
  {
    slug: "comedy",
    name: "Comedy",
    children: [
      { slug: "sketch", name: "Sketch" },
      { slug: "standup", name: "Stand-up" },
    ],
  },
  {
    slug: "education",
    name: "Education",
    children: [
      { slug: "study-tips", name: "Study Tips" },
      { slug: "language-learning", name: "Language Learning" },
      { slug: "career-advice", name: "Career Advice" },
    ],
  },
  {
    slug: "sports",
    name: "Sports",
    children: [
      { slug: "football", name: "Football" },
      { slug: "basketball", name: "Basketball" },
      { slug: "soccer", name: "Soccer" },
    ],
  },
  {
    slug: "automotive",
    name: "Automotive",
    children: [
      { slug: "cars", name: "Cars" },
      { slug: "motorcycles", name: "Motorcycles" },
    ],
  },
  {
    slug: "pets",
    name: "Pets",
    children: [
      { slug: "dogs", name: "Dogs" },
      { slug: "cats", name: "Cats" },
    ],
  },
  {
    slug: "photography",
    name: "Photography",
    children: [
      { slug: "portrait", name: "Portrait" },
      { slug: "photo-editing", name: "Photo Editing" },
    ],
  },
  {
    slug: "art",
    name: "Art",
    children: [
      { slug: "illustration", name: "Illustration" },
      { slug: "design", name: "Design" },
    ],
  },
  {
    slug: "business",
    name: "Business",
    children: [
      { slug: "entrepreneurship", name: "Entrepreneurship" },
      { slug: "marketing", name: "Marketing" },
    ],
  },
  {
    slug: "health",
    name: "Health",
    children: [
      { slug: "mental-health", name: "Mental Health" },
      { slug: "wellness", name: "Wellness" },
    ],
  },
  {
    slug: "outdoors",
    name: "Outdoors",
    children: [
      { slug: "hiking", name: "Hiking" },
      { slug: "camping", name: "Camping" },
    ],
  },
  {
    slug: "sustainability",
    name: "Sustainability",
    children: [
      { slug: "climate", name: "Climate" },
      { slug: "zero-waste", name: "Zero Waste" },
    ],
  },
  {
    slug: "entertainment",
    name: "Entertainment",
    children: [
      { slug: "movies", name: "Movies" },
      { slug: "tv", name: "TV" },
      { slug: "celebrity", name: "Celebrity" },
    ],
  },
  {
    slug: "dance",
    name: "Dance",
    children: [{ slug: "choreography", name: "Choreography" }],
  },
  {
    slug: "books",
    name: "Books",
    children: [{ slug: "book-reviews", name: "Book Reviews" }],
  },
  {
    slug: "diy",
    name: "DIY",
    children: [
      { slug: "crafts", name: "Crafts" },
      { slug: "home-projects", name: "Home Projects" },
    ],
  },
  {
    slug: "weddings",
    name: "Weddings",
    children: [
      { slug: "bridal", name: "Bridal" },
      { slug: "event-planning", name: "Event Planning" },
    ],
  },
  {
    slug: "real-estate",
    name: "Real Estate",
    children: [{ slug: "home-tours", name: "Home Tours" }],
  },
  {
    slug: "luxury",
    name: "Luxury",
    children: [
      { slug: "watches", name: "Watches" },
      { slug: "fine-living", name: "Fine Living" },
    ],
  },
  {
    slug: "science",
    name: "Science",
    children: [
      { slug: "space", name: "Space" },
      { slug: "explainers", name: "Explainers" },
    ],
  },
  {
    slug: "news",
    name: "News",
    children: [{ slug: "commentary", name: "Commentary" }],
  },
  {
    slug: "spirituality",
    name: "Spirituality",
    children: [{ slug: "mindfulness", name: "Mindfulness" }],
  },
];

export const SEED_CREATORS: SeedCreator[] = [
  {
    slug: "sofia-martinez",
    displayName: "Sofia Martinez",
    title: "Beauty & Lifestyle Influencer",
    bio: "Helping people create brighter, more confident routines through honest beauty content, travel moments, and brand stories that feel real.",
    locationCity: "Los Angeles",
    locationState: "California",
    locationCountry: "USA",
    languages: ["English", "Spanish"],
    avatarColor: "#633CFF",
    image: "/demo/creators/creator-sofia.jpg",
    coverImage: "/demo/sofia/sofia-banner.jpg",
    badge: "Top Influencer",
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
      { id: "7", category: "Lifestyle", platform: "YouTube", image: "/demo/content/content-lifestyle-1.jpg", views: "1.5M", likes: "112K" },
      { id: "8", category: "Travel", platform: "TikTok", image: "/demo/content/content-travel-1.jpg", views: "3.1M", likes: "278K" },
      { id: "9", category: "Fashion", platform: "Instagram", image: "/demo/content/content-fashion-1.jpg", views: "720K", likes: "51K" },
      { id: "10", category: "Beauty", platform: "YouTube", image: "/demo/content/content-beauty-1.jpg", views: "2.0M", likes: "163K" },
      { id: "11", category: "Brand Collaborations", platform: "TikTok", image: "/demo/content/content-collab-1.jpg", views: "1.4M", likes: "97K" },
      { id: "12", category: "Lifestyle", platform: "Instagram", image: "/demo/content/content-beauty-2.jpg", views: "640K", likes: "38K" },
      { id: "13", category: "Travel", platform: "Instagram", image: "/demo/content/content-travel-1.jpg", views: "1.8M", likes: "124K" },
      { id: "14", category: "Fashion", platform: "TikTok", image: "/demo/content/content-lifestyle-1.jpg", views: "2.7M", likes: "201K" },
      { id: "15", category: "Beauty", platform: "Instagram", image: "/demo/content/content-fashion-1.jpg", views: "990K", likes: "77K" },
    ],
  },
  {
    slug: "daniel-kim",
    displayName: "Daniel Kim",
    title: "Travel & Tech Influencer",
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
    need: "Local food influencers",
  },
  {
    slug: "priya-sharma",
    displayName: "Priya Sharma",
    title: "Food & Lifestyle Influencer",
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
    need: "Custom woodwork / cabinetry influencers",
  },
  {
    slug: "marcus-lee",
    displayName: "Marcus Lee",
    title: "Fitness & Wellness Influencer",
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
    need: "Nutrition influencers",
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
    title: "Fashion & Lifestyle Influencer",
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
    need: "Home security influencers",
  },
];

export const COLLAB_MATCH_PRESETS = [
  {
    title: "Interior Designer + Woodwork Influencer",
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
    title: "Food Influencer + Kitchen Brand",
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
  {
    title: "Beauty Influencer + Skincare Partner",
    image: "/demo/categories/cat-beauty.jpg",
    tags: ["Beauty", "Skincare", "Launch"],
    leftSlug: "sofia-martinez",
    rightSlug: "amara-okonkwo",
  },
  {
    title: "Fitness Influencer + Wellness Brand",
    image: "/demo/categories/cat-fitness.jpg",
    tags: ["Fitness", "Wellness"],
    leftSlug: "jordan-blake",
    rightSlug: "marcus-lee",
  },
  {
    title: "Tech Reviewer + Gadget Launch",
    image: "/demo/categories/cat-tech.jpg",
    tags: ["Tech", "Reviews", "Launch"],
    leftSlug: "priya-sharma",
    rightSlug: "daniel-kim",
  },
  {
    title: "Fashion Influencer + Streetwear Label",
    image: "/demo/categories/cat-fashion.jpg",
    tags: ["Fashion", "Streetwear"],
    leftSlug: "amara-okonkwo",
    rightSlug: "jordan-blake",
  },
  {
    title: "Lifestyle Influencer + Home Brand",
    image: "/demo/categories/cat-lifestyle.jpg",
    tags: ["Lifestyle", "Home"],
    leftSlug: "marcus-lee",
    rightSlug: "sofia-martinez",
  },
  {
    title: "Supplier + Stylist Restock Drop",
    image: "/demo/categories/cat-suppliers.jpg",
    tags: ["Supply", "Beauty", "Retail"],
    leftSlug: "daniel-kim",
    rightSlug: "amara-okonkwo",
  },
];

/** An uploaded image. Paths under /demo/ are retired sample art and are not shown. */
export function publicStoredImage(src: string | null | undefined): string {
  const value = (src ?? "").trim();
  if (!value || value.includes("/demo/")) return "";
  return value;
}

/** Niche photo. Uploaded images and /demo/categories/ stay. Other /demo/ art stays hidden. */
export function publicNicheImage(src: string | null | undefined): string {
  const value = (src ?? "").trim();
  if (!value || (value.includes("/demo/") && !value.includes("/demo/categories/"))) return "";
  return value;
}

/** Uploaded category image, or the niche photo for that specialty. */
export function publicCategoryImage(slug: string, stored?: string | null): string {
  return publicStoredImage(stored) || publicNicheImage(categoryImageFor(slug));
}

/** Niche photo saved with a collaboration pair title. Unknown titles stay blank. */
export function nicheImageForMatchTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "";
  const preset = COLLAB_MATCH_PRESETS.find((item) => item.title === trimmed);
  return preset ? publicNicheImage(preset.image) : "";
}

/** Resolve a specialty slug to the retired category photo path. Public pages use publicStoredImage. */
export function categoryImageFor(
  slug: string,
  taxonomy: { slug: string; children?: { slug: string }[] }[] = SPECIALTY_TAXONOMY,
): string {
  if (CATEGORY_IMAGES[slug]) return CATEGORY_IMAGES[slug]!;
  for (const parent of taxonomy) {
    if (parent.children?.some((child) => child.slug === slug)) {
      return CATEGORY_IMAGES[parent.slug] ?? CATEGORY_IMAGES.lifestyle!;
    }
  }
  return CATEGORY_IMAGES.lifestyle!;
}

/** Public name for a stored social network. Unknown codes stay as stored. */
export function platformDisplayName(platform: string): string {
  if (platform === "INSTAGRAM") return "Instagram";
  if (platform === "TIKTOK") return "TikTok";
  if (platform === "YOUTUBE") return "YouTube";
  if (platform === "X") return "X";
  if (platform === "WEBSITE") return "Website";
  if (platform === "PINTEREST") return "Pinterest";
  return platform;
}

export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(n);
}

export function getCreatorBySlug(slug: string) {
  /** Seed/fixture lookup only. Product pages should use getDirectoryCreator / listDirectoryCreators. */
  return SEED_CREATORS.find((c) => c.slug === slug);
}

export function indexCreatorsBySlug<T extends { slug: string }>(creators: readonly T[]): Map<string, T> {
  return new Map(creators.map((creator) => [creator.slug, creator]));
}

export type CreatorSearchQuery = {
  q?: string;
  specialty?: string | string[];
  location?: string;
  country?: string | string[];
  state?: string;
  city?: string;
  platform?: string | string[];
  language?: string;
  followersMin?: string | number;
  followersMax?: string | number;
  engagementMin?: string | number;
  engagementMax?: string | number;
  collabType?: string;
  rate?: string;
  openToCollab?: string | boolean;
  verified?: string | boolean;
  sort?: string;
};

function queryList(value?: string | string[] | number | boolean): string[] {
  if (value == null || typeof value === "number" || typeof value === "boolean") return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw.flatMap((item) => String(item).split(",")).map((item) => item.trim()).filter(Boolean);
}

export function filterCreators(
  creators: SeedCreator[],
  query: CreatorSearchQuery,
  synonyms: { term: string; slug: string }[] = [],
) {
  const q = query.q?.toLowerCase().trim();
  const specialties = queryList(query.specialty).map((item) => item.toLowerCase());
  const location = query.location?.toLowerCase();
  const countries = queryList(query.country).map((item) => item.toLowerCase());
  const state = query.state?.toLowerCase();
  const city = query.city?.toLowerCase();
  const platforms = queryList(query.platform).map((item) => item.toUpperCase());
  const language = query.language?.toLowerCase();
  const followersMin = Number(query.followersMin || 0) || 0;
  const followersMax = Number(query.followersMax || 0) || 0;
  const engagementMin = Number(query.engagementMin || 0) || 0;
  const engagementMax = Number(query.engagementMax || 0) || 0;
  const collabType = query.collabType?.toLowerCase().trim();
  const rate = query.rate?.toLowerCase().trim();
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

  let results = creators.filter((c) => {
    if (q) {
      // Terminology addendum: treat creator / content creator / influencer as related role queries.
      // Keep list in sync with ROLE_SEARCH_SYNONYMS in landing-pages.ts (avoid circular import).
      const roleOnly = ["creator", "creators", "content creator", "influencer", "influencers"].includes(q);
      if (!roleOnly) {
        const aliasWords = c.specialties
          .flatMap((slug) => synonyms.filter((row) => row.slug === slug).map((row) => row.term))
          .join(" ");
        const hay =
          `${c.displayName} ${c.title} ${c.bio} ${c.specialties.join(" ")} ${aliasWords} ${c.locationCity} ${c.locationCountry} influencer influencers creator creators content creator`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
    }
    if (
      specialties.length &&
      !c.specialties.some((s) => specialties.some((selected) => s === selected || s.includes(selected)))
    ) {
      return false;
    }
    if (location) {
      const loc = `${c.locationCity} ${c.locationState ?? ""} ${c.locationCountry}`.toLowerCase();
      if (!loc.includes(location)) return false;
    }
    if (countries.length && !countries.some((selected) => samePlace(selected, c.locationCountry))) return false;
    if (state && (c.locationState ?? "").toLowerCase() !== state) return false;
    if (city && c.locationCity.toLowerCase() !== city) return false;
    if (platforms.length && !c.socials.some((s) => platforms.includes(s.platform))) return false;
    if (language && !c.languages.some((l) => l.toLowerCase() === language)) return false;
    const followers = totalFollowers(c);
    if (followersMin && followers < followersMin) return false;
    if (followersMax && followers > followersMax) return false;
    if (engagementMin || engagementMax) {
      const engagement = parseFloat(c.stats?.engagementRate ?? "0");
      if (engagementMin && engagement < engagementMin) return false;
      if (engagementMax && engagement > engagementMax) return false;
    }
    if (collabType) {
      const hay = `${(c.collabPrefs ?? []).join(" ")} ${c.offer ?? ""} ${c.need ?? ""} ${c.bio}`.toLowerCase();
      if (!hay.includes(collabType)) return false;
    }
    if (rate === "entry" && c.planTier !== "STARTER") return false;
    if (rate === "growth" && c.planTier !== "PLUS") return false;
    if (rate === "premium" && c.planTier !== "PRO") return false;
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

export function searchCreators(query: CreatorSearchQuery) {
  return filterCreators(SEED_CREATORS, query);
}

export function locationOptionsFor(creators: SeedCreator[]) {
  const countries = new Map<string, Map<string, Set<string>>>();
  for (const c of creators) {
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

export function getLocationOptions() {
  return locationOptionsFor(SEED_CREATORS);
}

export function languageOptionsFor(creators: SeedCreator[]) {
  const set = new Set<string>();
  for (const c of creators) for (const l of c.languages) set.add(l);
  return [...set].sort();
}

export function getLanguageOptions() {
  return languageOptionsFor(SEED_CREATORS);
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
