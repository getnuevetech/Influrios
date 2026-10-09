import { listDirectoryCreators } from "@/lib/directory";
import { getEntitlements, type PlanCode } from "@/lib/entitlements";
import { categoryImageFor, specialtyLabel, type SeedCreator } from "@/lib/seed-data";
import { normalizeInfluencerRoleTitle } from "@/lib/terminology-copy";

export type MatchBreakdown = {
  audienceAlignment: number;
  contentCompatibility: number;
  goalSynergy: number;
  engagementPotential: number;
};

export type CreatorMatch = {
  a: SeedCreator;
  b: SeedCreator;
  score: number;
  breakdown: MatchBreakdown;
  reasons: string[];
  why: string;
  complementarySpecialties: string[];
};

export type BusinessRequest = {
  id: string;
  brand: string;
  category: string;
  budget: string;
  location: string;
  tags: string[];
  summary: string;
  lookingFor: string;
};

export type CreatorOpportunity = {
  id: string;
  creatorSlug: string;
  lookingFor: string;
  summary: string;
};

/** Deterministic complementary specialty pairs (not competitors). */
const COMPLEMENTARY: Record<string, string[]> = {
  beauty: ["hair", "natural-hair", "skincare", "fashion", "suppliers"],
  skincare: ["beauty", "lifestyle", "natural-hair"],
  "natural-hair": ["hair", "beauty", "suppliers", "hair-supply"],
  hair: ["natural-hair", "beauty", "suppliers", "hair-supply"],
  "hair-supply": ["hair", "natural-hair", "beauty"],
  fashion: ["beauty", "lifestyle", "travel"],
  "home-interior": ["woodworking", "interior-design", "custom-cabinetry", "lifestyle"],
  "interior-design": ["woodworking", "home-interior", "custom-cabinetry"],
  woodworking: ["interior-design", "home-interior", "custom-cabinetry"],
  "custom-cabinetry": ["interior-design", "woodworking", "home-interior"],
  travel: ["food", "lifestyle", "fashion"],
  food: ["travel", "lifestyle"],
  fitness: ["nutrition", "tech", "smart-home", "lifestyle"],
  training: ["nutrition", "fitness", "tech"],
  nutrition: ["fitness", "training"],
  tech: ["smart-home", "fitness", "consumer-tech"],
  "smart-home": ["tech", "consumer-tech", "fitness"],
  "consumer-tech": ["tech", "smart-home"],
  lifestyle: ["beauty", "travel", "food", "home-interior"],
  suppliers: ["beauty", "hair", "natural-hair"],
};

function specialtyOverlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter((s) => setB.has(s)).length;
}

function complementaryHits(a: string[], b: string[]): string[] {
  const hits: string[] = [];
  for (const sa of a) {
    const comps = COMPLEMENTARY[sa] ?? [];
    for (const sb of b) {
      if (comps.includes(sb) || (COMPLEMENTARY[sb] ?? []).includes(sa)) {
        hits.push(`${specialtyLabel(sa)} ↔ ${specialtyLabel(sb)}`);
      }
    }
  }
  return [...new Set(hits)];
}

function platformOverlap(a: SeedCreator, b: SeedCreator): number {
  const setB = new Set(b.socials.map((s) => s.platform));
  return a.socials.filter((s) => setB.has(s.platform)).length;
}

function sameMetro(a: SeedCreator, b: SeedCreator): boolean {
  return (
    a.locationCity.toLowerCase() === b.locationCity.toLowerCase() ||
    a.locationCountry.toLowerCase() === b.locationCountry.toLowerCase()
  );
}

function offerNeedFit(a: SeedCreator, b: SeedCreator): number {
  const text = `${b.need ?? ""} ${b.offer ?? ""} ${b.bio}`.toLowerCase();
  const offer = (a.offer ?? "").toLowerCase();
  const need = (a.need ?? "").toLowerCase();
  let score = 0;
  if (offer && text.split(/\s+/).some((w) => w.length > 4 && offer.includes(w))) score += 1;
  if (need && `${b.offer ?? ""}`.toLowerCase().split(/\s+/).some((w) => w.length > 4 && need.includes(w)))
    score += 1;
  // Keyword bridges
  const bridges: [RegExp, RegExp][] = [
    [/beauty|skincare|hair/i, /hair|beauty|skincare|supplier/i],
    [/interior|design|wood/i, /wood|cabin|interior|home/i],
    [/fitness|train/i, /nutrition|tech|smart|wellness/i],
    [/travel/i, /food|tourism|local/i],
    [/tech|smart/i, /fitness|security|home/i],
  ];
  for (const [ra, rb] of bridges) {
    if (
      (ra.test(a.bio + a.offer + a.need) && rb.test(b.bio + b.offer + b.need)) ||
      (rb.test(a.bio + a.offer + a.need) && ra.test(b.bio + b.offer + b.need))
    ) {
      score += 1;
    }
  }
  return Math.min(score, 3);
}

