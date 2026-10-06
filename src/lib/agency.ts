/**
 * Phase 11 — Agency Workspace & Joint Portfolios.
 * Multi-creator roster, agency campaigns, and collab case-study stubs.
 */
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { directoryHasCreator } from "@/lib/directory";
import { productSwitch } from "@/lib/product-switches";

export { AGENCY_WORKSPACE_ID as DEFAULT_AGENCY_WORKSPACE_ID } from "@/lib/agency-seats";
import { AGENCY_WORKSPACE_ID } from "@/lib/agency-seats";

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

const WORKSPACE_ID = AGENCY_WORKSPACE_ID;
const now = () => new Date().toISOString();

function resolveWorkspaceId(workspaceId?: string) {
  const id = (workspaceId || WORKSPACE_ID).trim().slice(0, 64);
  if (!id) return WORKSPACE_ID;
  return id;
}

const DEFAULT_STORE: AgencyStore = {
  agencyId: "agency_demo_1",
  name: "Northstar Influence",
  plan: "AGENCY",
  notes:
    "Phase 11 demo agency — roster + campaigns + joint portfolio stubs. Upgrade business plan to AGENCY to unlock.",
  roster: [
    {
      creatorSlug: "sofia-martinez",
      role: "lead",
      retainerLabel: "$4.5K / mo",
      notes: "Beauty lead; clean skincare launches",
      addedAt: now(),
    },
    {
      creatorSlug: "amara-okonkwo",
      role: "specialist",
      retainerLabel: "Project",
      notes: "Natural hair / texture specialist",
      addedAt: now(),
    },
    {
      creatorSlug: "jordan-blake",
      role: "talent",
      retainerLabel: "Project",
      notes: "Lifestyle / wellness crossovers",
      addedAt: now(),
    },
  ],
  campaigns: [
    {
      id: "camp_clean_launch",
      title: "Luminous Clean Launch",
      clientName: "Luminous Beauty",
      status: "live",
      specialty: "beauty",
      budgetLabel: "$12K package",
      creatorSlugs: ["sofia-martinez", "amara-okonkwo"],
      summary: "3-post launch + joint reel with complementary beauty + hair angles.",
      createdAt: now(),
      updatedAt: now(),
    },
  ],
  portfolios: [
    {
      id: "portfolio_demo_1",
      title: "Clean beauty × texture care",
      tagline: "Complementary influencers, one brand story",
      leftSlug: "sofia-martinez",
      rightSlug: "amara-okonkwo",
      specialty: "beauty",
      outcome:
        "Joint reel + carousel drove save-heavy engagement and a measurable lift in branded search.",
      metrics: [
        { label: "Combined reach", value: "1.2M" },
        { label: "Saves", value: "18.4K" },
        { label: "Brand lift", value: "+22%" },
      ],
      campaignId: "camp_clean_launch",
      published: true,
      createdAt: now(),
      updatedAt: now(),
    },
  ],
};

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

async function ensureWorkspace(workspaceId = WORKSPACE_ID) {
  const id = resolveWorkspaceId(workspaceId);
  const existing = await prisma.agencyWorkspace.findUnique({ where: { id } });
  if (existing) return existing;
  // Full demo seed only for the default workspace.
  if (id !== WORKSPACE_ID) {
    try {
      return await prisma.agencyWorkspace.create({
        data: {
          id,
          name: id.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80) || "Agency",
          plan: "AGENCY",
          notes: "Admin-created agency workspace.",
        },
      });
    } catch (error) {
      if (!isUnique(error)) throw error;
      return prisma.agencyWorkspace.findUniqueOrThrow({ where: { id } });
    }
  }
  try {
    return await prisma.agencyWorkspace.create({
      data: {
        id: WORKSPACE_ID,
        name: DEFAULT_STORE.name,
        plan: DEFAULT_STORE.plan,
        notes: DEFAULT_STORE.notes,
        roster: {
          create: DEFAULT_STORE.roster.map((member) => ({
            creatorSlug: member.creatorSlug,
            role: member.role,
            retainerLabel: member.retainerLabel,
            notes: member.notes,
          })),
        },
        campaigns: {
          create: DEFAULT_STORE.campaigns.map((campaign) => ({
            id: campaign.id,
            title: campaign.title,
            clientName: campaign.clientName,
            status: campaign.status,
            specialty: campaign.specialty,
            budgetLabel: campaign.budgetLabel,
            creatorSlugs: campaign.creatorSlugs,
            summary: campaign.summary,
          })),
        },
        portfolios: {
          create: DEFAULT_STORE.portfolios.map((portfolio) => ({
            id: portfolio.id,
            title: portfolio.title,
            tagline: portfolio.tagline,
            leftSlug: portfolio.leftSlug,
            rightSlug: portfolio.rightSlug,
            specialty: portfolio.specialty,
            outcome: portfolio.outcome,
            metricsJson: portfolio.metrics,
            campaignId: portfolio.campaignId,
            published: portfolio.published,
          })),
        },
      },
    });
  } catch (error) {
    if (!isUnique(error)) throw error;
    return prisma.agencyWorkspace.findUniqueOrThrow({ where: { id: WORKSPACE_ID } });
  }
}

function isUnique(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && String(error.code) === "P2002";
}

async function ensureStore(workspaceId = WORKSPACE_ID): Promise<AgencyStore> {
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
  await ensureWorkspace(WORKSPACE_ID);
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

export async function getAgencyStore(workspaceId?: string) {
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

export async function listAgencySeats(workspaceId?: string) {
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
