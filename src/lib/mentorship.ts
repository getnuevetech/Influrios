/**
 * Collab OS P7 — Influencer Mentorship (acquisition-adjacent).
 * Community mentoring by default. Paid mentoring is feature-flagged and must never
 * mix into Collaboration Holding unless explicitly enabled.
 */
import { getCollabControlPlane, mentorshipEligibilityOk } from "@/lib/collab-control-plane";
import { prisma } from "@/lib/db";
import { productSwitch } from "@/lib/product-switches";
import { computePayoutReadiness } from "@/lib/payout-readiness";

export const MENTORSHIP_STATUSES = ["pending", "accepted", "declined", "cancelled"] as const;
export type MentorshipRequestStatus = (typeof MENTORSHIP_STATUSES)[number];

export const MENTORSHIP_AVAILABILITY = ["open", "paused", "closed"] as const;
export type MentorshipAvailability = (typeof MENTORSHIP_AVAILABILITY)[number];

/** Display band for acquisition copy (Terminology / Collab OS §2.4). */
export type InfluencerExperienceBand = "emerging" | "experienced";

export const EXPERIENCE_BAND_LABELS: Record<InfluencerExperienceBand, string> = {
  emerging: "Emerging Influencer",
  experienced: "Experienced Influencer",
};

/** Followers at or above this count read as Experienced in mentorship UI. */
export const EXPERIENCED_FOLLOWERS_THRESHOLD = 10_000;

export function experienceBandFromFollowers(followers: number): InfluencerExperienceBand {
  const n = Number.isFinite(followers) ? Math.max(0, Math.floor(followers)) : 0;
  return n >= EXPERIENCED_FOLLOWERS_THRESHOLD ? "experienced" : "emerging";
}

export function totalFollowersFromSocials(socials: { followers?: number | null }[]): number {
  return socials.reduce((sum, row) => sum + (Number.isFinite(row.followers) ? Math.max(0, Number(row.followers)) : 0), 0);
}

/**
 * Hard invariant: mentorship money never enters Collaboration Holding unless paid mentoring is on.
 * Community mentoring always returns isolated.
 */
export function mentorshipFundsIsolated(input: {
  paidMentoringEnabled: boolean;
  paidRequested: boolean;
}): { ok: true; usesCollaborationHolding: false } | { ok: false; error: string } {
  if (input.paidRequested && !input.paidMentoringEnabled) {
    return {
      ok: false,
      error: "Paid mentoring is off. Community mentorship cannot request paid sessions.",
    };
  }
  // Even when paid mentoring is enabled, this module does not route into collab holding.
  return { ok: true, usesCollaborationHolding: false };
}

export async function paidMentoringEnabled() {
  return productSwitch("paid_mentoring");
}

export async function evaluateCreatorMentorshipEligibility(creatorId: string) {
  const plane = await getCollabControlPlane();
  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    include: { socialAccounts: true, payoutProfile: true },
  });
  if (!creator) return { ok: false as const, blockers: ["Influencer profile not found."] };
  const followers = totalFollowersFromSocials(creator.socialAccounts);
  const identityVerified = creator.identityVerified === "VERIFIED";
  let globalPayoutReady = creator.payoutProfile?.globalPayoutReady ?? false;
  if (plane.mentorship.requireGlobalPayoutReady) {
    const readiness = await computePayoutReadiness({
      creatorId,
      identityVerified,
      locationCountry: creator.locationCountry,
    }).catch(() => null);
    globalPayoutReady = readiness?.globalPayoutReady ?? false;
  }
  const check = mentorshipEligibilityOk({
    settings: plane.mentorship,
    followers,
    identityVerified,
    globalPayoutReady,
  });
  return {
    ...check,
    followers,
    identityVerified,
    globalPayoutReady,
    band: experienceBandFromFollowers(followers),
    settings: plane.mentorship,
  };
}

export async function upsertMentorProfile(input: {
  creatorId: string;
  headline?: string;
  boundaries?: string;
  niches?: string[];
  availability?: MentorshipAvailability;
  maxActiveMentees?: number;
}) {
  const eligibility = await evaluateCreatorMentorshipEligibility(input.creatorId);
  if (!eligibility.ok) {
    return { ok: false as const, error: eligibility.blockers[0] ?? "Not eligible to mentor." };
  }
  const availability =
    input.availability && (MENTORSHIP_AVAILABILITY as readonly string[]).includes(input.availability)
      ? input.availability
      : "open";
  const niches = (input.niches ?? []).map((n) => n.trim()).filter(Boolean).slice(0, 12);
  const maxActive = Math.min(
    20,
    Math.max(1, Number.isInteger(input.maxActiveMentees) ? Number(input.maxActiveMentees) : 5),
  );
  const profile = await prisma.mentorshipProfile.upsert({
    where: { creatorId: input.creatorId },
    create: {
      creatorId: input.creatorId,
      eligible: true,
      availability,
      headline: (input.headline ?? "").trim().slice(0, 160),
      boundaries: (input.boundaries ?? "").trim().slice(0, 800),
      nichesJson: niches,
      maxActiveMentees: maxActive,
    },
    update: {
      eligible: true,
      availability,
      headline: (input.headline ?? "").trim().slice(0, 160),
      boundaries: (input.boundaries ?? "").trim().slice(0, 800),
      nichesJson: niches,
      maxActiveMentees: maxActive,
    },
  });
  return { ok: true as const, profile, band: eligibility.band };
}