export function scoreCreatorPair(a: SeedCreator, b: SeedCreator): CreatorMatch | null {
  if (a.slug === b.slug) return null;
  if (!a.openToCollab || !b.openToCollab) return null;

  const comps = complementaryHits(a.specialties, b.specialties);
  const overlap = specialtyOverlap(a.specialties, b.specialties);
  // Prefer complementary over identical competitors
  if (comps.length === 0 && overlap > 0 && overlap === Math.min(a.specialties.length, b.specialties.length)) {
    // pure competitors — skip unless offer/need still fits
    if (offerNeedFit(a, b) === 0) return null;
  }

  const contentCompatibility = Math.min(
    98,
    70 + comps.length * 8 + (overlap > 0 ? 4 : 0),
  );
  const audienceAlignment = Math.min(
    98,
    72 + (sameMetro(a, b) ? 12 : 4) + platformOverlap(a, b) * 3,
  );
  const goalSynergy = Math.min(98, 68 + offerNeedFit(a, b) * 10 + (a.offer && b.need ? 4 : 0));
  const engagementPotential = Math.min(
    98,
    74 + Math.min(a.socials.length, b.socials.length) * 4 + (a.planTier !== "STARTER" ? 4 : 0),
  );

  const breakdown: MatchBreakdown = {
    audienceAlignment,
    contentCompatibility,
    goalSynergy,
    engagementPotential,
  };

  const score = Math.round(
    breakdown.audienceAlignment * 0.28 +
      breakdown.contentCompatibility * 0.3 +
      breakdown.goalSynergy * 0.24 +
      breakdown.engagementPotential * 0.18,
  );

  if (score < 70) return null;

  const reasons: string[] = [];
  if (comps.length) reasons.push(`Complementary specialties: ${comps.slice(0, 2).join("; ")}`);
  if (sameMetro(a, b))
    reasons.push(` overlapping geography (${a.locationCity} / ${b.locationCountry})`);
  if (platformOverlap(a, b) >= 1) reasons.push("Shared platform presence for joint distribution");
  if (a.offer) reasons.push(`${a.displayName.split(" ")[0]} offers: ${a.offer}`);
  if (b.offer) reasons.push(`${b.displayName.split(" ")[0]} offers: ${b.offer}`);
  if (a.need) reasons.push(`${a.displayName.split(" ")[0]} needs: ${a.need}`);
  if (b.need) reasons.push(`${b.displayName.split(" ")[0]} needs: ${b.need}`);

  const why =
    comps.length > 0
      ? `${a.displayName.split(" ")[0]} brings ${specialtyLabel(a.specialties[0] ?? "specialty")} strength while ${b.displayName.split(" ")[0]} complements with ${specialtyLabel(b.specialties[0] ?? "specialty")} — a stronger combined offer than either alone.`
      : `${a.displayName} and ${b.displayName} share audience and platform fit for a joint collaboration.`;

  return {
    a,
    b,
    score,
    breakdown,
    reasons: reasons.map((r) => r.trim()).filter(Boolean),
    why,
    complementarySpecialties: comps,
  };
}

export function findMatchesFor(creatorSlug: string, creators: readonly SeedCreator[]): CreatorMatch[] {
  const me = creators.find((c) => c.slug === creatorSlug);
  if (!me) return [];
  return creators
    .map((other) => scoreCreatorPair(me, other))
    .filter((m): m is CreatorMatch => Boolean(m))
    .sort((x, y) => y.score - x.score);
}

