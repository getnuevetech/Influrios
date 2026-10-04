import { prisma } from "@/lib/db";
import { CONSENT_VERSION } from "@/lib/account-policy";

export type FooterIconKey = "user" | "users" | "handshake" | "building";
export type FooterTone = "violet" | "sky" | "blue";

export type FooterStatView = {
  key: string;
  value: string;
  label: string;
  iconKey: FooterIconKey;
  tone: FooterTone;
  sortOrder: number;
  enabled: boolean;
  source: string;
  asOf: string | null;
  maxAgeDays: number;
  /** True when source + as-of are present and not past maxAgeDays. */
  verified: boolean;
};

export type SiteConfigView = {
  footerTagline: string;
  consentVersion: string;
  consentCopy: string;
  passwordMinLength: number;
  stats: FooterStatView[];
};

export const DEFAULT_FOOTER_TAGLINE = "A growing creator economy together.";

/**
 * Template rows for admin restore only — never published without source/as-of (Dev §23.8).
 * Placeholders stay disabled so 50K+/12K+ cannot appear as factual scale.
 */
export const DEFAULT_FOOTER_STATS: FooterStatView[] = [
  {
    key: "influencers",
    value: "50K+",
    label: "Influencers Worldwide",
    iconKey: "user",
    tone: "violet",
    sortOrder: 0,
    enabled: false,
    source: "",
    asOf: null,
    maxAgeDays: 90,
    verified: false,
  },
  {
    key: "categories",
    value: "100+",
    label: "Categories & Niches",
    iconKey: "users",
    tone: "sky",
    sortOrder: 1,
    enabled: false,
    source: "",
    asOf: null,
    maxAgeDays: 90,
    verified: false,
  },
  {
    key: "collaborations",
    value: "12K+",
    label: "Active Collaborations",
    iconKey: "handshake",
    tone: "violet",
    sortOrder: 2,
    enabled: false,
    source: "",
    asOf: null,
    maxAgeDays: 90,
    verified: false,
  },
  {
    key: "matches",
    value: "5K+",
    label: "Business Matches",
    iconKey: "building",
    tone: "blue",
    sortOrder: 3,
    enabled: false,
    source: "",
    asOf: null,
    maxAgeDays: 90,
    verified: false,
  },
];

export const DEFAULT_SITE_CONFIG = {
  footerTagline: DEFAULT_FOOTER_TAGLINE,
  consentVersion: CONSENT_VERSION,
  consentCopy: "I agree to the Influrios account terms",
  passwordMinLength: 8,
};

const ICONS = new Set<FooterIconKey>(["user", "users", "handshake", "building"]);
const TONES = new Set<FooterTone>(["violet", "sky", "blue"]);

let cache: { at: number; value: SiteConfigView } | null = null;

export function invalidateSiteConfigCache() {
  cache = null;
}

export function clampPasswordMin(value: number) {
  if (!Number.isFinite(value)) return 8;
  return Math.min(64, Math.max(8, Math.floor(value)));
}

function asIcon(value: string): FooterIconKey {
  return ICONS.has(value as FooterIconKey) ? (value as FooterIconKey) : "user";
}

function asTone(value: string): FooterTone {
  return TONES.has(value as FooterTone) ? (value as FooterTone) : "violet";
}

/** Dev §23.8 — public strip only when enabled, sourced, dated, and not stale. */
export function isVerifiedFooterStat(
  input: {
    enabled: boolean;
    source: string;
    asOf: Date | string | null | undefined;
    maxAgeDays?: number;
  },
  now: Date = new Date(),
): boolean {
  if (!input.enabled) return false;
  if (!String(input.source ?? "").trim()) return false;
  if (!input.asOf) return false;
  const asOf = input.asOf instanceof Date ? input.asOf : new Date(input.asOf);
  if (Number.isNaN(asOf.getTime())) return false;
  const maxAge = Number.isFinite(input.maxAgeDays) ? Math.max(1, Math.floor(input.maxAgeDays!)) : 90;
  const ageMs = now.getTime() - asOf.getTime();
  if (ageMs < 0) return true; // future as-of still counts as dated
  return ageMs <= maxAge * 24 * 60 * 60 * 1000;
}

