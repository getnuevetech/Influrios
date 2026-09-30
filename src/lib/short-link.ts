import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { isPlanCode, type EntitlementLimits } from "@/lib/entitlements";
import { entitlementsForPlan } from "@/lib/entitlements-db";
import { isShortLinkHost, normalizeShortHost } from "@/lib/short-link-hosts";

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
      where: { isPrimary: true, active: true },
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
      create: { ...domain, active: true },
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
  const current = creator.shortLinks[0];
  if (current) {
    if ((entitlements.standardQr || entitlements.dynamicQr) && current.status === "active") {
      await createQr(current.id);
    }
    if (current.dynamic !== entitlements.dynamicQr) {
      await prisma.shortLink.update({
        where: { id: current.id },
        data: { dynamic: entitlements.dynamicQr },
      });
    }
    return prisma.shortLink.findUnique({
      where: { id: current.id },
      include: { qrIdentities: { where: { status: "active" }, take: 1 } },
    });
  }
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
      },
    });
    if (entitlements.standardQr || entitlements.dynamicQr) await createQr(link.id);
    return prisma.shortLink.findUnique({
      where: { id: link.id },
      include: { qrIdentities: { where: { status: "active" }, take: 1 } },
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return null;
    throw error;
  }
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

async function recordEvent(shortLinkId: string | undefined, eventType: string, meta: Record<string, string>) {
  if (!shortLinkId) return;
  await prisma.shortLinkEvent
    .create({ data: { shortLinkId, eventType, metaJson: meta } })
    .catch(() => undefined);
}

export function shortLinkRootMessage(canonicalOrigin?: string) {
  const origin = (canonicalOrigin || process.env.NEXT_PUBLIC_APP_URL || "https://influrios.com").replace(/\/$/, "");
  return `Creator profiles stay on Influrios. Open ${origin} to browse the directory.`;
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

export async function resolveShortRequest(host: string, path: string): Promise<ResolveHit> {
  try {
    return await resolveShortRequestFromStore(host, path);
  } catch (error) {
    console.error("short link resolve", error);
    return hitWhenShortStoreUnavailable(host, path);
  }
}

async function resolveShortRequestFromStore(host: string, path: string): Promise<ResolveHit> {
  await ensureShortLinkDefaults();
  const hostname = normalizeShortHost(host);
  const domain = await prisma.shortLinkDomain.findUnique({ where: { hostname } });
  if (!domain?.active) {
    return {
      kind: "page",
      status: 404,
      title: "Unknown short domain",
      message: "This hostname is not an active Influrios short-link domain.",
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

  const qr = clean.match(/^\/q\/([A-Za-z0-9_-]{4,80})$/);
  if (qr) return resolveQrToken(qr[1], allowed, settings.canonicalOrigin);

  const slugMatch = clean.match(/^\/([a-z0-9][a-z0-9-]{1,30})$/);
  if (!slugMatch) {
    return { kind: "page", status: 404, title: "Link not found", message: "That Influrios short link does not exist." };
  }
  const slug = slugMatch[1];
  if (isReservedSlug(slug) || (await prisma.reservedSlug.findUnique({ where: { slug } }))) {
    return { kind: "page", status: 404, title: "Reserved", message: "That name is reserved by Influrios." };
  }

  const direct = await prisma.shortLink.findUnique({ where: { slug } });
  if (direct) return finishSlug(direct, allowed, settings.canonicalOrigin, "destination");

  const alias = await prisma.shortLinkAlias.findUnique({
    where: { slug },
    include: { shortLink: true },
  });
  if (alias?.redirect && alias.shortLink.status === "active") {
    const hostName = domain.hostname;
    const cache = redirectCacheFor("alias");
    void recordEvent(alias.shortLinkId, "alias_redirect", { slug });
    return {
      kind: "redirect",
      ...cache,
      location: `https://${hostName}/${alias.shortLink.slug}`,
      shortLinkId: alias.shortLinkId,
      eventType: "alias_redirect",
    };
  }

  const provisioned = await provisionByPublicSlug(slug);
  if (provisioned) return finishSlug(provisioned, allowed, settings.canonicalOrigin, "destination");

  return { kind: "page", status: 404, title: "Link not found", message: "That Influrios short link does not exist." };
}

export async function resolveQrToken(
  token: string,
  allowedHosts?: string[],
  canonicalOrigin?: string,
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
        void recordEvent(link.id, "qr_scan", { token, legacy: "card" });
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
  void recordEvent(identity.shortLinkId, "qr_scan", { token: identity.token });
  return { kind: "redirect", ...cache, location, shortLinkId: identity.shortLinkId, eventType: "qr_scan" };
}

async function finishSlug(
  link: { id: string; status: string; destination: string },
  allowed: string[],
  canonicalOrigin: string,
  kind: "alias" | "destination",
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
  void recordEvent(link.id, "resolve", { destination: location });
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

export function canMintShortLink(entitlements: EntitlementLimits) {
  return entitlements.shortlink && entitlements.shortlinkMax > 0;
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

export async function setShortLinkDestination(shortLinkId: string, destination: string, dynamic: boolean) {
  if (!dynamic) return { ok: false as const, error: "Only a dynamic short link can change destination." };
  const settings = await getShortLinkSettings();
  const location = safeRedirectTarget(destination, hostsFrom(settings), settings.canonicalOrigin);
  if (!location) return { ok: false as const, error: "Destination must be an Influrios path or an allow-listed https host." };
  const stored = destination.trim().startsWith("/") ? destination.trim() : location;
  await prisma.shortLink.update({
    where: { id: shortLinkId },
    data: { destination: stored, destinationKind: stored.startsWith("/") ? "path" : "https" },
  });
  void recordEvent(shortLinkId, "destination_change", { destination: stored });
  return { ok: true as const };
}

export function brandedFallbackHtml(title: string, message: string) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} · Influrios</title>
</head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b123f;color:#fff;font-family:Georgia,serif">
  <main style="max-width:28rem;padding:2rem;text-align:center">
    <p style="letter-spacing:.18em;text-transform:uppercase;font-size:.75rem;color:#c4b5fd">Influrios</p>
    <h1 style="font-size:1.8rem;margin:.5rem 0">${safeTitle}</h1>
    <p style="color:#dbe4ff;line-height:1.5">${safeMessage}</p>
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
