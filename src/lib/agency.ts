/**
 * Phase 11 — Agency Workspace & Joint Portfolios.
 * Multi-creator roster, agency campaigns, and collab case-study stubs.
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
        notes: (input.notes ?? "Admin-created agency workspace.").trim().slice(0, 400),
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
      retainerLabel: input.retainerLabel?.trim() || "Project",
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

export async function createAgencyCampaign(input: {
  title: string;
  clientName: string;
  specialty: string;
  budgetLabel: string;
  summary: string;
  creatorSlugs: string[];
  workspaceId?: string;
}) {
  const workspaceId = resolveWorkspaceId(input.workspaceId);
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
  id: string,
  status: AgencyCampaign["status"],
  workspaceId?: string,
) {
  const store = await ensureStore(resolveWorkspaceId(workspaceId));
  const camp = store.campaigns.find((c) => c.id === id);
  if (!camp) throw new Error("Campaign not found");
  await prisma.agencyCampaign.update({ where: { id }, data: { status } });
  camp.status = status;
  camp.updatedAt = now();
  return camp;
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
