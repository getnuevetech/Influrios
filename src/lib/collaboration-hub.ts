/**
 * Collaboration OS P2 — creator hub data helpers (status counts, pipeline, saved matches).
 */
import { prisma } from "@/lib/db";
import { listCollaborations } from "@/lib/collaborations";
import { listFundingsForCreator } from "@/lib/marketplace-ledger";
import { findDirectoryMatchesFor, type CreatorMatch, type MatchBreakdown } from "@/lib/matching";
import {
  listPublishedBusinessRequests,
  listPublishedCreatorOpportunities,
  persistTopMatches,
  type MarketplaceBusinessRequestRow,
  type MarketplaceCreatorOpportunityRow,
} from "@/lib/marketplace-listings";
import type { SeedCreator } from "@/lib/seed-data";

export const PIPELINE_STAGES = [
  "Match",
  "Contract",
  "Funded",
  "In Progress",
  "Review",
  "Released",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type HubPipelineItem = {
  id: string;
  title: string;
  counterparty: string;
  stage: PipelineStage;
  stageIndex: number;
  href: string;
};

export type HubStatusCounts = {
  active: number;
  pending: number;
  saved: number;
  completed: number;
};

export type HubSavedMatch = {
  saveId: string;
  partyASlug: string;
  partyBSlug: string;
  score: number;
  why: string;
  breakdown: MatchBreakdown;
  reasons: string[];
};

export type HubEarnings = {
  heldCents: number;
  releasedCents: number;
  currency: string;
  ready: boolean;
};

/** Map collaboration + funding state onto the Figure 2 pipeline stepper. */
export function derivePipelineStage(input: {
  collaborationStatus: string;
  fundingStatus?: string | null;
  milestoneStatuses?: string[];
}): PipelineStage {
  const milestones = input.milestoneStatuses ?? [];
  if (input.fundingStatus === "completed" || milestones.some((s) => s === "released")) {
    return "Released";
  }
  if (milestones.some((s) => s === "approved")) return "Review";
  if (milestones.some((s) => s === "submitted")) return "In Progress";
  if (input.fundingStatus === "awaiting_provider" || input.fundingStatus === "held") {
    return "Funded";
  }
  if (input.collaborationStatus === "accepted") return "Contract";
  return "Match";
}

export function scoreBusinessRequestForCreator(
  request: MarketplaceBusinessRequestRow,
  creator: SeedCreator,
): number {
  const hay = `${request.category} ${request.tags.join(" ")} ${request.lookingFor} ${request.summary}`.toLowerCase();
  let hits = 0;
  for (const specialty of creator.specialties) {
    const token = specialty.replace(/-/g, " ");
    if (hay.includes(specialty) || hay.includes(token)) hits += 1;
  }
  const locationHit =
    request.location.toLowerCase().includes("global") ||
    request.location.toLowerCase().includes(creator.locationCountry.toLowerCase()) ||
    request.location.toLowerCase().includes(creator.locationCity.toLowerCase());
  return Math.min(98, 68 + hits * 8 + (locationHit ? 6 : 0));
}

export async function listSavedMatchesForUser(userId: string): Promise<HubSavedMatch[]> {
  const rows = await prisma.marketplaceMatchSave.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { match: true },
    take: 40,
  });
  return rows.map((row) => ({
    saveId: row.id,
    partyASlug: row.match.partyASlug,
    partyBSlug: row.match.partyBSlug,
    score: row.match.score,
    why: row.match.why,
    breakdown: row.match.breakdownJson as MatchBreakdown,
    reasons: Array.isArray(row.match.reasonsJson) ? (row.match.reasonsJson as string[]) : [],
  }));
}

export async function loadCreatorHub(input: {
  userId: string;
  creator: SeedCreator;
}) {
  const slug = input.creator.slug;
  const [collaborations, fundings, saved, creatorMatches, requests, opportunities] =
    await Promise.all([
      listCollaborations({ slug }).catch(() => []),
      listFundingsForCreator(slug).catch(() => []),
      listSavedMatchesForUser(input.userId).catch(() => []),
      findDirectoryMatchesFor(slug).catch(() => [] as CreatorMatch[]),
      listPublishedBusinessRequests().catch(() => [] as MarketplaceBusinessRequestRow[]),
      listPublishedCreatorOpportunities().catch(() => [] as MarketplaceCreatorOpportunityRow[]),
    ]);

  await persistTopMatches(creatorMatches).catch(() => 0);

  const pending = collaborations.filter(
    (row) => row.status === "sent" && row.recipientSlug === slug,
  ).length;
  const active = collaborations.filter((row) => row.status === "accepted").length;
  const completed = fundings.filter((row) => row.status === "completed").length;

  const status: HubStatusCounts = {
    active,
    pending,
    saved: saved.length,
    completed,
  };

  const heldCents = fundings.reduce((sum, row) => sum + (row.ledger?.heldCents ?? 0), 0);
  const releasedCents = fundings.reduce((sum, row) => sum + (row.ledger?.releasedCents ?? 0), 0);
  const earnings: HubEarnings = {
    heldCents,
    releasedCents,
    currency: "USD",
    ready: heldCents > 0 || releasedCents > 0,
  };

  const fundingByTitle = new Map(fundings.map((row) => [row.title.toLowerCase(), row]));
  const pipeline: HubPipelineItem[] = collaborations
    .filter((row) => row.status === "accepted" || row.status === "sent" || row.status === "draft")
    .slice(0, 6)
    .map((row) => {
      const funding =
        fundingByTitle.get(row.title.toLowerCase()) ??
        fundings.find(
          (f) =>
            f.creatorSlug === slug &&
            (f.businessName?.toLowerCase().includes(row.recipientSlug) ||
              f.businessName?.toLowerCase().includes(row.initiatorSlug)),
        );
      const stage = derivePipelineStage({
        collaborationStatus: row.status,
        fundingStatus: funding?.status ?? null,
        milestoneStatuses: funding?.milestones?.map((m) => m.status) ?? [],
      });
      const counterparty = row.initiatorSlug === slug ? row.recipientSlug : row.initiatorSlug;
      return {
        id: row.id,
        title: row.title,
        counterparty,
        stage,
        stageIndex: PIPELINE_STAGES.indexOf(stage),
        href: `/collaboration/records/${row.id}`,
      };
    });

  const brandMatches = requests
    .map((request) => ({
      request,
      score: scoreBusinessRequestForCreator(request, input.creator),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return {
    status,
    earnings,
    pipeline,
    saved,
    creatorMatches: creatorMatches.slice(0, 8),
    brandMatches,
    requests: requests.slice(0, 6),
    opportunities: opportunities.filter((item) => item.creatorSlug !== slug).slice(0, 6),
    collaborations,
  };
}
