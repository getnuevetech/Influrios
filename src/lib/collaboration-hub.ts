/**
 * Collaboration OS P2 — creator hub data helpers (status counts, pipeline, saved matches).
 * P2b — business hub loaders (requests, suggestions, spend from ledger).
 */
import { newIncidentReference, type SectionState } from "@/lib/business-status";
import { prisma } from "@/lib/db";
import {
  getWorkspace,
  leadIsOpen,
  rankDirectoryCreatorsForBrief,
  type BusinessWorkspace,
  type CampaignBrief,
  type CreatorFit,
} from "@/lib/business";
import { businessEntitlementsForPlan } from "@/lib/entitlements-db";
import { listCollaborations } from "@/lib/collaborations";
import { fundingBadge, type FundingBadge } from "@/lib/funding-badge";
import { memberDealView } from "@/lib/member-deal-money";
import { agreedFeeFromSources } from "@/lib/signed-funding";
import { listFundingsForBusiness, listFundingsForCreator } from "@/lib/marketplace-ledger";
import { findDirectoryMatchesFor, type CreatorMatch, type MatchBreakdown } from "@/lib/matching";
import {
  listPublishedBusinessRequests,
  listPublishedCreatorOpportunities,
  listMarketplaceApplications,
  listWorkspaceBusinessRequests,
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
  contractHref?: string | null;
  /** Influencer compensation after the platform fee. Never mixed across currencies. */
  netCents?: number | null;
  source?: "proposal" | "application" | "team";
  /** W2.5 — Product §16 funding badge when a ledger row is linked. */
  fundingBadge?: FundingBadge | null;
  feeCents?: number | null;
  moneyLines?: { label: string; amountCents: number }[];
  /** Stored campaign gross when a funding row is linked. */
  grossCents?: number | null;
  currency?: string | null;
  /** e.g. "1/2 revisions used on Delivery" */
  revisionSummary?: string | null;
  obligationDone?: number;
  obligationTotal?: number;
  /** Signed agreement with no funding yet. Visible, but work has not started. */
  awaitingFunding?: boolean;
  /** Checkout is open and Stripe or finance has not confirmed it. */
  depositPending?: boolean;
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

/**
 * What the member sees. The word “Contract” is used only when a contract document exists.
 * An accepted invitation or collaboration before that document is not a contract.
 */
export function agreementPresentation(row: {
  stage: string;
  href: string;
  contractHref?: string | null;
  revisionSummary?: string | null;
  awaitingFunding?: boolean;
  depositPending?: boolean;
}) {
  if (row.stage === "Funded" || row.stage === "In Progress" || row.stage === "Review") {
    return {
      label: row.stage,
      next: row.revisionSummary || "Deliverables are open",
      action: "Open deliverables",
      href: row.href,
    };
  }
  if (row.depositPending) {
    return {
      label: "Payment pending",
      next: "The business opened a deposit. It stays unfunded until Stripe or finance confirms it.",
      action: "View agreement",
      href: row.contractHref || row.href,
    };
  }
  if (row.awaitingFunding) {
    return {
      label: "Expecting funding",
      next: "Waiting for the business to fund this agreement",
      action: "View agreement",
      href: row.contractHref || row.href,
    };
  }
  if (row.contractHref) {
    return {
      label: "Contract",
      next: row.revisionSummary || "Contract",
      action: "Review contract →",
      href: row.contractHref,
    };
  }
  if (row.stage === "Contract") {
    return {
      label: "Accepted",
      next: row.revisionSummary || "Agreement not created",
      action: "Open invitation →",
      href: row.href,
    };
  }
  return {
    label: row.stage,
    next: row.revisionSummary || row.stage,
    action: "Open workspace →",
    href: row.href,
  };
}

/**
 * Current work only. Matches, open invitations, and proposals stay out of the active count.
 * An accepted collaboration record counts. An invitation counts only after it is a funded or in-progress contract.
 */
export function isCurrentCollaboration(row: {
  stage: string;
  source?: string | null;
  contractHref?: string | null;
  awaitingFunding?: boolean;
  depositPending?: boolean;
}) {
  if (row.awaitingFunding || row.depositPending) return true;
  if (row.stage === "Match" || row.stage === "Released") return false;
  if (row.source === "application" || row.source === "team") {
    return Boolean(row.contractHref) && row.stage !== "Contract";
  }
  return row.stage === "Contract" || row.stage === "Funded" || row.stage === "In Progress" || row.stage === "Review";
}

const FUNDED_STAGES = new Set(["Funded", "In Progress", "Review", "Released"]);

export type AwaitingFundingContract = {
  id: string;
  title: string;
  status: string;
  fundingId: string | null;
  collaborationId?: string | null;
  applicationId?: string | null;
  teamProposalId?: string | null;
  grossCents: number | null;
  currency: string | null;
  counterparty: string;
  fundingStatus?: string | null;
};

function sameSignedDeal(row: HubPipelineItem, doc: AwaitingFundingContract) {
  const href = `/collaboration/contracts/${doc.id}`;
  if (row.contractHref === href || row.href === href) return true;
  if (doc.collaborationId && row.id === doc.collaborationId) return true;
  if (doc.applicationId && row.id === `application:${doc.applicationId}`) return true;
  if (doc.teamProposalId && row.id === `team:${doc.teamProposalId}`) return true;
  return false;
}

/** Signed, unfunded agreements stay on Active as one inactive row until money is held. */
export function attachAwaitingFunding(pipeline: HubPipelineItem[], contracts: AwaitingFundingContract[]): HubPipelineItem[] {
  const next = pipeline.map((row) => ({ ...row }));
  for (const doc of contracts) {
    if (doc.status !== "signed" || doc.fundingId) continue;
    const href = `/collaboration/contracts/${doc.id}`;
    const matches = next.filter((row) => sameSignedDeal(row, doc));
    if (matches.some((row) => FUNDED_STAGES.has(row.stage))) continue;
    const visible = matches.filter((row) => row.stage !== "Match" && row.stage !== "Released");
    const targets = visible.length > 0 ? visible : matches.slice(0, 1);
    const apply = (row: HubPipelineItem) => {
      row.awaitingFunding = true;
      row.contractHref = href;
      row.href = href;
      if (!row.counterparty.trim()) row.counterparty = doc.counterparty || "Business";
      if (doc.grossCents && doc.currency && row.grossCents == null) {
        row.grossCents = doc.grossCents;
        row.currency = doc.currency;
      }
    };
    if (targets.length > 0) {
      for (const row of targets) apply(row);
      continue;
    }
    next.push({
      id: `contract:${doc.id}`,
      title: doc.title,
      counterparty: doc.counterparty || "Business",
      stage: "Contract",
      stageIndex: PIPELINE_STAGES.indexOf("Contract"),
      href,
      contractHref: href,
      awaitingFunding: true,
      grossCents: doc.grossCents,
      currency: doc.currency,
      source: "proposal",
    });
  }
  return next;
}

/** A signed contract with a funding record belongs on the ongoing collaboration, with both the agreement and the work. */
export function attachOpenContracts(pipeline: HubPipelineItem[], contracts: AwaitingFundingContract[]): HubPipelineItem[] {
  const next = pipeline.map((row) => ({ ...row }));
  for (const doc of contracts) {
    if (doc.status !== "signed" || !doc.fundingId) continue;
    const href = `/collaboration/contracts/${doc.id}`;
    const work = `/collaboration/work/${doc.fundingId}`;
    const funded = doc.fundingStatus === "held" || doc.fundingStatus === "completed";
    const matches = next.filter((row) => sameSignedDeal(row, doc));
    const apply = (row: HubPipelineItem) => {
      row.contractHref = href;
      row.awaitingFunding = false;
      row.depositPending = !funded;
      if (funded) {
        row.stage = row.stage === "Released" ? "Released" : "Funded";
        row.stageIndex = PIPELINE_STAGES.indexOf(row.stage);
        row.href = work;
      } else if (!row.href || row.href === href) {
        row.href = href;
      }
      if (!row.counterparty.trim()) row.counterparty = doc.counterparty || "Business";
    };
    if (matches.length > 0) {
      for (const row of matches) apply(row);
      continue;
    }
    next.push({
      id: `contract:${doc.id}`,
      title: doc.title,
      counterparty: doc.counterparty || "Business",
      stage: funded ? "Funded" : "Contract",
      stageIndex: PIPELINE_STAGES.indexOf(funded ? "Funded" : "Contract"),
      href: funded ? work : href,
      contractHref: href,
      depositPending: !funded,
      grossCents: doc.grossCents,
      currency: doc.currency,
      source: "proposal",
    });
  }
  return next;
}

/** Invitations and requests leave those lists once a live contract exists. */
export function invitationStillListed(
  row: { id: string; collaborationId?: string | null },
  contractedApplicationIds: ReadonlySet<string>,
  contractedCollaborationIds: ReadonlySet<string>,
) {
  if (contractedApplicationIds.has(row.id)) return false;
  const collaborationId = row.collaborationId?.trim();
  if (collaborationId && contractedCollaborationIds.has(collaborationId)) return false;
  return true;
}

/** Map collaboration + funding state onto the Figure 2 pipeline stepper. */
export function derivePipelineStage(input: {
  collaborationStatus: string;
  fundingStatus?: string | null;
  milestoneStatuses?: string[];
}): PipelineStage {
  const milestones = input.milestoneStatuses ?? [];
  const released = milestones.filter((status) => status === "released").length;
  const allReleased = milestones.length > 0 && released === milestones.length;
  if (input.fundingStatus === "completed" && (milestones.length === 0 || allReleased)) {
    return "Released";
  }
  if (milestones.some((status) => status === "submitted" || status === "approved")) return "Review";
  if (released > 0) return "In Progress";
  if (input.fundingStatus === "held") return "Funded";
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
}): Pick<HubPipelineItem, "fundingBadge" | "feeCents" | "grossCents" | "currency" | "revisionSummary"> {
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
    grossCents: input.grossCents,
    currency: input.currency,
    revisionSummary,
  };
}

