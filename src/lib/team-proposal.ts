import { countryCodeFromLocation, evaluatePreContractGates } from "@/lib/contract-wizard";
import { prisma } from "@/lib/db";
import { getDirectoryCreator } from "@/lib/directory";
import { shareLines } from "@/lib/fx-share";
import { computePayoutReadiness } from "@/lib/payout-readiness";
import { paymentRoutes } from "@/lib/providers";
import { stripePayoutRouteReady } from "@/lib/stripe-admin";

export type MemberDecision = "invited" | "accepted" | "declined";
export type TeamMatchType = "CREATOR_TEAM" | "BUSINESS_CREATOR_TEAM";

const PROPOSAL_LIFE_MS = 14 * 24 * 60 * 60 * 1000;

export function equalShareBps(count: number): number[] | null {
  if (!Number.isInteger(count) || count < 2) return null;
  const base = Math.floor(10_000 / count);
  if (base <= 0) return null;
  const shares = Array.from({ length: count }, () => base);
  shares[count - 1] = 10_000 - base * (count - 1);
  return shares;
}

export function nextProposalStatus(
  members: { creatorSlug: string; status: string }[],
  slug: string,
  decision: "accepted" | "declined",
): "sent" | "partial" | "accepted" | "declined" {
  const next = members.map((member) =>
    member.creatorSlug === slug ? { ...member, status: decision } : member,
  );
  if (next.some((member) => member.status === "declined")) return "declined";
  if (next.length >= 2 && next.every((member) => member.status === "accepted")) return "accepted";
  if (next.some((member) => member.status === "accepted")) return "partial";
  return "sent";
}

/** Funding opens only after every member accepted and every payout route is ready. */
export function teamFundingReady(input: {
  status: string;
  payoutReady: boolean[];
}): { ok: true } | { ok: false; error: string } {
  if (input.status !== "accepted") {
    return { ok: false, error: "Every creator must accept before funding." };
  }
  if (input.payoutReady.length < 2 || input.payoutReady.some((ready) => !ready)) {
    return { ok: false, error: "Every creator needs a ready payout route." };
  }
  return { ok: true };
}

export function memberShareSnapshot(
  members: { creatorSlug: string; shareBps: number }[],
): { label: string; shareBps: number }[] | null {
  if (members.length < 2) return null;
  const rows = members.map((member) => ({
    label: member.creatorSlug.trim(),
    shareBps: member.shareBps,
  }));
  if (rows.some((row) => !row.label || !Number.isInteger(row.shareBps) || row.shareBps <= 0)) return null;
  if (rows.reduce((sum, row) => sum + row.shareBps, 0) !== 10_000) return null;
  return rows;
}

/** Creator compensation on one milestone, split by the frozen member shares. */
export function creatorAmountsForMilestone(
  creatorCents: number,
  members: { creatorSlug: string; shareBps: number }[],
): { creatorSlug: string; amountCents: number }[] | null {
  if (!Number.isInteger(creatorCents) || creatorCents < 0) return null;
  const snapshot = memberShareSnapshot(members);
  if (!snapshot) return null;
  if (creatorCents === 0) return snapshot.map((row) => ({ creatorSlug: row.label, amountCents: 0 }));
  const lines = shareLines(creatorCents, snapshot);
  if (!lines) return null;
  return lines.map((line) => ({ creatorSlug: line.label, amountCents: line.amountCents }));
}

export function wizardParties(proposal: {
  status: string;
  members: { creatorSlug: string; status: string; shareBps: number }[];
}): { creatorSlug: string; shareBps: number }[] | null {
  if (proposal.status !== "accepted") return null;
  if (proposal.members.length < 2) return null;
  if (proposal.members.some((member) => member.status !== "accepted")) return null;
  const shares = memberShareSnapshot(proposal.members);
  if (!shares) return null;
  return shares.map((row) => ({ creatorSlug: row.label, shareBps: row.shareBps }));
}

export function wizardHrefForProposal(proposal: {
  id: string;
  status: string;
  title: string;
  campaignIntent: string;
  members: { creatorSlug: string; status: string; shareBps: number }[];
}): string | null {
  const parties = wizardParties(proposal);
  if (!parties) return null;
  const params = new URLSearchParams({
    team: proposal.id,
    creator: parties[0]!.creatorSlug,
    title: proposal.title,
    scope: proposal.campaignIntent || proposal.title,
  });
  return `/collaboration/contract?${params.toString()}`;
}

