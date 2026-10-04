import type { EntitlementLimits } from "@/lib/entitlements";

export type AnalyticsLevel = EntitlementLimits["analytics"];

export type ShortLinkEventRow = {
  eventType: string;
  metaJson: unknown;
  createdAt?: Date;
};

export type ShortLinkPrivacyHints = {
  userAgent?: string | null;
  referrer?: string | null;
};

/** Coarse device class only — never store raw UA in creator-facing analytics. */
export function classifyDeviceClass(userAgent: string | null | undefined): "mobile" | "tablet" | "desktop" | "unknown" {
  const ua = (userAgent || "").toLowerCase();
  if (!ua) return "unknown";
  if (/ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(ua)) return "mobile";
  if (/mozilla|chrome|safari|firefox|edg|opera|msie|trident/.test(ua)) return "desktop";
  return "unknown";
}

/** Coarse referrer class — host family only, not full URL with query. */
export function classifyReferrerClass(referrer: string | null | undefined): string {
  const raw = (referrer || "").trim();
  if (!raw) return "direct";
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
    if (!host) return "direct";
    if (/(instagram|facebook|fb\.|meta)/.test(host)) return "social_meta";
    if (/(tiktok|t\.co|twitter|x\.com|linkedin|youtube|snapchat|pinterest)/.test(host)) return "social_other";
    if (/(google|bing|duckduckgo|yahoo|baidu)/.test(host)) return "search";
    if (/(inflr\.me|links\.influrios\.com|influrios\.com)/.test(host)) return "influrios";
    return "other";
  } catch {
    return "other";
  }
}

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  const ua = (userAgent || "").toLowerCase();
  if (!ua) return false;
  return /(bot|crawl|spider|slurp|facebookexternalhit|preview|wget|curl|python-requests|httpclient|headless)/.test(
    ua,
  );
}

export function privacyMetaFromHints(hints?: ShortLinkPrivacyHints | null): {
  bot: boolean;
  public: Record<string, string>;
} {
  const bot = isLikelyBot(hints?.userAgent);
  return {
    bot,
    public: {
      deviceClass: classifyDeviceClass(hints?.userAgent),
      referrerClass: classifyReferrerClass(hints?.referrer),
    },
  };
}

function metaRecord(meta: unknown): Record<string, unknown> {
  if (meta && typeof meta === "object" && !Array.isArray(meta)) return meta as Record<string, unknown>;
  return {};
}

export function isBotEvent(event: ShortLinkEventRow): boolean {
  const meta = metaRecord(event.metaJson);
  return meta.bot === true || meta.bot === "true";
}

const VISIT_TYPES = new Set(["resolve", "qr_scan", "alias_redirect"]);

export type CreatorShortLinkAnalytics = {
  level: AnalyticsLevel;
  totalVisits: number;
  qrScans?: number;
  directVisits?: number;
  aliasRedirects?: number;
  ctaClicks?: number;
  inquiryConversions?: number;
  deviceClasses?: Record<string, number>;
  referrerClasses?: Record<string, number>;
};

/** Entitlement-gated summary — never leaks advanced fields to lower tiers. */
export function summarizeShortLinkAnalytics(
  events: ShortLinkEventRow[],
  level: AnalyticsLevel,
): CreatorShortLinkAnalytics {
  const usable = events.filter((event) => !isBotEvent(event));
  const visits = usable.filter((event) => VISIT_TYPES.has(event.eventType));
  const summary: CreatorShortLinkAnalytics = {
    level,
    totalVisits: visits.length,
  };
  if (level === "views") return summary;

  summary.qrScans = usable.filter((event) => event.eventType === "qr_scan").length;
  summary.directVisits = usable.filter((event) => event.eventType === "resolve").length;
  summary.aliasRedirects = usable.filter((event) => event.eventType === "alias_redirect").length;
  if (level === "standard") return summary;

  summary.ctaClicks = usable.filter((event) => event.eventType === "cta_click").length;
  summary.inquiryConversions = usable.filter((event) => event.eventType === "inquiry_conversion").length;
  const devices: Record<string, number> = {};
  const referrers: Record<string, number> = {};
  for (const event of visits) {
    const meta = metaRecord(event.metaJson);
    const device = typeof meta.deviceClass === "string" ? meta.deviceClass : "unknown";
    const referrer = typeof meta.referrerClass === "string" ? meta.referrerClass : "direct";
    devices[device] = (devices[device] ?? 0) + 1;
    referrers[referrer] = (referrers[referrer] ?? 0) + 1;
  }
  summary.deviceClasses = devices;
  summary.referrerClasses = referrers;
  return summary;
}

export type AdminShortLinkRollup = {
  totalEvents: number;
  visits: number;
  qrScans: number;
  ctaClicks: number;
  destinationChanges: number;
  abuseOpen: number;
};

export function summarizeAdminShortLinkRollup(
  events: ShortLinkEventRow[],
  abuseOpenCount: number,
): AdminShortLinkRollup {
  const usable = events.filter((event) => !isBotEvent(event));
  return {
    totalEvents: usable.length,
    visits: usable.filter((event) => VISIT_TYPES.has(event.eventType)).length,
    qrScans: usable.filter((event) => event.eventType === "qr_scan").length,
    ctaClicks: usable.filter((event) => event.eventType === "cta_click").length,
    destinationChanges: usable.filter((event) => event.eventType === "destination_change").length,
    abuseOpen: abuseOpenCount,
  };
}
