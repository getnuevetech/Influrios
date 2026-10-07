import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { isPlanCode, type EntitlementLimits } from "@/lib/entitlements";
import { entitlementsForPlan } from "@/lib/entitlements-db";
import { isShortLinkHost, normalizeShortHost } from "@/lib/short-link-hosts";
import {
  privacyMetaFromHints,
  summarizeAdminShortLinkRollup,
  summarizeShortLinkAnalytics,
  type CreatorShortLinkAnalytics,
  type ShortLinkPrivacyHints,
} from "@/lib/short-link-analytics";
import { canAddCampaignLink, normalizeCampaignCode, parseShortPath, scheduleStartsInFuture } from "@/lib/short-link-phase4";

export type { ShortLinkPrivacyHints } from "@/lib/short-link-analytics";

export const LAUNCH_SHORT_HOST = "inflr.me";

/** Words that must never become a creator slug on the short domain. */
export const RESERVED_SLUGS = [
  "admin",
  "login",
  "signup",
  "register",
  "support",
  "help",
  "billing",
  "api",
  "www",
  "mail",
  "privacy",
  "terms",
  "legal",
  "influrios",
  "inflr",
  "q",
  "c",
  "i",
  "r",
  "static",
  "assets",
  "favicon",
] as const;

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

export function normalizeSlug(input: string): string | null {
  const slug = input.trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, "");
  if (!SLUG_RE.test(slug) || slug.includes("--")) return null;
  return slug;
}

export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug);
}

/**
 * Alias redirects can be cached. Destination redirects must not be, so a
 * suspension or a Pro destination change is not frozen by an intermediary.
 */
export function redirectCacheFor(kind: "alias" | "destination"): { status: 301 | 302; cacheControl: string } {
  if (kind === "alias") return { status: 301, cacheControl: "public, max-age=3600" };
  return { status: 302, cacheControl: "no-store" };
}

