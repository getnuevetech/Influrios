/**
 * Collaboration OS P2 — creator hub data helpers (status counts, pipeline, saved matches).
 * P2b — business hub loaders (requests, suggestions, spend from ledger).
 */
import { prisma } from "@/lib/db";
import {
  getWorkspace,
  rankDirectoryCreatorsForBrief,
  type BusinessWorkspace,
  type CampaignBrief,
  type CreatorFit,
} from "@/lib/business";
import { getBusinessEntitlements } from "@/lib/business-entitlements";
import { listCollaborations } from "@/lib/collaborations";
import { fundingBadge, type FundingBadge } from "@/lib/funding-badge";
import { listFundingsForBusiness, listFundingsForCreator } from "@/lib/marketplace-ledger";
import { findDirectoryMatchesFor, type CreatorMatch, type MatchBreakdown } from "@/lib/matching";
import {
  listPublishedBusinessRequests,
  listPublishedCreatorOpportunities,
  listMarketplaceApplications,
  persistTopMatches,
  type MarketplaceApplicationRow,
  type MarketplaceBusinessRequestRow,
  type MarketplaceCreatorOpportunityRow,
} from "@/lib/marketplace-listings";
import {
  computePayoutReadiness,
  type PayoutReadiness,
} from "@/lib/payout-readiness";
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
  /** W2.5 — Product §16 funding badge when a ledger row is linked. */
  fundingBadge?: FundingBadge | null;
  feeCents?: number | null;
  currency?: string | null;
  /** e.g. "1/2 revisions used on Delivery" */
  revisionSummary?: string | null;
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

export type HubPayoutPanel = {
  readiness: PayoutReadiness | null;
};

export type BusinessSpendSummary = {
  fundedCents: number;
  heldCents: number;
  releasedCents: number;
  refundedCents: number;
  feeCents: number;
  currency: string;
  dealCount: number;
};

