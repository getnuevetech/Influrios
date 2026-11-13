/**
 * Agency workspace, roster, campaigns, and joint portfolios.
 * A campaign or portfolio stores the specialty, budget, and metrics that were entered.
 */
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import {
  campaignStatusTransition,
  isolatedCreatorLinks,
  type CampaignRecordFact,
} from "@/lib/agency-context";
import { directoryHasCreator } from "@/lib/directory";
import { productSwitch } from "@/lib/product-switches";

export type RosterMember = {
  creatorSlug: string;
  role: "talent" | "lead" | "specialist";
  retainerLabel: string;
  notes: string;
  addedAt: string;
};

export type AgencyCampaign = {
  id: string;
  title: string;
  clientName: string;
  clientId: string | null;
  status: "briefing" | "casting" | "live" | "wrapped";
  specialty: string;
  budgetLabel: string;
  creatorSlugs: string[];
  summary: string;
  createdAt: string;
  updatedAt: string;
};

export type JointPortfolio = {
  id: string;
  title: string;
  tagline: string;
  leftSlug: string;
  rightSlug: string;
  specialty: string;
  outcome: string;
  metrics: { label: string; value: string }[];
  campaignId?: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AgencyStore = {
  agencyId: string;
  name: string;
  plan: "AGENCY";
  notes: string;
  roster: RosterMember[];
  campaigns: AgencyCampaign[];
  portfolios: JointPortfolio[];
};

const now = () => new Date().toISOString();

/** Stable id for the agency workspace owned by a member account. */
export function agencyWorkspaceIdForOwner(ownerUserId: string) {
  return `agency_owner_${ownerUserId}`.slice(0, 64);
}

function resolveWorkspaceId(workspaceId?: string | null) {
  const id = (workspaceId ?? "").trim().slice(0, 64);
  if (!id) throw new Error("Agency workspace is required.");
  return id;
}

function emptyStore(): AgencyStore {
  return {
    agencyId: "",
    name: "Agency",
    plan: "AGENCY",
    notes: "",
    roster: [],
    campaigns: [],
    portfolios: [],
  };
}

function asStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function parsePortfolioMetricLines(raw: string) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const [label, value] = line.split("|").map((part) => part.trim());
      if (!label || !value || value === "—") return [];
      return [{ label, value }];
    });
}

function asMetrics(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const label = "label" in item ? String(item.label).trim() : "";
    const metric = "value" in item ? String(item.value).trim() : "";
    if (!label || !metric || metric === "—") return [];
    return [{ label, value: metric }];
  });
}

async function ensureWorkspace(workspaceId: string) {
  const id = resolveWorkspaceId(workspaceId);
  const existing = await prisma.agencyWorkspace.findUnique({ where: { id } });
  if (existing) return existing;
  try {
    return await prisma.agencyWorkspace.create({
      data: {
        id,
        name: "Agency",
        plan: "AGENCY",
        notes: "",
      },
    });
  } catch (error) {
    if (!isUnique(error)) throw error;
    return prisma.agencyWorkspace.findUniqueOrThrow({ where: { id } });
  }
}

function isUnique(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && String(error.code) === "P2002";
}