function toStatView(
  stat: {
    key: string;
    value: string;
    label: string;
    iconKey: string;
    tone: string;
    sortOrder: number;
    enabled: boolean;
    source?: string | null;
    asOf?: Date | string | null;
    maxAgeDays?: number | null;
  },
  now = new Date(),
): FooterStatView {
  const source = String(stat.source ?? "").trim();
  const asOf =
    stat.asOf instanceof Date
      ? stat.asOf.toISOString()
      : typeof stat.asOf === "string" && stat.asOf
        ? new Date(stat.asOf).toISOString()
        : null;
  const maxAgeDays =
    Number.isFinite(stat.maxAgeDays) && stat.maxAgeDays != null ? Math.max(1, Math.floor(stat.maxAgeDays)) : 90;
  const verified = isVerifiedFooterStat(
    { enabled: stat.enabled, source, asOf, maxAgeDays },
    now,
  );
  return {
    key: stat.key,
    value: stat.value,
    label: stat.label,
    iconKey: asIcon(stat.iconKey),
    tone: asTone(stat.tone),
    sortOrder: stat.sortOrder,
    enabled: stat.enabled,
    source,
    asOf: asOf && !Number.isNaN(new Date(asOf).getTime()) ? asOf : null,
    maxAgeDays,
    verified,
  };
}

function fallback(): SiteConfigView {
  // Never publish placeholder 50K+/12K+ as factual when DB is unavailable.
  return {
    ...DEFAULT_SITE_CONFIG,
    stats: [],
  };
}

export async function getSiteConfig(): Promise<SiteConfigView> {
  if (cache && Date.now() - cache.at < 5000) return cache.value;
  try {
    const [rows, config] = await Promise.all([
      prisma.footerStat.findMany({ orderBy: [{ sortOrder: "asc" }, { key: "asc" }] }),
      prisma.siteConfig.findUnique({ where: { id: "default" } }),
    ]);

    let stats = rows;
    if (stats.length === 0) {
      // Seed disabled templates only — public strip stays empty until verified.
      await prisma.footerStat.createMany({
        data: DEFAULT_FOOTER_STATS.map((stat) => ({
          key: stat.key,
          value: stat.value,
          label: stat.label,
          iconKey: stat.iconKey,
          tone: stat.tone,
          sortOrder: stat.sortOrder,
          enabled: false,
          source: "",
          asOf: null,
          maxAgeDays: 90,
        })),
        skipDuplicates: true,
      });
      stats = await prisma.footerStat.findMany({ orderBy: [{ sortOrder: "asc" }, { key: "asc" }] });
    }

    const row =
      config ??
      (await prisma.siteConfig.create({
        data: { id: "default", ...DEFAULT_SITE_CONFIG },
      }));

    const now = new Date();
    const value: SiteConfigView = {
      footerTagline: row.footerTagline || DEFAULT_FOOTER_TAGLINE,
      consentVersion: row.consentVersion || CONSENT_VERSION,
      consentCopy: row.consentCopy || DEFAULT_SITE_CONFIG.consentCopy,
      passwordMinLength: clampPasswordMin(row.passwordMinLength),
      stats: stats.map((stat) => toStatView(stat, now)),
    };
    cache = { at: Date.now(), value };
    return value;
  } catch (error) {
    console.error("site config fallback", error);
    return fallback();
  }
}

export async function getFooterStrip() {
  const config = await getSiteConfig();
  return {
    tagline: config.footerTagline,
    stats: config.stats.filter((stat) => stat.verified),
  };
}

export function statKeyFromLabel(label: string) {
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return key || `stat-${Date.now()}`;
}

export function footerStatCreateData(stat: FooterStatView) {
  return {
    key: stat.key,
    value: stat.value,
    label: stat.label,
    iconKey: stat.iconKey,
    tone: stat.tone,
    sortOrder: stat.sortOrder,
    enabled: false,
    source: "",
    asOf: null as Date | null,
    maxAgeDays: 90,
  };
}
