/**
 * Agency workspace owned by a signed-in account.
 * Roster, campaigns, and joint portfolios are rows on that workspace.
 */
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
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
  return `agency_owner_${ownerUserId}`;
}

function emptyStore(agencyId = ""): AgencyStore {
  return {
    agencyId,
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

function asMetrics(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const label = "label" in item ? String(item.label) : "";
    const metric = "value" in item ? String(item.value) : "";
    return label ? [{ label, value: metric }] : [];
  });
}

async function ensureWorkspace(workspaceId: string) {
  const existing = await prisma.agencyWorkspace.findUnique({ where: { id: workspaceId } });
  if (existing) return existing;
  try {
    return await prisma.agencyWorkspace.create({
      data: {
        id: workspaceId,
        name: "Agency",
        plan: "AGENCY",
        notes: "",
      },
    });
  } catch (error) {
    if (!isUnique(error)) throw error;
    return prisma.agencyWorkspace.findUniqueOrThrow({ where: { id: workspaceId } });
  }
}

function isUnique(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && String(error.code) === "P2002";
}

async function loadStore(workspaceId: string): Promise<AgencyStore> {
  await ensureWorkspace(workspaceId);
  const row = await prisma.agencyWorkspace.findUniqueOrThrow({
    where: { id: workspaceId },
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

export async function getAgencyStore(workspaceId?: string | null) {
  if (!workspaceId) return emptyStore();
  return loadStore(workspaceId);
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

export async function addRosterMember(
  workspaceId: string,
  input: {
    creatorSlug: string;
    role?: RosterMember["role"];
    retainerLabel?: string;
    notes?: string;
  },
) {
  const store = await loadStore(workspaceId);
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
      retainerLabel: input.retainerLabel?.trim() || "Project",
      notes: input.notes?.trim() || "",
    },
  });
  return loadStore(workspaceId);
}

export async function removeRosterMember(workspaceId: string, creatorSlug: string) {
  await loadStore(workspaceId);
  await prisma.agencyRosterMember.deleteMany({ where: { workspaceId, creatorSlug } });
  return loadStore(workspaceId);
}

export async function createAgencyCampaign(
  workspaceId: string,
  input: {
  title: string;
  clientName: string;
  specialty: string;
  budgetLabel: string;
  summary: string;
  creatorSlugs: string[];
}) {
  await ensureWorkspace(workspaceId);
  const ts = now();
  const campaign: AgencyCampaign = {
    id: `camp_${randomBytes(4).toString("hex")}`,
    title: input.title.trim(),
    clientName: input.clientName.trim(),
    status: "briefing",
    specialty: input.specialty.trim() || "lifestyle",
    budgetLabel: input.budgetLabel.trim() || "TBD",
    creatorSlugs: input.creatorSlugs.filter(Boolean),
    summary: input.summary.trim(),
    createdAt: ts,
    updatedAt: ts,
  };
  if (!campaign.title || !campaign.clientName) throw new Error("Title and client required");
  await prisma.agencyCampaign.create({
    data: {
      id: campaign.id,
      workspaceId,
      title: campaign.title,
      clientName: campaign.clientName,
      status: campaign.status,
      specialty: campaign.specialty,
      budgetLabel: campaign.budgetLabel,
      creatorSlugs: campaign.creatorSlugs,
      summary: campaign.summary,
    },
  });
  return campaign;
}

export async function setCampaignStatus(
  workspaceId: string,
  id: string,
  status: AgencyCampaign["status"],
) {
  const camp = await prisma.agencyCampaign.findFirst({ where: { id, workspaceId } });
  if (!camp) throw new Error("Campaign not found");
  await prisma.agencyCampaign.update({ where: { id }, data: { status } });
  return {
    id: camp.id,
    title: camp.title,
    clientName: camp.clientName,
    status,
    specialty: camp.specialty,
    budgetLabel: camp.budgetLabel,
    creatorSlugs: asStringList(camp.creatorSlugs),
    summary: camp.summary,
    createdAt: camp.createdAt.toISOString(),
    updatedAt: now(),
  };
}

export async function createJointPortfolio(
  workspaceId: string,
  input: {
  title: string;
  tagline: string;
  leftSlug: string;
  rightSlug: string;
  specialty: string;
  outcome: string;
  metrics?: { label: string; value: string }[];
  campaignId?: string;
  published?: boolean;
}) {
  await ensureWorkspace(workspaceId);
  if (input.leftSlug === input.rightSlug) throw new Error("Pick two different influencers");
  const ts = now();
  const portfolio: JointPortfolio = {
    id: `portfolio_${randomBytes(4).toString("hex")}`,
    title: input.title.trim(),
    tagline: input.tagline.trim(),
    leftSlug: input.leftSlug,
    rightSlug: input.rightSlug,
    specialty: input.specialty.trim() || "lifestyle",
    outcome: input.outcome.trim(),
    metrics: input.metrics?.length
      ? input.metrics
      : [
          { label: "Reach", value: "—" },
          { label: "Engagement", value: "—" },
        ],
    campaignId: input.campaignId,
    published: input.published ?? true,
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

export async function setPortfolioPublished(workspaceId: string, id: string, published: boolean) {
  const portfolio = await prisma.agencyPortfolio.findFirst({ where: { id, workspaceId } });
  if (!portfolio) throw new Error("Portfolio not found");
  await prisma.agencyPortfolio.update({ where: { id }, data: { published } });
  return published;
}

export async function listAgencySeats(workspaceId?: string | null) {
  if (!workspaceId) return [];
  await ensureWorkspace(workspaceId);
  return prisma.agencySeat.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } });
}

/** @deprecated Prefer inviteAgencySeat — kept for switch-off refusal tests and admin redirect. */
export async function addAgencySeat(input: { email: string; role?: string }) {
  const { inviteAgencySeat } = await import("@/lib/agency-seats");
  const result = await inviteAgencySeat(input);
  return result.seat;
}

export async function setAgencySeatActive(workspaceId: string, email: string, active: boolean) {
  if (!(await productSwitch("agency_seats"))) throw new Error("Agency seats are turned off.");
  await prisma.agencySeat.updateMany({
    where: { workspaceId, email: email.trim().toLowerCase() },
    data: { active },
  });
}

export function listPublishedPortfolios(store: AgencyStore) {
  return store.portfolios.filter((p) => p.published);
}