async function ensureStore(workspaceId: string): Promise<AgencyStore> {
  const id = resolveWorkspaceId(workspaceId);
  await ensureWorkspace(id);
  const row = await prisma.agencyWorkspace.findUniqueOrThrow({
    where: { id },
    include: {
      roster: { orderBy: { addedAt: "desc" } },
      campaigns: { orderBy: { createdAt: "desc" } },
      portfolios: { orderBy: { createdAt: "desc" } },
    },
  });
  return {
    agencyId: row.id,
    name: row.name,
    plan: "AGENCY",
    notes: row.notes,
    roster: row.roster.map((member) => ({
      creatorSlug: member.creatorSlug,
      role: member.role === "lead" || member.role === "specialist" ? member.role : "talent",
      retainerLabel: member.retainerLabel,
      notes: member.notes,
      addedAt: member.addedAt.toISOString(),
    })),
    campaigns: row.campaigns.map((campaign) => ({
      id: campaign.id,
      title: campaign.title,
      clientName: campaign.clientName,
      clientId: campaign.clientId,
      status: campaign.status === "casting" || campaign.status === "live" || campaign.status === "wrapped" ? campaign.status : "briefing",
      specialty: campaign.specialty,
      budgetLabel: campaign.budgetLabel,
      creatorSlugs: asStringList(campaign.creatorSlugs),
      summary: campaign.summary,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    })),
    portfolios: row.portfolios.map((portfolio) => ({
      id: portfolio.id,
      title: portfolio.title,
      tagline: portfolio.tagline,
      leftSlug: portfolio.leftSlug,
      rightSlug: portfolio.rightSlug,
      specialty: portfolio.specialty,
      outcome: portfolio.outcome,
      metrics: asMetrics(portfolio.metricsJson),
      campaignId: portfolio.campaignId ?? undefined,
      published: portfolio.published,
      createdAt: portfolio.createdAt.toISOString(),
      updatedAt: portfolio.updatedAt.toISOString(),
    })),
  };
}

export async function listAgencyWorkspaces() {
  return prisma.agencyWorkspace.findMany({ orderBy: { name: "asc" } });
}

/** Notes stay blank until they are entered. */
export function agencyWorkspaceNotes(notes?: string | null) {
  return (notes ?? "").trim().slice(0, 400);
}

export async function createAgencyWorkspace(input: { id: string; name: string; notes?: string }) {
  const id = input.id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  if (!id || id.length < 3) throw new Error("Use a workspace id with at least 3 letters or numbers.");
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("A workspace name is required.");
  try {
    return await prisma.agencyWorkspace.create({
      data: {
        id,
        name,
        plan: "AGENCY",
        notes: agencyWorkspaceNotes(input.notes),
      },
    });
  } catch (error) {
    if (isUnique(error)) throw new Error("That workspace id already exists.");
    throw error;
  }
}

export async function getAgencyStore(workspaceId?: string | null) {
  if (!workspaceId?.trim()) return emptyStore();
  return ensureStore(resolveWorkspaceId(workspaceId));
}

export function agencyStats(store: AgencyStore) {
  return {
    roster: store.roster.length,
    campaigns: store.campaigns.length,
    live: store.campaigns.filter((c) => c.status === "live").length,
    portfolios: store.portfolios.length,
    published: store.portfolios.filter((p) => p.published).length,
  };
}

export async function addRosterMember(input: {
  creatorSlug: string;
  role?: RosterMember["role"];
  retainerLabel?: string;
  notes?: string;
  workspaceId?: string;
}) {
  const workspaceId = resolveWorkspaceId(input.workspaceId);
  const store = await ensureStore(workspaceId);
  if (!(await directoryHasCreator(input.creatorSlug))) {
    throw new Error("Unknown creator");
  }
  if (store.roster.some((r) => r.creatorSlug === input.creatorSlug)) {
    throw new Error("Influencer already on roster");
  }
  await prisma.agencyRosterMember.create({
    data: {
      workspaceId,
      creatorSlug: input.creatorSlug,
      role: input.role ?? "talent",
      retainerLabel: input.retainerLabel?.trim() || "",
      notes: input.notes?.trim() || "",
    },
  });
  return ensureStore(workspaceId);
}

export async function removeRosterMember(creatorSlug: string, workspaceId?: string) {
  const id = resolveWorkspaceId(workspaceId);
  await ensureStore(id);
  await prisma.agencyRosterMember.deleteMany({ where: { workspaceId: id, creatorSlug } });
  return ensureStore(id);
}

export async function createAgencyClient(input: { workspaceId: string; name: string }) {
  const workspaceId = resolveWorkspaceId(input.workspaceId);
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error("A client name is required.");
  await ensureWorkspace(workspaceId);
  const existing = await prisma.agencyClient.findUnique({
    where: { workspaceId_name: { workspaceId, name } },
  });
  if (existing) return existing;
  return prisma.agencyClient.create({
    data: { id: `client_${randomBytes(4).toString("hex")}`, workspaceId, name },
  });
}

