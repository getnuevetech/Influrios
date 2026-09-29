/**
 * Phase 5 — Intelligence (demo, file-backed).
 * Audience snapshots, niche trends, relationship signals, and export payloads.
 * Labeled as demo / synthetic where data is not platform-verified.
 */
import { promises as fs } from "fs";
import path from "path";
import { getManagedMatching } from "@/lib/managed-matching";
import {
  SEED_CREATORS,
  specialtyLabel,
  type SeedCreator,
} from "@/lib/seed-data";

export type AudienceSnapshot = {
  creatorSlug: string;
  displayName: string;
  source: "demo_seed" | "claimed_metrics";
  refreshedAt: string;
  gender: { female: number; male: number; other: number };
  ages: { range: string; pct: number }[];
  topLocations: { name: string; pct: number }[];
  engagementRate: string;
  totalReach: string;
  primaryPlatforms: string[];
};

export type NicheTrend = {
  specialty: string;
  label: string;
  demandIndex: number;
  growthPct: number;
  creatorSupply: number;
  signal: "rising" | "stable" | "cooling";
  note: string;
};

export type RelationshipSignal = {
  id: string;
  kind: "intro_pipeline" | "collab_fit" | "repeat_interest";
  title: string;
  parties: string[];
  strength: number;
  status: string;
  note: string;
};

export type IntelligenceStore = {
  notes: string;
  lastExportAt?: string;
  watchedSpecialties: string[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "intelligence.json");

const DEFAULT_STORE: IntelligenceStore = {
  notes: "Phase 5 demo intelligence — synthetic trends + seed demographics.",
  watchedSpecialties: ["beauty", "travel", "home-interior", "fashion"],
};

async function ensureStore(): Promise<IntelligenceStore> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return { ...DEFAULT_STORE, ...(JSON.parse(raw) as IntelligenceStore) };
  } catch {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(STORE_PATH, JSON.stringify(DEFAULT_STORE, null, 2), "utf8");
    } catch {
      /* read-only fs — in-memory fallback */
    }
    return { ...DEFAULT_STORE };
  }
}

export async function getIntelligenceStore(): Promise<IntelligenceStore> {
  return ensureStore();
}

export async function markIntelligenceExport(): Promise<void> {
  const store = await ensureStore();
  store.lastExportAt = new Date().toISOString();
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch {
    /* ignore write failures in read-only environments */
  }
}

function fallbackDemographics(creator: SeedCreator) {
  const hash = creator.slug.length * 17;
  return {
    female: 55 + (hash % 25),
    male: 45 - (hash % 20),
    locations: [
      { name: creator.locationCity, pct: 22 + (hash % 10) },
      { name: "New York", pct: 14 },
      { name: "London", pct: 9 },
    ],
    ages: [
      { range: "18-24", pct: 28 },
      { range: "25-34", pct: 34 },
      { range: "35-44", pct: 22 },
      { range: "45+", pct: 16 },
    ],
  };
}

export function buildAudienceSnapshot(creator: SeedCreator): AudienceSnapshot {
  const demo = creator.demographics ?? fallbackDemographics(creator);
  const female = demo.female;
  const male = demo.male;
  const other = Math.max(0, 100 - female - male);

  return {
    creatorSlug: creator.slug,
    displayName: creator.displayName,
    source: creator.demographics ? "demo_seed" : "claimed_metrics",
    refreshedAt: new Date().toISOString(),
    gender: { female, male, other },
    ages: demo.ages,
    topLocations: demo.locations.slice(0, 5),
    engagementRate: creator.stats?.engagementRate ?? "3.2%",
    totalReach: creator.stats?.totalReach ?? formatRoughReach(creator),
    primaryPlatforms: creator.socials.slice(0, 3).map((s) => s.platform),
  };
}

