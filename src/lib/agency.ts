/**
 * Phase 11 — Agency Workspace & Joint Portfolios.
 * Multi-creator roster, agency campaigns, and collab case-study stubs.
 */
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { getCreatorBySlug, SEED_CREATORS } from "@/lib/seed-data";

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

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "agency-workspace.json");
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
      tagline: "Complementary creators, one brand story",
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

async function ensureStore(): Promise<AgencyStore> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as AgencyStore;
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(DEFAULT_STORE, null, 2), "utf8");
    return structuredClone(DEFAULT_STORE);
  }
}

async function saveStore(store: AgencyStore) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
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
  if (!getCreatorBySlug(input.creatorSlug) && !SEED_CREATORS.some((c) => c.slug === input.creatorSlug)) {
    throw new Error("Unknown creator");
  }
  if (store.roster.some((r) => r.creatorSlug === input.creatorSlug)) {
    throw new Error("Creator already on roster");
  }
  store.roster.unshift({
    creatorSlug: input.creatorSlug,
    role: input.role ?? "talent",
    retainerLabel: input.retainerLabel?.trim() || "Project",
    notes: input.notes?.trim() || "",
    addedAt: now(),
  });
  await saveStore(store);
  return store;
}

export async function removeRosterMember(creatorSlug: string) {
  const store = await ensureStore();
  store.roster = store.roster.filter((r) => r.creatorSlug !== creatorSlug);
  await saveStore(store);
  return store;
}

export async function createAgencyCampaign(input: {
  title: string;
  clientName: string;
  specialty: string;
  budgetLabel: string;
  summary: string;
  creatorSlugs: string[];
}) {
  const store = await ensureStore();
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
  store.campaigns.unshift(campaign);
  await saveStore(store);
  return campaign;
}

export async function setCampaignStatus(
  id: string,
  status: AgencyCampaign["status"],
) {
  const store = await ensureStore();
  const camp = store.campaigns.find((c) => c.id === id);
  if (!camp) throw new Error("Campaign not found");
  camp.status = status;
  camp.updatedAt = now();
  await saveStore(store);
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
  const store = await ensureStore();
  if (input.leftSlug === input.rightSlug) throw new Error("Pick two different creators");
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
    throw new Error("Title and both creators required");
  }
  store.portfolios.unshift(portfolio);
  await saveStore(store);
  return portfolio;
}

export async function setPortfolioPublished(id: string, published: boolean) {
  const store = await ensureStore();
  const p = store.portfolios.find((x) => x.id === id);
  if (!p) throw new Error("Portfolio not found");
  p.published = published;
  p.updatedAt = now();
  await saveStore(store);
  return p;
}

export function listPublishedPortfolios(store: AgencyStore) {
  return store.portfolios.filter((p) => p.published);
}
