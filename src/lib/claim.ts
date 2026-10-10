/**
 * Phase 8 / Phase K — Creator Claim & Activation
 * Draft → claim → verify → publish. OnboardingSession in Postgres is authoritative.
 */
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { requireAuthSecret } from "@/lib/app-secret";
import { decideCount, isPlanCode, normalizePlanCode } from "@/lib/entitlements";
import { entitlementsForPlan } from "@/lib/entitlements-db";
import { prisma } from "@/lib/db";
import { advanceClaimStage, completionItemDone, evaluateCompletion, secondSocialDecision } from "@/lib/onboarding";
import {
  defaultAvatarForGender,
  defaultBannerForSeed,
  normalizeBrandAvatar,
  normalizeProfileGender,
  resolveDefaultAvatar,
  resolveDefaultBanner,
  type ProfileGender,
} from "@/lib/profile-media";
import { cookies } from "next/headers";
import type { OnboardingSession, OnboardingState, Prisma } from "@prisma/client";
import type { SeedCreator, SeedSocial } from "@/lib/seed-data";
import { SPECIALTY_TAXONOMY } from "@/lib/seed-data";

export type ClaimStage = "draft" | "claimed" | "verified" | "published";

export type ClaimDraft = {
  id: string;
  slug: string;
  stage: ClaimStage;
  inputHandle: string;
  platform: SeedSocial["platform"];
  displayName: string;
  title: string;
  bio: string;
  locationCity: string;
  locationCountry: string;
  specialties: string[];
  socials: SeedSocial[];
  image: string;
  coverImage: string;
  gender: ProfileGender;
  email?: string;
  ownerName?: string;
  /** Mailed verification code. Absent until SMTP accepts the message. */
  verifyCode?: string;
  /** email after SMTP accepts the code. demo is a stored legacy value and does not verify. */
  verificationDelivery?: "demo" | "email" | "unsent";
  verifiedAt?: string;
  publishedAt?: string;
  attribution: string;
  planTier?: string;
  createdAt: string;
  updatedAt: string;
};

export type CompletenessItem = {
  id: string;
  label: string;
  done: boolean;
  weight: number;
  hint: string;
};

type SessionPayload = {
  displayName: string;
  title: string;
  bio: string;
  locationCity: string;
  locationCountry: string;
  specialties: string[];
  socials: SeedSocial[];
  image: string;
  coverImage: string;
  gender: ProfileGender;
  stage: ClaimStage;
  attribution: string;
  verifyCode?: string;
  verificationDelivery?: "demo" | "email" | "unsent";
  planTier?: string;
};

const COOKIE_NAME = "influrios_creator_session";
const SESSION_DAYS = 14;

