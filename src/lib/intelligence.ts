/**
 * Phase 5 / Phase O — Intelligence.
 * Audience snapshots and trends read the Postgres directory.
 * Ops notes / watched specialties / last export live in IntelligenceSettings.
 */
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { getDirectoryCreator, listDirectoryCreators } from "@/lib/directory";
import { getManagedMatching } from "@/lib/managed-matching";
import { specialtyLabel, type SeedCreator } from "@/lib/seed-data";

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
const LEGACY_STORE_PATH = path.join(DATA_DIR, "intelligence.json");
const LEGACY_MIGRATED_PATH = path.join(DATA_DIR, "intelligence.json.migrated");
const SETTINGS_ID = "default";

const DEFAULT_STORE: IntelligenceStore = {
  notes: "Phase 5 demo intelligence — synthetic trends + seed demographics.",
  watchedSpecialties: ["beauty", "travel", "home-interior", "fashion"],
};

function storeFromRow(row: {
  notes: string;
  watchedSpecialties: string[];
  lastExportAt: Date | null;
}): IntelligenceStore {
  return {
    notes: row.notes || DEFAULT_STORE.notes,
    watchedSpecialties: row.watchedSpecialties.length
      ? row.watchedSpecialties
      : [...DEFAULT_STORE.watchedSpecialties],
    lastExportAt: row.lastExportAt?.toISOString(),
  };
}

async function readLegacyStore(): Promise<IntelligenceStore | null> {
  try {
    const raw = await fs.readFile(LEGACY_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<IntelligenceStore>;
    return {
      notes: typeof parsed.notes === "string" ? parsed.notes : DEFAULT_STORE.notes,
      watchedSpecialties: Array.isArray(parsed.watchedSpecialties)
        ? parsed.watchedSpecialties.filter((item): item is string => typeof item === "string")
        : [...DEFAULT_STORE.watchedSpecialties],
      lastExportAt: typeof parsed.lastExportAt === "string" ? parsed.lastExportAt : undefined,
    };
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

async function ensureStore(): Promise<IntelligenceStore> {
  const existing = await prisma.intelligenceSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return storeFromRow(existing);

  const legacy = await readLegacyStore();
  const seed = legacy ?? DEFAULT_STORE;
  const row = await prisma.intelligenceSettings.create({
    data: {
      id: SETTINGS_ID,
      notes: seed.notes,
      watchedSpecialties: seed.watchedSpecialties,
      lastExportAt: seed.lastExportAt ? new Date(seed.lastExportAt) : null,
    },
  });
  if (legacy) await markLegacyMigrated();
  return storeFromRow(row);
}

export async function getIntelligenceStore(): Promise<IntelligenceStore> {
  return ensureStore();
}

export async function markIntelligenceExport(): Promise<void> {
  const at = new Date();
  await prisma.intelligenceSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      notes: DEFAULT_STORE.notes,
      watchedSpecialties: DEFAULT_STORE.watchedSpecialties,
      lastExportAt: at,
    },
    update: { lastExportAt: at },
  });
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

export async function getAllAudienceSnapshots(): Promise<AudienceSnapshot[]> {
  return (await listDirectoryCreators()).map(buildAudienceSnapshot);
}

export async function getAudienceSnapshot(slug: string): Promise<AudienceSnapshot | null> {
  const creator = await getDirectoryCreator(slug);
  return creator ? buildAudienceSnapshot(creator) : null;
}

/** Synthetic niche demand vs supply — demo only. */
export async function getNicheTrends(): Promise<NicheTrend[]> {
  const counts = new Map<string, number>();
  for (const c of await listDirectoryCreators()) {
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
    { specialty: "tech", demand: 52, growth: 21, note: "Influencer gadget reviews heating up." },
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
  const creators = await listDirectoryCreators();
  const bySlug = new Map(creators.map((c) => [c.slug, c]));
  const signals: RelationshipSignal[] = [];

  for (const intro of matching.intros) {
    const creator = bySlug.get(intro.creatorSlug);
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
  for (const a of creators) {
    if (!a.offer || !a.need) continue;
    for (const b of creators) {
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
    ? ([await getAudienceSnapshot(opts.slug)].filter(Boolean) as AudienceSnapshot[])
    : await getAllAudienceSnapshots();
  const signals = await getRelationshipSignals();
  await markIntelligenceExport();
  return {
    exportedAt: new Date().toISOString(),
    source: "influrios-intelligence-demo",
    snapshots,
    trends: await getNicheTrends(),
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
