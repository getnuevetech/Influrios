import { getBusinessEntitlements, type BusinessPlanCode } from "@/lib/business-entitlements";
import { managedMatchGate } from "@/lib/business-queue";
import { directoryHasCreator, listDirectoryCreators } from "@/lib/directory";
import { prisma } from "@/lib/db";
import { getManagedPromotionEnabled } from "@/lib/managed-matching";
import { samePlace } from "@/lib/place-names";
import { specialtyLabel, type SeedCreator } from "@/lib/seed-data";

export type ShortlistItem = {
  creatorSlug: string;
  addedAt: string;
  note?: string;
};

export type CampaignBrief = {
  id: string;
  title: string;
  goal: string;
  specialty: string;
  budget: string;
  location: string;
  platform: string;
  summary: string;
  createdAt: string;
  status: "draft" | "active" | "closed";
};

export type Inquiry = {
  id: string;
  creatorSlug: string;
  briefId?: string;
  message: string;
  status: "sent" | "replied" | "declined";
  createdAt: string;
};

export type BusinessWorkspace = {
  businessId: string;
  name: string;
  plan: BusinessPlanCode;
  industry: string;
  shortlist: ShortlistItem[];
  briefs: CampaignBrief[];
  inquiries: Inquiry[];
};

const WORKSPACE_ID = "demo-business";

const BRIEF_STATUSES = ["draft", "active", "closed"] as const;
const INQUIRY_STATUSES = ["sent", "replied", "declined"] as const;
const PLAN_CODES: BusinessPlanCode[] = ["BUSINESS_FREE", "BUSINESS_PRO", "AGENCY"];

function asPlan(value: string): BusinessPlanCode {
  return PLAN_CODES.includes(value as BusinessPlanCode) ? (value as BusinessPlanCode) : "BUSINESS_PRO";
}

function asBriefStatus(value: string): CampaignBrief["status"] {
  return BRIEF_STATUSES.includes(value as CampaignBrief["status"]) ? (value as CampaignBrief["status"]) : "active";
}

function asInquiryStatus(value: string): Inquiry["status"] {
  return INQUIRY_STATUSES.includes(value as Inquiry["status"]) ? (value as Inquiry["status"]) : "sent";
}

function isUnique(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && String(error.code) === "P2002";
}

type WorkspaceRow = NonNullable<Awaited<ReturnType<typeof loadRow>>>;

async function loadRow() {
  return prisma.businessWorkspace.findUnique({
    where: { id: WORKSPACE_ID },
    include: {
      briefs: { orderBy: { createdAt: "desc" } },
      shortlist: { orderBy: { addedAt: "desc" } },
      inquiries: { orderBy: { createdAt: "desc" } },
    },
  });
}

function mapWorkspace(row: WorkspaceRow): BusinessWorkspace {
  return {
    businessId: row.id,
    name: row.name,
    plan: asPlan(row.plan),
    industry: row.industry,
    shortlist: row.shortlist.map((item) => ({
      creatorSlug: item.creatorSlug,
      addedAt: item.addedAt.toISOString(),
      note: item.note ?? undefined,
    })),
    briefs: row.briefs.map((brief) => ({
      id: brief.id,
      title: brief.title,
      goal: brief.goal,
      specialty: brief.specialty,
      budget: brief.budget,
      location: brief.location,
      platform: brief.platform,
      summary: brief.summary,
      createdAt: brief.createdAt.toISOString(),
      status: asBriefStatus(brief.status),
    })),
    inquiries: row.inquiries.map((inquiry) => ({
      id: inquiry.id,
      creatorSlug: inquiry.creatorSlug,
      briefId: inquiry.briefId ?? undefined,
      message: inquiry.message,
      status: asInquiryStatus(inquiry.status),
      createdAt: inquiry.createdAt.toISOString(),
    })),
  };
}

let workspaceSeed: Promise<void> | null = null;