/** A declined or extra member is a new proposal. Sent membership is frozen. */
export function refuseMemberRemoval(): { ok: false; error: string } {
  return {
    ok: false,
    error: "A member cannot be removed from a sent proposal. Send a new proposal.",
  };
}

export function teamSendControl(input: { audience: "guest" | "business" | "creator" }): { visible: boolean } {
  return { visible: input.audience === "business" };
}

export function proposalExpiresAt(from: Date): Date {
  return new Date(from.getTime() + PROPOSAL_LIFE_MS);
}

export function proposalIsExpired(input: { status: string; expiresAt: Date | null; now: Date }): boolean {
  if (input.status === "accepted" || input.status === "declined") return false;
  if (input.status === "expired") return true;
  if (!input.expiresAt) return false;
  return input.expiresAt.getTime() <= input.now.getTime();
}

export function teamMatchRows(input: {
  workspaceId: string;
  campaignIntent: string;
  members: { creatorSlug: string }[];
}): {
  matchType: TeamMatchType;
  partyASlug: string;
  partyBSlug: string;
  score: number;
  why: string;
  reasons: string[];
}[] {
  const workspaceId = input.workspaceId.trim();
  const slugs = [...new Set(input.members.map((member) => member.creatorSlug.trim()).filter(Boolean))].sort();
  if (!workspaceId || slugs.length < 2) return [];
  const why = input.campaignIntent.trim() || "Team proposal";
  const reasons = ["Team proposal", why];
  const rows: {
    matchType: TeamMatchType;
    partyASlug: string;
    partyBSlug: string;
    score: number;
    why: string;
    reasons: string[];
  }[] = [];
  for (const slug of slugs) {
    const [partyASlug, partyBSlug] = [workspaceId, slug].sort();
    rows.push({
      matchType: "BUSINESS_CREATOR_TEAM",
      partyASlug,
      partyBSlug,
      score: 80,
      why,
      reasons,
    });
  }
  for (let index = 0; index < slugs.length; index += 1) {
    for (let other = index + 1; other < slugs.length; other += 1) {
      rows.push({
        matchType: "CREATOR_TEAM",
        partyASlug: slugs[index]!,
        partyBSlug: slugs[other]!,
        score: 80,
        why,
        reasons,
      });
    }
  }
  return rows;
}

async function writeTeamMatches(input: {
  workspaceId: string;
  campaignIntent: string;
  members: { creatorSlug: string }[];
}) {
  const rows = teamMatchRows(input);
  for (const row of rows) {
    await prisma.marketplaceMatchRecord.upsert({
      where: {
        partyASlug_partyBSlug_matchType: {
          partyASlug: row.partyASlug,
          partyBSlug: row.partyBSlug,
          matchType: row.matchType,
        },
      },
      create: {
        matchType: row.matchType,
        partyASlug: row.partyASlug,
        partyBSlug: row.partyBSlug,
        score: row.score,
        breakdownJson: {
          audienceAlignment: 0,
          contentCompatibility: 0,
          goalSynergy: row.score,
          engagementPotential: 0,
        },
        reasonsJson: row.reasons,
        why: row.why,
        specialtyHits: [],
        modelVersion: "team-proposal-v1",
      },
      update: {
        score: row.score,
        reasonsJson: row.reasons,
        why: row.why,
        modelVersion: "team-proposal-v1",
      },
    });
  }
}

async function expireDueProposals(now = new Date()) {
  await prisma.teamProposal.updateMany({
    where: {
      status: { in: ["draft", "sent", "partial"] },
      expiresAt: { lte: now },
    },
    data: { status: "expired" },
  });
}

export async function createTeamProposal(input: {
  workspaceId: string;
  title: string;
  campaignIntent?: string;
  creatorSlugs: string[];
}) {
  const slugs = [...new Set(input.creatorSlugs.map((slug) => slug.trim()).filter(Boolean))];
  if (slugs.length < 2) return { ok: false as const, error: "Select at least two creators." };
  const shares = equalShareBps(slugs.length);
  if (!shares) return { ok: false as const, error: "Select at least two creators." };
  const title = input.title.trim();
  const workspaceId = input.workspaceId.trim();
  if (!title || !workspaceId || workspaceId === "public") {
    return { ok: false as const, error: "Sign in with a business workspace and add a title." };
  }
  const campaignIntent = (input.campaignIntent ?? title).trim().slice(0, 240);
  const row = await prisma.teamProposal.create({
    data: {
      workspaceId,
      title: title.slice(0, 160),
      campaignIntent,
      status: "sent",
      expiresAt: proposalExpiresAt(new Date()),
      members: {
        create: slugs.map((creatorSlug, index) => ({
          creatorSlug,
          role: "creator",
          shareBps: shares[index]!,
          status: "invited",
        })),
      },
    },
    include: { members: true },
  });
  await writeTeamMatches({
    workspaceId,
    campaignIntent,
    members: row.members,
  });
  return { ok: true as const, id: row.id };
}