/** Specialty tokens that actually appear on the request. A blank specialty never counts. */
export function requestSpecialtyHits(request: MarketplaceBusinessRequestRow, creator: SeedCreator): number {
  const hay = `${request.category} ${request.tags.join(" ")} ${request.lookingFor} ${request.summary}`.toLowerCase();
  let hits = 0;
  for (const specialty of creator.specialties) {
    const raw = specialty.trim().toLowerCase();
    const token = raw.replace(/-/g, " ");
    if (token.length < 3) continue;
    if (hay.includes(raw) || hay.includes(token)) hits += 1;
  }
  return hits;
}

export function scoreBusinessRequestForCreator(
  request: MarketplaceBusinessRequestRow,
  creator: SeedCreator,
): number {
  const hits = requestSpecialtyHits(request, creator);
  if (hits === 0) return 0;
  const locationHit =
    request.location.toLowerCase().includes("global") ||
    (creator.locationCountry.trim().length > 0 &&
      request.location.toLowerCase().includes(creator.locationCountry.toLowerCase())) ||
    (creator.locationCity.trim().length > 0 &&
      request.location.toLowerCase().includes(creator.locationCity.toLowerCase()));
  return Math.min(98, 68 + hits * 8 + (locationHit ? 6 : 0));
}

/** One currency code when every funding stored the same code. Otherwise blank. */
export function sharedStoredCurrency(currencies: Array<string | null | undefined>): string {
  if (currencies.length === 0) return "";
  const codes = currencies.map((value) => (value ?? "").trim().toUpperCase());
  if (codes.some((code) => !/^[A-Z]{3}$/.test(code))) return "";
  const first = codes[0];
  if (codes.some((code) => code !== first)) return "";
  return first;
}