async function seedWorkspace() {
  const existing = await prisma.businessWorkspace.findUnique({ where: { id: WORKSPACE_ID } });
  if (existing) return;
  try {
    await prisma.businessWorkspace.create({
      data: {
        id: WORKSPACE_ID,
        name: "Luminous Beauty",
        plan: "BUSINESS_PRO",
        industry: "Skincare & Wellness",
        briefs: {
          create: {
            id: "brief-clean-launch",
            title: "Clean Skincare Launch",
            goal: "Product Launch",
            specialty: "beauty",
            budget: "$5K – $10K",
            location: "USA",
            platform: "INSTAGRAM",
            summary: "Seeking beauty educators for a 3-post launch series with honest routine content.",
            status: "active",
          },
        },
        shortlist: {
          create: [
            { creatorSlug: "sofia-martinez", note: "Top beauty fit" },
            { creatorSlug: "amara-okonkwo", note: "Natural-hair angle" },
          ],
        },
      },
    });
  } catch (error) {
    if (!isUnique(error)) throw error;
  }
}

function ensureWorkspace() {
  if (!workspaceSeed) {
    workspaceSeed = seedWorkspace().catch((error) => {
      workspaceSeed = null;
      throw error;
    });
  }
  return workspaceSeed;
}

async function readWorkspace() {
  await ensureWorkspace();
  const row = await loadRow();
  if (!row) throw new Error("Business workspace is unavailable.");
  return mapWorkspace(row);
}

export async function getWorkspace(): Promise<BusinessWorkspace> {
  return readWorkspace();
}

export async function setBusinessPlan(plan: BusinessPlanCode) {
  if (!PLAN_CODES.includes(plan)) throw new Error("Unknown business plan.");
  await ensureWorkspace();
  await prisma.businessWorkspace.update({ where: { id: WORKSPACE_ID }, data: { plan } });
  return readWorkspace();
}

export async function addToShortlist(creatorSlug: string, note?: string) {
  const ws = await readWorkspace();
  const limits = getBusinessEntitlements(ws.plan);
  if (ws.shortlist.some((item) => item.creatorSlug === creatorSlug)) return { ok: true as const, ws };
  if (ws.shortlist.length >= limits.shortlistMax) {
    return {
      ok: false as const,
      error: `Shortlist limit reached (${limits.shortlistMax}). Upgrade Business Pro for larger lists.`,
      ws,
    };
  }
  if (!(await directoryHasCreator(creatorSlug))) {
    return { ok: false as const, error: "Influencer not found", ws };
  }
  try {
    await prisma.businessShortlistItem.create({
      data: { workspaceId: WORKSPACE_ID, creatorSlug, note },
    });
  } catch (error) {
    if (!isUnique(error)) throw error;
  }
  return { ok: true as const, ws: await readWorkspace() };
}

export async function removeFromShortlist(creatorSlug: string) {
  await ensureWorkspace();
  await prisma.businessShortlistItem.deleteMany({
    where: { workspaceId: WORKSPACE_ID, creatorSlug },
  });
  return readWorkspace();
}

export async function createBrief(
  input: Omit<CampaignBrief, "id" | "createdAt" | "status"> & { status?: CampaignBrief["status"] },
) {
  await ensureWorkspace();
  const brief = await prisma.businessBrief.create({
    data: {
      workspaceId: WORKSPACE_ID,
      title: input.title,
      goal: input.goal,
      specialty: input.specialty,
      budget: input.budget,
      location: input.location,
      platform: input.platform,
      summary: input.summary,
      status: input.status ?? "active",
    },
  });
  return presentBrief(brief);
}

/** W2.3 — update an owned Campaign Intent in place (no duplicate brief rows). */
export async function updateBrief(
  id: string,
  input: Omit<CampaignBrief, "id" | "createdAt" | "status"> & { status?: CampaignBrief["status"] },
) {
  await ensureWorkspace();
  const existing = await prisma.businessBrief.findFirst({
    where: { id, workspaceId: WORKSPACE_ID },
  });
  if (!existing) throw new Error("Campaign intent not found.");
  const brief = await prisma.businessBrief.update({
    where: { id: existing.id },
    data: {
      title: input.title,
      goal: input.goal,
      specialty: input.specialty,
      budget: input.budget,
      location: input.location,
      platform: input.platform,
      summary: input.summary,
      status: input.status ?? existing.status,
    },
  });
  return presentBrief(brief);
}