export function safeRedirectTarget(
  destination: string,
  allowedHosts: string[],
  canonicalOrigin: string,
): string | null {
  const dest = destination.trim();
  if (!dest || dest.includes("\\") || dest.includes("\n")) return null;
  if (dest.startsWith("/") && !dest.startsWith("//")) {
    const origin = canonicalOrigin.replace(/\/$/, "");
    try {
      const url = new URL(origin);
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      return `${origin}${dest}`;
    } catch {
      return null;
    }
  }
  try {
    const url = new URL(dest);
    if (url.protocol !== "https:") return null;
    if (!allowedHosts.map((host) => host.toLowerCase()).includes(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function hostsFrom(settings: { allowedHosts: string; canonicalOrigin: string }) {
  const hosts = settings.allowedHosts
    .split(/[\s,]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  try {
    hosts.push(new URL(settings.canonicalOrigin).hostname.toLowerCase());
  } catch {
    /* canonical is validated before save */
  }
  return [...new Set(hosts)];
}

let hostCache: { at: number; host: string } | null = null;

export async function primaryShortHost(): Promise<string> {
  if (hostCache && Date.now() - hostCache.at < 30_000) return hostCache.host;
  try {
    const row = await prisma.shortLinkDomain.findFirst({
      where: { isPrimary: true, active: true, verified: true },
      orderBy: { hostname: "asc" },
    });
    const host = row?.hostname || LAUNCH_SHORT_HOST;
    hostCache = { at: Date.now(), host };
    return host;
  } catch {
    return LAUNCH_SHORT_HOST;
  }
}

export function clearShortHostCache() {
  hostCache = null;
}

/** Spec §20.24 — only verified+active domains serve short links / become primary. */
export function domainCanServe(domain: { verified: boolean; active: boolean }) {
  return Boolean(domain.verified && domain.active);
}

export function domainCanBePrimary(domain: { verified: boolean; active: boolean }) {
  return domainCanServe(domain);
}

async function settingsRow() {
  const canonical =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://influrios.com";
  let canonicalHost = "influrios.com";
  try {
    canonicalHost = new URL(canonical).hostname;
  } catch {
    /* keep default */
  }
  return prisma.shortLinkSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      canonicalOrigin: canonical,
      allowedHosts: ["influrios.com", "www.influrios.com", canonicalHost].filter((v, i, a) => a.indexOf(v) === i).join("\n"),
    },
  });
}

export async function ensureShortLinkDefaults() {
  const domains = [
    { hostname: "inflr.me", label: "Primary short domain", isPrimary: true, fallback: false },
    { hostname: "www.inflr.me", label: "www alias", isPrimary: false, fallback: false },
    { hostname: "links.influrios.com", label: "Fallback short domain", isPrimary: false, fallback: true },
  ];
  for (const domain of domains) {
    await prisma.shortLinkDomain.upsert({
      where: { hostname: domain.hostname },
      update: {},
      create: {
        ...domain,
        active: true,
        verified: true,
        verifiedAt: new Date(),
        verifiedBy: "system",
      },
    });
  }
  for (const slug of RESERVED_SLUGS) {
    await prisma.reservedSlug.upsert({
      where: { slug },
      update: {},
      create: { slug, reason: "platform" },
    });
  }
  await settingsRow();
  clearShortHostCache();
}

export async function getShortLinkSettings() {
  await ensureShortLinkDefaults();
  return settingsRow();
}

function newToken() {
  return randomBytes(9).toString("base64url");
}

async function createQr(shortLinkId: string) {
  const existing = await prisma.qrIdentity.findFirst({
    where: { shortLinkId, status: "active" },
  });
  if (existing) return existing;
  return prisma.qrIdentity.create({ data: { token: newToken(), shortLinkId, status: "active" } });
}

async function createNfc(shortLinkId: string) {
  const existing = await prisma.nfcIdentity.findFirst({
    where: { shortLinkId, status: "active" },
  });
  if (existing) return existing;
  return prisma.nfcIdentity.create({ data: { token: newToken(), shortLinkId, status: "active" } });
}

const activeIdentityInclude = {
  qrIdentities: { where: { status: "active" }, take: 1 },
  nfcIdentities: { where: { status: "active" }, take: 1 },
} as const;

export async function ensureCreatorShortLink(creatorSlug: string) {
  await ensureShortLinkDefaults();
  const creator = await prisma.creator.findUnique({
    where: { slug: creatorSlug },
    include: { card: true, shortLinks: { where: { status: { not: "archived" } } } },
  });
  if (!creator || creator.profileState === "RESTRICTED") return null;
  const plan = isPlanCode(creator.planTier) ? creator.planTier : "STARTER";
  const entitlements = await entitlementsForPlan(plan);
  if (!entitlements.shortlink || entitlements.shortlinkMax < 1) return null;
  const snapshot = entitlementSnapshotForMint(plan, entitlements);
  const current = creator.shortLinks[0];
  if (current) {
    if ((entitlements.standardQr || entitlements.dynamicQr) && current.status === "active") {
      await createQr(current.id);
      await createNfc(current.id);
    }
    const patch: { dynamic?: boolean; entitlementSnapshotJson?: object } = {};
    if (current.dynamic !== entitlements.dynamicQr) patch.dynamic = entitlements.dynamicQr;
    if (current.entitlementSnapshotJson == null) patch.entitlementSnapshotJson = snapshot;
    if (Object.keys(patch).length) {
      await prisma.shortLink.update({ where: { id: current.id }, data: patch });
    }
    return prisma.shortLink.findUnique({
      where: { id: current.id },
      include: activeIdentityInclude,
    });
  }
  if (!canCreateAnotherShortLink(creator.shortLinks.length, entitlements)) return null;
  const slug = normalizeSlug(creator.card?.shortAlias || creator.slug.split("-")[0] || "");
  if (!slug || isReservedSlug(slug)) return null;
  const taken = await prisma.shortLink.findUnique({ where: { slug } });
  const aliasTaken = await prisma.shortLinkAlias.findUnique({ where: { slug } });
  if (taken || aliasTaken) return null;
  try {
    const link = await prisma.shortLink.create({
      data: {
        creatorId: creator.id,
        slug,
        destinationKind: "profile",
        destination: `/c/${creator.slug}`,
        status: "active",
        dynamic: entitlements.dynamicQr,
        entitlementSnapshotJson: snapshot,
      },
    });
    if (entitlements.standardQr || entitlements.dynamicQr) {
      await createQr(link.id);
      await createNfc(link.id);
    }
    return prisma.shortLink.findUnique({
      where: { id: link.id },
      include: activeIdentityInclude,
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return null;
    throw error;
  }
}

export type ShortLinkEntitlementSnapshot = {
  plan: string;
  shortlink: boolean;
  shortlinkMax: number;
  customAlias: boolean;
  standardQr: boolean;
  dynamicQr: boolean;
  frozenAt: string;
};

export function entitlementSnapshotForMint(
  plan: string,
  entitlements: EntitlementLimits,
): ShortLinkEntitlementSnapshot {
  return {
    plan,
    shortlink: entitlements.shortlink,
    shortlinkMax: entitlements.shortlinkMax,
    customAlias: entitlements.customAlias,
    standardQr: entitlements.standardQr,
    dynamicQr: entitlements.dynamicQr,
    frozenAt: new Date().toISOString(),
  };
}

export function canCreateAnotherShortLink(existingActiveCount: number, entitlements: EntitlementLimits) {
  if (!canMintShortLink(entitlements)) return false;
  return existingActiveCount < entitlements.shortlinkMax;
}

export function canMintShortLink(entitlements: EntitlementLimits) {
  return entitlements.shortlink && entitlements.shortlinkMax > 0;
}

export async function shortLinkPublicLabel(creatorSlug: string): Promise<string | null> {
  const link = await ensureCreatorShortLink(creatorSlug).catch(() => null);
  if (!link || link.status !== "active") return null;
  const host = await primaryShortHost();
  return `${host}/${link.slug}`;
}

export async function qrPayloadForSlug(creatorSlug: string): Promise<string | null> {
  const link = await ensureCreatorShortLink(creatorSlug);
  const token = link?.qrIdentities[0]?.token;
  if (!link || !token || link.status !== "active") return null;
  const host = await primaryShortHost();
  return `https://${host}/q/${token}`;
}

type ResolveHit =
  | { kind: "redirect"; status: 301 | 302; location: string; cacheControl: string; shortLinkId: string; eventType: string }
  | { kind: "page"; status: number; title: string; message: string };

async function recordEvent(
  shortLinkId: string | undefined,
  eventType: string,
  meta: Record<string, string>,
  hints?: ShortLinkPrivacyHints | null,
) {
  if (!shortLinkId) return;
  const privacy = privacyMetaFromHints(hints);
  if (privacy.bot) return;
  await prisma.shortLinkEvent
    .create({
      data: {
        shortLinkId,
        eventType,
        metaJson: { ...meta, ...privacy.public },
      },
    })
    .catch(() => undefined);
}

export function shortLinkRootMessage(canonicalOrigin?: string) {
  const origin = (canonicalOrigin || process.env.NEXT_PUBLIC_APP_URL || "https://influrios.com").replace(/\/$/, "");
  return `Influencer profiles stay on Influrios. Open ${origin} to browse the directory.`;
}

/** Known launch hosts can explain themselves when the store is down. Slugs are never invented. */
export function hitWhenShortStoreUnavailable(host: string, path: string): ResolveHit {
  const hostname = normalizeShortHost(host);
  const clean = path.split("?")[0].replace(/\/+$/, "") || "/";
  if (clean === "/" && isShortLinkHost(hostname)) {
    return {
      kind: "page",
      status: 200,
      title: "Influrios short links",
      message: shortLinkRootMessage(),
    };
  }
  return {
    kind: "page",
    status: 503,
    title: "Influrios",
    message: "This short link could not be resolved right now.",
  };
}

export async function resolveShortRequest(
  host: string,
  path: string,
  hints?: ShortLinkPrivacyHints | null,
): Promise<ResolveHit> {
  try {
    return await resolveShortRequestFromStore(host, path, hints);
  } catch (error) {
    console.error("short link resolve", error);
    return hitWhenShortStoreUnavailable(host, path);
  }
}

async function resolveShortRequestFromStore(
  host: string,
  path: string,
  hints?: ShortLinkPrivacyHints | null,
): Promise<ResolveHit> {
  await ensureShortLinkDefaults();
  const hostname = normalizeShortHost(host);
  const domain = await prisma.shortLinkDomain.findUnique({ where: { hostname } });
  if (!domain || !domainCanServe(domain)) {
    return {
      kind: "page",
      status: 404,
      title: "Unknown short domain",
      message: domain && domain.active && !domain.verified
        ? "This short-link domain is not verified yet."
        : "This hostname is not an active Influrios short-link domain.",
    };
  }
  const clean = path.split("?")[0].replace(/\/+$/, "") || "/";
  if (clean === "/") {
    const settings = await settingsRow();
    return {
      kind: "page",
      status: 200,
      title: "Influrios short links",
      message: shortLinkRootMessage(settings.canonicalOrigin),
    };
  }
  const settings = await settingsRow();
  const allowed = hostsFrom(settings);
  const parsed = parseShortPath(clean);
  if (parsed.kind === "qr") return resolveQrToken(parsed.token, allowed, settings.canonicalOrigin, hints);
  if (parsed.kind === "nfc") return resolveNfcToken(parsed.token, allowed, settings.canonicalOrigin, hints);
  if (parsed.kind === "campaign") return resolveCampaignCode(parsed.code, allowed, settings.canonicalOrigin, hints);
  if (parsed.kind !== "slug") {
    return { kind: "page", status: 404, title: "Link not found", message: "That Influrios short link does not exist." };
  }
  const slug = parsed.slug;
  if (isReservedSlug(slug) || (await prisma.reservedSlug.findUnique({ where: { slug } }))) {
    return { kind: "page", status: 404, title: "Reserved", message: "That name is reserved by Influrios." };
  }

  const direct = await prisma.shortLink.findUnique({ where: { slug } });
  if (direct) return finishSlug(direct, allowed, settings.canonicalOrigin, "destination", hints);

  const alias = await prisma.shortLinkAlias.findUnique({
    where: { slug },
    include: { shortLink: true },
  });
  if (alias && aliasShouldRedirect(alias)) {
    const hostName = domain.hostname;
    const cache = redirectCacheFor("alias");
    void recordEvent(alias.shortLinkId, "alias_redirect", { slug }, hints);
    return {
      kind: "redirect",
      ...cache,
      location: `https://${hostName}/${alias.shortLink.slug}`,
      shortLinkId: alias.shortLinkId,
      eventType: "alias_redirect",
    };
  }

  // Spec §20.12 — disabled alias redirects do not resolve (configured alias policy).
  if (alias) {
    return {
      kind: "page",
      status: 404,
      title: "Link not found",
      message: "That Influrios short link does not exist.",
    };
  }

  const provisioned = await provisionByPublicSlug(slug);
  if (provisioned) return finishSlug(provisioned, allowed, settings.canonicalOrigin, "destination", hints);

  return { kind: "page", status: 404, title: "Link not found", message: "That Influrios short link does not exist." };
}

export async function resolveQrToken(
  token: string,
  allowedHosts?: string[],
  canonicalOrigin?: string,
  hints?: ShortLinkPrivacyHints | null,
): Promise<ResolveHit> {
  await ensureShortLinkDefaults();
  const settings = await settingsRow();
  const allowed = allowedHosts ?? hostsFrom(settings);
  const origin = canonicalOrigin ?? settings.canonicalOrigin;
  const identity = await prisma.qrIdentity.findUnique({
    where: { token },
    include: { shortLink: true },
  });
  if (!identity || identity.status !== "active") {
    const legacy = await prisma.influenceCard.findUnique({
      where: { qrToken: token },
      include: { creator: true },
    });
    if (legacy?.published && legacy.creator.profileState !== "RESTRICTED") {
      const link = await ensureCreatorShortLink(legacy.creator.slug);
      const location = link
        ? safeRedirectTarget(link.destination, allowed, origin)
        : safeRedirectTarget(`/c/${legacy.creator.slug}`, allowed, origin);
      if (location && link?.status === "active") {
        void recordEvent(link.id, "qr_scan", { token, legacy: "card" }, hints);
        const cache = redirectCacheFor("destination");
        return { kind: "redirect", ...cache, location, shortLinkId: link.id, eventType: "qr_scan" };
      }
    }
    return {
      kind: "page",
      status: 404,
      title: "QR not found",
      message: "This QR code is not an active Influrios identity.",
    };
  }
  if (identity.shortLink.status !== "active") {
    return {
      kind: "page",
      status: 403,
      title: "Link unavailable",
      message: "This Influrios link is suspended. The QR identity is unchanged.",
    };
  }
  const location = safeRedirectTarget(identity.shortLink.destination, allowed, origin);
  if (!location) {
    return {
      kind: "page",
      status: 404,
      title: "Destination blocked",
      message: "This link destination is not on the Influrios allow list.",
    };
  }
  const cache = redirectCacheFor("destination");
  void recordEvent(identity.shortLinkId, "qr_scan", { token: identity.token }, hints);
  return { kind: "redirect", ...cache, location, shortLinkId: identity.shortLinkId, eventType: "qr_scan" };
}

export async function resolveNfcToken(
  token: string,
  allowedHosts?: string[],
  canonicalOrigin?: string,
  hints?: ShortLinkPrivacyHints | null,
): Promise<ResolveHit> {
  await ensureShortLinkDefaults();
  const settings = await settingsRow();
  const allowed = allowedHosts ?? hostsFrom(settings);
  const origin = canonicalOrigin ?? settings.canonicalOrigin;
  const identity = await prisma.nfcIdentity.findUnique({
    where: { token },
    include: { shortLink: true },
  });
  if (!identity || identity.status !== "active") {
    return { kind: "page", status: 404, title: "NFC not found", message: "This NFC tag is not an active Influrios identity." };
  }
  if (identity.shortLink.status !== "active") {
    return {
      kind: "page",
      status: 403,
      title: "Link unavailable",
      message: "This Influrios link is suspended. The NFC identity is unchanged.",
    };
  }
  const location = safeRedirectTarget(identity.shortLink.destination, allowed, origin);
  if (!location) {
    return { kind: "page", status: 404, title: "Destination blocked", message: "This link destination is not on the Influrios allow list." };
  }
  const cache = redirectCacheFor("destination");
  void recordEvent(identity.shortLinkId, "nfc_tap", { token: identity.token }, hints);
  return { kind: "redirect", ...cache, location, shortLinkId: identity.shortLinkId, eventType: "nfc_tap" };
}

async function resolveCampaignCode(
  code: string,
  allowedHosts: string[],
  canonicalOrigin: string,
  hints?: ShortLinkPrivacyHints | null,
): Promise<ResolveHit> {
  const campaign = await prisma.campaignLink.findUnique({
    where: { code },
    include: { shortLink: true },
  });
  if (!campaign || campaign.status !== "active" || campaign.shortLink.status !== "active") {
    return { kind: "page", status: 404, title: "Campaign not found", message: "That Influrios campaign link does not exist." };
  }
  const location = safeRedirectTarget(campaign.destination, allowedHosts, canonicalOrigin);
  if (!location) {
    return { kind: "page", status: 404, title: "Destination blocked", message: "This campaign destination is not on the Influrios allow list." };
  }
  const cache = redirectCacheFor("destination");
  void recordEvent(campaign.shortLinkId, "campaign_redirect", { code: campaign.code }, hints);
  return { kind: "redirect", ...cache, location, shortLinkId: campaign.shortLinkId, eventType: "campaign_redirect" };
}

async function finishSlug(
  link: { id: string; status: string; destination: string },
  allowed: string[],
  canonicalOrigin: string,
  kind: "alias" | "destination",
  hints?: ShortLinkPrivacyHints | null,
): Promise<ResolveHit> {
  if (link.status !== "active") {
    return {
      kind: "page",
      status: 403,
      title: "Link unavailable",
      message: "This Influrios link is suspended.",
    };
  }
  const location = safeRedirectTarget(link.destination, allowed, canonicalOrigin);
  if (!location) {
    return {
      kind: "page",
      status: 404,
      title: "Destination blocked",
      message: "This link destination is not on the Influrios allow list.",
    };
  }
  const cache = redirectCacheFor(kind);
  void recordEvent(link.id, "resolve", { destination: location }, hints);
  return { kind: "redirect", ...cache, location, shortLinkId: link.id, eventType: "resolve" };
}

async function provisionByPublicSlug(slug: string) {
  const creators = await prisma.creator.findMany({
    where: {
      profileState: { not: "RESTRICTED" },
      OR: [{ slug }, { slug: { startsWith: `${slug}-` } }, { card: { shortAlias: slug } }],
    },
    include: { card: true },
    take: 3,
  });
  if (creators.length !== 1) return null;
  const plan = isPlanCode(creators[0].planTier) ? creators[0].planTier : "STARTER";
  const entitlements = await entitlementsForPlan(plan);
  if (!canMintShortLink(entitlements)) return null;
  return ensureCreatorShortLink(creators[0].slug);
}

export async function changeCreatorSlug(creatorSlug: string, nextSlug: string) {
  const slug = normalizeSlug(nextSlug);
  if (!slug) return { ok: false as const, error: "Use 3–30 letters, numbers, or single hyphens." };
  if (isReservedSlug(slug) || (await prisma.reservedSlug.findUnique({ where: { slug } }))) {
    return { ok: false as const, error: "That name is reserved." };
  }
  const creator = await prisma.creator.findUnique({ where: { slug: creatorSlug } });
  if (!creator) return { ok: false as const, error: "Publish your card before changing the short link." };
  const plan = isPlanCode(creator.planTier) ? creator.planTier : "STARTER";
  const entitlements = await entitlementsForPlan(plan);
  if (!entitlements.customAlias) return { ok: false as const, error: "Custom slugs are not included on this plan." };
  const link = await ensureCreatorShortLink(creatorSlug);
  if (!link) return { ok: false as const, error: "This plan does not include a short link." };
  if (link.slug === slug) return { ok: true as const, slug };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.shortLinkAlias.create({
        data: { shortLinkId: link.id, slug: link.slug, redirect: true },
      });
      await tx.shortLink.update({ where: { id: link.id }, data: { slug } });
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return { ok: false as const, error: "That short link is already taken." };
    }
    throw error;
  }
  void recordEvent(link.id, "slug_change", { from: link.slug, to: slug });
  return { ok: true as const, slug };
}

/** Spec §20.12 — alias redirects follow configured policy (admin can disable). */
export function aliasShouldRedirect(alias: { redirect: boolean; shortLink: { status: string } }) {
  return Boolean(alias.redirect && alias.shortLink.status === "active");
}

/** Admin ops: enable or disable an old-slug redirect without deleting the alias row. */
export async function setAliasRedirect(aliasId: string, redirect: boolean) {
  const id = aliasId.trim();
  if (!id) return { ok: false as const, error: "Missing alias." };
  const updated = await prisma.shortLinkAlias.updateMany({
    where: { id },
    data: { redirect },
  });
  if (updated.count !== 1) return { ok: false as const, error: "Alias not found." };
  return { ok: true as const };
}

/** Ops-attested domain ownership — Spec §16 / §20.24 (no DNS challenge). */
export async function setDomainVerification(
  domainId: string,
  verified: boolean,
  actorId?: string | null,
) {
  const id = domainId.trim();
  if (!id) return { ok: false as const, error: "Missing domain." };
  const domain = await prisma.shortLinkDomain.findUnique({ where: { id } });
  if (!domain) return { ok: false as const, error: "Domain not found." };
  if (!verified && domain.isPrimary) {
    return { ok: false as const, error: "Make another verified domain primary before unverifying this one." };
  }
  await prisma.shortLinkDomain.update({
    where: { id },
    data: verified
      ? { verified: true, verifiedAt: new Date(), verifiedBy: actorId?.trim() || "admin" }
      : { verified: false, verifiedAt: null, verifiedBy: null },
  });
  clearShortHostCache();
  return { ok: true as const };
}

export async function makePrimaryDomain(domainId: string) {
  const id = domainId.trim();
  if (!id) return { ok: false as const, error: "Missing domain." };
  const domain = await prisma.shortLinkDomain.findUnique({ where: { id } });
  if (!domain) return { ok: false as const, error: "Domain not found." };
  if (!domainCanBePrimary(domain)) {
    return { ok: false as const, error: "Verify the domain before making it primary." };
  }
  await prisma.$transaction([
    prisma.shortLinkDomain.updateMany({ data: { isPrimary: false } }),
    prisma.shortLinkDomain.update({ where: { id }, data: { isPrimary: true, active: true } }),
  ]);
  clearShortHostCache();
  return { ok: true as const };
}

/** Warn copy before a creator slug change (Spec §13). */
export function slugChangeWarning(fromSlug: string, toSlug: string) {
  return `“/${fromSlug}” will permanently redirect to “/${toSlug}” until an admin disables that alias. Your printed QR still works.`;
}

export type DestinationActorType = "creator" | "admin" | "system";

export type DestinationChangeActor = {
  type: DestinationActorType;
  id?: string | null;
};

/** Gate for Pro dynamic destination changes (INFLR.me Spec §9). */
export function canChangeDynamicDestination(input: {
  dynamic: boolean;
  status: string;
  requireEntitlement?: boolean;
  entitlementsDynamicQr?: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (!input.dynamic) return { ok: false, error: "Only a dynamic short link can change destination." };
  if (input.status !== "active") {
    return { ok: false, error: "Suspended short links cannot change destination." };
  }
  if (input.requireEntitlement && !input.entitlementsDynamicQr) {
    return { ok: false, error: "Dynamic destinations are included on the Pro plan." };
  }
  return { ok: true };
}

export function storeDestinationValue(destination: string, resolvedHttps: string): string {
  const trimmed = destination.trim();
  return trimmed.startsWith("/") ? trimmed : resolvedHttps;
}

export function destinationKindFor(stored: string): "path" | "https" {
  return stored.startsWith("/") ? "path" : "https";
}

/** Most recent history row is the prior safe destination for immediate rollback. */
export function priorDestinationFromHistory(
  entries: Array<{ previousDestination: string; previousKind: string }>,
): { destination: string; destinationKind: string } | null {
  const latest = entries[0];
  if (!latest?.previousDestination) return null;
  return { destination: latest.previousDestination, destinationKind: latest.previousKind };
}

export async function setShortLinkDestination(
  shortLinkId: string,
  destination: string,
  dynamic: boolean,
  actor: DestinationChangeActor = { type: "system" },
  reason: "update" | "rollback" | "schedule" = "update",
) {
  const link = await prisma.shortLink.findUnique({ where: { id: shortLinkId } });
  if (!link) return { ok: false as const, error: "Missing short link." };
  const gate = canChangeDynamicDestination({
    dynamic: dynamic && link.dynamic,
    status: link.status,
  });
  if (!gate.ok) return gate;

  const settings = await getShortLinkSettings();
  const location = safeRedirectTarget(destination, hostsFrom(settings), settings.canonicalOrigin);
  if (!location) {
    return { ok: false as const, error: "Destination must be an Influrios path or an allow-listed https host." };
  }
  const stored = storeDestinationValue(destination, location);
  const kind = destinationKindFor(stored);
  if (stored === link.destination) return { ok: true as const, destination: stored, unchanged: true as const };

  await prisma.$transaction(async (tx) => {
    await tx.shortLinkDestinationHistory.create({
      data: {
        shortLinkId,
        previousDestination: link.destination,
        previousKind: link.destinationKind,
        destination: stored,
        destinationKind: kind,
        actorType: actor.type,
        actorId: actor.id ?? null,
        reason,
      },
    });
    await tx.shortLink.update({
      where: { id: shortLinkId },
      data: { destination: stored, destinationKind: kind },
    });
  });
  // Opaque QR identities are untouched — Pro destination changes must not require QR regeneration.
  void recordEvent(shortLinkId, "destination_change", {
    destination: stored,
    reason,
    actorType: actor.type,
  });
  return { ok: true as const, destination: stored, unchanged: false as const };
}

export async function listShortLinkDestinationHistory(shortLinkId: string, limit = 20) {
  return prisma.shortLinkDestinationHistory.findMany({
    where: { shortLinkId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 50),
  });
}

export async function rollbackShortLinkDestination(
  shortLinkId: string,
  actor: DestinationChangeActor = { type: "system" },
) {
  const history = await listShortLinkDestinationHistory(shortLinkId, 1);
  const prior = priorDestinationFromHistory(history);
  if (!prior) return { ok: false as const, error: "No prior destination to restore." };
  return setShortLinkDestination(shortLinkId, prior.destination, true, actor, "rollback");
}

export async function scheduleShortLinkDestination(shortLinkId: string, destination: string, startsAt: Date) {
  const link = await prisma.shortLink.findUnique({ where: { id: shortLinkId } });
  if (!link) return { ok: false as const, error: "Missing short link." };
  const gate = canChangeDynamicDestination({ dynamic: link.dynamic, status: link.status });
  if (!gate.ok) return gate;
  if (!scheduleStartsInFuture(startsAt, new Date())) {
    return { ok: false as const, error: "Choose a start time at least a minute from now." };
  }
  const pending = await prisma.shortLinkSchedule.count({ where: { shortLinkId, status: "pending" } });
  if (pending > 0) return { ok: false as const, error: "A destination change is already scheduled. Cancel it first." };
  const settings = await getShortLinkSettings();
  const location = safeRedirectTarget(destination, hostsFrom(settings), settings.canonicalOrigin);
  if (!location) {
    return { ok: false as const, error: "Destination must be an Influrios path or an allow-listed https host." };
  }
  const stored = storeDestinationValue(destination, location);
  const row = await prisma.shortLinkSchedule.create({
    data: {
      shortLinkId,
      destination: stored,
      destinationKind: destinationKindFor(stored),
      startsAt,
      status: "pending",
    },
  });
  return { ok: true as const, id: row.id, destination: stored, startsAt: row.startsAt };
}

export async function cancelShortLinkSchedule(shortLinkId: string, scheduleId: string) {
  const updated = await prisma.shortLinkSchedule.updateMany({
    where: { id: scheduleId, shortLinkId, status: "pending" },
    data: { status: "cancelled" },
  });
  if (updated.count !== 1) return { ok: false as const, error: "That schedule is not pending." };
  return { ok: true as const };
}

export async function listPendingShortLinkSchedules(shortLinkId: string) {
  return prisma.shortLinkSchedule.findMany({
    where: { shortLinkId, status: "pending" },
    orderBy: { startsAt: "asc" },
  });
}

/** Applies due schedules. QR and NFC tokens are not rewritten. */
export async function applyDueShortLinkSchedules(now = new Date()) {
  const due = await prisma.shortLinkSchedule.findMany({
    where: { status: "pending", startsAt: { lte: now } },
    orderBy: { startsAt: "asc" },
    take: 50,
  });
  let applied = 0;
  for (const row of due) {
    const result = await setShortLinkDestination(
      row.shortLinkId,
      row.destination,
      true,
      { type: "system", id: "schedule" },
      "schedule",
    );
    await prisma.shortLinkSchedule.update({
      where: { id: row.id },
      data: result.ok ? { status: "applied", appliedAt: now } : { status: "blocked" },
    });
    if (result.ok) applied += 1;
  }
  return { applied, scanned: due.length };
}

export async function createCampaignLink(input: {
  creatorSlug: string;
  code: string;
  label: string;
  destination: string;
}) {
  const creator = await prisma.creator.findUnique({
    where: { slug: input.creatorSlug },
    include: { shortLinks: { where: { status: "active" }, take: 1 } },
  });
  const link = creator?.shortLinks[0];
  if (!creator || !link) return { ok: false as const, error: "An active short link is required before a campaign link." };
  const plan = isPlanCode(creator.planTier) ? creator.planTier : "STARTER";
  const entitlements = await entitlementsForPlan(plan);
  const campaignCount = await prisma.campaignLink.count({ where: { creatorId: creator.id, status: { not: "archived" } } });
  if (!canAddCampaignLink({ shortlinkMax: entitlements.shortlinkMax, campaignCount })) {
    return { ok: false as const, error: "This plan has no remaining campaign link slots." };
  }
  const code = normalizeCampaignCode(input.code, RESERVED_SLUGS);
  if (!code) return { ok: false as const, error: "Use a short campaign code with letters, numbers, and hyphens." };
  const label = input.label.trim().slice(0, 80);
  if (!label) return { ok: false as const, error: "A campaign label is required." };
  const settings = await getShortLinkSettings();
  const location = safeRedirectTarget(input.destination, hostsFrom(settings), settings.canonicalOrigin);
  if (!location) {
    return { ok: false as const, error: "Destination must be an Influrios path or an allow-listed https host." };
  }
  const takenSlug = await prisma.shortLink.findUnique({ where: { slug: code } });
  const takenAlias = await prisma.shortLinkAlias.findUnique({ where: { slug: code } });
  if (takenSlug || takenAlias) return { ok: false as const, error: "That code is already a short link." };
  const stored = storeDestinationValue(input.destination, location);
  try {
    const row = await prisma.campaignLink.create({
      data: {
        code,
        label,
        creatorId: creator.id,
        shortLinkId: link.id,
        destination: stored,
        destinationKind: destinationKindFor(stored),
        status: "active",
      },
    });
    return { ok: true as const, id: row.id, code: row.code };
  } catch (error) {
    const prismaCode = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (prismaCode === "P2002") return { ok: false as const, error: "That campaign code is already in use." };
    throw error;
  }
}

export async function listCreatorCampaignLinks(creatorSlug: string) {
  const creator = await prisma.creator.findUnique({ where: { slug: creatorSlug }, select: { id: true } });
  if (!creator) return [];
  return prisma.campaignLink.findMany({
    where: { creatorId: creator.id, status: { not: "archived" } },
    orderBy: { createdAt: "desc" },
  });
}

export async function setCampaignLinkStatus(creatorSlug: string, campaignId: string, status: "active" | "suspended") {
  const creator = await prisma.creator.findUnique({ where: { slug: creatorSlug }, select: { id: true } });
  if (!creator) return { ok: false as const, error: "Creator not found." };
  const updated = await prisma.campaignLink.updateMany({
    where: { id: campaignId, creatorId: creator.id, status: { not: "archived" } },
    data: { status },
  });
  if (updated.count !== 1) return { ok: false as const, error: "Campaign link not found." };
  return { ok: true as const };
}

/** Pro self-serve destination update — ownership + dynamicQr entitlement gated. */
export async function setCreatorDynamicDestination(creatorSlug: string, destination: string) {
  const creator = await prisma.creator.findUnique({
    where: { slug: creatorSlug },
    include: { shortLinks: { where: { status: { not: "archived" } }, take: 1 } },
  });
  if (!creator) return { ok: false as const, error: "Publish your card before changing the destination." };
  const plan = isPlanCode(creator.planTier) ? creator.planTier : "STARTER";
  const entitlements = await entitlementsForPlan(plan);
  const link = creator.shortLinks[0];
  if (!link) return { ok: false as const, error: "This plan does not include a short link." };
  const gate = canChangeDynamicDestination({
    dynamic: link.dynamic,
    status: link.status,
    requireEntitlement: true,
    entitlementsDynamicQr: entitlements.dynamicQr,
  });
  if (!gate.ok) return gate;
  return setShortLinkDestination(link.id, destination, true, { type: "creator", id: creator.id }, "update");
}

export async function rollbackCreatorDynamicDestination(creatorSlug: string) {
  const creator = await prisma.creator.findUnique({
    where: { slug: creatorSlug },
    include: { shortLinks: { where: { status: { not: "archived" } }, take: 1 } },
  });
  if (!creator) return { ok: false as const, error: "Publish your card before changing the destination." };
  const plan = isPlanCode(creator.planTier) ? creator.planTier : "STARTER";
  const entitlements = await entitlementsForPlan(plan);
  const link = creator.shortLinks[0];
  if (!link) return { ok: false as const, error: "This plan does not include a short link." };
  const gate = canChangeDynamicDestination({
    dynamic: link.dynamic,
    status: link.status,
    requireEntitlement: true,
    entitlementsDynamicQr: entitlements.dynamicQr,
  });
  if (!gate.ok) return gate;
  return rollbackShortLinkDestination(link.id, { type: "creator", id: creator.id });
}

/** Entitlement-aware creator analytics — never returns another creator's traffic. */
export async function getCreatorShortLinkAnalytics(
  creatorSlug: string,
): Promise<{ ok: true; analytics: CreatorShortLinkAnalytics; shortLinkId: string } | { ok: false; error: string }> {
  const creator = await prisma.creator.findUnique({
    where: { slug: creatorSlug },
    include: { shortLinks: { where: { status: { not: "archived" } }, take: 1 } },
  });
  if (!creator) return { ok: false, error: "Publish your card before viewing link analytics." };
  const link = creator.shortLinks[0];
  if (!link) return { ok: false, error: "This plan does not include a short link." };
  const plan = isPlanCode(creator.planTier) ? creator.planTier : "STARTER";
  const entitlements = await entitlementsForPlan(plan);
  const events = await prisma.shortLinkEvent.findMany({
    where: { shortLinkId: link.id },
    orderBy: { createdAt: "desc" },
    take: 2_000,
    select: { eventType: true, metaJson: true, createdAt: true },
  });
  return {
    ok: true,
    shortLinkId: link.id,
    analytics: summarizeShortLinkAnalytics(events, entitlements.analytics),
  };
}

export async function getAdminShortLinkAnalyticsRollup() {
  const [events, abuseOpen] = await Promise.all([
    prisma.shortLinkEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 5_000,
      select: { eventType: true, metaJson: true },
    }),
    prisma.shortLinkAbuseCase.count({ where: { status: "open" } }),
  ]);
  return summarizeAdminShortLinkRollup(events, abuseOpen);
}

/** Record a card CTA click against the creator's short link (privacy-safe). */
export async function recordCreatorCtaClick(
  creatorSlug: string,
  hints?: ShortLinkPrivacyHints | null,
) {
  const creator = await prisma.creator.findUnique({
    where: { slug: creatorSlug },
    include: { shortLinks: { where: { status: { not: "archived" } }, take: 1 } },
  });
  const link = creator?.shortLinks[0];
  if (!link || link.status !== "active") return { ok: false as const };
  void recordEvent(link.id, "cta_click", { source: "influencer_card" }, hints);
  return { ok: true as const };
}

export async function recordCreatorInquiryConversion(
  creatorSlug: string,
  hints?: ShortLinkPrivacyHints | null,
) {
  const creator = await prisma.creator.findUnique({
    where: { slug: creatorSlug },
    include: { shortLinks: { where: { status: { not: "archived" } }, take: 1 } },
  });
  const link = creator?.shortLinks[0];
  if (!link || link.status !== "active") return { ok: false as const };
  void recordEvent(link.id, "inquiry_conversion", { source: "contact_inquiry" }, hints);
  return { ok: true as const };
}

export function brandedFallbackHtml(
  title: string,
  message: string,
  options?: { canonicalOrigin?: string; ctaLabel?: string; outcome?: string },
) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const origin = (
    options?.canonicalOrigin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://influrios.com"
  ).replace(/\/$/, "");
  const safeOrigin = escapeHtml(origin);
  const ctaLabel = escapeHtml(options?.ctaLabel || "Open Influrios");
  const outcome = options?.outcome ? escapeHtml(options.outcome) : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} · Influrios</title>
