/** The influencer card as it appears in Apple Wallet and Google Wallet. */
import { createHmac } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { absoluteAssetUrl, appOrigin, specialtySummary } from "@/lib/creator-og";
import { prisma } from "@/lib/db";

export const WALLET_COLORS = { background: "#1B1464", foreground: "#FFFFFF", label: "#C9BEFF", accent: "#6D4AFF" };

const PLATFORM: Record<string, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  X: "X",
  FACEBOOK: "Facebook",
  LINKEDIN: "LinkedIn",
  PINTEREST: "Pinterest",
  WEBSITE: "Website",
};

export type WalletCard = {
  /** Stable id for the pass (the creator record id). */
  serial: string;
  slug: string;
  name: string;
  title: string;
  specialties: string;
  location: string;
  /** The link the QR code opens: https://inflr.me/{name}, or the profile page when the plan has no short link. */
  cardUrl: string;
  /** cardUrl without https:// — shown under the QR code. */
  cardLabel: string;
  profileUrl: string;
  photoUrl: string | null;
  socials: { label: string; value: string }[];
  updatedAt: Date;
};

const compact = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export async function walletCardFor(slug: string): Promise<WalletCard | null> {
  const creator = await prisma.creator
    .findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        displayName: true,
        title: true,
        avatarUrl: true,
        profileState: true,
        locationCity: true,
        locationState: true,
        locationCountry: true,
        updatedAt: true,
        socialAccounts: { select: { platform: true, handle: true, followers: true } },
        specialties: { select: { isPrimary: true, specialty: { select: { slug: true } } } },
      },
    })
    .catch(() => null);
  if (!creator || creator.profileState === "RESTRICTED") return null;
  const { cardLinkForSlug } = await import("@/lib/short-link");
  const origin = appOrigin();
  const profileUrl = `${origin}/c/${creator.slug}`;
  const cardUrl = (await cardLinkForSlug(creator.slug).catch(() => null)) || profileUrl;
  const specialtySlugs = [...creator.specialties]
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
    .map((row) => row.specialty.slug);
  const socials = creator.socialAccounts
    .filter((row) => row.handle.trim())
    .sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0))
    .slice(0, 3)
    .map((row) => ({
      label: PLATFORM[row.platform] ?? row.platform,
      value: `@${row.handle.replace(/^@/, "")}${row.followers ? ` · ${compact(row.followers)}` : ""}`,
    }));
  const photo = creator.avatarUrl && !/\/brand\/avatars\//.test(creator.avatarUrl) ? absoluteAssetUrl(creator.avatarUrl, origin) : null;
  return {
    serial: creator.id,
    slug: creator.slug,
    name: creator.displayName,
    title: creator.title?.trim() || "Influencer",
    specialties: specialtySummary(specialtySlugs, 3),
    location: [creator.locationCity, creator.locationState, creator.locationCountry].filter(Boolean).join(", "),
    cardUrl,
    cardLabel: cardUrl.replace(/^https?:\/\//, ""),
    profileUrl,
    photoUrl: photo,
    socials,
    updatedAt: creator.updatedAt,
  };
}

/** Per-pass token Apple sends back on update requests (derived, so nothing is stored). */
export function applePassAuthToken(serial: string) {
  const secret = process.env.APP_SECRET || process.env.SESSION_SECRET || process.env.AUTH_SECRET || "influrios-wallet";
  return createHmac("sha256", `${secret}:wallet`).update(serial).digest("base64url").slice(0, 32);
}

// ---------- Images ----------

/** Brand mark (violet tile with the Influrios infinity loop) drawn as SVG, so no font is needed. */
export function brandMarkSvg(size: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="24" fill="${WALLET_COLORS.accent}"/>
  <path d="M50 50 C 40 34, 18 34, 18 50 C 18 66, 40 66, 50 50 C 60 34, 82 34, 82 50 C 82 66, 60 66, 50 50 Z"
    fill="none" stroke="#FFFFFF" stroke-width="9" stroke-linejoin="round"/>
</svg>`;
}

export function wordmarkSvg(height: number) {
  const width = Math.round(height * 3.2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 320 100">
  <g transform="translate(0,10) scale(0.8)">${brandMarkSvg(100).replace(/<\/?svg[^>]*>/g, "")}</g>
  <text x="96" y="66" font-family="Helvetica, Arial, sans-serif" font-size="46" font-weight="700" fill="#FFFFFF">Influrios</text>
</svg>`;
}

export async function pngFromSvg(svg: string, width: number, height?: number) {
  const sharp = (await import("sharp")).default;
  return sharp(Buffer.from(svg)).resize(width, height ?? width, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

/** The influencer's photo as a square PNG, or null when there is none or it cannot be read. */
export async function photoPng(photoUrl: string | null, size: number) {
  if (!photoUrl) return null;
  try {
    let bytes: Buffer;
    const origin = appOrigin();
    if (photoUrl.startsWith(`${origin}/uploads/`) || photoUrl.startsWith("/uploads/")) {
      const rel = photoUrl.replace(origin, "").replace(/^\/+/, "");
      bytes = await readFile(path.join(process.cwd(), "public", rel));
    } else {
      const response = await fetch(photoUrl, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return null;
      bytes = Buffer.from(await response.arrayBuffer());
    }
    const sharp = (await import("sharp")).default;
    return await sharp(bytes).resize(size, size, { fit: "cover" }).png().toBuffer();
  } catch {
    return null;
  }
}
