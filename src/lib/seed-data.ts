export type SeedSocial = {
  platform: "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "X" | "WEBSITE";
  handle: string;
  url: string;
  followers: number;
};

export type SeedCreator = {
  slug: string;
  displayName: string;
  title: string;
  bio: string;
  locationCity: string;
  locationCountry: string;
  languages: string[];
  avatarColor: string;
  planTier: "STARTER" | "PLUS" | "PRO";
  specialties: string[];
  socials: SeedSocial[];
  openToCollab: boolean;
  offer?: string;
  need?: string;
};

export const SPECIALTY_TAXONOMY: { slug: string; name: string; children?: { slug: string; name: string }[] }[] = [
  {
    slug: "beauty",
    name: "Beauty",
    children: [
      { slug: "natural-hair", name: "Natural Hair" },
      { slug: "protective-styles", name: "Protective Styles" },
      { slug: "skincare", name: "Skincare" },
      { slug: "makeup", name: "Makeup" },
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
    bio: "Natural beauty educator helping brands reach audiences who care about skincare rituals and everyday confidence.",
    locationCity: "Los Angeles",
    locationCountry: "USA",
    languages: ["English", "Spanish"],
    avatarColor: "#633CFF",
    planTier: "PLUS",
    specialties: ["beauty", "skincare", "lifestyle"],
    socials: [
      { platform: "INSTAGRAM", handle: "@sofia.m", url: "https://instagram.com/sofia.m", followers: 2_400_000 },
      { platform: "TIKTOK", handle: "@sofiam", url: "https://tiktok.com/@sofiam", followers: 1_800_000 },
      { platform: "YOUTUBE", handle: "Sofia Martinez", url: "https://youtube.com/@sofiam", followers: 620_000 },
      { platform: "X", handle: "@sofiam", url: "https://x.com/sofiam", followers: 480_000 },
    ],
    openToCollab: true,
    offer: "Beauty tutorials and product education",
    need: "Skincare brands and hair-care specialists",
  },
  {
    slug: "daniel-kim",
    displayName: "Daniel Kim",
    title: "Travel Creator",
    bio: "Destination storytelling with a focus on tourism partnerships and multi-city itineraries.",
    locationCity: "Seoul",
    locationCountry: "South Korea",
    languages: ["English", "Korean"],
    avatarColor: "#2979FF",
    planTier: "STARTER",
    specialties: ["travel"],
    socials: [
      { platform: "INSTAGRAM", handle: "@daniel.travels", url: "https://instagram.com/daniel.travels", followers: 890_000 },
    ],
    openToCollab: true,
    offer: "Travel itinerary content",
    need: "Local food creators",
  },
  {
    slug: "priya-sharma",
    displayName: "Priya Sharma",
    title: "Interior Design Creator",
    bio: "Room transformations and accessible design for urban apartments.",
    locationCity: "Austin",
    locationCountry: "USA",
    languages: ["English", "Hindi"],
    avatarColor: "#7B46F6",
    planTier: "PRO",
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
    title: "Fitness Creator",
    bio: "Strength training and recovery education for busy professionals.",
    locationCity: "Toronto",
    locationCountry: "Canada",
    languages: ["English"],
    avatarColor: "#111A5A",
    planTier: "PLUS",
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
    locationCountry: "USA",
    languages: ["English"],
    avatarColor: "#E879F9",
    planTier: "STARTER",
    specialties: ["natural-hair"],
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
    title: "Tech & Smart Home Creator",
    bio: "Consumer tech reviews and integrated smart-home walkthroughs.",
    locationCity: "London",
    locationCountry: "UK",
    languages: ["English"],
    avatarColor: "#4979FF",
    planTier: "PLUS",
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
  platform?: string;
}) {
  const q = query.q?.toLowerCase().trim();
  const specialty = query.specialty?.toLowerCase();
  const location = query.location?.toLowerCase();
  const platform = query.platform?.toUpperCase();

  return SEED_CREATORS.filter((c) => {
    if (q) {
      const hay = `${c.displayName} ${c.title} ${c.bio} ${c.specialties.join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (specialty && !c.specialties.some((s) => s === specialty || s.includes(specialty))) return false;
    if (location) {
      const loc = `${c.locationCity} ${c.locationCountry}`.toLowerCase();
      if (!loc.includes(location)) return false;
    }
    if (platform && !c.socials.some((s) => s.platform === platform)) return false;
    return true;
  });
}

export function specialtyLabel(slug: string): string {
  for (const parent of SPECIALTY_TAXONOMY) {
    if (parent.slug === slug) return parent.name;
    const child = parent.children?.find((c) => c.slug === slug);
    if (child) return child.name;
  }
  return slug;
}