export type BusinessHubStatus = {
  active: number;
  draftRequests: number;
  pendingReview: number;
  completed: number;
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

/** W2.5 — Product §16 badge + fee + revision summary for a funding-linked pipeline row. */
export function pipelineFundingSurface(input: {
  status: string;
  feeCents: number;
  currency: string;
  grossCents: number;
  fundingMode?: string | null;
  protectedPaymentsEnabled?: boolean;
  heldCents?: number;
  releasedCents?: number;
  milestones?: Array<{ title: string; revisionCount: number; revisionLimit: number; status: string }>;
}): Pick<HubPipelineItem, "fundingBadge" | "feeCents" | "currency" | "revisionSummary"> {
  const badge = fundingBadge({
    status: input.status,
    heldCents: input.heldCents,
    releasedCents: input.releasedCents,
    fundedCents: input.grossCents,
    protectedPaymentsEnabled: input.protectedPaymentsEnabled,
    fundingMode: input.fundingMode ?? undefined,
  });
  const hot = (input.milestones ?? []).find(
    (m) => m.revisionLimit > 0 && (m.status === "submitted" || m.status === "pending" || m.revisionCount > 0),
  );
  const revisionSummary = hot
    ? `${hot.revisionCount}/${hot.revisionLimit} revisions · ${hot.title}`
    : null;
  return {
    fundingBadge: badge,
    feeCents: input.feeCents,
    currency: input.currency,
    revisionSummary,
  };
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

export function summarizeBusinessSpend(
  fundings: Array<{
    grossCents: number;
    feeCents: number;
    currency: string;
    ledger: { heldCents: number; releasedCents: number; refundedCents: number; heldInCents: number };
  }>,
): BusinessSpendSummary {
  if (fundings.length === 0) {
    return {
      fundedCents: 0,
      heldCents: 0,
      releasedCents: 0,
      refundedCents: 0,
      feeCents: 0,
      currency: "USD",
      dealCount: 0,
    };
  }
  return {
    fundedCents: fundings.reduce((sum, row) => sum + row.ledger.heldInCents, 0),
    heldCents: fundings.reduce((sum, row) => sum + row.ledger.heldCents, 0),
    releasedCents: fundings.reduce((sum, row) => sum + row.ledger.releasedCents, 0),
    refundedCents: fundings.reduce((sum, row) => sum + row.ledger.refundedCents, 0),
    feeCents: fundings.reduce((sum, row) => sum + row.feeCents, 0),
    currency: fundings[0]?.currency ?? "USD",
    dealCount: fundings.length,
  };
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

  const dbCreator = await prisma.creator.findUnique({ where: { slug } }).catch(() => null);
  let payout: HubPayoutPanel = { readiness: null };
  if (dbCreator) {
    const readiness = await computePayoutReadiness({
      creatorId: dbCreator.id,
      identityVerified: dbCreator.identityVerified === "VERIFIED",
      locationCountry: dbCreator.locationCountry,
    }).catch(() => null);
    payout = { readiness };
  }

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
      const surface = funding
        ? pipelineFundingSurface({
            status: funding.status,
            feeCents: funding.feeCents,
            currency: funding.currency,
            grossCents: funding.grossCents,
            fundingMode: funding.fundingMode,
            heldCents: funding.ledger?.heldCents,
            releasedCents: funding.ledger?.releasedCents,
            milestones: funding.milestones,
          })
        : { fundingBadge: null, feeCents: null, currency: null, revisionSummary: null };
      return {
        id: row.id,
        title: row.title,
        counterparty,
        stage,
        stageIndex: PIPELINE_STAGES.indexOf(stage),
        href: funding ? `/payments` : `/collaboration/records/${row.id}`,
        ...surface,
      };
    });

  const brandMatches = requests
    .map((request) => ({
      request,
      score: scoreBusinessRequestForCreator(request, input.creator),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const applications = await listMarketplaceApplications({
    creatorSlug: slug,
    limit: 20,
  }).catch(() => [] as MarketplaceApplicationRow[]);

  return {
    status,
    earnings,
    payout,
    pipeline,
    saved,
    creatorMatches: creatorMatches.slice(0, 8),
    brandMatches,
    requests: requests.slice(0, 6),
    opportunities: opportunities.filter((item) => item.creatorSlug !== slug).slice(0, 6),
    applications,
    collaborations,
  };
}

export async function loadBusinessHub(input?: { intentBriefId?: string }) {
  const ws = await getWorkspace();
  const entitlements = getBusinessEntitlements(ws.plan);
  const [fundings, requests, opportunities, collaborations] = await Promise.all([
    listFundingsForBusiness(ws.name).catch(() => []),
    listPublishedBusinessRequests().catch(() => [] as MarketplaceBusinessRequestRow[]),
    listPublishedCreatorOpportunities().catch(() => [] as MarketplaceCreatorOpportunityRow[]),
    listCollaborations({}).catch(() => []),
  ]);

  const ownRequests = requests.filter(
    (row) =>
      row.brand.toLowerCase() === ws.name.toLowerCase() ||
      row.brand.toLowerCase().includes(ws.name.toLowerCase().slice(0, 8)),
  );
  const draftRequests = ws.briefs.filter((brief) => brief.status === "draft").length;
  const activeBriefs = ws.briefs.filter((brief) => brief.status === "active").length;
  const pendingReview = ws.inquiries.filter((inquiry) => inquiry.status === "sent").length;
  const active = collaborations.filter((row) => row.status === "accepted").length + activeBriefs;
  const completed = fundings.filter((row) => row.status === "completed").length;

  const status: BusinessHubStatus = {
    active,
    draftRequests,
    pendingReview,
    completed,
  };

  const spend = summarizeBusinessSpend(fundings);

  const intentBrief: CampaignBrief | null =
    (input?.intentBriefId ? ws.briefs.find((brief) => brief.id === input.intentBriefId) : null) ??
    ws.briefs.find((brief) => brief.status === "draft") ??
    ws.briefs[0] ??
    null;

  let suggestions: CreatorFit[] = [];
  if (intentBrief) {
    const limit = entitlements.fitInsights ? 8 : 3;
    suggestions = (await rankDirectoryCreatorsForBrief(intentBrief)).slice(0, limit);
  }

  const ownRequestIds = ownRequests.map((row) => row.id);
  const applications = ownRequestIds.length
    ? await listMarketplaceApplications({ businessRequestIds: ownRequestIds, limit: 20 }).catch(() => [])
    : [];

  const pipeline: HubPipelineItem[] = fundings.slice(0, 6).map((row) => {
    const stage = derivePipelineStage({
      collaborationStatus: "accepted",
      fundingStatus: row.status,
      milestoneStatuses: row.milestones?.map((m) => m.status) ?? [],
    });
    const surface = pipelineFundingSurface({
      status: row.status,
      feeCents: row.feeCents,
      currency: row.currency,
      grossCents: row.grossCents,
      fundingMode: row.fundingMode,
      heldCents: row.ledger?.heldCents,
      releasedCents: row.ledger?.releasedCents,
      milestones: row.milestones,
    });
    return {
      id: row.id,
      title: row.title,
      counterparty: row.creatorSlug,
      stage,
      stageIndex: PIPELINE_STAGES.indexOf(stage),
      href: `/payments`,
      ...surface,
    };
  });

  return {
    workspace: ws as BusinessWorkspace,
    entitlements,
    status,
    spend,
    suggestions,
    intentBrief,
    ownRequests: ownRequests.slice(0, 8),
    applications,
    opportunities: opportunities.slice(0, 6),
    inquiries: ws.inquiries.slice(0, 10),
    shortlist: ws.shortlist,
    briefs: ws.briefs,
    pipeline,
    fundings: fundings.slice(0, 8),
  };
}