</head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(ellipse at top,#1a2460 0%,#0b123f 55%,#070b28 100%);color:#fff;font-family:Georgia,'Times New Roman',serif">
  <main style="max-width:28rem;padding:2rem;text-align:center">
    <p style="letter-spacing:.18em;text-transform:uppercase;font-size:.75rem;color:#c4b5fd;margin:0">Influrios</p>
    <h1 style="font-size:1.8rem;margin:.75rem 0 .5rem;font-weight:700">${safeTitle}</h1>
    <p style="color:#dbe4ff;line-height:1.55;margin:0 0 1.5rem">${safeMessage}</p>
    <a href="${safeOrigin}" style="display:inline-block;padding:.7rem 1.25rem;border-radius:.85rem;background:linear-gradient(90deg,#633CFF,#2979FF);color:#fff;text-decoration:none;font-family:system-ui,sans-serif;font-size:.875rem;font-weight:700">${ctaLabel}</a>
    <p style="margin:1.25rem 0 0;font-family:system-ui,sans-serif;font-size:.7rem;color:#94a3b8">Influencer profiles and collaborations live on Influrios — short links only redirect.</p>
    ${outcome ? `<p style="margin:.5rem 0 0;font-family:ui-monospace,monospace;font-size:.65rem;color:#64748b" data-resolve-outcome="${outcome}">${outcome}</p>` : ""}
  </main>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
