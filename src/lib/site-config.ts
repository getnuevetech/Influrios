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
};

export type SiteConfigView = {
  footerTagline: string;
  consentVersion: string;
  consentCopy: string;
  passwordMinLength: number;
  stats: FooterStatView[];
};

export const DEFAULT_FOOTER_TAGLINE = "A growing creator economy together.";

export const DEFAULT_FOOTER_STATS: FooterStatView[] = [
  {
    key: "influencers",
    value: "50K+",
    label: "Influencers Worldwide",
    iconKey: "user",
    tone: "violet",
    sortOrder: 0,
    enabled: true,
  },
  {
    key: "categories",
    value: "100+",
    label: "Categories & Niches",
    iconKey: "users",
    tone: "sky",
    sortOrder: 1,
    enabled: true,
  },
  {
    key: "collaborations",
    value: "12K+",
    label: "Active Collaborations",
    iconKey: "handshake",
    tone: "violet",
    sortOrder: 2,
    enabled: true,
  },
  {
    key: "matches",
    value: "5K+",
    label: "Business Matches",
    iconKey: "building",
    tone: "blue",
    sortOrder: 3,
    enabled: true,
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

function fallback(): SiteConfigView {
  return {
    ...DEFAULT_SITE_CONFIG,
    stats: DEFAULT_FOOTER_STATS.map((stat) => ({ ...stat })),
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
      await prisma.footerStat.createMany({
        data: DEFAULT_FOOTER_STATS.map((stat) => ({ ...stat })),
        skipDuplicates: true,
      });
      stats = await prisma.footerStat.findMany({ orderBy: [{ sortOrder: "asc" }, { key: "asc" }] });
    }

    const row =
      config ??
      (await prisma.siteConfig.create({
        data: { id: "default", ...DEFAULT_SITE_CONFIG },
      }));

    const value: SiteConfigView = {
      footerTagline: row.footerTagline || DEFAULT_FOOTER_TAGLINE,
      consentVersion: row.consentVersion || CONSENT_VERSION,
      consentCopy: row.consentCopy || DEFAULT_SITE_CONFIG.consentCopy,
      passwordMinLength: clampPasswordMin(row.passwordMinLength),
      stats: (stats.length ? stats : DEFAULT_FOOTER_STATS).map((stat) => ({
        key: stat.key,
        value: stat.value,
        label: stat.label,
        iconKey: asIcon(stat.iconKey),
        tone: asTone(stat.tone),
        sortOrder: stat.sortOrder,
        enabled: stat.enabled,
      })),
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
    stats: config.stats.filter((stat) => stat.enabled),
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
