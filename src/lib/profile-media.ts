/**
 * Branded default profile media for new influencers.
 * Gender picks the avatar; banners are chosen from the brand pool (stable per slug).
 */
export type ProfileGender = "male" | "female" | "unspecified";

export const BRAND_AVATARS = {
  male: "/brand/avatars/male.png",
  female: "/brand/avatars/female.png",
  unspecified: "/brand/avatars/generic.svg",
} as const;

export const BRAND_BANNERS = [
  "/brand/banners/rooftop-crew.png",
  "/brand/banners/rooftop-lounge.png",
] as const;

const BRAND_AVATAR_SET = new Set<string>(Object.values(BRAND_AVATARS));
const BRAND_BANNER_SET = new Set<string>(BRAND_BANNERS);
/** Legacy demo headshots we no longer want as new-user defaults. */
export const LEGACY_DEMO_AVATARS = [
  "/demo/creators/creator-sofia.jpg",
  "/demo/creators/creator-priya.jpg",
  "/demo/creators/creator-marcus.jpg",
  "/demo/creators/creator-amara.jpg",
  "/demo/creators/creator-jordan.jpg",
  "/demo/creators/creator-daniel.jpg",
  "/demo/sofia/sofia-banner.jpg",
] as const;

export function isProfileGender(value: string | null | undefined): value is ProfileGender {
  return value === "male" || value === "female" || value === "unspecified";
}

export function normalizeProfileGender(value: string | null | undefined): ProfileGender {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "male" || raw === "m" || raw === "man") return "male";
  if (raw === "female" || raw === "f" || raw === "woman") return "female";
  return "unspecified";
}

/** Stable integer hash for deterministic banner/avatar picks. */
export function mediaHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function defaultAvatarForGender(gender: ProfileGender | null | undefined): string {
  const g = normalizeProfileGender(gender);
  return BRAND_AVATARS[g];
}

/** Banner from the brand pool — stable for a given seed (usually slug). */
export function defaultBannerForSeed(seed: string, offset = 0): string {
  const index = (mediaHash(seed) + offset) % BRAND_BANNERS.length;
  return BRAND_BANNERS[index]!;
}

export function nextBrandBanner(current: string | null | undefined, seed: string): string {
  const currentIndex = BRAND_BANNERS.findIndex((path) => path === current);
  if (currentIndex < 0) return defaultBannerForSeed(seed, 1);
  return BRAND_BANNERS[(currentIndex + 1) % BRAND_BANNERS.length]!;
}

export function isBrandDefaultAvatar(path: string | null | undefined): boolean {
  if (!path) return true;
  return BRAND_AVATAR_SET.has(path) || (LEGACY_DEMO_AVATARS as readonly string[]).includes(path);
}

export function isBrandDefaultBanner(path: string | null | undefined): boolean {
  if (!path) return true;
  return BRAND_BANNER_SET.has(path) || path === "/demo/sofia/sofia-banner.jpg";
}

/**
 * When social avatar lookup fails (or returns legacy demo art), use a branded default.
 * Prefer an explicit gender; otherwise leave unspecified → generic Influrios mark.
 */
export function resolveDefaultAvatar(input: {
  gender?: ProfileGender | null;
  socialImage?: string | null;
  seed?: string;
}): string {
  const social = input.socialImage?.trim() || null;
  if (social && !isBrandDefaultAvatar(social) && !social.includes("/demo/creators/")) {
    return social;
  }
  return defaultAvatarForGender(input.gender);
}

export function resolveDefaultBanner(input: { seed: string; coverImage?: string | null }): string {
  const cover = input.coverImage?.trim() || null;
  if (cover && !isBrandDefaultBanner(cover) && !cover.includes("/demo/sofia/")) {
    return cover;
  }
  return defaultBannerForSeed(input.seed);
}
