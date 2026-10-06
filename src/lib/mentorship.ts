/**
 * Collab OS P7 — Influencer Mentorship (acquisition-adjacent).
 * Community mentoring by default. Paid mentoring is feature-flagged and must never
 * mix into Collaboration Holding unless explicitly enabled.
 */
import { getCollabControlPlane, mentorshipEligibilityOk } from "@/lib/collab-control-plane";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/provider-secrets";
import { productSwitch } from "@/lib/product-switches";
import { computePayoutReadiness } from "@/lib/payout-readiness";
import {
  createAirwallexMentorshipIntent,
  parseAirwallexMentorshipWebhook,
  verifyAirwallexSignature,
} from "@/lib/providers/airwallex";
import { openStripeOneTimeCheckout, stripeCredentials } from "@/lib/stripe-admin";

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

/** One paid session. Confirmed only by the payment webhook. */
export const MENTORSHIP_SESSION_CENTS = 4900;

function appOrigin() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export async function confirmMentorshipPayment(input: {
  requestId: string;
  checkoutRef: string;
  provider: string;
}) {
  const refs = [input.checkoutRef, input.requestId].map((value) => value.trim()).filter(Boolean);
  const clash = await prisma.collaborationFunding.findFirst({ where: { id: { in: refs } } });
  if (clash) {
    return { ok: false as const, error: "Mentorship checkout cannot confirm a collaboration funding." };
  }
  const row = await prisma.mentorshipRequest.findUnique({ where: { id: input.requestId } });
  if (!row) return { ok: false as const, error: "Mentorship request not found." };
  if (row.checkoutRef && input.checkoutRef && row.checkoutRef !== input.checkoutRef) {
    return { ok: false as const, error: "Checkout reference does not match this mentorship request." };
  }
  if (row.paymentStatus === "paid") return { ok: true as const, duplicate: true };
  await prisma.mentorshipRequest.update({
    where: { id: row.id },
    data: {
      paymentStatus: "paid",
      paymentProvider: input.provider,
      checkoutRef: row.checkoutRef || input.checkoutRef,
    },
  });
  return { ok: true as const, duplicate: false };
}

async function airwallexMentorshipCredentials() {
  const row = await prisma.integrationProvider
    .findUnique({ where: { kind_code: { kind: "payment", code: "airwallex" } } })
    .catch(() => null);
  if (!row?.enabled || !row.secretCipher || !row.baseUrl) return null;
  const token = decryptSecret(row.secretCipher);
  if (!token) return null;
  return { token, baseUrl: row.baseUrl };
}

async function openPaidMentorshipCheckout(input: {
  requestId: string;
  amountCents: number;
  customerEmail?: string;
  userId?: string;
}) {
  const origin = appOrigin();
  const successUrl = `${origin}/mentorship?returned=1&request=${input.requestId}`;
  const cancelUrl = `${origin}/mentorship?error=${encodeURIComponent("Checkout was cancelled. Nothing was confirmed.")}`;
  const creds = await stripeCredentials().catch(() => ({ ok: false as const, reason: "missing" as const }));
  if (creds.ok) {
    const opened = await openStripeOneTimeCheckout({
      secret: creds.secret,
      mode: creds.mode,
      amountCents: input.amountCents,
      name: "Influrios mentorship session",
      successUrl,
      cancelUrl,
      customerEmail: input.customerEmail,
      metadata: {
        purpose: "mentorship",
        requestId: input.requestId,
        userId: input.userId ?? "",
      },
    });
    if (!opened.ok) return opened;
    return { ok: true as const, provider: "stripe", checkoutRef: opened.id, url: opened.url };
  }
  const airwallex = await airwallexMentorshipCredentials();
  if (airwallex) {
    const opened = await createAirwallexMentorshipIntent({
      baseUrl: airwallex.baseUrl,
      token: airwallex.token,
      requestId: input.requestId,
      amountCents: input.amountCents,
      currency: "USD",
    });
    if (opened.ok) {
      return {
        ok: true as const,
        provider: "airwallex",
        checkoutRef: opened.paymentId,
        url: `${origin}/mentorship?returned=1&request=${input.requestId}`,
      };
    }
  }
  return { ok: false as const, error: "Paid mentorship checkout is not configured. Nothing was charged." };
}

export async function applyAirwallexMentorshipWebhook(body: string, signature: string | null): Promise<
  | { ok: true; paid: boolean; fallThrough?: false }
  | { ok: false; error: string; status: number; fallThrough: boolean }
> {
  const parsed = parseAirwallexMentorshipWebhook(body);
  if (!parsed.ok && parsed.error === "not_mentorship") {
    return { ok: false, error: parsed.error, status: 400, fallThrough: true };
  }
  const row = await prisma.integrationProvider
    .findUnique({ where: { kind_code: { kind: "payment", code: "airwallex" } } })
    .catch(() => null);
  if (!row?.enabled || !row.webhookCipher) {
    return { ok: false, error: "Airwallex is not ready.", status: 503, fallThrough: false };
  }
  const secret = decryptSecret(row.webhookCipher);
  if (!secret || !verifyAirwallexSignature(body, signature, secret)) {
    return { ok: false, error: "Signature did not match.", status: 401, fallThrough: false };
  }
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400, fallThrough: false };
  if (!parsed.paid) return { ok: true, paid: false };
  const confirmed = await confirmMentorshipPayment({
    requestId: parsed.requestId,
    checkoutRef: parsed.paymentId,
    provider: "airwallex",
  });
  if (!confirmed.ok) return { ok: false, error: confirmed.error, status: 409, fallThrough: false };
  return { ok: true, paid: true };
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
  customerEmail?: string;
  userId?: string;
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

  const paid = Boolean(input.paidRequested) && paidOn;
  const row = await prisma.mentorshipRequest.create({
    data: {
      mentorCreatorId: input.mentorCreatorId,
      menteeCreatorId: input.menteeCreatorId,
      message: (input.message ?? "").trim().slice(0, 800),
      paidRequested: paid,
      status: "pending",
      paymentStatus: "unpaid",
      amountCents: paid ? MENTORSHIP_SESSION_CENTS : 0,
    },
  });
  if (!paid) return { ok: true as const, request: row, usesCollaborationHolding: false as const, checkoutUrl: null };
  const opened = await openPaidMentorshipCheckout({
    requestId: row.id,
    amountCents: MENTORSHIP_SESSION_CENTS,
    customerEmail: input.customerEmail,
    userId: input.userId,
  });
  if (!opened.ok) {
    await prisma.mentorshipRequest.delete({ where: { id: row.id } }).catch(() => undefined);
    return opened;
  }
  const request = await prisma.mentorshipRequest.update({
    where: { id: row.id },
    data: { paymentStatus: "open", paymentProvider: opened.provider, checkoutRef: opened.checkoutRef },
  });
  return { ok: true as const, request, usesCollaborationHolding: false as const, checkoutUrl: opened.url };
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
  if (input.decision === "accepted" && row.paidRequested && row.paymentStatus !== "paid") {
    return { ok: false as const, error: "Paid mentorship is confirmed only after the payment webhook." };
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
