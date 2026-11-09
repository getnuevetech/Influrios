/**
 * Collaboration OS P1b — marketplace listings (business requests, creator opportunities,
 * persisted match records, and application state machine).
 */
import { applicationLinkPlan } from "@/lib/collaboration-links";
import { prisma } from "@/lib/db";
import {
  BUSINESS_REQUESTS,
  CREATOR_OPPORTUNITIES,
  type BusinessRequest,
  type CreatorMatch,
  type CreatorOpportunity,
  type MatchBreakdown,
} from "@/lib/matching";

export const MARKETPLACE_APPLICATION_STATUSES = [
  "REQUESTED",
  "VIEWED",
  "RESPONDED",
  "NEGOTIATING",
  "ACCEPTED",
  "COLLABORATION_DRAFTED",
  "DECLINED",
  "EXPIRED",
  "WITHDRAWN",
] as const;

export type MarketplaceApplicationStatus = (typeof MARKETPLACE_APPLICATION_STATUSES)[number];

const APPLICATION_TRANSITIONS: Record<MarketplaceApplicationStatus, MarketplaceApplicationStatus[]> = {
  REQUESTED: ["VIEWED", "DECLINED", "EXPIRED", "WITHDRAWN"],
  // ACCEPTED from VIEWED lets an invitee accept after opening the detail (auto-VIEWED).
  VIEWED: ["RESPONDED", "ACCEPTED", "DECLINED", "EXPIRED", "WITHDRAWN"],
  RESPONDED: ["NEGOTIATING", "ACCEPTED", "DECLINED", "EXPIRED", "WITHDRAWN"],
  NEGOTIATING: ["ACCEPTED", "DECLINED", "EXPIRED", "WITHDRAWN"],
  ACCEPTED: ["COLLABORATION_DRAFTED", "WITHDRAWN"],
  COLLABORATION_DRAFTED: [],
  DECLINED: [],
  EXPIRED: [],
  WITHDRAWN: [],
};

export type MarketplaceBusinessRequestRow = BusinessRequest & {
  logoUrl?: string | null;
  imageUrl?: string | null;
  status: string;
  sortOrder: number;
  workspaceId?: string | null;
  briefId?: string | null;
  currency?: string | null;
  deliverableSummary?: string | null;
  platforms?: string[];
};

export type MarketplaceCreatorOpportunityRow = CreatorOpportunity & {
  purpose?: string | null;
  location?: string | null;
  budget?: string | null;
  currency?: string | null;
  deliverableSummary?: string | null;
  platforms?: string[];
  status: string;
  sortOrder: number;
};

function isApplicationStatus(value: string): value is MarketplaceApplicationStatus {
  return (MARKETPLACE_APPLICATION_STATUSES as readonly string[]).includes(value);
}

export function isLaunchSampleBusinessRequest(row: {
  id: string;
  brand: string;
  summary: string;
}): boolean {
  const sample = BUSINESS_REQUESTS.find((item) => item.id === row.id);
  if (!sample) return false;
  return sample.brand === row.brand && sample.summary === row.summary;
}

export function isLaunchSampleCreatorOpportunity(row: {
  id: string;
  creatorSlug: string;
  summary: string;
}): boolean {
  const sample = CREATOR_OPPORTUNITIES.find((item) => item.id === row.id);
  if (!sample) return false;
  return sample.creatorSlug === row.creatorSlug && sample.summary === row.summary;
}

/** Demo art is not a business logo. Uploaded paths stay. */
export function publicListingAsset(url: string | null | undefined): string | null {
  const value = url?.trim() ?? "";
  if (!value || value.includes("/demo/")) return null;
  return value;
}

const RETIRED_SAMPLE_SAVE =
  "This listing is a retired sample. Replace the brand or influencer and the summary with the party that posted it before saving.";

/** Seed and migrate delete leftover sample rows. Nothing in the product inserts them. */
export async function ensureMarketplaceListings() {
  const [requests, opportunities] = await Promise.all([
    prisma.marketplaceBusinessRequest.deleteMany({
      where: {
        OR: BUSINESS_REQUESTS.map((item) => ({
          id: item.id,
          brand: item.brand,
          summary: item.summary,
        })),
      },
    }),
    prisma.marketplaceCreatorOpportunity.deleteMany({
      where: {
        OR: CREATOR_OPPORTUNITIES.map((item) => ({
          id: item.id,
          creatorSlug: item.creatorSlug,
          summary: item.summary,
        })),
      },
    }),
  ]);
  return {
    removedRequests: requests.count,
    removedOpportunities: opportunities.count,
  };
}

function mapBusinessRequestRow(row: {
  id: string;
  brand: string;
  category: string;
  budget: string;
  location: string;
  tags: string[];
  summary: string;
  lookingFor: string;
  logoUrl: string | null;
  imageUrl: string | null;
  status: string;
  sortOrder: number;
  workspaceId: string | null;
  briefId?: string | null;
  currency?: string | null;
  deliverableSummary?: string | null;
  platforms?: string[];
}): MarketplaceBusinessRequestRow {
  return {
    id: row.id,
    brand: row.brand,
    category: row.category,
    budget: row.budget,
    location: row.location,
    tags: row.tags,
    summary: row.summary,
    lookingFor: row.lookingFor,
    logoUrl: publicListingAsset(row.logoUrl),
    imageUrl: publicListingAsset(row.imageUrl),
    status: row.status,
    sortOrder: row.sortOrder,
    workspaceId: row.workspaceId,
    briefId: row.briefId ?? null,
    currency: row.currency ?? "",
    deliverableSummary: row.deliverableSummary ?? "",
    platforms: row.platforms ?? [],
  };
}