export async function respondToTeamProposal(input: {
  proposalId: string;
  creatorSlug: string;
  decision: "accepted" | "declined";
}) {
  await expireDueProposals();
  const row = await prisma.teamProposal.findUnique({
    where: { id: input.proposalId },
    include: { members: true },
  });
  if (!row) return { ok: false as const, error: "Proposal not found." };
  if (proposalIsExpired({ status: row.status, expiresAt: row.expiresAt, now: new Date() })) {
    if (row.status !== "expired") {
      await prisma.teamProposal.update({ where: { id: row.id }, data: { status: "expired" } });
    }
    return { ok: false as const, error: "This proposal has expired." };
  }
  if (row.status === "accepted" || row.status === "declined" || row.status === "expired") {
    return { ok: false as const, error: "This proposal is already closed." };
  }
  const member = row.members.find((item) => item.creatorSlug === input.creatorSlug);
  if (!member) return { ok: false as const, error: "You are not on this proposal." };
  if (member.status !== "invited") return { ok: false as const, error: "You already responded." };
  const status = nextProposalStatus(row.members, input.creatorSlug, input.decision);
  await prisma.$transaction([
    prisma.teamProposalMember.update({
      where: { id: member.id },
      data: { status: input.decision },
    }),
    prisma.teamProposal.update({
      where: { id: row.id },
      data: { status },
    }),
  ]);
  const members = row.members.map((item) =>
    item.creatorSlug === input.creatorSlug ? { ...item, status: input.decision } : item,
  );
  return {
    ok: true as const,
    status,
    wizardHref: wizardHrefForProposal({ ...row, status, members }),
  };
}

export async function listTeamProposalsForWorkspace(workspaceId: string) {
  await expireDueProposals();
  return prisma.teamProposal.findMany({
    where: { workspaceId },
    include: { members: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function listTeamProposalsForCreator(creatorSlug: string) {
  await expireDueProposals();
  return prisma.teamProposal.findMany({
    where: { members: { some: { creatorSlug } } },
    include: { members: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function teamMemberReadiness(input: {
  creatorSlug: string;
  businessName: string;
  jurisdictionProtectedPayments: boolean;
  marketplaceProviderReady: boolean;
}): Promise<{ ready: boolean; blockers: string[] }> {
  const creator = await getDirectoryCreator(input.creatorSlug);
  if (!creator) return { ready: false, blockers: [`${input.creatorSlug} is not in the directory.`] };
  const dbCreator = await prisma.creator.findUnique({ where: { slug: input.creatorSlug } }).catch(() => null);
  const identityVerified = dbCreator?.identityVerified === "VERIFIED";
  const payout = dbCreator
    ? await computePayoutReadiness({
        creatorId: dbCreator.id,
        identityVerified,
        locationCountry: dbCreator.locationCountry ?? creator.locationCountry,
      }).catch(() => null)
    : null;
  const country = countryCodeFromLocation(creator.locationCountry);
  const routes = await paymentRoutes().catch(() => []);
  const route = country ? routes.find((row) => row.countryCode === country) : undefined;
  const profile = dbCreator
    ? await prisma.influencerPayoutProfile
        .findUnique({
          where: { creatorId: dbCreator.id },
          select: { stripeConnectAccountId: true },
        })
        .catch(() => null)
    : null;
  const gates = evaluatePreContractGates({
    businessName: input.businessName,
    creatorSlug: input.creatorSlug,
    identityVerified,
    creatorCountryKnown: Boolean(country),
    corridorActive: payout ? payout.corridorActive : Boolean(country),
    paymentRouteReady: stripePayoutRouteReady({
      providerCode: route?.providerCode,
      routeReady: Boolean(route?.ready),
      stripeConnectAccountId: profile?.stripeConnectAccountId,
    }),
    jurisdictionProtectedPayments: input.jurisdictionProtectedPayments,
    marketplaceProviderReady: input.marketplaceProviderReady,
  });
  return { ready: gates.ok, blockers: gates.blockers };
}