function presentBrief(brief: {
  id: string;
  title: string;
  goal: string;
  specialty: string;
  budget: string;
  location: string;
  platform: string;
  summary: string;
  createdAt: Date;
  status: string;
}): CampaignBrief {
  return {
    id: brief.id,
    title: brief.title,
    goal: brief.goal,
    specialty: brief.specialty,
    budget: brief.budget,
    location: brief.location,
    platform: brief.platform,
    summary: brief.summary,
    createdAt: brief.createdAt.toISOString(),
    status: asBriefStatus(brief.status),
  };
}

/** Pure — reuse existing brief when the id is owned by this workspace. */
export function resolveCampaignIntentSaveMode(input: {
  briefId?: string | null;
  ownedBriefIds: string[];
}): "create" | "update" {
  const id = input.briefId?.trim();
  if (id && input.ownedBriefIds.includes(id)) return "update";
  return "create";
}

export function buildCampaignIntentFields(input: {
  title?: string;
  goal?: string;
  specialty?: string;
  budget?: string;
  location?: string;
  platform?: string;
  audience?: string;
  collabType?: string;
  timeframe?: string;
  summary?: string;
}) {
  const goal = (input.goal ?? "Brand Awareness").trim() || "Brand Awareness";
  const specialty = (input.specialty ?? "beauty").trim() || "beauty";
  const title =
    (input.title ?? "").trim() || `Campaign intent · ${goal} · ${specialty}`;
  return {
    title,
    goal,
    specialty,
    budget: (input.budget ?? "$1K – $5K").trim() || "$1K – $5K",
    location: (input.location ?? "Global").trim() || "Global",
    platform: (input.platform ?? "INSTAGRAM").trim() || "INSTAGRAM",
    summary: [input.audience, input.collabType, input.timeframe, input.summary]
      .map((part) => (part ?? "").trim())
      .filter(Boolean)
      .join(" · "),
    status: "draft" as const,
  };
}

export async function sendInquiry(input: {
  creatorSlug: string;
  message: string;
  briefId?: string;
}) {
  const ws = await readWorkspace();
  const limits = getBusinessEntitlements(ws.plan);
  const month = new Date().toISOString().slice(0, 7);
  const sentThisMonth = ws.inquiries.filter((inquiry) => inquiry.createdAt.startsWith(month)).length;
  if (sentThisMonth >= limits.inquiryMaxPerMonth) {
    return {
      ok: false as const,
      error: `Monthly inquiry limit reached (${limits.inquiryMaxPerMonth}). Upgrade for higher limits.`,
    };
  }
  const brief =
    input.briefId && ws.briefs.some((item) => item.id === input.briefId) ? input.briefId : undefined;
  const inquiry = await prisma.businessInquiry.create({
    data: {
      workspaceId: WORKSPACE_ID,
      briefId: brief,
      creatorSlug: input.creatorSlug,
      message: input.message,
      status: "sent",
    },
  });
  return {
    ok: true as const,
    inquiry: {
      id: inquiry.id,
      creatorSlug: inquiry.creatorSlug,
      briefId: inquiry.briefId ?? undefined,
      message: inquiry.message,
      status: asInquiryStatus(inquiry.status),
      createdAt: inquiry.createdAt.toISOString(),
    } satisfies Inquiry,
  };
}

export async function updateInquiryStatus(id: string, status: Inquiry["status"]) {
  if (!INQUIRY_STATUSES.includes(status)) {
    return { ok: false as const, error: "Invalid inquiry status." };
  }
  await ensureWorkspace();
  const existing = await prisma.businessInquiry.findFirst({
    where: { id, workspaceId: WORKSPACE_ID },
  });
  if (!existing) return { ok: false as const, error: "Inquiry not found." };
  const updated = await prisma.businessInquiry.update({
    where: { id },
    data: { status },
  });
  return {
    ok: true as const,
    inquiry: {
      id: updated.id,
      creatorSlug: updated.creatorSlug,
      briefId: updated.briefId ?? undefined,
      message: updated.message,
      status: asInquiryStatus(updated.status),
      createdAt: updated.createdAt.toISOString(),
    } satisfies Inquiry,
  };
}