export async function createAgencyCampaign(input: {
  title: string;
  clientName: string;
  clientId?: string;
  specialty: string;
  budgetLabel: string;
  summary: string;
  creatorSlugs: string[];
  workspaceId?: string;
}) {
  const workspaceId = resolveWorkspaceId(input.workspaceId);
  await ensureWorkspace(workspaceId);
  const title = input.title.trim();
  const requestedClientId = input.clientId?.trim() || "";
  const requestedName = input.clientName.trim();
  if (!title || (!requestedClientId && !requestedName)) throw new Error("Title and client required");
  const links = isolatedCreatorLinks(input.creatorSlugs);
  const ts = now();
  const campaignId = `camp_${randomBytes(4).toString("hex")}`;
  const client = await prisma.$transaction(async (tx) => {
    const bound = requestedClientId
      ? await tx.agencyClient.findUnique({ where: { id: requestedClientId } })
      : await tx.agencyClient.findUnique({
          where: { workspaceId_name: { workspaceId, name: requestedName } },
        });
    if (requestedClientId && (!bound || bound.workspaceId !== workspaceId)) {
      throw new Error("That client is not in this workspace.");
    }
    const row =
      bound ??
      (await tx.agencyClient.create({
        data: {
          id: `client_${randomBytes(4).toString("hex")}`,
          workspaceId,
          name: requestedName,
        },
      }));
    if (row.workspaceId !== workspaceId) throw new Error("That client is not in this workspace.");
    await tx.agencyCampaign.create({
      data: {
        id: campaignId,
        workspaceId,
        title,
        clientName: row.name,
        clientId: row.id,
        status: "briefing",
        specialty: input.specialty.trim(),
        budgetLabel: input.budgetLabel.trim(),
        creatorSlugs: links.map((link) => link.creatorSlug),
        summary: input.summary.trim(),
      },
    });
    if (links.length > 0) {
      await tx.agencyCampaignLink.createMany({
        data: links.map((link) => ({
          id: `link_${randomBytes(4).toString("hex")}`,
          campaignId,
          workspaceId,
          creatorSlug: link.creatorSlug,
          collaborationId: link.collaborationId,
          contractDocumentId: link.contractDocumentId,
          fundingId: link.fundingId,
        })),
      });
    }
    return row;
  });
  const campaign: AgencyCampaign = {
    id: campaignId,
    title,
    clientName: client.name,
    clientId: client.id,
    status: "briefing",
    specialty: input.specialty.trim(),
    budgetLabel: input.budgetLabel.trim(),
    creatorSlugs: links.map((link) => link.creatorSlug),
    summary: input.summary.trim(),
    createdAt: ts,
    updatedAt: ts,
  };
  return campaign;
}

export async function setCampaignStatus(
  id: string,
  status: AgencyCampaign["status"],
  workspaceId?: string,
) {
  const store = await ensureStore(resolveWorkspaceId(workspaceId));
  const camp = store.campaigns.find((c) => c.id === id);
  if (!camp) throw new Error("Campaign not found");
  const next = campaignStatusTransition(camp.status, status);
  if (!next.ok) throw new Error(next.error);
  const updated = await prisma.agencyCampaign.updateMany({
    where: { id, workspaceId: store.agencyId },
    data: { status: next.status },
  });
  if (updated.count !== 1) throw new Error("Campaign not found");
  camp.status = next.status;
  camp.updatedAt = now();
  return camp;
}

