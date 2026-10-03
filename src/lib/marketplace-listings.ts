/**
 * Collaboration OS P1b — marketplace listings (business requests, creator opportunities,
 * persisted match records, and application state machine).
 */
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
  VIEWED: ["RESPONDED", "DECLINED", "EXPIRED", "WITHDRAWN"],
  RESPONDED: ["NEGOTIATING", "ACCEPTED", "DECLINED", "EXPIRED", "WITHDRAWN"],
  NEGOTIATING: ["ACCEPTED", "DECLINED", "EXPIRED", "WITHDRAWN"],
  ACCEPTED: ["COLLABORATION_DRAFTED", "WITHDRAWN"],
  COLLABORATION_DRAFTED: [],
  DECLINED: [],
  EXPIRED: [],
  WITHDRAWN: [],
};

const BRAND_DEMO_ART: Record<string, { logoUrl: string; imageUrl: string }> = {
  "Lumina Beauty Co.": {
    logoUrl: "/demo/brands/sephora.svg",
    imageUrl: "/demo/categories/cat-beauty.jpg",
  },
  WanderStay: {
    logoUrl: "/demo/brands/airbnb.svg",
    imageUrl: "/demo/categories/cat-travel.jpg",
  },
  "NexHome Tech": {
    logoUrl: "/demo/brands/samsung.svg",
    imageUrl: "/demo/categories/cat-tech.jpg",
  },
};

export type MarketplaceBusinessRequestRow = BusinessRequest & {
  logoUrl?: string | null;
  imageUrl?: string | null;
  status: string;
  sortOrder: number;
};

export type MarketplaceCreatorOpportunityRow = CreatorOpportunity & {
  purpose?: string | null;
  location?: string | null;
  status: string;
  sortOrder: number;
};

function isApplicationStatus(value: string): value is MarketplaceApplicationStatus {
  return (MARKETPLACE_APPLICATION_STATUSES as readonly string[]).includes(value);
}

/** Seed demo marketplace listings once when tables are empty. */
export async function ensureMarketplaceListings() {
  const [requestCount, opportunityCount] = await Promise.all([
    prisma.marketplaceBusinessRequest.count(),
    prisma.marketplaceCreatorOpportunity.count(),
  ]);

  if (requestCount === 0) {
    await prisma.marketplaceBusinessRequest.createMany({
      data: BUSINESS_REQUESTS.map((item, index) => {
        const art = BRAND_DEMO_ART[item.brand];
        return {
          id: item.id,
          brand: item.brand,
          category: item.category,
          budget: item.budget,
          location: item.location,
          tags: item.tags,
          summary: item.summary,
          lookingFor: item.lookingFor,
          logoUrl: art?.logoUrl,
          imageUrl: art?.imageUrl,
          status: "published",
          sortOrder: index,
          publishedAt: new Date(),
        };
      }),
    });
  }

  if (opportunityCount === 0) {
    await prisma.marketplaceCreatorOpportunity.createMany({
      data: CREATOR_OPPORTUNITIES.map((item, index) => ({
        id: item.id,
        creatorSlug: item.creatorSlug,
        lookingFor: item.lookingFor,
        summary: item.summary,
        status: "published",
        sortOrder: index,
        publishedAt: new Date(),
      })),
    });
  }
}

export async function listPublishedBusinessRequests(filters?: {
  budget?: string;
  goal?: string;
}): Promise<MarketplaceBusinessRequestRow[]> {
  await ensureMarketplaceListings();
  const rows = await prisma.marketplaceBusinessRequest.findMany({
    where: { status: "published" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return rows
    .map((row) => ({
      id: row.id,
      brand: row.brand,
      category: row.category,
      budget: row.budget,
      location: row.location,
      tags: row.tags,
      summary: row.summary,
      lookingFor: row.lookingFor,
      logoUrl: row.logoUrl,
      imageUrl: row.imageUrl,
      status: row.status,
      sortOrder: row.sortOrder,
    }))
    .filter((item) => {
      if (filters?.budget && item.budget !== filters.budget) return false;
      if (filters?.goal) {
        const hay = `${item.category} ${item.tags.join(" ")} ${item.summary}`.toLowerCase();
        if (!hay.includes(filters.goal.toLowerCase())) return false;
      }
      return true;
    });
}

export async function listPublishedCreatorOpportunities(filters?: {
  specialty?: string;
  creatorSlugs?: string[];
}): Promise<MarketplaceCreatorOpportunityRow[]> {
  await ensureMarketplaceListings();
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
      status: row.status,
      sortOrder: row.sortOrder,
    }))
    .filter((item) => {
      if (filters?.creatorSlugs && !filters.creatorSlugs.includes(item.creatorSlug)) return false;
      return true;
    });
}

export async function listAdminBusinessRequests() {
  await ensureMarketplaceListings();
  return prisma.marketplaceBusinessRequest.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function listAdminCreatorOpportunities() {
  await ensureMarketplaceListings();
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
    throw new Error("Creator slug, looking-for, and summary are required.");
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

export async function createMarketplaceApplication(input: {
  kind: "business_request" | "creator_opportunity";
  businessRequestId?: string;
  opportunityId?: string;
  fromUserId?: string;
  fromSlug?: string;
  toSlug?: string;
  note?: string;
}) {
  if (input.kind === "business_request" && !input.businessRequestId) {
    throw new Error("businessRequestId is required.");
  }
  if (input.kind === "creator_opportunity" && !input.opportunityId) {
    throw new Error("opportunityId is required.");
  }
  return prisma.$transaction(async (tx) => {
    const row = await tx.marketplaceApplication.create({
      data: {
        kind: input.kind,
        businessRequestId: input.businessRequestId,
        opportunityId: input.opportunityId,
        fromUserId: input.fromUserId,
        fromSlug: input.fromSlug,
        toSlug: input.toSlug,
        status: "REQUESTED",
        note: input.note?.trim() || null,
      },
    });
    await tx.marketplaceApplicationEvent.create({
      data: {
        applicationId: row.id,
        fromStatus: null,
        toStatus: "REQUESTED",
        actorUserId: input.fromUserId,
        note: "Application created",
      },
    });
    return row;
  });
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
    return updated;
  });
}

export function canTransitionApplication(from: string, to: string): boolean {
  if (!isApplicationStatus(from) || !isApplicationStatus(to)) return false;
  return APPLICATION_TRANSITIONS[from].includes(to);
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
