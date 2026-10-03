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

const WORKSPACE_ID = "agency_demo_1";
const now = () => new Date().toISOString();

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

async function ensureWorkspace() {
  const existing = await prisma.agencyWorkspace.findUnique({ where: { id: WORKSPACE_ID } });
  if (existing) return existing;
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

async function ensureStore(): Promise<AgencyStore> {
  await ensureWorkspace();
  const row = await prisma.agencyWorkspace.findUniqueOrThrow({
    where: { id: WORKSPACE_ID },
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

export async function getAgencyStore() {
  return ensureStore();
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
}) {
  const store = await ensureStore();
  if (!(await directoryHasCreator(input.creatorSlug))) {
    throw new Error("Unknown creator");
  }
  if (store.roster.some((r) => r.creatorSlug === input.creatorSlug)) {
    throw new Error("Influencer already on roster");
  }
  await prisma.agencyRosterMember.create({
    data: {
      workspaceId: WORKSPACE_ID,
      creatorSlug: input.creatorSlug,
      role: input.role ?? "talent",
      retainerLabel: input.retainerLabel?.trim() || "Project",
      notes: input.notes?.trim() || "",
    },
  });
  return ensureStore();
}

export async function removeRosterMember(creatorSlug: string) {
  await ensureStore();
  await prisma.agencyRosterMember.deleteMany({ where: { workspaceId: WORKSPACE_ID, creatorSlug } });
  return ensureStore();
}

export async function createAgencyCampaign(input: {
  title: string;
  clientName: string;
  specialty: string;
  budgetLabel: string;
  summary: string;
  creatorSlugs: string[];
}) {
  await ensureWorkspace();
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
      workspaceId: WORKSPACE_ID,
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
) {
  const store = await ensureStore();
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
}) {
  await ensureWorkspace();
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
      workspaceId: WORKSPACE_ID,
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

export async function setPortfolioPublished(id: string, published: boolean) {
  const store = await ensureStore();
  const p = store.portfolios.find((x) => x.id === id);
  if (!p) throw new Error("Portfolio not found");
  await prisma.agencyPortfolio.update({ where: { id }, data: { published } });
  p.published = published;
  p.updatedAt = now();
  return p;
}

export async function listAgencySeats() {
  await ensureWorkspace();
  return prisma.agencySeat.findMany({ where: { workspaceId: WORKSPACE_ID }, orderBy: { createdAt: "asc" } });
}

export async function addAgencySeat(input: { email: string; role?: string }) {
  if (!(await productSwitch("agency_seats"))) throw new Error("Agency seats are turned off.");
  const email = input.email.trim().toLowerCase().slice(0, 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a seat email.");
  const role = input.role === "owner" || input.role === "manager" ? input.role : "member";
  await ensureWorkspace();
  await prisma.agencySeat.upsert({
    where: { workspaceId_email: { workspaceId: WORKSPACE_ID, email } },
    update: { role, active: true },
    create: { workspaceId: WORKSPACE_ID, email, role, active: true },
  });
}

export async function setAgencySeatActive(email: string, active: boolean) {
  if (!(await productSwitch("agency_seats"))) throw new Error("Agency seats are turned off.");
  await prisma.agencySeat.updateMany({
    where: { workspaceId: WORKSPACE_ID, email: email.trim().toLowerCase() },
    data: { active },
  });
}

export function listPublishedPortfolios(store: AgencyStore) {
  return store.portfolios.filter((p) => p.published);
}
