/**
 * Audience snapshots read claimed creator demographics.
 * Niche rows compare open requests with directory creator counts.
 * A relationship row is a managed introduction.
 * Ops notes / watched specialties / last export live in IntelligenceSettings.
 */
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { getDirectoryCreator, listDirectoryCreators } from "@/lib/directory";
import { isLaunchSampleBusinessRequest } from "@/lib/marketplace-listings";
import { getManagedMatching } from "@/lib/managed-matching";
import { specialtyLabel, type SeedCreator } from "@/lib/seed-data";

export type AudienceSnapshot = {
  creatorSlug: string;
  displayName: string;
  source: "claimed_metrics" | "unavailable";
  refreshedAt: string;
  gender: { female: number; male: number; other: number };
  ages: { range: string; pct: number }[];
  topLocations: { name: string; pct: number }[];
  engagementRate: string;
  totalReach: string;
  primaryPlatforms: string[];
};

export type NicheBalance = "more_requests" | "more_creators" | "even";

export type NicheTrend = {
  specialty: string;
  label: string;
  requestCount: number;
  creatorSupply: number;
  balance: NicheBalance;
  note: string;
};

export type RelationshipSignal = {
  id: string;
  kind: "intro_pipeline";
  title: string;
  parties: string[];
  status: string;
  note: string;
};

export const NICHE_BALANCE_LABEL: Record<NicheBalance, string> = {
  more_requests: "More requests",
  more_creators: "More creators",
  even: "Even",
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
  notes: "",
  watchedSpecialties: [],
};

function storeFromRow(row: {
  notes: string;
  watchedSpecialties: string[];
  lastExportAt: Date | null;
}): IntelligenceStore {
  return {
    notes: row.notes,
    watchedSpecialties: row.watchedSpecialties,
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

export function buildAudienceSnapshot(creator: SeedCreator): AudienceSnapshot {
  const demo = creator.demographics;
  const female = demo?.female ?? 0;
  const male = demo?.male ?? 0;
  const other = demo ? Math.max(0, 100 - female - male) : 0;

  return {
    creatorSlug: creator.slug,
    displayName: creator.displayName,
    source: demo ? "claimed_metrics" : "unavailable",
    refreshedAt: new Date().toISOString(),
    gender: { female, male, other },
    ages: demo?.ages ?? [],
    topLocations: demo?.locations.slice(0, 5) ?? [],
    engagementRate: creator.stats?.engagementRate ?? "",
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

export function specialtyKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function nicheBalance(requestCount: number, creatorSupply: number): NicheBalance {
  if (requestCount > creatorSupply) return "more_requests";
  if (requestCount < creatorSupply) return "more_creators";
  return "even";
}

export function nicheBalanceNote(balance: NicheBalance): string {
  if (balance === "more_requests") return "More open requests than creators in the directory.";
  if (balance === "more_creators") return "More creators in the directory than open requests.";
  return "Open requests match the creator count.";
}

/** One collaboration names each distinct specialty once. */
export function requestSpecialtiesForCollaboration(row: {
  offerSpecialty?: string | null;
  needSpecialty?: string | null;
}): string[] {
  const offer = specialtyKey(row.offerSpecialty);
  const need = specialtyKey(row.needSpecialty);
  if (offer && need && offer !== need) return [offer, need];
  if (offer) return [offer];
  if (need) return [need];
  return [];
}

export function nicheTrendsFromCounts(input: {
  supply: { specialty: string; creators: number }[];
  requests: Array<string | null | undefined>;
}): NicheTrend[] {
  const supply = new Map<string, number>();
  for (const row of input.supply) {
    const key = specialtyKey(row.specialty);
    if (!key || row.creators < 1) continue;
    supply.set(key, (supply.get(key) ?? 0) + row.creators);
  }
  const requests = new Map<string, number>();
  for (const raw of input.requests) {
    const key = specialtyKey(raw);
    if (!key) continue;
    requests.set(key, (requests.get(key) ?? 0) + 1);
  }
  const keys = new Set([...supply.keys(), ...requests.keys()]);
  return [...keys]
    .map((specialty) => {
      const creatorSupply = supply.get(specialty) ?? 0;
      const requestCount = requests.get(specialty) ?? 0;
      const balance = nicheBalance(requestCount, creatorSupply);
      return {
        specialty,
        label: specialtyLabel(specialty),
        requestCount,
        creatorSupply,
        balance,
        note: nicheBalanceNote(balance),
      };
    })
    .sort(
      (a, b) =>
        b.requestCount - a.requestCount ||
        b.creatorSupply - a.creatorSupply ||
        a.specialty.localeCompare(b.specialty),
    );
}

/**
 * Open requests are draft or active briefs, collaborations that are still
 * draft, sent, or accepted, agency campaigns that are not wrapped, and
 * published marketplace listings. Retired launch-sample rows are excluded.
 * Searches are not stored, so they are not counted. Growth is not estimated.
 */
export async function getNicheTrends(): Promise<NicheTrend[]> {
  const supply = new Map<string, number>();
  for (const creator of await listDirectoryCreators()) {
    for (const specialty of creator.specialties) {
      const key = specialtyKey(specialty);
      if (!key) continue;
      supply.set(key, (supply.get(key) ?? 0) + 1);
    }
  }

  const [briefs, collaborations, campaigns, listings] = await Promise.all([
    prisma.businessBrief.findMany({
      where: { status: { in: ["draft", "active"] } },
      select: { specialty: true },
    }),
    prisma.collaboration.findMany({
      where: { status: { in: ["draft", "sent", "accepted"] } },
      select: { offerSpecialty: true, needSpecialty: true },
    }),
    prisma.agencyCampaign.findMany({
      where: { status: { in: ["briefing", "casting", "live"] } },
      select: { specialty: true },
    }),
    prisma.marketplaceBusinessRequest.findMany({
      where: { status: "published" },
      select: { id: true, brand: true, summary: true, category: true },
    }),
  ]);

  const requests: string[] = briefs.map((row) => row.specialty);
  for (const row of collaborations) requests.push(...requestSpecialtiesForCollaboration(row));
  for (const row of campaigns) requests.push(row.specialty);
  for (const row of listings) {
    if (isLaunchSampleBusinessRequest(row)) continue;
    requests.push(row.category);
  }

  return nicheTrendsFromCounts({
    supply: [...supply.entries()].map(([specialty, creators]) => ({ specialty, creators })),
    requests,
  });
}

export async function getRelationshipSignals(): Promise<RelationshipSignal[]> {
  const matching = await getManagedMatching();
  const creators = await listDirectoryCreators();
  const bySlug = new Map(creators.map((creator) => [creator.slug, creator]));
  return matching.intros.map((intro) => ({
    id: `intro-${intro.id}`,
    kind: "intro_pipeline" as const,
    title: intro.briefTitle,
    parties: [intro.businessName, bySlug.get(intro.creatorSlug)?.displayName ?? intro.creatorSlug],
    status: intro.status,
    note: intro.notes.trim() || "Managed introduction",
  }));
}

export type IntelligenceExport = {
  exportedAt: string;
  source: "influrios-intelligence-directory";
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
    source: "influrios-intelligence-directory",
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