export function allCreatorMatches(creators: readonly SeedCreator[]): CreatorMatch[] {
  const seen = new Set<string>();
  const out: CreatorMatch[] = [];
  for (let i = 0; i < creators.length; i++) {
    for (let j = i + 1; j < creators.length; j++) {
      const match = scoreCreatorPair(creators[i], creators[j]);
      if (!match) continue;
      const key = [match.a.slug, match.b.slug].sort().join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(match);
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

export async function allDirectoryMatches(): Promise<CreatorMatch[]> {
  return allCreatorMatches(await listDirectoryCreators());
}

export async function findDirectoryMatchesFor(creatorSlug: string): Promise<CreatorMatch[]> {
  return findMatchesFor(creatorSlug, await listDirectoryCreators());
}

export function filterMatches(
  matches: CreatorMatch[],
  filters: {
    specialty?: string;
    location?: string;
    platform?: string;
    collabType?: string;
    q?: string;
  },
): CreatorMatch[] {
  return matches.filter((m) => {
    if (filters.specialty) {
      const s = filters.specialty.toLowerCase();
      const hit =
        m.a.specialties.some((x) => x.includes(s) || s.includes(x)) ||
        m.b.specialties.some((x) => x.includes(s) || s.includes(x));
      if (!hit) return false;
    }
    if (filters.location) {
      const loc = filters.location.toLowerCase();
      const hay = `${m.a.locationCity} ${m.a.locationCountry} ${m.b.locationCity} ${m.b.locationCountry}`.toLowerCase();
      if (!hay.includes(loc)) return false;
    }
    if (filters.platform) {
      const p = filters.platform.toUpperCase();
      if (!m.a.socials.some((s) => s.platform === p) && !m.b.socials.some((s) => s.platform === p)) {
        return false;
      }
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const hay = `${m.a.displayName} ${m.b.displayName} ${m.why} ${m.a.offer} ${m.b.offer}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Launch-default check. Live pages use entitlementsForPlan().proposalsMax. */
export function canRequestMatch(plan: PlanCode): boolean {
  return getEntitlements(plan).proposalsMax > 0;
}

export const BUSINESS_REQUESTS: BusinessRequest[] = [
  {
    id: "br-sephora",
    brand: "Lumina Beauty Co.",
    category: "Skincare",
    budget: "$5K – $10K",
    location: "Global",
    tags: ["Beauty", "Product Launch"],
    summary: "Looking for beauty + hair educators for a clean-skincare launch series.",
    lookingFor: "Beauty & natural-hair creators",
  },
  {
    id: "br-airbnb",
    brand: "WanderStay",
    category: "Travel",
    budget: "$8K – $15K",
    location: "APAC",
    tags: ["Travel", "Tourism"],
    summary: "Need travel + local food pairs for destination itinerary content.",
    lookingFor: "Travel × food creator teams",
  },
  {
    id: "br-samsung",
    brand: "NexHome Tech",
    category: "Smart Home",
    budget: "$10K – $20K",
    location: "US / UK",
    tags: ["Tech", "Fitness"],
    summary: "Smart-home recovery setup walkthroughs with fitness creators.",
    lookingFor: "Tech + fitness collaborator pairs",
  },
];

export const CREATOR_OPPORTUNITIES: CreatorOpportunity[] = [
  {
    id: "co-daniel",
    creatorSlug: "daniel-kim",
    lookingFor: "Tourism & local food brands",
    summary: "Open to destination partnerships and co-created food itineraries.",
  },
  {
    id: "co-priya",
    creatorSlug: "priya-sharma",
    lookingFor: "Furniture & cabinetry makers",
    summary: "Seeking woodwork partners for full-room makeover series.",
  },
  {
    id: "co-marcus",
    creatorSlug: "marcus-lee",
    lookingFor: "Nutrition & wellness brands",
    summary: "Wants a nutrition collaborator for a 30-day training + meals series.",
  },
];

export type StoredMatchCard = {
  title: string;
  subtitle: string;
  specialty: string;
  image: string;
};

/** Cards for matches an admin saved. An empty list stays empty. */
export function cardsFromStoredCollaborationMatches(
  matches: Array<{ title: string; tags?: string[]; image?: string | null }>,
): StoredMatchCard[] {
  return matches.flatMap((match) => {
    const displayTitle = normalizeInfluencerRoleTitle(match.title.trim());
    if (!displayTitle) return [];
    const [left, right] = displayTitle.split(/\s*\+\s*/);
    const specialty = match.tags?.[0]?.trim().toLowerCase() || "";
    const image = match.image?.trim() ?? "";
    return [
      {
        title: left?.trim() || displayTitle,
        subtitle: right?.trim() ? `+ ${right.trim()}` : "",
        specialty: specialty || "lifestyle",
        image: image && !image.includes("/demo/creators/") ? image : categoryImageFor(specialty || "lifestyle"),
      },
    ];
  });
}
