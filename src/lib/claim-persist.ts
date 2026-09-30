import { randomBytes } from "crypto";
import type { ClaimDraft } from "@/lib/claim";
import { prisma } from "@/lib/db";
import type { OnboardingState, SocialPlatform } from "@prisma/client";

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

export function newQrToken() {
  return randomBytes(16).toString("base64url");
}

function onboardingState(stage: ClaimDraft["stage"]): OnboardingState {
  if (stage === "claimed") return "CLAIMED";
  if (stage === "verified") return "EMAIL_VERIFIED";
  if (stage === "published") return "PUBLISHED";
  return "DRAFT";
}

function asPlatform(value: string): SocialPlatform {
  return (PLATFORMS.has(value) ? value : "INSTAGRAM") as SocialPlatform;
}

function publicPayload(draft: ClaimDraft) {
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

export async function syncOnboardingSession(draft: ClaimDraft) {
  await prisma.onboardingSession.upsert({
    where: { id: draft.id },
    create: {
      id: draft.id,
      state: onboardingState(draft.stage),
      inputHandle: draft.inputHandle,
      platform: draft.platform,
      draftSlug: draft.slug,
      email: draft.email,
      ownerName: draft.ownerName,
      emailVerifiedAt: draft.verifiedAt ? new Date(draft.verifiedAt) : null,
      publishedAt: draft.publishedAt ? new Date(draft.publishedAt) : null,
      verifyMethod: "DEMO_CODE",
      payload: publicPayload(draft),
    },
    update: {
      state: onboardingState(draft.stage),
      draftSlug: draft.slug,
      email: draft.email,
      ownerName: draft.ownerName,
      emailVerifiedAt: draft.verifiedAt ? new Date(draft.verifiedAt) : null,
      publishedAt: draft.publishedAt ? new Date(draft.publishedAt) : null,
      payload: publicPayload(draft),
    },
  });
}

export async function recordClaim(draft: ClaimDraft) {
  await syncOnboardingSession(draft);
  if (!draft.email) return;
  await prisma.profileClaim.create({
    data: {
      sessionId: draft.id,
      email: draft.email,
      status: "CLAIMED",
    },
  });
}

export async function recordVerificationAttempt(input: {
  draft: ClaimDraft;
  channel: "EMAIL" | "SOCIAL";
  success: boolean;
  detail?: string;
}) {
  await syncOnboardingSession(input.draft);
  await prisma.verificationAttempt.create({
    data: {
      sessionId: input.draft.id,
      method: "DEMO_CODE",
      channel: input.channel,
      success: input.success,
      detail: input.detail,
    },
  });
}

/** Publish writes the live creator, card, and opaque QR identity. */
export async function persistPublishedClaim(draft: ClaimDraft) {
  if (!draft.email) throw new Error("Email is required before publish");
  await syncOnboardingSession(draft);

  const user = await prisma.user.upsert({
    where: { email: draft.email },
    create: { email: draft.email, role: "CREATOR", planTier: "STARTER" },
    update: { role: "CREATOR" },
  });

  const creator = await prisma.creator.upsert({
    where: { slug: draft.slug },
    create: {
      userId: user.id,
      slug: draft.slug,
      displayName: draft.displayName,
      title: draft.title,
      bio: draft.bio,
      locationCity: draft.locationCity,
      locationCountry: draft.locationCountry,
      languages: ["English"],
      avatarUrl: draft.image,
      openToCollab: true,
      claimed: true,
      planTier: draft.planTier ?? "STARTER",
      profileState: "VERIFIED",
      identityVerified: "UNVERIFIED",
    },
    update: {
      userId: user.id,
      displayName: draft.displayName,
      title: draft.title,
      bio: draft.bio,
      locationCity: draft.locationCity,
      locationCountry: draft.locationCountry,
      avatarUrl: draft.image,
      claimed: true,
      profileState: "VERIFIED",
    },
  });

  await prisma.socialAccount.deleteMany({ where: { creatorId: creator.id } });
  for (const social of draft.socials) {
    await prisma.socialAccount.create({
      data: {
        creatorId: creator.id,
        platform: asPlatform(social.platform),
        handle: social.handle,
        url: social.url,
        followers: social.followers,
        source: "CREATOR_CLAIMED",
      },
    });
  }

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

  const existingCard = await prisma.influenceCard.findUnique({ where: { creatorId: creator.id } });
  const qrToken = existingCard?.qrToken ?? newQrToken();
  await prisma.influenceCard.upsert({
    where: { creatorId: creator.id },
    create: {
      creatorId: creator.id,
      slug: draft.slug,
      qrToken,
      theme: "starter",
      published: true,
      platformBrandVisible: true,
    },
    update: { published: true, slug: draft.slug, qrToken },
  });
  await prisma.qrRedirect.upsert({
    where: { token: qrToken },
    create: {
      token: qrToken,
      targetUrl: `/c/${draft.slug}`,
      creatorId: creator.id,
      active: true,
    },
    update: { targetUrl: `/c/${draft.slug}`, active: true, creatorId: creator.id },
  });

  await prisma.profileClaim.create({
    data: {
      sessionId: draft.id,
      creatorId: creator.id,
      email: draft.email,
      status: "PUBLISHED",
    },
  });
  await prisma.auditLog.create({
    data: {
      actor: draft.email,
      action: "claim.publish",
      objectType: "Creator",
      objectId: creator.id,
      after: publicPayload(draft),
    },
  });

  return { creatorId: creator.id, qrToken };
}