export async function listOpenMentors(input?: { niche?: string; country?: string; limit?: number }) {
  const plane = await getCollabControlPlane();
  if (!plane.mentorship.enabled) return [];
  const niche = input?.niche?.trim().toLowerCase() ?? "";
  const country = input?.country?.trim().toLowerCase() ?? "";
  const limit = Math.min(40, Math.max(1, input?.limit ?? 24));
  const rows = await prisma.mentorshipProfile.findMany({
    where: { eligible: true, availability: "open" },
    include: {
      creator: {
        include: { socialAccounts: true, specialties: { include: { specialty: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 80,
  });
  return rows
    .filter((row) => {
      if (country) {
        const loc = (row.creator.locationCountry ?? "").toLowerCase();
        if (!loc.includes(country)) return false;
      }
      if (niche) {
        const niches = Array.isArray(row.nichesJson) ? (row.nichesJson as string[]) : [];
        const specialties = row.creator.specialties.map((s) => s.specialty.slug);
        const hay = [...niches, ...specialties].join(" ").toLowerCase();
        if (!hay.includes(niche)) return false;
      }
      return true;
    })
    .slice(0, limit)
    .map((row) => {
      const followers = totalFollowersFromSocials(row.creator.socialAccounts);
      return {
        profileId: row.id,
        creatorId: row.creatorId,
        slug: row.creator.slug,
        displayName: row.creator.displayName,
        title: row.creator.title,
        locationCountry: row.creator.locationCountry,
        headline: row.headline,
        boundaries: row.boundaries,
        niches: Array.isArray(row.nichesJson) ? (row.nichesJson as string[]) : [],
        followers,
        band: experienceBandFromFollowers(followers),
        maxActiveMentees: row.maxActiveMentees,
        avatarUrl: row.creator.avatarUrl,
      };
    });
}

export async function requestMentorship(input: {
  menteeCreatorId: string;
  mentorCreatorId: string;
  message?: string;
  paidRequested?: boolean;
}) {
  if (input.menteeCreatorId === input.mentorCreatorId) {
    return { ok: false as const, error: "You cannot request mentorship from yourself." };
  }
  const paidOn = await paidMentoringEnabled();
  const isolation = mentorshipFundsIsolated({
    paidMentoringEnabled: paidOn,
    paidRequested: Boolean(input.paidRequested),
  });
  if (!isolation.ok) return isolation;

  const mentorProfile = await prisma.mentorshipProfile.findUnique({
    where: { creatorId: input.mentorCreatorId },
  });
  if (!mentorProfile?.eligible || mentorProfile.availability !== "open") {
    return { ok: false as const, error: "That Influencer Mentor is not accepting requests." };
  }

  const activeCount = await prisma.mentorshipRequest.count({
    where: { mentorCreatorId: input.mentorCreatorId, status: "accepted" },
  });
  if (activeCount >= mentorProfile.maxActiveMentees) {
    return { ok: false as const, error: "That mentor has reached their active mentee limit." };
  }

  const existing = await prisma.mentorshipRequest.findFirst({
    where: {
      mentorCreatorId: input.mentorCreatorId,
      menteeCreatorId: input.menteeCreatorId,
      status: { in: ["pending", "accepted"] },
    },
  });
  if (existing) {
    return { ok: false as const, error: "You already have an open request with this mentor." };
  }

  const row = await prisma.mentorshipRequest.create({
    data: {
      mentorCreatorId: input.mentorCreatorId,
      menteeCreatorId: input.menteeCreatorId,
      message: (input.message ?? "").trim().slice(0, 800),
      paidRequested: Boolean(input.paidRequested) && paidOn,
      status: "pending",
    },
  });
  return { ok: true as const, request: row, usesCollaborationHolding: false as const };
}

export async function respondToMentorshipRequest(input: {
  requestId: string;
  mentorCreatorId: string;
  decision: "accepted" | "declined";
  responseNote?: string;
}) {
  const row = await prisma.mentorshipRequest.findUnique({ where: { id: input.requestId } });
  if (!row || row.mentorCreatorId !== input.mentorCreatorId) {
    return { ok: false as const, error: "Request not found." };
  }
  if (row.status !== "pending") {
    return { ok: false as const, error: "Only pending requests can be accepted or declined." };
  }
  if (input.decision === "accepted") {
    const profile = await prisma.mentorshipProfile.findUnique({
      where: { creatorId: input.mentorCreatorId },
    });
    const activeCount = await prisma.mentorshipRequest.count({
      where: { mentorCreatorId: input.mentorCreatorId, status: "accepted" },
    });
    if (profile && activeCount >= profile.maxActiveMentees) {
      return { ok: false as const, error: "Active mentee limit reached." };
    }
  }
  const updated = await prisma.mentorshipRequest.update({
    where: { id: input.requestId },
    data: {
      status: input.decision,
      responseNote: (input.responseNote ?? "").trim().slice(0, 500),
    },
  });
  return { ok: true as const, request: updated };
}

export async function cancelMentorshipRequest(input: { requestId: string; menteeCreatorId: string }) {
  const row = await prisma.mentorshipRequest.findUnique({ where: { id: input.requestId } });
  if (!row || row.menteeCreatorId !== input.menteeCreatorId) {
    return { ok: false as const, error: "Request not found." };
  }
  if (row.status !== "pending") {
    return { ok: false as const, error: "Only pending requests can be cancelled." };
  }
  const updated = await prisma.mentorshipRequest.update({
    where: { id: input.requestId },
    data: { status: "cancelled" },
  });
  return { ok: true as const, request: updated };
}

export async function listMentorshipInbox(creatorId: string) {
  const [incoming, outgoing, profile] = await Promise.all([
    prisma.mentorshipRequest.findMany({
      where: { mentorCreatorId: creatorId },
      include: { mentee: { select: { slug: true, displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.mentorshipRequest.findMany({
      where: { menteeCreatorId: creatorId },
      include: { mentor: { select: { slug: true, displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.mentorshipProfile.findUnique({ where: { creatorId } }),
  ]);
  return { incoming, outgoing, profile };
}