export async function linkAgencyCampaignCollaboration(input: {
  workspaceId: string;
  campaignId: string;
  creatorSlug: string;
  collaborationId: string;
}) {
  const workspaceId = resolveWorkspaceId(input.workspaceId);
  const creatorSlug = input.creatorSlug.trim();
  const collaborationId = input.collaborationId.trim();
  if (!creatorSlug || !collaborationId) throw new Error("Choose an influencer and an existing agreement.");
  const collaboration = await prisma.collaboration.findUnique({ where: { id: collaborationId } });
  if (!collaboration) throw new Error("That agreement was not found.");
  if (collaboration.initiatorSlug !== creatorSlug && collaboration.recipientSlug !== creatorSlug) {
    throw new Error("That agreement is not for this influencer.");
  }
  const updated = await prisma.agencyCampaignLink.updateMany({
    where: { campaignId: input.campaignId, workspaceId, creatorSlug },
    data: { collaborationId: collaboration.id },
  });
  if (updated.count !== 1) throw new Error("That influencer is not on this campaign.");
}

export type AgencyCampaignFact = CampaignRecordFact & {
  campaignId: string;
  creatorSlug: string;
};

/** Read contract and payout facts from the canonical records linked to each influencer slot. */
export async function loadAgencyCampaignFacts(workspaceId: string): Promise<AgencyCampaignFact[]> {
  const id = workspaceId.trim();
  if (!id) return [];
  const links = await prisma.agencyCampaignLink.findMany({ where: { workspaceId: id } });
  if (links.length === 0) return [];
  const collaborationIds = uniqueIds(links.map((link) => link.collaborationId));
  const contractIds = uniqueIds(links.map((link) => link.contractDocumentId));
  const fundingIds = uniqueIds(links.map((link) => link.fundingId));
  const [directContracts, collabContracts, directFundings, collabFundings] = await Promise.all([
    contractIds.length
      ? prisma.contractDocument.findMany({
          where: { id: { in: contractIds } },
          select: { id: true, collaborationId: true, status: true },
        })
      : [],
    collaborationIds.length
      ? prisma.contractDocument.findMany({
          where: { collaborationId: { in: collaborationIds } },
          select: { id: true, collaborationId: true, status: true },
        })
      : [],
    fundingIds.length
      ? prisma.collaborationFunding.findMany({
          where: { id: { in: fundingIds } },
          select: { id: true, collaborationId: true },
        })
      : [],
    collaborationIds.length
      ? prisma.collaborationFunding.findMany({
          where: { collaborationId: { in: collaborationIds } },
          select: { id: true, collaborationId: true },
        })
      : [],
  ]);
  const fundings = [...directFundings, ...collabFundings];
  const allFundingIds = uniqueIds(fundings.map((funding) => funding.id));
  const [milestones, settlements] = await Promise.all([
    allFundingIds.length
      ? prisma.fundingMilestone.findMany({
          where: { fundingId: { in: allFundingIds } },
          select: { fundingId: true, status: true },
        })
      : [],
    allFundingIds.length
      ? prisma.milestoneSettlementV4.findMany({
          where: { fundingId: { in: allFundingIds } },
          select: { fundingId: true, payoutState: true },
        })
      : [],
  ]);
  return links.map((link) => {
    const contracts = [
      ...directContracts.filter((contract) => contract.id === link.contractDocumentId),
      ...collabContracts.filter((contract) => contract.collaborationId && contract.collaborationId === link.collaborationId),
    ];
    const contractStatus = preferredContractStatus(contracts.map((contract) => contract.status));
    const relatedFundingIds = fundings
      .filter(
        (funding) =>
          funding.id === link.fundingId ||
          (link.collaborationId && funding.collaborationId === link.collaborationId),
      )
      .map((funding) => funding.id);
    const payouts = settlements
      .filter((settlement) => relatedFundingIds.includes(settlement.fundingId))
      .map((settlement) => settlement.payoutState);
    const milestoneStatuses = milestones
      .filter((milestone) => relatedFundingIds.includes(milestone.fundingId))
      .map((milestone) => milestone.status);
    const paid = payouts.includes("paid") || milestoneStatuses.includes("released");
    const pending =
      !paid &&
      (payouts.some((state) => state === "pending" || state === "in_transit" || state === "queued") ||
        milestoneStatuses.some(
          (state) => state === "approved" || state === "release_scheduled" || state === "release_requested",
        ));
    return {
      campaignId: link.campaignId,
      creatorSlug: link.creatorSlug,
      contractStatus,
      payoutState: paid ? "paid" : pending ? "pending" : null,
      milestoneStatus: paid ? "released" : pending ? "approved" : null,
    };
  });
}