function formatRoughReach(creator: SeedCreator): string {
  const total = creator.socials.reduce((sum, s) => sum + s.followers, 0);
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M`;
  if (total >= 1_000) return `${Math.round(total / 1_000)}K`;
  return String(total);
}

export function getAllAudienceSnapshots(): AudienceSnapshot[] {
  return SEED_CREATORS.map(buildAudienceSnapshot);
}

export function getAudienceSnapshot(slug: string): AudienceSnapshot | null {
  const creator = SEED_CREATORS.find((c) => c.slug === slug);
  return creator ? buildAudienceSnapshot(creator) : null;
}

/** Synthetic niche demand vs supply — demo only. */
export function getNicheTrends(): NicheTrend[] {
  const counts = new Map<string, number>();
  for (const c of SEED_CREATORS) {
    for (const s of c.specialties) {
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
  }

  const seeds: { specialty: string; demand: number; growth: number; note: string }[] = [
    { specialty: "beauty", demand: 92, growth: 18, note: "Clean beauty briefs outpacing supply." },
    { specialty: "travel", demand: 78, growth: 12, note: "Destination tourism rebound." },
    { specialty: "home-interior", demand: 71, growth: 9, note: "DIY apartment makeovers." },
    { specialty: "fashion", demand: 85, growth: 6, note: "Steady brand lookbook demand." },
    { specialty: "food", demand: 64, growth: 14, note: "Local restaurant collabs rising." },
    { specialty: "fitness", demand: 58, growth: -3, note: "Slight cool-off after Q2 surge." },
    { specialty: "tech", demand: 52, growth: 21, note: "Creator gadget reviews heating up." },
    { specialty: "hair", demand: 60, growth: 8, note: "Salon + supplier pairings." },
  ];

  return seeds.map((s) => {
    const supply = counts.get(s.specialty) ?? 0;
    const signal: NicheTrend["signal"] =
      s.growth >= 10 ? "rising" : s.growth < 0 ? "cooling" : "stable";
    return {
      specialty: s.specialty,
      label: specialtyLabel(s.specialty),
      demandIndex: s.demand,
      growthPct: s.growth,
      creatorSupply: supply,
      signal,
      note: s.note,
    };
  });
}

export async function getRelationshipSignals(): Promise<RelationshipSignal[]> {
  const matching = await getManagedMatching();
  const signals: RelationshipSignal[] = [];

  for (const intro of matching.intros) {
    const creator = SEED_CREATORS.find((c) => c.slug === intro.creatorSlug);
    signals.push({
      id: `intro-${intro.id}`,
      kind: "intro_pipeline",
      title: intro.briefTitle,
      parties: [intro.businessName, creator?.displayName ?? intro.creatorSlug],
      strength: intro.status === "paid" ? 95 : intro.status === "introduced" ? 70 : 45,
      status: intro.status,
      note: intro.notes || "Managed intro in pipeline",
    });
  }

  // Complementary offer/need pairs as collab-fit signals
  for (const a of SEED_CREATORS) {
    if (!a.offer || !a.need) continue;
    for (const b of SEED_CREATORS) {
      if (a.slug === b.slug || !b.offer) continue;
      const aNeed = a.need.toLowerCase();
      const bOffer = b.offer.toLowerCase();
      const overlap =
        a.specialties.some((s) => b.specialties.includes(s)) ||
        aNeed.split(" ").some((w) => w.length > 4 && bOffer.includes(w));
      if (!overlap) continue;
      signals.push({
        id: `fit-${a.slug}-${b.slug}`,
        kind: "collab_fit",
        title: `${a.displayName} ↔ ${b.displayName}`,
        parties: [a.displayName, b.displayName],
        strength: 62,
        status: "suggested",
        note: `${a.displayName} needs “${a.need}”; ${b.displayName} offers “${b.offer}”.`,
      });
    }
  }

  // Cap for demo UI
  return signals.slice(0, 12);
}

export type IntelligenceExport = {
  exportedAt: string;
  source: "influrios-intelligence-demo";
  snapshots: AudienceSnapshot[];
  trends: NicheTrend[];
  signals: RelationshipSignal[];
};

export async function buildIntelligenceExport(opts?: {
  slug?: string;
}): Promise<IntelligenceExport> {
  const snapshots = opts?.slug
    ? ([getAudienceSnapshot(opts.slug)].filter(Boolean) as AudienceSnapshot[])
    : getAllAudienceSnapshots();
  const signals = await getRelationshipSignals();
  await markIntelligenceExport();
  return {
    exportedAt: new Date().toISOString(),
    source: "influrios-intelligence-demo",
    snapshots,
    trends: getNicheTrends(),
    signals,
  };
}

export function intelligenceExportToCsv(payload: IntelligenceExport): string {
  const rows = [
    ["creatorSlug", "displayName", "engagementRate", "totalReach", "femalePct", "malePct", "topLocation", "source"],
  ];
  for (const s of payload.snapshots) {
    rows.push([
      s.creatorSlug,
      s.displayName,
      s.engagementRate,
      s.totalReach,
      String(s.gender.female),
      String(s.gender.male),
      s.topLocations[0]?.name ?? "",
      s.source,
    ]);
  }
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}