export async function listPublishedBusinessRequests(filters?: {
  budget?: string;
  goal?: string;
}): Promise<MarketplaceBusinessRequestRow[]> {
  const rows = await prisma.marketplaceBusinessRequest.findMany({
    where: { status: "published" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return rows
    .map(mapBusinessRequestRow)
    .filter((item) => !isLaunchSampleBusinessRequest(item))
    .filter((item) => {
      if (filters?.budget && item.budget !== filters.budget) return false;
      if (filters?.goal) {
        const hay = `${item.category} ${item.tags.join(" ")} ${item.summary}`.toLowerCase();
        if (!hay.includes(filters.goal.toLowerCase())) return false;
      }
      return true;
    });
}

/** Single published business campaign/request for influencer campaign detail. */
export async function getPublishedBusinessRequest(
  id: string,
): Promise<MarketplaceBusinessRequestRow | null> {
  const requestId = id.trim();
  if (!requestId) return null;
  const row = await prisma.marketplaceBusinessRequest.findUnique({ where: { id: requestId } });
  if (!row || row.status !== "published") return null;
  const mapped = mapBusinessRequestRow(row);
  if (isLaunchSampleBusinessRequest(mapped)) return null;
  return mapped;
}

export async function listPublishedCreatorOpportunities(filters?: {
  specialty?: string;
  creatorSlugs?: string[];
}): Promise<MarketplaceCreatorOpportunityRow[]> {
  const rows = await prisma.marketplaceCreatorOpportunity.findMany({
    where: { status: "published" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return rows
    .map((row) => ({
      id: row.id,
      creatorSlug: row.creatorSlug,
      lookingFor: row.lookingFor,
      summary: row.summary,
      purpose: row.purpose,
      location: row.location,
      budget: row.budget,
      currency: row.currency,
      deliverableSummary: row.deliverableSummary,
      platforms: row.platforms,
      status: row.status,
      sortOrder: row.sortOrder,
    }))
    .filter((item) => !isLaunchSampleCreatorOpportunity(item))
    .filter((item) => {
      if (filters?.creatorSlugs && !filters.creatorSlugs.includes(item.creatorSlug)) return false;
      return true;
    });
}

export async function listAdminBusinessRequests() {
  return prisma.marketplaceBusinessRequest.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function listAdminCreatorOpportunities() {
  return prisma.marketplaceCreatorOpportunity.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function upsertBusinessRequest(input: {
  id?: string;
  brand: string;
  category: string;
  budget: string;
  location: string;
  tags: string[];
  summary: string;
  lookingFor: string;
  logoUrl?: string;
  imageUrl?: string;
  status: "draft" | "published" | "closed";
  sortOrder: number;
  /** Owning hub workspace; null clears ownership (admin catalog). */
  workspaceId?: string | null;
  briefId?: string | null;
  currency?: string | null;
  deliverableSummary?: string | null;
  platforms?: string[];
  applicationDeadline?: Date | null;
}) {
  const brand = input.brand.trim();
  const category = input.category.trim();
  const budget = input.budget.trim();
  const location = input.location.trim();
  const summary = input.summary.trim();
  const lookingFor = input.lookingFor.trim();
  if (!brand || !category || !budget || !location || !summary || !lookingFor) {
    throw new Error("Brand, category, budget, location, summary, and looking-for are required.");
  }
  if (input.id && isLaunchSampleBusinessRequest({ id: input.id, brand, summary })) {
    throw new Error(RETIRED_SAMPLE_SAVE);
  }
  const workspaceId =
    input.workspaceId === undefined
      ? undefined
      : input.workspaceId === null || input.workspaceId.trim() === ""
        ? null
        : input.workspaceId.trim();
  const data = {
    brand,
    category,
    budget,
    location,
    tags: input.tags,
    summary,
    lookingFor,
    logoUrl: input.logoUrl?.trim() || null,
    imageUrl: input.imageUrl?.trim() || null,
    status: input.status,
    sortOrder: Number.isFinite(input.sortOrder) ? input.sortOrder : 0,
    publishedAt: input.status === "published" ? new Date() : null,
    ...(workspaceId !== undefined ? { workspaceId } : {}),
    ...(input.briefId !== undefined ? { briefId: input.briefId?.trim() || null } : {}),
    ...(input.currency !== undefined ? { currency: (input.currency ?? "").trim().toUpperCase() } : {}),
    ...(input.deliverableSummary !== undefined ? { deliverableSummary: (input.deliverableSummary ?? "").trim() } : {}),
    ...(input.platforms !== undefined ? { platforms: input.platforms } : {}),
    ...(input.applicationDeadline !== undefined ? { applicationDeadline: input.applicationDeadline } : {}),
  };
  if (input.id) {
    return prisma.marketplaceBusinessRequest.update({ where: { id: input.id }, data });
  }
  return prisma.marketplaceBusinessRequest.create({ data });
}

export async function upsertCreatorOpportunity(input: {
  id?: string;
  creatorSlug: string;
  lookingFor: string;
  summary: string;
  purpose?: string;
  location?: string;
  status: "draft" | "published" | "closed";
  sortOrder: number;
}) {
  const creatorSlug = input.creatorSlug.trim();
  const lookingFor = input.lookingFor.trim();
  const summary = input.summary.trim();
  if (!creatorSlug || !lookingFor || !summary) {
    throw new Error("Influencer slug, looking-for, and summary are required.");
  }
  if (input.id && isLaunchSampleCreatorOpportunity({ id: input.id, creatorSlug, summary })) {
    throw new Error(RETIRED_SAMPLE_SAVE);
  }
  const data = {
    creatorSlug,
    lookingFor,
    summary,
    purpose: input.purpose?.trim() || null,
    location: input.location?.trim() || null,
    status: input.status,
    sortOrder: Number.isFinite(input.sortOrder) ? input.sortOrder : 0,
    publishedAt: input.status === "published" ? new Date() : null,
  };
  if (input.id) {
    return prisma.marketplaceCreatorOpportunity.update({ where: { id: input.id }, data });
  }
  return prisma.marketplaceCreatorOpportunity.create({ data });
}

export async function upsertMatchRecord(match: CreatorMatch, matchType = "CREATOR_CREATOR") {
  const [partyASlug, partyBSlug] = [match.a.slug, match.b.slug].sort();
  return prisma.marketplaceMatchRecord.upsert({
    where: {
      partyASlug_partyBSlug_matchType: { partyASlug, partyBSlug, matchType },
    },
    create: {
      matchType,
      partyASlug,
      partyBSlug,
      score: match.score,
      breakdownJson: match.breakdown,
      reasonsJson: match.reasons,
      why: match.why,
      specialtyHits: match.complementarySpecialties,
      modelVersion: "rules-v1",
    },
    update: {
      score: match.score,
      breakdownJson: match.breakdown,
      reasonsJson: match.reasons,
      why: match.why,
      specialtyHits: match.complementarySpecialties,
      modelVersion: "rules-v1",
    },
  });
}

export async function persistTopMatches(matches: CreatorMatch[], limit = 20) {
  const top = matches.slice(0, limit);
  for (const match of top) {
    await upsertMatchRecord(match);
  }
  return top.length;
}

export async function getTopPersistedMatch(): Promise<{
  partyASlug: string;
  partyBSlug: string;
  score: number;
  breakdown: MatchBreakdown;
  reasons: string[];
  why: string;
} | null> {
  const row = await prisma.marketplaceMatchRecord.findFirst({
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
  });
  if (!row) return null;
  return {
    partyASlug: row.partyASlug,
    partyBSlug: row.partyBSlug,
    score: row.score,
    breakdown: row.breakdownJson as MatchBreakdown,
    reasons: Array.isArray(row.reasonsJson) ? (row.reasonsJson as string[]) : [],
    why: row.why,
  };
}

/** A withdrawn application can be sent again. Every other status means this listing was already applied to. */
export function listingApplicationHidesApply(status: string): boolean {
  return status !== "WITHDRAWN";
}

export async function listSavedListings(userId: string) {
  const id = userId.trim();
  if (!id) return [];
  return prisma.savedMarketplaceListing.findMany({
    where: { userId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function toggleSavedListing(input: {
  userId: string;
  kind: "business_request" | "creator_opportunity";
  listingId: string;
}) {
  const listingId = input.listingId.trim();
  if (!input.userId.trim() || !listingId) return { saved: false as const };
  const where = {
    userId_kind_listingId: { userId: input.userId, kind: input.kind, listingId },
  };
  const existing = await prisma.savedMarketplaceListing.findUnique({ where });
  if (existing) {
    await prisma.savedMarketplaceListing.delete({ where: { id: existing.id } });
    return { saved: false as const };
  }
  await prisma.savedMarketplaceListing.create({
    data: { userId: input.userId, kind: input.kind, listingId },
  });
  return { saved: true as const };
}

/** Platforms named on a campaign that the applicant has not connected. */
export function missingVerifiedPlatforms(required: string[], connected: string[]) {
  const have = new Set(connected.map((item) => item.trim().toUpperCase()).filter(Boolean));
  return [
    ...new Set(required.map((item) => item.trim().toUpperCase()).filter((item) => item && !have.has(item))),
  ];
}

async function assertVerifiedChannels(slug: string, platforms: string[]) {
  if (missingVerifiedPlatforms(platforms, []).length === 0) return;
  const creator = await prisma.creator.findUnique({
    where: { slug },
    select: { socialConnections: { where: { status: "connected" }, select: { platform: true } } },
  });
  const missing = missingVerifiedPlatforms(
    platforms,
    (creator?.socialConnections ?? []).map((row) => row.platform),
  );
  if (missing.length === 0) return;
  throw new Error(
    `This campaign requires a verified ${missing.join(", ")} channel. Connect that account from your dashboard before applying. Nothing was submitted.`,
  );
}

export async function createMarketplaceApplication(input: {
  kind: "business_request" | "creator_opportunity";
  businessRequestId?: string;
  opportunityId?: string;
  fromUserId?: string;
  fromSlug?: string;
  toSlug?: string;
  note?: string;
  briefId?: string;
  offerText?: string;
  deliverables?: string;
  responseDeadline?: Date | null;
  /** Recorded on the creation event. Not used as the invitee's identity. */
  actorUserId?: string;
}) {
  const invitation = Boolean(input.toSlug?.trim()) && !input.fromSlug?.trim();
  if (input.kind === "business_request" && !input.businessRequestId && !(invitation && input.briefId?.trim())) {
    throw new Error("businessRequestId is required.");
  }
  if (input.kind === "creator_opportunity" && !input.opportunityId) {
    throw new Error("opportunityId is required.");
  }
  let requiredPlatforms: string[] = [];
  if (input.kind === "business_request" && input.businessRequestId) {
    const request = await prisma.marketplaceBusinessRequest.findUnique({
      where: { id: input.businessRequestId },
      select: { status: true, briefId: true, platforms: true },
    });
    if (!request || request.status !== "published") {
      throw new Error("Business request must be published before applying or inviting.");
    }
    requiredPlatforms = request.platforms ?? [];
    input = { ...input, briefId: input.briefId ?? request.briefId ?? undefined };
  }
  if (input.kind === "creator_opportunity" && input.opportunityId) {
    const opportunity = await prisma.marketplaceCreatorOpportunity.findUnique({
      where: { id: input.opportunityId },
      select: { status: true },
    });
    if (!opportunity || opportunity.status !== "published") {
      throw new Error("Creator opportunity must be published before connecting.");
    }
  }
  if (!invitation && input.fromSlug && requiredPlatforms.length > 0) {
    await assertVerifiedChannels(input.fromSlug, requiredPlatforms);
  }
  if (invitation) {
    const existing = await prisma.marketplaceApplication.findFirst({
      where: {
        kind: input.kind,
        toSlug: input.toSlug,
        fromSlug: null,
        status: { notIn: ["WITHDRAWN", "DECLINED", "EXPIRED"] },
        ...(input.businessRequestId
          ? { businessRequestId: input.businessRequestId }
          : { briefId: input.briefId ?? null }),
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing;
  } else if (input.fromUserId || input.fromSlug) {
    const existing = await prisma.marketplaceApplication.findFirst({
      where: {
        kind: input.kind,
        ...(input.kind === "business_request"
          ? { businessRequestId: input.businessRequestId }
          : { opportunityId: input.opportunityId }),
        status: { not: "WITHDRAWN" },
        OR: [
          ...(input.fromUserId ? [{ fromUserId: input.fromUserId }] : []),
          ...(input.fromSlug ? [{ fromSlug: input.fromSlug }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing;
  }
  return prisma.$transaction(async (tx) => {
    const row = await tx.marketplaceApplication.create({
      data: {
        kind: input.kind,
        businessRequestId: input.businessRequestId,
        opportunityId: input.opportunityId,
        fromUserId: invitation ? null : input.fromUserId,
        fromSlug: input.fromSlug,
        toSlug: input.toSlug,
        briefId: input.briefId?.trim() || null,
        status: "REQUESTED",
        note: input.note?.trim() || null,
        offerText: (input.offerText ?? "").trim(),
        deliverables: (input.deliverables ?? "").trim(),
        responseDeadline: input.responseDeadline ?? null,
      },
    });
    await tx.marketplaceApplicationEvent.create({
      data: {
        applicationId: row.id,
        fromStatus: null,
        toStatus: "REQUESTED",
        actorUserId: input.actorUserId ?? input.fromUserId,
        note: invitation ? "Invitation sent" : "Application created",
      },
    });
    return row;
  });
}

/**
 * One campaign, one private invitation per influencer.
 * Accepting or declining one row does not change any other row.
 */
export async function inviteCreatorsIndependently(input: {
  workspaceId: string;
  actorUserId: string;
  creatorSlugs: string[];
  requestId?: string;
  briefId?: string;
  offerText?: string;
  deliverables?: string;
  responseDeadline?: Date | null;
  note?: string;
}): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const slugs = [...new Set(input.creatorSlugs.map((slug) => slug.trim()).filter(Boolean))];
  if (!slugs.length) return { ok: false, error: "Choose at least one influencer." };
  const workspaceId = input.workspaceId.trim();
  if (!workspaceId || workspaceId === "public") {
    return { ok: false, error: "Sign in with a business workspace." };
  }

  let requestId = input.requestId?.trim() || "";
  let briefId = input.briefId?.trim() || "";
  if (requestId) {
    const request = await prisma.marketplaceBusinessRequest.findUnique({ where: { id: requestId } });
    if (!request || request.workspaceId !== workspaceId) {
      return { ok: false, error: "That campaign is not on this workspace." };
    }
    if (request.status !== "published") {
      return { ok: false, error: "Publish the campaign before inviting influencers." };
    }
    briefId = briefId || request.briefId || "";
  } else if (briefId) {
    const brief = await prisma.businessBrief.findUnique({ where: { id: briefId } });
    if (!brief || brief.workspaceId !== workspaceId) {
      return { ok: false, error: "That campaign is not on this workspace." };
    }
    const request = await prisma.marketplaceBusinessRequest.findFirst({
      where: { workspaceId, briefId, status: "published" },
      orderBy: { createdAt: "desc" },
    });
    requestId = request?.id ?? "";
  } else {
    return { ok: false, error: "Save a campaign before inviting influencers." };
  }

  const ids: string[] = [];
  for (const toSlug of slugs) {
    const row = await createMarketplaceApplication({
      kind: "business_request",
      businessRequestId: requestId || undefined,
      briefId: briefId || undefined,
      toSlug,
      note: input.note,
      offerText: input.offerText,
      deliverables: input.deliverables,
      responseDeadline: input.responseDeadline,
      actorUserId: input.actorUserId,
    });
    ids.push(row.id);
  }
  return { ok: true, ids };
}

/** A creator may receive only the invitation or application that names them. */
export function invitationsVisibleTo<T extends { toSlug?: string | null; fromSlug?: string | null }>(
  rows: T[],
  creatorSlug: string,
): T[] {
  const slug = creatorSlug.trim();
  if (!slug) return [];
  return rows.filter((row) => row.toSlug === slug || row.fromSlug === slug);
}

export async function transitionMarketplaceApplication(input: {
  id: string;
  toStatus: MarketplaceApplicationStatus;
  actorUserId?: string;
  note?: string;
}) {
  const row = await prisma.marketplaceApplication.findUnique({ where: { id: input.id } });
  if (!row) throw new Error("Application not found.");
  if (!isApplicationStatus(row.status)) throw new Error(`Unknown status ${row.status}`);
  const allowed = APPLICATION_TRANSITIONS[row.status];
  if (!allowed.includes(input.toStatus)) {
    throw new Error(`Cannot move application from ${row.status} to ${input.toStatus}.`);
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.marketplaceApplication.update({
      where: { id: input.id },
      data: { status: input.toStatus },
    });
    await tx.marketplaceApplicationEvent.create({
      data: {
        applicationId: input.id,
        fromStatus: row.status,
        toStatus: input.toStatus,
        actorUserId: input.actorUserId,
        note: input.note?.trim() || null,
      },
    });
    const plan = applicationLinkPlan({
      id: updated.id,
      status: updated.status,
      collaborationId: updated.collaborationId,
      fromSlug: updated.fromSlug,
      toSlug: updated.toSlug,
    });
    if (plan !== "create" || !updated.fromSlug || !updated.toSlug) return updated;
    const collab = await tx.collaboration.create({
      data: {
        initiatorSlug: updated.fromSlug,
        recipientSlug: updated.toSlug,
        initiatorUserId: input.actorUserId ?? null,
        title: (updated.note || "Accepted application").slice(0, 160),
        scope: "Per accepted application",
        roleInitiator: "Initiator",
        roleRecipient: "Recipient",
        commercial: "",
        status: "accepted",
        why: "",
        reasons: [],
        score: 0,
        decidedAt: new Date(),
        decidedByUserId: input.actorUserId ?? null,
        events: {
          create: {
            fromStatus: null,
            toStatus: "accepted",
            actorUserId: input.actorUserId ?? null,
            note: `application:${updated.id}`,
          },
        },
      },
    });
    return tx.marketplaceApplication.update({
      where: { id: updated.id },
      data: { collaborationId: collab.id },
    });
  });
}

export function canTransitionApplication(from: string, to: string): boolean {
  if (!isApplicationStatus(from) || !isApplicationStatus(to)) return false;
  return APPLICATION_TRANSITIONS[from].includes(to);
}

/** Allowed next statuses from the Collab OS §4.3 state machine. */
export function nextApplicationStatuses(from: string): MarketplaceApplicationStatus[] {
  if (!isApplicationStatus(from)) return [];
  return [...APPLICATION_TRANSITIONS[from]];
}

/**
 * Whether this row is a business→creator invitation.
 * A creator application always stores fromSlug, including when toSlug names the other party.
 * An invitation stores only toSlug.
 */
export function applicationIsInvitation(application: {
  fromSlug?: string | null;
  toSlug?: string | null;
}): boolean {
  const to = (application.toSlug ?? "").trim();
  const from = (application.fromSlug ?? "").trim();
  return Boolean(to) && !from;
}

/**
 * An accepted application still needs a contract when no live agreement names that creator.
 */
export function acceptedWorkNeedsContract(
  application: { status: string; fromSlug?: string | null; toSlug?: string | null },
  contracts: { status?: string | null; parties: { creatorSlug?: string | null }[] }[],
): boolean {
  if (application.status !== "ACCEPTED" && application.status !== "COLLABORATION_DRAFTED") return false;
  const slug = (application.fromSlug || application.toSlug || "").trim();
  if (!slug) return true;
  return !contracts.some((document) => {
    if (document.status === "voided" || document.status === "declined") return false;
    return document.parties.some((party) => (party.creatorSlug ?? "").trim() === slug);
  });
}

/** Creator role on an application they own. */
export function creatorApplicationRole(
  application: { fromSlug?: string | null; toSlug?: string | null },
  creatorSlug: string,
): "applicant" | "invitee" | null {
  const slug = creatorSlug.trim();
  if (!slug) return null;
  if (application.fromSlug === slug) return "applicant";
  if (application.toSlug === slug) return "invitee";
  return null;
}

/**
 * Statuses a business may advance from the application detail page.
 * VIEWED is applied automatically when the business opens the detail — not a button.
 */
export function businessApplicationTransitions(from: string): MarketplaceApplicationStatus[] {
  return nextApplicationStatuses(from).filter((status) => status !== "VIEWED");
}

/**
 * Statuses a creator may advance from the application detail page.
 * Invitees must open the detail (auto-VIEWED) before Accept/Decline appear.
 * Applicants may only withdraw their own submission.
 */
export function creatorApplicationTransitions(
  from: string,
  role: "applicant" | "invitee",
): MarketplaceApplicationStatus[] {
  const next = nextApplicationStatuses(from);
  if (role === "applicant") {
    return next.filter((status) => status === "WITHDRAWN");
  }
  // Invitee: no business-ops transitions; Accept/Decline only after the invite was opened (VIEWED+).
  if (from === "REQUESTED") return [];
  return next.filter(
    (status) =>
      status === "ACCEPTED" ||
      status === "DECLINED" ||
      status === "WITHDRAWN" ||
      status === "NEGOTIATING",
  );
}

/** Human-readable kind for list/detail chrome. */
export function applicationKindLabel(application: {
  fromSlug?: string | null;
  toSlug?: string | null;
  kind?: string | null;
}): string {
  if (applicationIsInvitation(application)) return "Invitation";
  if (application.kind === "creator_opportunity") return "Opportunity application";
  return "Campaign application";
}

/** Open statuses that still belong under “invitations / applications” lists. */
export function applicationIsOpenPipeline(status: string): boolean {
  return (
    status === "REQUESTED" ||
    status === "VIEWED" ||
    status === "RESPONDED" ||
    status === "NEGOTIATING"
  );
}

/** Accepted / drafted — no longer an “invite”; show under progressing collaborations. */
export function applicationIsAcceptedPipeline(status: string): boolean {
  return status === "ACCEPTED" || status === "COLLABORATION_DRAFTED";
}

/** Pure — workspace owns a request only via durable workspaceId (not brand substring). */
export function isWorkspaceOwnedRequest(
  request: { workspaceId?: string | null },
  workspaceId: string,
): boolean {
  const owned = workspaceId.trim();
  if (!owned) return false;
  return (request.workspaceId ?? "").trim() === owned;
}

/** @deprecated Brand substring is not used for product auth — prefer isWorkspaceOwnedRequest. */
export function isWorkspaceOwnedRequestBrand(brand: string, workspaceName: string): boolean {
  const b = brand.trim().toLowerCase();
  const w = workspaceName.trim().toLowerCase();
  if (!b || !w) return false;
  return b === w || b.includes(w.slice(0, Math.min(8, w.length)));
}

/** Pure — creator party on either side of the application. */
export function creatorOwnsApplication(
  application: { fromSlug?: string | null; toSlug?: string | null },
  creatorSlug: string,
): boolean {
  const slug = creatorSlug.trim();
  if (!slug) return false;
  return application.fromSlug === slug || application.toSlug === slug;
}

/** Pure — business may manage when the application sits on an owned request id. */
export function businessOwnsApplication(
  application: { businessRequestId?: string | null; briefId?: string | null },
  ownedRequestIds: string[],
  ownedBriefIds: string[] = [],
): boolean {
  const requestId = application.businessRequestId?.trim();
  if (requestId && ownedRequestIds.includes(requestId)) return true;
  const briefId = application.briefId?.trim();
  if (briefId && ownedBriefIds.includes(briefId)) return true;
  return false;
}

export async function listWorkspaceBusinessRequests(workspaceId: string): Promise<MarketplaceBusinessRequestRow[]> {
  const id = workspaceId.trim();
  if (!id) return [];
  const rows = await prisma.marketplaceBusinessRequest.findMany({
    where: { workspaceId: id, status: "published" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => mapBusinessRequestRow(row));
}

export type MarketplaceApplicationEventRow = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorUserId: string | null;
  note: string | null;
  createdAt: string;
};

export type MarketplaceApplicationRow = {
  id: string;
  kind: string;
  businessRequestId: string | null;
  opportunityId: string | null;
  fromUserId: string | null;
  fromSlug: string | null;
  toSlug: string | null;
  briefId: string | null;
  collaborationId: string | null;
  status: MarketplaceApplicationStatus;
  note: string | null;
  offerText: string;
  deliverables: string;
  responseDeadline: string | null;
  createdAt: string;
  /** Creator slug on either side of the application. */
  creatorSlug: string | null;
  requestBrand: string | null;
  requestBudget: string | null;
  requestCurrency: string | null;
  requestSummary: string | null;
  requestBriefId: string | null;
  requestDeliverables: string | null;
  opportunityLookingFor: string | null;
  nextStatuses: MarketplaceApplicationStatus[];
  events: MarketplaceApplicationEventRow[];
};

function mapApplication(row: {
  id: string;
  kind: string;
  businessRequestId: string | null;
  opportunityId: string | null;
  fromUserId: string | null;
  fromSlug: string | null;
  toSlug: string | null;
  briefId?: string | null;
  collaborationId?: string | null;
  offerText?: string | null;
  deliverables?: string | null;
  responseDeadline?: Date | null;
  status: string;
  note: string | null;
  createdAt: Date;
  businessRequest?: {
    brand: string;
    budget?: string | null;
    currency?: string | null;
    summary?: string | null;
    briefId?: string | null;
    deliverableSummary?: string | null;
  } | null;
  opportunity?: { lookingFor: string } | null;
  events?: {
    id: string;
    fromStatus: string | null;
    toStatus: string;
    actorUserId: string | null;
    note: string | null;
    createdAt: Date;
  }[];
}): MarketplaceApplicationRow {
  const status = isApplicationStatus(row.status) ? row.status : "REQUESTED";
  const creatorSlug = row.fromSlug || row.toSlug || null;
  return {
    id: row.id,
    kind: row.kind,
    businessRequestId: row.businessRequestId,
    opportunityId: row.opportunityId,
    fromUserId: row.fromUserId,
    fromSlug: row.fromSlug,
    toSlug: row.toSlug,
    briefId: row.briefId ?? null,
    collaborationId: row.collaborationId ?? null,
    status,
    note: row.note,
    offerText: row.offerText ?? "",
    deliverables: row.deliverables ?? "",
    responseDeadline: row.responseDeadline ? row.responseDeadline.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    creatorSlug,
    requestBrand: row.businessRequest?.brand ?? null,
    requestBudget: row.businessRequest?.budget ?? null,
    requestCurrency: row.businessRequest?.currency ?? null,
    requestSummary: row.businessRequest?.summary ?? null,
    requestBriefId: row.businessRequest?.briefId ?? null,
    requestDeliverables: row.businessRequest?.deliverableSummary ?? null,
    opportunityLookingFor: row.opportunity?.lookingFor ?? null,
    nextStatuses: nextApplicationStatuses(status),
    events: (row.events ?? []).map((event) => ({
      id: event.id,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      actorUserId: event.actorUserId,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export async function getMarketplaceApplication(id: string): Promise<MarketplaceApplicationRow | null> {
  const row = await prisma.marketplaceApplication.findUnique({
    where: { id },
    include: {
      businessRequest: {
        select: {
          brand: true,
          summary: true,
          lookingFor: true,
          budget: true,
          location: true,
          category: true,
          logoUrl: true,
          imageUrl: true,
          workspaceId: true,
          status: true,
          currency: true,
          briefId: true,
          deliverableSummary: true,
        },
      },
      opportunity: { select: { lookingFor: true, summary: true, creatorSlug: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  return row ? mapApplication(row) : null;
}

export type MarketplaceApplicationDetail = MarketplaceApplicationRow & {
  requestSummary: string | null;
  requestLookingFor: string | null;
  requestBudget: string | null;
  requestLocation: string | null;
  requestCategory: string | null;
  requestLogoUrl: string | null;
  requestImageUrl: string | null;
  requestWorkspaceId: string | null;
  requestCurrency: string | null;
  opportunitySummary: string | null;
};

/** Full detail payload for the application review page. */
export async function getMarketplaceApplicationDetail(
  id: string,
): Promise<MarketplaceApplicationDetail | null> {
  const row = await prisma.marketplaceApplication.findUnique({
    where: { id },
    include: {
      businessRequest: {
        select: {
          brand: true,
          summary: true,
          lookingFor: true,
          budget: true,
          location: true,
          category: true,
          logoUrl: true,
          imageUrl: true,
          workspaceId: true,
          currency: true,
          briefId: true,
          deliverableSummary: true,
        },
      },
      opportunity: { select: { lookingFor: true, summary: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) return null;
  const base = mapApplication(row);
  return {
    ...base,
    requestSummary: row.businessRequest?.summary ?? null,
    requestLookingFor: row.businessRequest?.lookingFor ?? null,
    requestBudget: row.businessRequest?.budget ?? null,
    requestLocation: row.businessRequest?.location ?? null,
    requestCategory: row.businessRequest?.category ?? null,
    requestLogoUrl: row.businessRequest?.logoUrl ?? null,
    requestImageUrl: row.businessRequest?.imageUrl ?? null,
    requestWorkspaceId: row.businessRequest?.workspaceId ?? null,
    requestCurrency: row.businessRequest?.currency ?? null,
    opportunitySummary: row.opportunity?.summary ?? null,
  };
}

export async function listMarketplaceApplications(input?: {
  businessRequestIds?: string[];
  briefIds?: string[];
  creatorSlug?: string;
  opportunityIds?: string[];
  limit?: number;
}): Promise<MarketplaceApplicationRow[]> {
  const clauses: Record<string, unknown>[] = [];
  const campaign: Record<string, unknown>[] = [];
  if (input?.businessRequestIds?.length) {
    campaign.push({ businessRequestId: { in: input.businessRequestIds } });
  }
  if (input?.briefIds?.length) {
    campaign.push({ briefId: { in: input.briefIds } });
  }
  if (campaign.length === 1) clauses.push(campaign[0]!);
  if (campaign.length > 1) clauses.push({ OR: campaign });
  if (input?.opportunityIds?.length) {
    clauses.push({ opportunityId: { in: input.opportunityIds } });
  }
  if (input?.creatorSlug) {
    clauses.push({
      OR: [{ fromSlug: input.creatorSlug }, { toSlug: input.creatorSlug }],
    });
  }
  const rows = await prisma.marketplaceApplication.findMany({
    where: clauses.length ? { AND: clauses } : undefined,
    include: {
      businessRequest: {
        select: { brand: true, budget: true, currency: true, summary: true, briefId: true, deliverableSummary: true },
      },
      opportunity: { select: { lookingFor: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: input?.limit ?? 40,
  });
  const mapped = rows.map(mapApplication);
  return input?.creatorSlug ? invitationsVisibleTo(mapped, input.creatorSlug) : mapped;
}

/** Accepted requests for one influencer on this workspace, newest first. */
export async function acceptedContractChoices(input: {
  creatorSlug?: string;
  businessRequestIds: string[];
  briefIds: string[];
}): Promise<MarketplaceApplicationRow[]> {
  const slug = input.creatorSlug?.trim();
  if (!slug || (!input.businessRequestIds.length && !input.briefIds.length)) return [];
  const rows = await listMarketplaceApplications({
    businessRequestIds: input.businessRequestIds,
    briefIds: input.briefIds,
    limit: 40,
  });
  return rows.filter(
    (row) =>
      row.creatorSlug === slug &&
      (row.status === "ACCEPTED" || row.status === "COLLABORATION_DRAFTED"),
  );
}

/**
 * The request a contract should copy.
 * A chosen application wins. Otherwise the newest accepted request for that influencer.
 */
export async function applicationForContract(input: {
  applicationId?: string;
  creatorSlug?: string;
  businessRequestIds: string[];
  briefIds: string[];
}): Promise<MarketplaceApplicationDetail | null> {
  const requestIds = input.businessRequestIds;
  const briefIds = input.briefIds;
  const owns = (row: { businessRequestId?: string | null; briefId?: string | null }) =>
    businessOwnsApplication(row, requestIds, briefIds);
  const id = input.applicationId?.trim();
  if (id) {
    const row = await getMarketplaceApplicationDetail(id);
    if (row && owns(row)) return row;
  }
  const slug = input.creatorSlug?.trim();
  if (!slug || (!requestIds.length && !briefIds.length)) return null;
  const rows = await listMarketplaceApplications({
    businessRequestIds: requestIds,
    briefIds,
    limit: 40,
  });
  const match = rows.find(
    (row) =>
      row.creatorSlug === slug &&
      (row.status === "ACCEPTED" || row.status === "COLLABORATION_DRAFTED"),
  );
  return match ? getMarketplaceApplicationDetail(match.id) : null;
}

/** Human labels for hub transition buttons. */
export function applicationTransitionLabel(status: MarketplaceApplicationStatus): string {
  switch (status) {
    case "VIEWED":
      return "Mark viewed";
    case "RESPONDED":
      return "Mark responded";
    case "NEGOTIATING":
      return "Enter negotiation";
    case "ACCEPTED":
      return "Accept";
    case "COLLABORATION_DRAFTED":
      return "Set up collaboration";
    case "DECLINED":
      return "Decline";
    case "EXPIRED":
      return "Mark expired";
    case "WITHDRAWN":
      return "Withdraw";
    default:
      return status;
  }
}

const AUTO_EXPIREABLE_STATUSES: MarketplaceApplicationStatus[] = [
  "REQUESTED",
  "VIEWED",
  "RESPONDED",
  "NEGOTIATING",
];

/** Pure — whether an open application is past the admin auto-expire window. */
export function applicationIsStaleForExpire(input: {
  createdAt: Date | string;
  afterDays: number;
  now?: Date;
}): boolean {
  const days = Number.isFinite(input.afterDays) ? Math.max(1, Math.floor(input.afterDays)) : 14;
  const created = input.createdAt instanceof Date ? input.createdAt : new Date(input.createdAt);
  if (Number.isNaN(created.getTime())) return false;
  const now = input.now ?? new Date();
  const ageMs = now.getTime() - created.getTime();
  return ageMs >= days * 24 * 60 * 60 * 1000;
}

/**
 * W2.3c — when control plane mode is `auto`, expire stale open applications.
 * Manual mode is a no-op (ops use hub EXPIRED buttons).
 */
export async function sweepExpiredMarketplaceApplications(now = new Date()) {
  const { getCollabControlPlane } = await import("@/lib/collab-control-plane");
  const plane = await getCollabControlPlane();
  if (plane.applicationExpire.mode !== "auto") {
    return { mode: "manual" as const, scanned: 0, expired: 0 };
  }
  const afterDays = plane.applicationExpire.afterDays;
  const cutoff = new Date(now.getTime() - afterDays * 24 * 60 * 60 * 1000);
  const candidates = await prisma.marketplaceApplication.findMany({
    where: {
      status: { in: AUTO_EXPIREABLE_STATUSES },
      createdAt: { lte: cutoff },
    },
    take: 100,
    orderBy: { createdAt: "asc" },
  });
  let expired = 0;
  for (const row of candidates) {
    if (!applicationIsStaleForExpire({ createdAt: row.createdAt, afterDays, now })) continue;
    if (!canTransitionApplication(row.status, "EXPIRED")) continue;
    await transitionMarketplaceApplication({
      id: row.id,
      toStatus: "EXPIRED",
      note: `Auto-expired after ${afterDays} day(s) (admin control plane).`,
    });
    expired += 1;
  }
  return { mode: "auto" as const, scanned: candidates.length, expired };
}

/** Persist a scored match and attach a per-user save bookmark. */
export async function saveMatchForUser(input: {
  match: CreatorMatch;
  userId: string;
}) {
  const record = await upsertMatchRecord(input.match);
  const existing = await prisma.marketplaceMatchSave.findFirst({
    where: { matchId: record.id, userId: input.userId },
  });
  if (existing) return { matchId: record.id, saveId: existing.id, created: false };
  const save = await prisma.marketplaceMatchSave.create({
    data: { matchId: record.id, userId: input.userId },
  });
  return { matchId: record.id, saveId: save.id, created: true };
}