export function summarizeBusinessSpend(
  fundings: Array<{
    grossCents: number;
    feeCents: number;
    currency: string;
    ledger: { heldCents: number; releasedCents: number; refundedCents: number; heldInCents: number };
    feeSnapshotJson?: unknown;
  }>,
): BusinessSpendSummary {
  const currency = sharedStoredCurrency(fundings.map((row) => row.currency));
  if (fundings.length === 0) {
    return {
      fundedCents: 0,
      heldCents: 0,
      releasedCents: 0,
      refundedCents: 0,
      feeCents: 0,
      currency,
      dealCount: 0,
    };
  }
  return {
    fundedCents: fundings.reduce((sum, row) => sum + row.ledger.heldInCents, 0),
    heldCents: fundings.reduce((sum, row) => sum + row.ledger.heldCents, 0),
    releasedCents: fundings.reduce((sum, row) => sum + row.ledger.releasedCents, 0),
    refundedCents: fundings.reduce((sum, row) => sum + row.ledger.refundedCents, 0),
    feeCents: fundings.reduce(
      (sum, row) =>
        sum +
        memberDealView({
          role: "business",
          grossCents: row.grossCents,
          feeCents: row.feeCents,
          plan: row.feeSnapshotJson,
        }).feeCents,
      0,
    ),
    currency,
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

async function settle<T>(
  label: string,
  work: Promise<T>,
  fallback: T,
  degraded: string[],
  incidents?: Record<string, string>,
): Promise<T> {
  try {
    return await work;
  } catch (error) {
    const incident = newIncidentReference();
    if (incidents) incidents[label] = incident;
    console.error(label, incident, error);
    degraded.push(label);
    return fallback;
  }
}

function sectionState(failed: boolean, count: number): SectionState {
  if (failed) return "unavailable";
  return count === 0 ? "empty" : "ready";
}

export async function loadCreatorHub(input: {
  userId: string;
  creator: SeedCreator;
}) {
  const slug = input.creator.slug;
  const degraded: string[] = [];
  const [collaborations, fundings, saved, creatorMatches, requests, opportunities, applications, teamProposals] =
    await Promise.all([
      settle("proposals", listCollaborations({ slug }), [], degraded),
      settle("fundings", listFundingsForCreator(slug), [], degraded),
      settle("saved matches", listSavedMatchesForUser(input.userId), [], degraded),
      settle("matches", findDirectoryMatchesFor(slug), [] as CreatorMatch[], degraded),
      settle("campaigns", listPublishedBusinessRequests(), [] as MarketplaceBusinessRequestRow[], degraded),
      settle("openings", listPublishedCreatorOpportunities(), [] as MarketplaceCreatorOpportunityRow[], degraded),
      settle("applications", listMarketplaceApplications({ creatorSlug: slug, limit: 100 }), [] as MarketplaceApplicationRow[], degraded),
      settle(
        "team proposals",
        import("@/lib/team-proposal").then((mod) => mod.listTeamProposalsForCreator(slug, { includeContracted: true })),
        [],
        degraded,
      ),
    ]);

  await persistTopMatches(creatorMatches).catch(() => 0);
  const awaitingDeposits = fundings.filter((row) => row.status === "awaiting_provider");
  if (awaitingDeposits.length > 0) {
    const { syncOpenGatewayDeposits } = await import("@/lib/funding-checkout");
    const changed = await Promise.all(awaitingDeposits.map((row) => syncOpenGatewayDeposits(row.id).catch(() => false)));
    if (changed.some(Boolean)) {
      const fresh = await listFundingsForCreator(slug).catch(() => fundings);
      fundings.splice(0, fundings.length, ...fresh);
    }
  }

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

  const { influencerLedgerShare } = await import("@/lib/member-deal-money");
  const influencerEarnings = fundings.map((row) =>
    influencerLedgerShare({
      grossCents: row.grossCents,
      feeCents: row.feeCents,
      plan: row.feeSnapshotJson,
      ledger: { heldCents: row.ledger?.heldCents ?? 0, releasedCents: row.ledger?.releasedCents ?? 0 },
    }),
  );
  const heldCents = influencerEarnings.reduce((sum, row) => sum + row.heldCents, 0);
  const releasedCents = influencerEarnings.reduce((sum, row) => sum + row.releasedCents, 0);
  const earnings: HubEarnings = {
    heldCents,
    releasedCents,
    currency: sharedStoredCurrency(fundings.map((row) => row.currency)),
    ready: heldCents > 0 || releasedCents > 0,
  };

  const dbCreator = await prisma.creator.findUnique({ where: { slug } }).catch(() => null);
  let payout: HubPayoutPanel = { readiness: null };
  if (dbCreator) {
    const { resolveCreatorIdentityVerified } = await import("@/lib/kyc-document");
    const identityVerified = await resolveCreatorIdentityVerified({
      creatorId: dbCreator.id,
      creatorSlug: dbCreator.slug,
      identityVerified: dbCreator.identityVerified,
    }).catch(() => dbCreator.identityVerified === "VERIFIED");
    const readiness = await computePayoutReadiness({
      creatorId: dbCreator.id,
      identityVerified,
      locationCountry: dbCreator.locationCountry,
    }).catch(() => null);
    payout = { readiness };
  }

  const fundingByCollab = new Map(
    fundings
      .filter((row) => row.collaborationId)
      .map((row) => [row.collaborationId as string, row]),
  );
  const pipeline: HubPipelineItem[] = collaborations
    .filter((row) => row.status === "accepted" || row.status === "sent" || row.status === "draft")
    .map((row) => {
      const funding = fundingByCollab.get(row.id) ?? null;
      const stage = derivePipelineStage({
        collaborationStatus: row.status,
        fundingStatus: funding?.status ?? null,
        milestoneStatuses: funding?.milestones?.map((m) => m.status) ?? [],
      });
      const counterparty = row.initiatorSlug === slug ? row.recipientSlug : row.initiatorSlug;
      const view = funding
        ? memberDealView({
            role: "influencer",
            grossCents: funding.grossCents,
            feeCents: funding.feeCents,
            plan: funding.feeSnapshotJson,
          })
        : null;
      const surface = funding
        ? pipelineFundingSurface({
            status: funding.status,
            feeCents: view?.feeCents ?? funding.feeCents,
            currency: funding.currency,
            grossCents: view?.grossCents ?? funding.grossCents,
            fundingMode: funding.fundingMode,
            heldCents: funding.ledger?.heldCents,
            releasedCents: funding.ledger?.releasedCents,
            milestones: funding.milestones,
          })
        : { fundingBadge: null, feeCents: null, grossCents: null, currency: null, revisionSummary: null };
      return {
        id: row.id,
        title: row.title,
        counterparty,
        stage,
        stageIndex: PIPELINE_STAGES.indexOf(stage),
        href:
          funding && (funding.status === "held" || funding.status === "completed")
            ? `/collaboration/work/${funding.id}`
            : funding
              ? `/payments?funding=${encodeURIComponent(funding.id)}`
              : `/collaboration/records/${row.id}`,
        depositPending: funding?.status === "awaiting_provider",
        source: "proposal",
        netCents: view?.headlineCents ?? null,
        moneyLines: view?.lines,
        obligationDone: funding?.milestones?.filter((item) => item.status === "approved" || item.status === "released").length,
        obligationTotal: funding?.milestones?.length,
        ...surface,
      };
    });

  const brandMatches = requests
    .map((request) => ({
      request,
      score: scoreBusinessRequestForCreator(request, input.creator),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const collabIds = collaborations.map((row) => row.id);
  const teamIds = teamProposals.map((row) => row.id);
  const contractWhere = [
    ...(collabIds.length ? [{ collaborationId: { in: collabIds } }] : []),
    ...(teamIds.length ? [{ teamProposalId: { in: teamIds } }] : []),
  ];
  const contractLinks = contractWhere.length
    ? await settle(
        "agreements",
        prisma.contractDocument.findMany({
          where: { OR: contractWhere },
          select: { id: true, applicationId: true, collaborationId: true, teamProposalId: true, fundingId: true, status: true },
          orderBy: { updatedAt: "desc" },
        }),
        [],
        degraded,
      )
    : [];
  const contractByCollab = new Map<string, string>();
  const contractByTeam = new Map<string, string>();
  const contractByApplication = new Map<string, string>();
  for (const link of contractLinks) {
    if (link.collaborationId && !contractByCollab.has(link.collaborationId)) {
      contractByCollab.set(link.collaborationId, link.id);
    }
    if (link.teamProposalId && !contractByTeam.has(link.teamProposalId)) {
      contractByTeam.set(link.teamProposalId, link.id);
    }
    if (link.applicationId && !contractByApplication.has(link.applicationId)) {
      contractByApplication.set(link.applicationId, link.id);
    }
  }
  const fundingIds = [...new Set(contractLinks.map((link) => link.fundingId).filter((id): id is string => Boolean(id)))];
  const fundingRows = fundingIds.length
    ? await prisma.collaborationFunding.findMany({
        where: { id: { in: fundingIds } },
        select: { id: true, status: true },
      })
    : [];
  const fundingById = new Map(fundingRows.map((row) => [row.id, row]));
  for (const row of pipeline) {
    const contractId = contractByCollab.get(row.id);
    if (!contractId) continue;
    row.contractHref = row.contractHref || `/collaboration/contracts/${contractId}`;
    if (row.stage === "Match") {
      row.stage = "Contract";
      row.stageIndex = PIPELINE_STAGES.indexOf("Contract");
    }
  }
  const contractFunding = (contractId: string | undefined) => {
    const link = contractId ? contractLinks.find((row) => row.id === contractId) : undefined;
    const funding = link?.fundingId ? fundingById.get(link.fundingId) : undefined;
    if (!funding) {
      return { stage: (contractId ? "Contract" : "Match") as PipelineStage, workHref: null as string | null, depositPending: false };
    }
    const stage = derivePipelineStage({
      collaborationStatus: "accepted",
      fundingStatus: funding.status,
      milestoneStatuses: [],
    });
    const open = funding.status === "held" || funding.status === "completed";
    return {
      stage,
      workHref: open ? `/collaboration/work/${funding.id}` : null,
      depositPending: funding.status === "awaiting_provider",
    };
  };
  for (const proposal of teamProposals) {
    if (proposal.status !== "accepted" && proposal.status !== "partial") continue;
    const mine = proposal.members.find((member) => member.creatorSlug === slug);
    if (!mine || mine.status === "declined") continue;
    const contractId = contractByTeam.get(proposal.id);
    const money = contractFunding(contractId);
    pipeline.push({
      id: `team:${proposal.id}`,
      title: proposal.title,
      counterparty: proposal.title,
      stage: money.stage,
      stageIndex: PIPELINE_STAGES.indexOf(money.stage),
      href: money.workHref || (contractId ? `/collaboration/contracts/${contractId}` : `/collaboration/team/${proposal.id}`),
      contractHref: contractId ? `/collaboration/contracts/${contractId}` : null,
      depositPending: money.depositPending,
      source: "team",
    });
  }
  const pipelineIds = new Set(pipeline.map((row) => row.id));
  for (const application of applications) {
    if (application.status !== "ACCEPTED" && application.status !== "COLLABORATION_DRAFTED") continue;
    if (application.collaborationId && pipelineIds.has(application.collaborationId)) continue;
    const contractId =
      contractByApplication.get(application.id) ||
      (application.collaborationId ? contractByCollab.get(application.collaborationId) : undefined);
    const money = contractFunding(contractId);
    pipeline.push({
      id: `application:${application.id}`,
      title: application.requestBrand || application.opportunityLookingFor || "Campaign invitation",
      counterparty: application.requestBrand || "Business",
      stage: money.stage,
      stageIndex: PIPELINE_STAGES.indexOf(money.stage),
      href: money.workHref || (contractId ? `/collaboration/contracts/${contractId}` : `/collaboration/applications/${application.id}`),
      contractHref: contractId ? `/collaboration/contracts/${contractId}` : null,
      depositPending: money.depositPending,
      source: "application",
    });
  }
  for (const row of pipeline) {
    if (row.stage === "Funded" || row.stage === "In Progress" || row.stage === "Review") continue;
    const contractId = row.contractHref?.split("/").pop();
    const money = contractFunding(contractId);
    if (!money.workHref && !money.depositPending) continue;
    row.stage = money.stage;
    row.stageIndex = PIPELINE_STAGES.indexOf(money.stage);
    if (money.workHref) row.href = money.workHref;
    row.depositPending = money.depositPending;
  }
  const listedApplications = applications.filter((row) =>
    invitationStillListed(row, new Set(contractByApplication.keys()), new Set(contractByCollab.keys())),
  );
  const signedUnfunded = await settle(
    "signed agreements",
    prisma.contractDocument.findMany({
      where: {
        status: "signed",
        fundingId: null,
        OR: [
          { parties: { some: { creatorSlug: slug } } },
          { parties: { some: { userId: input.userId, role: "creator" } } },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        fundingId: true,
        collaborationId: true,
        applicationId: true,
        teamProposalId: true,
        sourceJson: true,
        termsSnapshotJson: true,
        parties: { select: { role: true, name: true } },
      },
      take: 40,
    }),
    [],
    degraded,
  );
  const signedWithFunding = await settle(
    "funded agreements",
    prisma.contractDocument.findMany({
      where: {
        status: "signed",
        fundingId: { not: null },
        OR: [
          { parties: { some: { creatorSlug: slug } } },
          { parties: { some: { userId: input.userId, role: "creator" } } },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        fundingId: true,
        collaborationId: true,
        applicationId: true,
        teamProposalId: true,
        sourceJson: true,
        termsSnapshotJson: true,
        parties: { select: { role: true, name: true } },
      },
      take: 40,
    }),
    [],
    degraded,
  );
  const fundingStates = await settle(
    "funding status",
    prisma.collaborationFunding.findMany({
      where: { id: { in: signedWithFunding.flatMap((document) => (document.fundingId ? [document.fundingId] : [])) } },
      select: { id: true, status: true },
    }),
    [],
    degraded,
  );
  const fundingStatus = new Map(fundingStates.map((row) => [row.id, row.status]));
  const toContract = (document: (typeof signedUnfunded)[number], status: string | null) => {
    const fee = agreedFeeFromSources(document.sourceJson, document.termsSnapshotJson);
    const business = document.parties.find((party) => party.role === "business");
    return {
      id: document.id,
      title: document.title,
      status: document.status,
      fundingId: document.fundingId,
      collaborationId: document.collaborationId,
      applicationId: document.applicationId,
      teamProposalId: document.teamProposalId,
      grossCents: fee.grossCents,
      currency: fee.currency,
      counterparty: business?.name || "Business",
      fundingStatus: status,
    };
  };
  const withFunding = attachOpenContracts(
    attachAwaitingFunding(
      pipeline,
      signedUnfunded.map((document) => toContract(document, null)),
    ),
    signedWithFunding.map((document) => toContract(document, document.fundingId ? fundingStatus.get(document.fundingId) ?? null : null)),
  );
  status.active = withFunding.filter((row) => isCurrentCollaboration(row)).length;
  const history: HubPipelineItem[] = [
    ...collaborations
      .filter((row) => row.status === "declined" || row.status === "withdrawn")
      .map((row) => ({
        id: row.id,
        title: row.title,
        counterparty: row.initiatorSlug === slug ? row.recipientSlug : row.initiatorSlug,
        stage: "Match" as const,
        stageIndex: 0,
        href: `/collaboration/records/${row.id}`,
        source: "proposal" as const,
      })),
    ...applications
      .filter((row) => row.status === "DECLINED" || row.status === "EXPIRED" || row.status === "WITHDRAWN")
      .map((row) => ({
        id: `application:${row.id}`,
        title: row.requestBrand || row.opportunityLookingFor || "Application",
        counterparty: row.status === "EXPIRED" ? "Expired" : row.status === "WITHDRAWN" ? "Withdrawn" : "Declined",
        stage: "Match" as const,
        stageIndex: 0,
        href: `/collaboration/applications/${row.id}`,
        source: "application" as const,
      })),
  ];

  return {
    status,
    earnings,
    payout,
    pipeline: withFunding,
    saved,
    creatorMatches: creatorMatches.slice(0, 8),
    brandMatches,
    requests: requests.slice(0, 6),
    opportunities: opportunities.filter((item) => item.creatorSlug !== slug).slice(0, 6),
    applications: listedApplications,
    collaborations,
    history,
    degraded,
  };
}

export async function loadBusinessHub(input?: { intentBriefId?: string; userId?: string }) {
  const ws = await getWorkspace(input?.userId);
  const entitlements = await businessEntitlementsForPlan(ws.plan);
  const degraded: string[] = [];
  const incidents: Record<string, string> = {};
  const [fundings, opportunities, collaborations] = await Promise.all([
    settle("fundings", listFundingsForBusiness(ws.businessId), [], degraded, incidents),
    settle("opportunities", listPublishedCreatorOpportunities(), [] as MarketplaceCreatorOpportunityRow[], degraded, incidents),
    ws.ownerUserId
      ? settle(
          "collaborations",
          prisma.collaboration.count({ where: { initiatorUserId: ws.ownerUserId, status: "accepted" } }),
          0,
          degraded,
          incidents,
        )
      : Promise.resolve(0),
  ]);

  const ownRequests = await settle(
    "requests",
    listWorkspaceBusinessRequests(ws.businessId),
    [] as MarketplaceBusinessRequestRow[],
    degraded,
    incidents,
  );
  const draftRequests = ws.briefs.filter((brief) => brief.status === "draft").length;
  const activeBriefs = ws.briefs.filter((brief) => brief.status === "active").length;
  const pendingReview = ws.inquiries.filter((inquiry) => leadIsOpen(inquiry.status)).length;
  const active = collaborations + activeBriefs;
  const completed = fundings.filter((row) => row.status === "completed").length;

  const status: BusinessHubStatus = {
    active,
    draftRequests,
    pendingReview,
    completed,
  };

  const fundingsFailed = degraded.includes("fundings");
  const spend = fundingsFailed ? null : summarizeBusinessSpend(fundings);

  // #13/#15 — the Campaign Intent form is not auto-filled with the latest draft on every visit.
  // It only loads a brief when the caller explicitly asks for one by id (an Edit link), and
  // ?intent=new always starts blank.
  const intentBrief: CampaignBrief | null =
    input?.intentBriefId && input.intentBriefId !== "new"
      ? ws.briefs.find((brief) => brief.id === input.intentBriefId) ?? null
      : null;

  let suggestions: CreatorFit[] = [];
  if (intentBrief) {
    const limit = entitlements.fitInsights ? 8 : 3;
    suggestions = (await rankDirectoryCreatorsForBrief(intentBrief)).slice(0, limit);
  }

  const ownRequestIds = ownRequests.map((row) => row.id);
  const ownBriefIds = ws.briefs.map((brief) => brief.id);
  const applications = ownRequestIds.length || ownBriefIds.length
    ? await settle(
        "applications",
        listMarketplaceApplications({
          businessRequestIds: ownRequestIds,
          briefIds: ownBriefIds,
          limit: 20,
        }),
        [],
        degraded,
        incidents,
      )
    : [];

  const applicationIds = applications.map((row) => row.id);
  const contractedApplications = applicationIds.length
    ? await prisma.contractDocument
        .findMany({
          where: {
            applicationId: { in: applicationIds },
            status: { notIn: ["voided", "declined"] },
          },
          select: { applicationId: true, collaborationId: true },
        })
        .catch(() => [])
    : [];
  const contractedApplicationIds = new Set(
    contractedApplications.map((row) => row.applicationId).filter((id): id is string => Boolean(id)),
  );
  const contractedCollaborationIds = new Set(
    contractedApplications.map((row) => row.collaborationId).filter((id): id is string => Boolean(id)),
  );
  const listedApplications = applications.filter((row) =>
    invitationStillListed(row, contractedApplicationIds, contractedCollaborationIds),
  );

  const pipeline: HubPipelineItem[] = fundings.map((row) => {
    const stage = derivePipelineStage({
      collaborationStatus: "accepted",
      fundingStatus: row.status,
      milestoneStatuses: row.milestones?.map((m) => m.status) ?? [],
    });
    const view = memberDealView({
      role: "business",
      grossCents: row.grossCents,
      feeCents: row.feeCents,
      plan: row.feeSnapshotJson,
    });
    const surface = pipelineFundingSurface({
      status: row.status,
      feeCents: view.feeCents,
      currency: row.currency,
      grossCents: view.headlineCents,
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
      href: `/payments?funding=${encodeURIComponent(row.id)}`,
      netCents: null,
      moneyLines: view.lines,
      obligationDone: row.milestones?.filter((item) => item.status === "approved" || item.status === "released").length,
      obligationTotal: row.milestones?.length,
      ...surface,
    };
  });

  const sections = {
    fundings: sectionState(fundingsFailed, fundings.length),
    opportunities: sectionState(degraded.includes("opportunities"), opportunities.length),
    collaborations: sectionState(degraded.includes("collaborations"), collaborations),
    requests: sectionState(degraded.includes("requests"), ownRequests.length),
    applications: sectionState(degraded.includes("applications"), applications.length),
  };

  return {
    workspace: ws as BusinessWorkspace,
    entitlements,
    status,
    spend,
    sections,
    incidents,
    suggestions,
    intentBrief,
    ownRequests: ownRequests.slice(0, 8),
    publishedBriefIds: ownRequests.map((row) => row.briefId).filter((id): id is string => Boolean(id)),
    applications: listedApplications,
    opportunities: opportunities.slice(0, 6),
    inquiries: ws.inquiries.slice(0, 10),
    shortlist: ws.shortlist,
    briefs: ws.briefs,
    pipeline,
    fundings: fundings.slice(0, 8),
  };
}
