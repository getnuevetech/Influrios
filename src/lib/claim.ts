/**
 * Phase 8 / Phase K — Creator Claim & Activation
 * Draft → claim → verify → publish. OnboardingSession in Postgres is authoritative.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { decideCount, isPlanCode } from "@/lib/entitlements";
import { entitlementsForPlan } from "@/lib/entitlements-db";
import { prisma } from "@/lib/db";
import { advanceClaimStage, evaluateCompletion, secondSocialDecision } from "@/lib/onboarding";
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
  email?: string;
  ownerName?: string;
  /** Verification code — shown only when SMTP is not ready (demo path). */
  verifyCode?: string;
  /** How the claim verification code was delivered. */
  verificationDelivery?: "demo" | "email";
  verifiedAt?: string;
  publishedAt?: string;
  attribution: string;
  planTier?: SeedCreator["planTier"];
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
  stage: ClaimStage;
  attribution: string;
  verifyCode?: string;
  verificationDelivery?: "demo" | "email";
  planTier?: SeedCreator["planTier"];
};

const COOKIE_NAME = "influrios_creator_session";
const SESSION_DAYS = 14;
const DEMO_IMAGES = [
  "/demo/creators/creator-sofia.jpg",
  "/demo/creators/creator-priya.jpg",
  "/demo/creators/creator-marcus.jpg",
  "/demo/creators/creator-amara.jpg",
  "/demo/creators/creator-jordan.jpg",
  "/demo/creators/creator-daniel.jpg",
];

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
  return process.env.CREATOR_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || "influrios-creator-demo";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
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
): { platform: SeedSocial["platform"]; handle: string } {
  const cleaned = raw.trim();
  const lower = cleaned.toLowerCase();
  let platform: SeedSocial["platform"] = platformFromHint(preferred) ?? "INSTAGRAM";
  if (lower.includes("tiktok.com") || lower.includes("tiktok")) platform = "TIKTOK";
  else if (lower.includes("youtube.com") || lower.includes("youtu.be") || lower.includes("youtube"))
    platform = "YOUTUBE";
  else if (lower.includes("x.com") || lower.includes("twitter.com") || lower.startsWith("@x/"))
    platform = "X";
  else if (platformFromHint(preferred)) platform = platformFromHint(preferred)!;

  let handle = cleaned
    .replace(/^https?:\/\//, "")
    .replace(/^(www\.)?/, "")
    .replace(/^(instagram|tiktok|youtube|www)\.com\//, "")
    .replace(/^x\.com\//, "")
    .replace(/^twitter\.com\//, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .trim();

  if (!handle) handle = "influencer";
  return { platform, handle };
}

function platformUrl(platform: SeedSocial["platform"], handle: string) {
  if (platform === "TIKTOK") return `https://tiktok.com/@${handle}`;
  if (platform === "YOUTUBE") return `https://youtube.com/@${handle}`;
  if (platform === "X") return `https://x.com/${handle}`;
  return `https://instagram.com/${handle}`;
}

function guessSpecialty(handle: string, platform: string): string[] {
  const hay = `${handle} ${platform}`.toLowerCase();
  for (const s of SPECIALTY_TAXONOMY) {
    if (hay.includes(s.slug) || hay.includes(s.name.toLowerCase().split(" ")[0]!)) {
      return [s.slug];
    }
  }
  return ["lifestyle"];
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
    image: typeof value.image === "string" ? value.image : DEMO_IMAGES[0]!,
    stage,
    attribution: typeof value.attribution === "string" ? value.attribution : "ORGANIC_SIGNUP",
    verifyCode: typeof value.verifyCode === "string" ? value.verifyCode : undefined,
    verificationDelivery: value.verificationDelivery === "email" ? "email" : "demo",
    planTier:
      value.planTier === "STARTER" || value.planTier === "PLUS" || value.planTier === "PRO"
        ? value.planTier
        : undefined,
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
    stage: draft.stage,
    attribution: draft.attribution,
    verifyCode: draft.verifyCode,
    verificationDelivery: draft.verificationDelivery ?? "demo",
    planTier: draft.planTier,
  };
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
    image: payload.image,
    email: row.email ?? undefined,
    ownerName: row.ownerName ?? undefined,
    verifyCode: payload.verifyCode,
    verificationDelivery: row.verifyMethod === "EMAIL" || payload.verificationDelivery === "email" ? "email" : "demo",
    verifiedAt: row.emailVerifiedAt?.toISOString(),
    publishedAt: row.publishedAt?.toISOString(),
    attribution: payload.attribution,
    planTier: payload.planTier,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function writeDraft(draft: ClaimDraft, userId?: string | null) {
  const verifyMethod =
    draft.verificationDelivery === "email" ? "EMAIL" : draft.verifyCode ? "DEMO_CODE" : "DEMO_CODE";
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
  const { platform, handle } = detectPlatform(input, preferredPlatform);
  const baseSlug = slugify(handle) || `creator-${randomBytes(3).toString("hex")}`;
  let slug = baseSlug;
  let n = 2;
  while (await slugTaken(slug)) {
    slug = `${baseSlug}-${n++}`;
  }

  const displayName = titleCase(handle.replace(/[0-9]+$/g, "")) || "New Influencer";
  const specialty = guessSpecialty(handle, platform);
  const specialtyName =
    SPECIALTY_TAXONOMY.find((s) => s.slug === specialty[0])?.name ?? "Lifestyle";
  const now = new Date().toISOString();
  const socialImage = await resolveSocialAvatar(platform, handle);
  const image = socialImage ?? DEMO_IMAGES[Math.abs(hash(handle)) % DEMO_IMAGES.length]!;
  // Demo preview specialties so the temporary card shows a full-card experience.
  const previewSpecialties = [...new Set([specialty[0], "lifestyle", "travel"].filter(Boolean))].slice(0, 3);

  const draft: ClaimDraft = {
    id: `draft_${randomBytes(6).toString("hex")}`,
    slug,
    stage: "draft",
    inputHandle: input.trim(),
    platform,
    displayName,
    title: `${specialtyName} Influencer`,
    bio: `Draft Influencer Profile for @${handle}. Confirm specialties, bio, and location after you claim — nothing publishes until you say so.`,
    locationCity: "Your city",
    locationCountry: "Your country",
    specialties: previewSpecialties,
    socials: [
      {
        platform,
        handle: `@${handle}`,
        url: platformUrl(platform, handle),
        followers: 12500,
      },
      {
        platform: platform === "INSTAGRAM" ? "TIKTOK" : "INSTAGRAM",
        handle: `@${handle}`,
        url: platformUrl(platform === "INSTAGRAM" ? "TIKTOK" : "INSTAGRAM", handle),
        followers: 8200,
      },
      {
        platform: "YOUTUBE",
        handle: `@${handle}`,
        url: platformUrl("YOUTUBE", handle),
        followers: 4100,
      },
    ],
    image,
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
    image: creator.image,
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
  return {
    slug: draft.slug,
    displayName: draft.displayName,
    title: draft.title,
    bio: draft.bio,
    locationCity: draft.locationCity,
    locationCountry: draft.locationCountry,
    languages: ["English"],
    avatarColor: "#633CFF",
    image: draft.image,
    badge: draft.stage === "published" ? "Rising Star" : "Draft preview",
    statusLabel: draft.stage === "published" ? "Open to partnerships" : "Draft — not public yet",
    planTier: draft.planTier ?? "STARTER",
    specialties: draft.specialties,
    socials: draft.socials,
    openToCollab: true,
    verified: draft.stage === "verified" || draft.stage === "published" || draft.stage === "draft",
    stats: {
      engagementRate: "4.8%",
      engagementDelta: "+0.2%",
      totalReach: "25K",
      reachDelta: "+1.1K",
      avgViews: "18K",
      viewsDelta: "+900",
      collaborations: "0",
      collabDelta: "—",
    },
  };
}

export async function claimDraft(input: {
  draftId: string;
  email: string;
  name: string;
}): Promise<ClaimDraft> {
  const draft = await getDraft(input.draftId);
  if (!draft) throw new Error("Draft not found");
  const claimed = advanceClaimStage(draft.stage, "claim");
  if (!claimed.ok) throw new Error(claimed.error);

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email.includes("@") || !name) throw new Error("Name and valid email required");

  draft.email = email;
  draft.ownerName = name;
  draft.displayName = name;
  draft.stage = claimed.stage;
  draft.verifyCode = String(100000 + (Math.abs(hash(email + draft.id)) % 900000));
  draft.updatedAt = new Date().toISOString();

  const { mailReady } = await import("@/lib/mail");
  const canMail = await mailReady();
  draft.verificationDelivery = canMail ? "email" : "demo";
  await writeDraft(draft);

  const { recordClaim } = await import("@/lib/claim-persist");
  await recordClaim(draft);

  if (canMail && draft.verifyCode) {
    const { enqueueClaimVerificationEmail } = await import("@/lib/jobs");
    await enqueueClaimVerificationEmail(email, draft.verifyCode);
  }

  await noteInvitation(draft.id, "claimed");
  return draft;
}

export async function verifyDraft(draftId: string, code: string): Promise<ClaimDraft> {
  const draft = await getDraft(draftId);
  if (!draft) throw new Error("Draft not found");
  const verified = advanceClaimStage(draft.stage, "verify");
  if (!verified.ok) throw new Error(verified.error);
  if (!draft.verifyCode || code.trim() !== draft.verifyCode) {
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
  if (draft.locationCity === "Your city") {
    draft.locationCity = "Lagos";
    draft.locationCountry = "Nigeria";
  }
  await writeDraft(draft);
  const { recordVerificationAttempt } = await import("@/lib/claim-persist");
  await recordVerificationAttempt({
    draft,
    channel: "EMAIL",
    success: true,
    detail:
      draft.verificationDelivery === "email"
        ? "email code accepted; social account remains unverified"
        : "demo email code accepted; social account remains unverified",
  });
  return draft;
}

export async function publishDraft(draftId: string): Promise<ClaimDraft> {
  const draft = await getDraft(draftId);
  if (!draft) throw new Error("Draft not found");
  const published = advanceClaimStage(draft.stage, "publish");
  if (!published.ok) throw new Error(published.error);
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
      "displayName" | "title" | "bio" | "locationCity" | "locationCountry" | "specialties"
    >
  >,
): Promise<ClaimDraft> {
  const draft = await getDraft(draftId);
  if (!draft) throw new Error("Draft not found");
  if (patch.specialties) {
    const plan = draft.planTier && isPlanCode(draft.planTier) ? draft.planTier : "STARTER";
    const limits = await entitlementsForPlan(plan);
    const decision = decideCount(limits, "specialtiesMax", patch.specialties.length, plan);
    if (!decision.ok) {
      const upgrade = decision.upgradePlanCode ? ` Upgrade to ${decision.upgradePlanCode}.` : "";
      throw new Error(
        `This card includes ${decision.limit} ${decision.limit === 1 ? "specialty" : "specialties"}.${upgrade}`,
      );
    }
  }
  Object.assign(draft, patch);
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
    image: creator.avatarUrl ?? DEMO_IMAGES[0]!,
    email: undefined,
    ownerName: creator.displayName,
    publishedAt: creator.updatedAt.toISOString(),
    attribution: "PROFILE_CLAIM",
    planTier: creator.planTier === "PLUS" || creator.planTier === "PRO" ? creator.planTier : "STARTER",
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