export async function queuedBriefIds() {
  await ensureWorkspace();
  const rows = await prisma.managedMatchRequest.findMany({
    where: { workspaceId: WORKSPACE_ID, status: "queued" },
    select: { briefId: true },
  });
  return rows.map((row) => row.briefId);
}

/** Name of a live AI provider assigned to business_creator_match, or null for the platform rule. */
export async function businessMatchProviderName(): Promise<string | null> {
  const route = await prisma.aiFunctionRoute.findUnique({
    where: { functionKey: "business_creator_match" },
    include: { provider: true },
  });
  if (!route?.enabled || !route.provider?.enabled || !route.provider.secretCipher) return null;
  return route.provider.name;
}

export async function requestManagedMatch(briefId: string) {
  const ws = await readWorkspace();
  const brief = ws.briefs.find((item) => item.id === briefId);
  if (!brief) return { ok: false as const, error: "Brief not found." };
  const [flagEnabled, queued] = await Promise.all([getManagedPromotionEnabled(), queuedBriefIds()]);
  const gate = managedMatchGate({
    flagEnabled,
    planAllows: getBusinessEntitlements(ws.plan).managedMatching,
    alreadyQueued: queued.includes(briefId),
  });
  if (!gate.ok) return gate;
  await prisma.managedMatchRequest.create({
    data: { workspaceId: WORKSPACE_ID, briefId, status: "queued" },
  });
  return { ok: true as const };
}

export type CreatorFit = {
  creator: SeedCreator;
  score: number;
  reasons: string[];
  breakdown: {
    specialtyFit: number;
    audienceGeo: number;
    platformFit: number;
    commercialReadiness: number;
  };
};

function geographyFits(creator: { locationCity: string; locationCountry: string }, location: string) {
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;
  return parts.some(
    (part) => samePlace(part, creator.locationCity) || samePlace(part, creator.locationCountry),
  );
}

/** Explainable business → creator fit for a brief. This is a platform rule. */
export function fitCreatorToBrief(creator: SeedCreator, brief: CampaignBrief): CreatorFit {
  const specialtyHit =
    creator.specialties.includes(brief.specialty) ||
    creator.specialties.some((s) => s.includes(brief.specialty) || brief.specialty.includes(s));
  const specialtyFit = specialtyHit ? 94 : creator.specialties.length ? 62 : 40;

  const geoHit = geographyFits(creator, brief.location);
  const audienceGeo = geoHit ? 90 : 70;

  const platformFit = creator.socials.some((s) => s.platform === brief.platform)
    ? 92
    : creator.socials.length
      ? 68
      : 40;

  const commercialReadiness = creator.openToCollab
    ? creator.planTier === "PRO"
      ? 95
      : creator.planTier === "PLUS"
        ? 88
        : 74
    : 30;

  const score = Math.round(
    specialtyFit * 0.35 + audienceGeo * 0.2 + platformFit * 0.25 + commercialReadiness * 0.2,
  );

  const reasons: string[] = [];
  if (specialtyHit) {
    reasons.push(
      `Specialty match: ${specialtyLabel(brief.specialty)} aligns with ${creator.specialties
        .slice(0, 2)
        .map(specialtyLabel)
        .join(", ")}`,
    );
  } else {
    reasons.push(`Partial specialty overlap — consider adjacent niches on ${creator.displayName}'s profile`);
  }
  if (geoHit) {
    reasons.push(`Geography fit for ${brief.location}`);
  }
  if (creator.socials.some((s) => s.platform === brief.platform)) {
    reasons.push(`Active on ${brief.platform}`);
  }
  if (creator.openToCollab) reasons.push("Marked open to collaborations");
  if (creator.offer) reasons.push(`Offers: ${creator.offer}`);

  return {
    creator,
    score,
    reasons,
    breakdown: { specialtyFit, audienceGeo, platformFit, commercialReadiness },
  };
}

export function rankCreatorsForBrief(
  brief: CampaignBrief,
  creators: readonly SeedCreator[],
): CreatorFit[] {
  return creators.map((c) => fitCreatorToBrief(c, brief)).sort((a, b) => b.score - a.score);
}

export async function rankDirectoryCreatorsForBrief(brief: CampaignBrief): Promise<CreatorFit[]> {
  return rankCreatorsForBrief(brief, await listDirectoryCreators());
}