function uniqueIds(values: (string | null | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function preferredContractStatus(statuses: string[]): string | null {
  if (statuses.includes("signed")) return "signed";
  if (statuses.includes("sent")) return "sent";
  if (statuses.includes("draft")) return "draft";
  return null;
}

export async function createJointPortfolio(input: {
  title: string;
  tagline: string;
  leftSlug: string;
  rightSlug: string;
  specialty: string;
  outcome: string;
  metrics?: { label: string; value: string }[];
  campaignId?: string;
  published?: boolean;
  workspaceId?: string;
}) {
  const workspaceId = resolveWorkspaceId(input.workspaceId);
  await ensureWorkspace(workspaceId);
  if (input.leftSlug === input.rightSlug) throw new Error("Pick two different influencers");
  const ts = now();
  const portfolio: JointPortfolio = {
    id: `portfolio_${randomBytes(4).toString("hex")}`,
    title: input.title.trim(),
    tagline: input.tagline.trim(),
    leftSlug: input.leftSlug,
    rightSlug: input.rightSlug,
    specialty: input.specialty.trim(),
    outcome: input.outcome.trim(),
    metrics: (input.metrics ?? []).flatMap((metric) => {
      const label = metric.label.trim();
      const value = metric.value.trim();
      if (!label || !value || value === "—") return [];
      return [{ label, value }];
    }),
    campaignId: input.campaignId,
    published: input.published === true,
    createdAt: ts,
    updatedAt: ts,
  };
  if (!portfolio.title || !portfolio.leftSlug || !portfolio.rightSlug) {
    throw new Error("Title and both influencers required");
  }
  await prisma.agencyPortfolio.create({
    data: {
      id: portfolio.id,
      workspaceId,
      title: portfolio.title,
      tagline: portfolio.tagline,
      leftSlug: portfolio.leftSlug,
      rightSlug: portfolio.rightSlug,
      specialty: portfolio.specialty,
      outcome: portfolio.outcome,
      metricsJson: portfolio.metrics,
      campaignId: portfolio.campaignId,
      published: portfolio.published,
    },
  });
  return portfolio;
}

export async function setPortfolioPublished(id: string, published: boolean, workspaceId?: string) {
  const store = await ensureStore(resolveWorkspaceId(workspaceId));
  const p = store.portfolios.find((x) => x.id === id);
  if (!p) throw new Error("Portfolio not found");
  await prisma.agencyPortfolio.update({ where: { id }, data: { published } });
  p.published = published;
  p.updatedAt = now();
  return p;
}

export async function listAgencySeats(workspaceId?: string | null) {
  if (!workspaceId?.trim()) return [];
  const id = resolveWorkspaceId(workspaceId);
  await ensureWorkspace(id);
  return prisma.agencySeat.findMany({ where: { workspaceId: id }, orderBy: { createdAt: "asc" } });
}

/** @deprecated Prefer inviteAgencySeat — kept for switch-off refusal tests and admin redirect. */
export async function addAgencySeat(input: { email: string; role?: string; workspaceId?: string }) {
  const { inviteAgencySeat } = await import("@/lib/agency-seats");
  const result = await inviteAgencySeat(input);
  return result.seat;
}

export async function setAgencySeatActive(email: string, active: boolean, workspaceId?: string) {
  if (!(await productSwitch("agency_seats"))) throw new Error("Agency seats are turned off.");
  const id = resolveWorkspaceId(workspaceId);
  await prisma.agencySeat.updateMany({
    where: { workspaceId: id, email: email.trim().toLowerCase() },
    data: { active },
  });
}

export function listPublishedPortfolios(store: AgencyStore) {
  return store.portfolios.filter((p) => p.published);
}