/** Best-effort avatar from public social avatar proxies (falls back to demo art). */
export async function resolveSocialAvatar(
  platform: SeedSocial["platform"],
  handle: string,
): Promise<string | null> {
  const clean = handle.replace(/^@/, "").trim();
  if (!clean) return null;
  const candidates: string[] = [];
  if (platform === "INSTAGRAM") candidates.push(`https://unavatar.io/instagram/${encodeURIComponent(clean)}`);
  if (platform === "X") candidates.push(`https://unavatar.io/twitter/${encodeURIComponent(clean)}`);
  if (platform === "YOUTUBE") candidates.push(`https://unavatar.io/youtube/${encodeURIComponent(clean)}`);
  if (platform === "TIKTOK") candidates.push(`https://unavatar.io/tiktok/${encodeURIComponent(clean)}`);
  candidates.push(`https://unavatar.io/${encodeURIComponent(clean)}`);

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(2500),
        headers: { Accept: "image/*" },
      });
      if (res.ok) {
        const type = res.headers.get("content-type") ?? "";
        if (type.startsWith("image/")) return url;
        // unavatar often returns image even without a perfect content-type
        if (res.url && !res.url.includes("fallback")) return url;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

const PLATFORMS = new Set([
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
  "X",
  "FACEBOOK",
  "LINKEDIN",
  "PINTEREST",
  "WEBSITE",
]);

function secret() {
  const dedicated = process.env.CREATOR_SESSION_SECRET?.trim();
  if (dedicated) return dedicated;
  return requireAuthSecret("admin");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function titleCase(s: string) {
  return s
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function platformFromHint(hint?: string): SeedSocial["platform"] | null {
  const key = (hint ?? "").trim().toLowerCase();
  if (key === "instagram") return "INSTAGRAM";
  if (key === "tiktok") return "TIKTOK";
  if (key === "youtube") return "YOUTUBE";
  if (key === "x" || key === "twitter") return "X";
  if (key === "website") return "WEBSITE";
  return null;
}

function detectPlatform(
  raw: string,
  preferred?: string,
): { platform: SeedSocial["platform"] | null; handle: string } {
  const cleaned = raw.trim();
  const lower = cleaned.toLowerCase();
  let platform: SeedSocial["platform"] | null = null;
  if (lower.includes("tiktok.com") || lower.includes("tiktok")) platform = "TIKTOK";
  else if (lower.includes("youtube.com") || lower.includes("youtu.be") || lower.includes("youtube"))
    platform = "YOUTUBE";
  else if (lower.includes("x.com") || lower.includes("twitter.com") || lower.startsWith("@x/"))
    platform = "X";
  else if (lower.includes("instagram.com")) platform = "INSTAGRAM";
  else platform = platformFromHint(preferred);

  const handle = cleaned
    .replace(/^https?:\/\//, "")
    .replace(/^(www\.)?/, "")
    .replace(/^(instagram|tiktok|youtube|www)\.com\//, "")
    .replace(/^x\.com\//, "")
    .replace(/^twitter\.com\//, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .trim();

  return { platform, handle };
}

/** A new claim draft stores the handle and platform that were entered. */
export function claimDraftProfile(input: string, preferredPlatform?: string):
  | { ok: false; error: string }
  | {
      ok: true;
      platform: SeedSocial["platform"];
      handle: string;
      displayName: string;
      title: "";
      bio: "";
      locationCity: "";
      locationCountry: "";
      specialties: [];
    } {
  const { platform, handle } = detectPlatform(input, preferredPlatform);
  if (!handle) return { ok: false, error: "Enter a social URL or handle." };
  if (!platform) return { ok: false, error: "Choose a social platform." };
  return {
    ok: true,
    platform,
    handle,
    displayName: titleCase(handle.replace(/[0-9]+$/g, "")) || handle,
    title: "",
    bio: "",
    locationCity: "",
    locationCountry: "",
    specialties: [],
  };
}

/** A profile self-description is the title that was chosen. */
export function enteredSelfDescription(
  requested: string,
  allowed: readonly string[],
): { ok: true; title: string } | { ok: false; error: string } {
  const title = requested.trim();
  if (!title || !allowed.includes(title)) {
    return { ok: false, error: "Choose how you describe yourself." };
  }
  return { ok: true, title };
}

function platformUrl(platform: SeedSocial["platform"], handle: string) {
  if (platform === "TIKTOK") return `https://tiktok.com/@${handle}`;
  if (platform === "YOUTUBE") return `https://youtube.com/@${handle}`;
  if (platform === "X") return `https://x.com/${handle}`;
  return `https://instagram.com/${handle}`;
}

/** A specialty is suggested only when the handle names one. Otherwise the creator chooses. */
export function guessSpecialty(handle: string, platform: string): string[] {
  const hay = `${handle} ${platform}`.toLowerCase();
  for (const s of SPECIALTY_TAXONOMY) {
    if (hay.includes(s.slug) || hay.includes(s.name.toLowerCase().split(" ")[0]!)) {
      return [s.slug];
    }
  }
  return [];
}

export function claimPublishBlockers(draft: Pick<ClaimDraft, "bio" | "locationCity" | "locationCountry" | "specialties">): string[] {
  const subject = {
    stage: "verified" as const,
    bio: draft.bio,
    locationCity: draft.locationCity,
    locationCountry: draft.locationCountry,
    specialties: draft.specialties,
  };
  const blockers: string[] = [];
  if (!completionItemDone({ key: "location", label: "", hint: "", weight: 0 }, subject)) {
    blockers.push("Add a city and country. Nothing was published.");
  }
  if (!completionItemDone({ key: "bio", label: "", hint: "", weight: 0 }, subject)) {
    blockers.push("Add a bio. Nothing was published.");
  }
  if (!completionItemDone({ key: "specialty", label: "", hint: "", weight: 0 }, subject)) {
    blockers.push("Choose a specialty. Nothing was published.");
  }
  return blockers;
}

function stageFromState(state: OnboardingState): ClaimStage {
  if (state === "CLAIMED") return "claimed";
  if (state === "EMAIL_VERIFIED") return "verified";
  if (state === "PUBLISHED") return "published";
  return "draft";
}

function stateFromStage(stage: ClaimStage): OnboardingState {
  if (stage === "claimed") return "CLAIMED";
  if (stage === "verified") return "EMAIL_VERIFIED";
  if (stage === "published") return "PUBLISHED";
  return "DRAFT";
}

function asPlatform(value: string): SeedSocial["platform"] {
  return (PLATFORMS.has(value) ? value : "INSTAGRAM") as SeedSocial["platform"];
}

function readPayload(raw: Prisma.JsonValue): SessionPayload {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const socials = Array.isArray(value.socials) ? (value.socials as SeedSocial[]) : [];
  const specialties = Array.isArray(value.specialties)
    ? value.specialties.filter((item): item is string => typeof item === "string")
    : [];
  const stage =
    value.stage === "claimed" || value.stage === "verified" || value.stage === "published" || value.stage === "draft"
      ? value.stage
      : "draft";
  return {
    displayName: typeof value.displayName === "string" ? value.displayName : "",
    title: typeof value.title === "string" ? value.title : "",
    bio: typeof value.bio === "string" ? value.bio : "",
    locationCity: typeof value.locationCity === "string" ? value.locationCity : "",
    locationCountry: typeof value.locationCountry === "string" ? value.locationCountry : "",
    specialties,
    socials,
    image:
      typeof value.image === "string" && !value.image.includes("/demo/creators/")
        ? value.image
        : defaultAvatarForGender(
            normalizeProfileGender(typeof value.gender === "string" ? value.gender : "unspecified"),
          ),
    coverImage:
      typeof value.coverImage === "string" && !value.coverImage.includes("/demo/sofia/")
        ? value.coverImage
        : defaultBannerForSeed(typeof value.slug === "string" ? value.slug : "draft"),
    gender: normalizeProfileGender(typeof value.gender === "string" ? value.gender : "unspecified"),
    stage,
    attribution: typeof value.attribution === "string" ? value.attribution : "ORGANIC_SIGNUP",
    verifyCode: typeof value.verifyCode === "string" ? value.verifyCode : undefined,
    verificationDelivery:
      value.verificationDelivery === "email" ? "email" : value.verificationDelivery === "unsent" ? "unsent" : "demo",
    planTier: normalizePlanCode(typeof value.planTier === "string" ? value.planTier : "") ?? undefined,
  };
}

function sessionPayload(draft: ClaimDraft): SessionPayload {
  return {
    displayName: draft.displayName,
    title: draft.title,
    bio: draft.bio,
    locationCity: draft.locationCity,
    locationCountry: draft.locationCountry,
    specialties: draft.specialties,
    socials: draft.socials,
    image: draft.image,
    coverImage: draft.coverImage,
    gender: draft.gender,
    stage: draft.stage,
    attribution: draft.attribution,
    verifyCode: draft.verifyCode,
    verificationDelivery: draft.verificationDelivery ?? "unsent",
    planTier: draft.planTier,
  };
}

/** A claim code verifies the email only after SMTP accepted it. A stored demo code does not. */
export function claimEmailCanVerify(delivery: string | null | undefined): boolean {
  return delivery === "email";
}

/** Public audit/DTO payload — never includes email or verifyCode. */
export function publicClaimPayload(draft: ClaimDraft) {
  return {
    slug: draft.slug,
    displayName: draft.displayName,
    title: draft.title,
    bio: draft.bio,
    locationCity: draft.locationCity,
    locationCountry: draft.locationCountry,
    specialties: draft.specialties,
    socials: draft.socials.map((social) => ({
      platform: social.platform,
      handle: social.handle,
      url: social.url,
      followers: social.followers,
    })),
    image: draft.image,
    coverImage: draft.coverImage,
    gender: draft.gender,
    stage: draft.stage,
    attribution: draft.attribution,
  };
}

export function draftFromSession(row: OnboardingSession): ClaimDraft {
  const payload = readPayload(row.payload);
  return {
    id: row.id,
    slug: row.draftSlug,
    stage: stageFromState(row.state),
    inputHandle: row.inputHandle,
    platform: asPlatform(row.platform),
    displayName: payload.displayName || row.ownerName || row.draftSlug,
    title: payload.title,
    bio: payload.bio,
    locationCity: payload.locationCity,
    locationCountry: payload.locationCountry,
    specialties: payload.specialties,
    socials: payload.socials,
    image:
      payload.image.includes("/demo/creators/")
        ? defaultAvatarForGender(payload.gender || "unspecified")
        : payload.image,
    coverImage:
      !payload.coverImage || payload.coverImage.includes("/demo/sofia/")
        ? defaultBannerForSeed(row.draftSlug)
        : payload.coverImage,
    gender: payload.gender || "unspecified",
    email: row.email ?? undefined,
    ownerName: row.ownerName ?? undefined,
    verifyCode: payload.verifyCode,
    verificationDelivery:
      row.verifyMethod === "EMAIL" || payload.verificationDelivery === "email"
        ? "email"
        : payload.verificationDelivery === "unsent" || row.verifyMethod === "UNSENT"
          ? "unsent"
          : "demo",
    verifiedAt: row.emailVerifiedAt?.toISOString(),
    publishedAt: row.publishedAt?.toISOString(),
    attribution: payload.attribution,
    planTier: payload.planTier,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function writeDraft(draft: ClaimDraft, userId?: string | null) {
  const verifyMethod = draft.verificationDelivery === "email" ? "EMAIL" : "UNSENT";
  await prisma.onboardingSession.upsert({
    where: { id: draft.id },
    create: {
      id: draft.id,
      state: stateFromStage(draft.stage),
      inputHandle: draft.inputHandle,
      platform: draft.platform,
      draftSlug: draft.slug,
      email: draft.email,
      ownerName: draft.ownerName,
      emailVerifiedAt: draft.verifiedAt ? new Date(draft.verifiedAt) : null,
      publishedAt: draft.publishedAt ? new Date(draft.publishedAt) : null,
      verifyMethod,
      payload: sessionPayload(draft) as Prisma.InputJsonValue,
      userId: userId ?? undefined,
    },
    update: {
      state: stateFromStage(draft.stage),
      inputHandle: draft.inputHandle,
      platform: draft.platform,
      draftSlug: draft.slug,
      email: draft.email,
      ownerName: draft.ownerName,
      emailVerifiedAt: draft.verifiedAt ? new Date(draft.verifiedAt) : null,
      publishedAt: draft.publishedAt ? new Date(draft.publishedAt) : null,
      verifyMethod,
      payload: sessionPayload(draft) as Prisma.InputJsonValue,
      ...(userId ? { userId } : {}),
    },
  });
}

async function slugTaken(slug: string, exceptId?: string) {
  const [session, creator] = await Promise.all([
    prisma.onboardingSession.findUnique({ where: { draftSlug: slug }, select: { id: true } }),
    prisma.creator.findUnique({ where: { slug }, select: { id: true } }),
  ]);
  if (session && session.id !== exceptId) return true;
  if (creator) return true;
  return false;
}

/** Build a private draft card from one social URL/handle — no signup required. */
export async function createDraftFromHandle(
  input: string,
  attribution = "ORGANIC_SIGNUP",
  preferredPlatform?: string,
): Promise<ClaimDraft> {
  const fields = claimDraftProfile(input, preferredPlatform);
  if (!fields.ok) throw new Error(fields.error);
  const baseSlug = slugify(fields.handle) || `creator-${randomBytes(3).toString("hex")}`;
  let slug = baseSlug;
  let n = 2;
  while (await slugTaken(slug)) {
    slug = `${baseSlug}-${n++}`;
  }

  const now = new Date().toISOString();
  const socialImage = await resolveSocialAvatar(fields.platform, fields.handle);
  const gender: ProfileGender = "unspecified";
  const image = resolveDefaultAvatar({ socialImage, gender, seed: slug });
  const coverImage = resolveDefaultBanner({ seed: slug });

  const draft: ClaimDraft = {
    id: `draft_${randomBytes(6).toString("hex")}`,
    slug,
    stage: "draft",
    inputHandle: input.trim(),
    platform: fields.platform,
    displayName: fields.displayName,
    title: fields.title,
    bio: fields.bio,
    locationCity: fields.locationCity,
    locationCountry: fields.locationCountry,
    specialties: fields.specialties,
    socials: [
      {
        platform: fields.platform,
        handle: `@${fields.handle}`,
        url: platformUrl(fields.platform, fields.handle),
        followers: 0,
      },
    ],
    image,
    coverImage,
    gender,
    attribution,
    createdAt: now,
    updatedAt: now,
  };

  await writeDraft(draft);
  return draft;
}

/** Private draft of an existing directory profile. Reuses a draft already started for that slug. */
export async function createDraftFromProfile(
  creator: SeedCreator,
  attribution = "ADMIN_INVITE",
): Promise<ClaimDraft> {
  const existing = await prisma.onboardingSession.findUnique({ where: { draftSlug: creator.slug } });
  if (existing) return draftFromSession(existing);

  const social = creator.socials[0];
  const now = new Date().toISOString();
  const draft: ClaimDraft = {
    id: `draft_${randomBytes(6).toString("hex")}`,
    slug: creator.slug,
    stage: "draft",
    inputHandle: social?.handle || creator.slug,
    platform: social?.platform || "INSTAGRAM",
    displayName: creator.displayName,
    title: creator.title,
    bio: creator.bio,
    locationCity: creator.locationCity,
    locationCountry: creator.locationCountry,
    specialties: [...creator.specialties],
    socials: creator.socials.map((item) => ({ ...item })),
    image: resolveDefaultAvatar({
      socialImage: creator.image,
      gender: creator.gender,
      seed: creator.slug,
    }),
    coverImage: resolveDefaultBanner({
      seed: creator.slug,
      coverImage: creator.coverImage,
    }),
    gender: normalizeProfileGender(creator.gender),
    planTier: creator.planTier,
    attribution,
    createdAt: now,
    updatedAt: now,
  };
  await writeDraft(draft);
  return draft;
}

export async function getDraft(id: string) {
  const row = await prisma.onboardingSession.findUnique({ where: { id } });
  return row ? draftFromSession(row) : null;
}

export async function getDraftBySlug(slug: string) {
  const row = await prisma.onboardingSession.findUnique({ where: { draftSlug: slug } });
  return row ? draftFromSession(row) : null;
}

/**
 * Published claims live on Creator rows after persistPublishedClaim.
 * Directory reads Postgres; this stays empty so Discover does not double-count JSON leftovers.
 */
export async function listPublishedClaimCreators(): Promise<SeedCreator[]> {
  return [];
}

export async function getPublishedCreatorBySlug(slug: string): Promise<SeedCreator | null> {
  const draft = await getDraftBySlug(slug);
  if (!draft || draft.stage !== "published") return null;
  return draftToSeedCreator(draft);
}

export function draftToSeedCreator(draft: ClaimDraft): SeedCreator {
  const image = normalizeBrandAvatar(draft.image, draft.gender);
  const coverImage = draft.coverImage?.includes("/demo/sofia/")
    ? defaultBannerForSeed(draft.slug)
    : draft.coverImage || defaultBannerForSeed(draft.slug);
  // Temporary claim cards: when still on a brand default avatar, prefer the lifestyle
  // cover so the hero matches the Influrios branded preview imagery.
  const hero =
    draft.stage !== "published" &&
    (image === defaultAvatarForGender(draft.gender) || image.endsWith("/generic.png") || image.endsWith("/generic.svg"))
      ? coverImage
      : image;

  return {
    slug: draft.slug,
    displayName: draft.displayName,
    title: draft.title,
    bio: draft.bio,
    locationCity: draft.locationCity,
    locationCountry: draft.locationCountry,
    languages: [],
    avatarColor: "#633CFF",
    image: hero,
    coverImage,
    gender: draft.gender,
    badge: draft.stage === "published" ? "Starter" : "Draft preview",
    statusLabel: draft.stage === "published" ? "Open to partnerships" : "Draft — not public yet",
    planTier: draft.planTier === "PLUS" || draft.planTier === "PRO" ? draft.planTier : "STARTER",
    specialties: draft.specialties,
    socials: draft.socials,
    openToCollab: true,
    verified: false,
    stats: {
      engagementRate: "",
      engagementDelta: "",
      totalReach: "",
      reachDelta: "",
      avgViews: "",
      viewsDelta: "",
      collaborations: "",
      collabDelta: "",
    },
  };
}

export async function claimDraft(input: {
  draftId: string;
  email: string;
  name: string;
  gender?: string;
  title?: string;
}): Promise<ClaimDraft> {
  const draft = await getDraft(input.draftId);
  if (!draft) throw new Error("Draft not found");
  const claimed = advanceClaimStage(draft.stage, "claim");
  if (!claimed.ok) throw new Error(claimed.error);

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email.includes("@") || !name) throw new Error("Name and valid email required");

  const nextGender = normalizeProfileGender(input.gender ?? draft.gender);
  draft.email = email;
  draft.ownerName = name;
  draft.displayName = name;
  const title = input.title?.trim();
  if (title) draft.title = title;
  draft.gender = nextGender;
  // When gender becomes known and avatar is still a brand default, swap to the matching set.
  draft.image = resolveDefaultAvatar({
    socialImage: draft.image,
    gender: nextGender,
    seed: draft.slug,
  });
  draft.coverImage = resolveDefaultBanner({ seed: draft.slug, coverImage: draft.coverImage });
  draft.stage = claimed.stage;
  draft.updatedAt = new Date().toISOString();

  const { mailReady } = await import("@/lib/mail");
  const canMail = await mailReady();
  draft.verifyCode = canMail ? String(randomInt(100000, 1000000)) : undefined;
  draft.verificationDelivery = canMail ? "email" : "unsent";
  await writeDraft(draft);

  const { recordClaim } = await import("@/lib/claim-persist");
  await recordClaim(draft);

  if (canMail && draft.verifyCode) {
    const { enqueueClaimVerificationEmail } = await import("@/lib/jobs");
    const queued = await enqueueClaimVerificationEmail(email, draft.verifyCode);
    if (!queued.queued) {
      draft.verifyCode = undefined;
      draft.verificationDelivery = "unsent";
      draft.updatedAt = new Date().toISOString();
      await writeDraft(draft);
    }
  }

  await noteInvitation(draft.id, "claimed");
  return draft;
}

export async function verifyDraft(draftId: string, code: string): Promise<ClaimDraft> {
  const draft = await getDraft(draftId);
  if (!draft) throw new Error("Draft not found");
  const verified = advanceClaimStage(draft.stage, "verify");
  if (!verified.ok) throw new Error(verified.error);
  if (!claimEmailCanVerify(draft.verificationDelivery) || !draft.verifyCode) {
    const { recordVerificationAttempt } = await import("@/lib/claim-persist");
    await recordVerificationAttempt({
      draft,
      channel: "EMAIL",
      success: false,
      detail: "email was not sent",
    });
    throw new Error("SMTP is not configured. Nothing was verified.");
  }
  if (code.trim() !== draft.verifyCode) {
    const { recordVerificationAttempt } = await import("@/lib/claim-persist");
    await recordVerificationAttempt({
      draft,
      channel: "EMAIL",
      success: false,
      detail: "invalid verification code",
    });
    throw new Error("Invalid verification code");
  }
  draft.stage = verified.stage;
  draft.verifiedAt = new Date().toISOString();
  draft.updatedAt = draft.verifiedAt;
  await writeDraft(draft);
  const { recordVerificationAttempt } = await import("@/lib/claim-persist");
  await recordVerificationAttempt({
    draft,
    channel: "EMAIL",
    success: true,
    detail: "email code accepted; social account remains unverified",
  });
  return draft;
}

export async function publishDraft(draftId: string): Promise<ClaimDraft> {
  const draft = await getDraft(draftId);
  if (!draft) throw new Error("Draft not found");
  const published = advanceClaimStage(draft.stage, "publish");
  if (!published.ok) throw new Error(published.error);
  const blockers = claimPublishBlockers(draft);
  if (blockers.length > 0) throw new Error(blockers[0]);
  draft.stage = published.stage;
  draft.publishedAt = new Date().toISOString();
  draft.updatedAt = draft.publishedAt;
  await writeDraft(draft);

  const { persistPublishedClaim } = await import("@/lib/claim-persist");
  await persistPublishedClaim(draft);
  const { invalidateDirectoryCache } = await import("@/lib/directory");
  invalidateDirectoryCache();
  await noteInvitation(draft.id, "published");
  return draft;
}

export async function addDraftSocial(draftId: string, social: SeedSocial): Promise<ClaimDraft> {
  const draft = await getDraft(draftId);
  if (!draft) throw new Error("Draft not found");
  const limits = await entitlementsForPlan("STARTER");
  const decision = secondSocialDecision(draft.socials.length, limits, "STARTER");
  if (!decision.ok) {
    const upgrade = decision.upgradePlanCode ? ` Upgrade to ${decision.upgradePlanCode}.` : "";
    throw new Error(
      `card.social_links.max limit ${decision.limit}.${upgrade} Starter includes ${decision.limit} social ${decision.limit === 1 ? "link" : "links"}.`,
    );
  }
  draft.socials.push(social);
  draft.updatedAt = new Date().toISOString();
  await writeDraft(draft);
  return draft;
}

export async function updateDraftProfile(
  draftId: string,
  patch: Partial<
    Pick<
      ClaimDraft,
      | "displayName"
      | "title"
      | "bio"
      | "locationCity"
      | "locationCountry"
      | "specialties"
      | "image"
      | "coverImage"
      | "gender"
    >
  >,
): Promise<ClaimDraft> {
  const draft = await getDraft(draftId);
  if (!draft) throw new Error("Draft not found");
  if (patch.specialties) {
    const plan = draft.planTier || "STARTER";
    const limits = await entitlementsForPlan(plan);
    const decision = decideCount(limits, "specialtiesMax", patch.specialties.length, isPlanCode(plan) ? plan : "STARTER");
    if (!decision.ok) {
      const upgrade = decision.upgradePlanCode ? ` Upgrade to ${decision.upgradePlanCode}.` : "";
      throw new Error(
        `This card includes ${decision.limit} ${decision.limit === 1 ? "specialty" : "specialties"}.${upgrade}`,
      );
    }
  }
  const previousGender = draft.gender;
  Object.assign(draft, patch);
  if (patch.gender) {
    draft.gender = normalizeProfileGender(patch.gender);
    // Auto-refresh default avatar when gender changes and the photo is still a brand default.
    if (draft.gender !== previousGender) {
      draft.image = resolveDefaultAvatar({
        socialImage: patch.image ?? draft.image,
        gender: draft.gender,
        seed: draft.slug,
      });
    }
  }
  draft.updatedAt = new Date().toISOString();
  await writeDraft(draft);

  if (draft.stage === "published") {
    await syncPublishedCreatorProfile(draft);
  }
  return draft;
}

async function syncPublishedCreatorProfile(draft: ClaimDraft) {
  const creator = await prisma.creator.findUnique({ where: { slug: draft.slug } });
  if (!creator) return;
  await prisma.creator.update({
    where: { id: creator.id },
    data: {
      displayName: draft.displayName,
      title: draft.title,
      bio: draft.bio,
      locationCity: draft.locationCity,
      locationCountry: draft.locationCountry,
      avatarUrl: draft.image,
      coverUrl: draft.coverImage,
      gender: draft.gender,
    },
  });
  if (draft.specialties) {
    await prisma.creatorSpecialty.deleteMany({ where: { creatorId: creator.id } });
    for (const [index, slug] of draft.specialties.entries()) {
      const specialty = await prisma.specialty.findUnique({ where: { slug } });
      if (!specialty) continue;
      await prisma.creatorSpecialty.create({
        data: {
          creatorId: creator.id,
          specialtyId: specialty.id,
          isPrimary: index === 0,
          source: "CREATOR_CLAIMED",
        },
      });
    }
  }
  const { invalidateDirectoryCache } = await import("@/lib/directory");
  invalidateDirectoryCache();
  const { syncCreatorSearch } = await import("@/lib/creator-search");
  await syncCreatorSearch(draft.slug);
}

export function completenessFor(draft: ClaimDraft): {
  score: number;
  items: CompletenessItem[];
} {
  return evaluateCompletion(draft);
}

async function noteInvitation(draftId: string, status: "claimed" | "published") {
  try {
    const { advanceInvitationForDraft } = await import("@/lib/invitations");
    await advanceInvitationForDraft(draftId, status);
  } catch (error) {
    console.error("invitation advance skipped", error);
  }
}

export async function setCreatorSession(draftId: string) {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  const body = Buffer.from(JSON.stringify({ draftId, exp }), "utf8").toString("base64url");
  const token = `${body}.${sign(body)}`;
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function clearCreatorSession() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

async function draftFromAccountUser(userId: string): Promise<ClaimDraft | null> {
  const open = await prisma.onboardingSession.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  if (open) return draftFromSession(open);

  const creator = await prisma.creator.findFirst({
    where: { userId },
    include: { specialties: { include: { specialty: true } }, socialAccounts: true },
  });
  if (!creator) return null;

  const session = await prisma.onboardingSession.findUnique({ where: { draftSlug: creator.slug } });
  if (session) return draftFromSession(session);

  // Published creator without a surviving session row — synthesize a published draft for the dashboard.
  const now = new Date().toISOString();
  return {
    id: `creator_${creator.id}`,
    slug: creator.slug,
    stage: "published",
    inputHandle: creator.socialAccounts[0]?.handle ?? creator.slug,
    platform: asPlatform(creator.socialAccounts[0]?.platform ?? "INSTAGRAM"),
    displayName: creator.displayName,
    title: creator.title ?? "",
    bio: creator.bio ?? "",
    locationCity: creator.locationCity ?? "",
    locationCountry: creator.locationCountry ?? "",
    specialties: creator.specialties.map((row) => row.specialty.slug),
    socials: creator.socialAccounts.map((row) => ({
      platform: asPlatform(row.platform),
      handle: row.handle,
      url: row.url ?? "",
      followers: row.followers ?? 0,
    })),
    image: resolveDefaultAvatar({
      socialImage: creator.avatarUrl,
      gender: normalizeProfileGender(creator.gender),
      seed: creator.slug,
    }),
    coverImage: resolveDefaultBanner({
      seed: creator.slug,
      coverImage: creator.coverUrl,
    }),
    gender: normalizeProfileGender(creator.gender),
    email: undefined,
    ownerName: creator.displayName,
    publishedAt: creator.updatedAt.toISOString(),
    attribution: "PROFILE_CLAIM",
    planTier: normalizePlanCode(creator.planTier) ?? "STARTER",
    createdAt: creator.createdAt.toISOString(),
    updatedAt: now,
  };
}

export async function getCreatorSessionDraft(): Promise<ClaimDraft | null> {
  try {
    const { getAccountSession } = await import("@/lib/accounts");
    const account = await getAccountSession();
    if (account) {
      const fromAccount = await draftFromAccountUser(account.id);
      if (fromAccount) return fromAccount;
    }
  } catch {
    /* account module unavailable in some scripts */
  }

  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      draftId: string;
      exp: number;
    };
    if (parsed.exp < Date.now()) return null;
    return getDraft(parsed.draftId);
  } catch {
    return null;
  }
}

/** Link the open claim draft cookie to a registered member and keep the creator session. */
export async function attachClaimToUser(userId: string) {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) {
    const latest = await prisma.onboardingSession.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    if (latest) await setCreatorSession(latest.id);
    return;
  }
  const [body, sig] = raw.split(".");
  if (!body || !sig) return;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return;
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      draftId: string;
      exp: number;
    };
    if (parsed.exp < Date.now()) return;
    await prisma.onboardingSession.update({
      where: { id: parsed.draftId },
      data: { userId },
    });
    await setCreatorSession(parsed.draftId);
  } catch {
    /* draft may already be linked or missing */
  }
}

export const CREATOR_COOKIE = COOKIE_NAME;
