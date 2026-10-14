import { isBusinessPlanCode } from "@/lib/business-entitlements";
import { EMPTY_ENTITLEMENTS, getEntitlements, isPlanCode, type EntitlementLimits } from "@/lib/entitlements";
import { businessEntitlementsForPlan } from "@/lib/entitlements-db";
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
  budgetCurrency: string;
  collabType: string;
  timeframe: string;
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
  status: string;
  createdAt: string;
};

export type BusinessWorkspace = {
  businessId: string;
  ownerUserId?: string | null;
  name: string;
  plan: string;
  industry: string;
  shortlist: ShortlistItem[];
  briefs: CampaignBrief[];
  inquiries: Inquiry[];
};

/** Logged-out readers get a free workspace that is not stored and is not Business Pro. */
export const PUBLIC_BUSINESS_WORKSPACE: BusinessWorkspace = {
  businessId: "public",
  ownerUserId: null,
  name: "",
  plan: "BUSINESS_FREE",
  industry: "",
  shortlist: [],
  briefs: [],
  inquiries: [],
};

const BRIEF_STATUSES = ["draft", "active", "closed"] as const;

export const LEAD_STATUSES = ["lead_created", "contacted", "qualified", "won", "lost", "dormant"] as const;

const LEAD_MOVES: Record<string, readonly string[]> = {
  lead_created: ["contacted", "lost", "dormant"],
  sent: ["contacted", "lost", "dormant"],
  contacted: ["qualified", "lost", "dormant"],
  replied: ["qualified", "lost", "dormant"],
  qualified: ["won", "lost", "dormant"],
  dormant: ["contacted", "lost"],
};

/** The stored status. A blank or unknown value is not renamed. */
export function storedInquiryStatus(value: string): string {
  return value.trim();
}

export function leadLabel(status: string): string {
  const labels: Record<string, string> = {
    lead_created: "Lead created",
    contacted: "Contacted",
    qualified: "Qualified",
    won: "Won",
    lost: "Lost",
    dormant: "Dormant",
    sent: "Sent",
    replied: "Replied",
    declined: "Declined",
  };
  return labels[status] ?? status;
}

export function leadTransitions(status: string): string[] {
  return [...(LEAD_MOVES[status.trim()] ?? [])];
}

export function leadIsOpen(status: string): boolean {
  return ["lead_created", "sent", "contacted", "replied", "qualified"].includes(status.trim());
}

/** A lead moves only along the stored path. Won, lost, and declined stay where they are. */
export function advanceLead(current: string, next: string): { ok: true; status: string } | { ok: false; error: string } {
  const from = current.trim();
  const to = next.trim();
  if (!leadTransitions(from).includes(to)) {
    return { ok: false, error: "That lead cannot move to that stage." };
  }
  return { ok: true, status: to };
}

function asPlan(value: string): string {
  const code = value.trim().toUpperCase();
  return code || "BUSINESS_FREE";
}

/** A new workspace starts free. Name and industry stay blank until they are known. */
export function newBusinessWorkspaceFields(input: {
  name?: string | null;
  userName?: string | null;
  email?: string | null;
  industry?: string | null;
}) {
  const fromEmail = (input.email ?? "").split("@")[0]?.trim() ?? "";
  const name = (input.name || input.userName || fromEmail || "").trim().slice(0, 120);
  const industry = (input.industry ?? "").trim().slice(0, 120);
  return { name, industry, plan: "BUSINESS_FREE" as const };
}

function asBriefStatus(value: string): CampaignBrief["status"] {
  return BRIEF_STATUSES.includes(value as CampaignBrief["status"]) ? (value as CampaignBrief["status"]) : "active";
}

function asInquiryStatus(value: string): string {
  return storedInquiryStatus(value);
}

function isUnique(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && String(error.code) === "P2002";
}

type WorkspaceRow = NonNullable<Awaited<ReturnType<typeof loadRow>>>;

async function loadRow(workspaceId: string) {
  return prisma.businessWorkspace.findUnique({
    where: { id: workspaceId },
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
    ownerUserId: row.ownerUserId ?? null,
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
      budgetCurrency: brief.budgetCurrency,
      collabType: brief.collabType,
      timeframe: brief.timeframe,
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

const RETIRED_DEMO_WORKSPACE_ID = "demo-business";
const RETIRED_DEMO_BRIEF_ID = "brief-clean-launch";
const RETIRED_DEMO_BRIEF_SUMMARY =
  "Seeking beauty educators for a 3-post launch series with honest routine content.";

async function readWorkspace(workspaceId: string) {
  const id = workspaceId.trim();
  if (!id) throw new Error("Business workspace is required.");
  const row = await loadRow(id);
  if (!row) throw new Error("Business workspace is unavailable.");
  return mapWorkspace(row);
}

/** Delete the retired sample workspace only when its brief and shortlist are still the sample. */
export async function removeUntouchedDemoBusinessWorkspace(): Promise<number> {
  const row = await prisma.businessWorkspace.findUnique({
    where: { id: RETIRED_DEMO_WORKSPACE_ID },
    include: {
      briefs: true,
      shortlist: true,
      inquiries: { select: { id: true } },
      matchQueue: { select: { id: true } },
      marketplaceRequests: { select: { id: true } },
      fundings: { select: { id: true } },
    },
  });
  if (!row || row.ownerUserId) return 0;
  if (row.name !== "Luminous Beauty" || row.industry !== "Skincare & Wellness") return 0;
  if (row.inquiries.length || row.matchQueue.length || row.marketplaceRequests.length || row.fundings.length) {
    return 0;
  }
  if (row.briefs.length !== 1) return 0;
  const brief = row.briefs[0]!;
  if (
    brief.id !== RETIRED_DEMO_BRIEF_ID ||
    brief.title !== "Clean Skincare Launch" ||
    brief.summary !== RETIRED_DEMO_BRIEF_SUMMARY
  ) {
    return 0;
  }
  const sampleSlugs = new Set(["sofia-martinez", "amara-okonkwo"]);
  if (row.shortlist.some((item) => !sampleSlugs.has(item.creatorSlug))) return 0;
  await prisma.businessWorkspace.delete({ where: { id: row.id } });
  return 1;
}

/**
 * Signed-in users get their owned workspace. Logged-out callers get a free public workspace.
 */
export async function getWorkspace(userId?: string | null): Promise<BusinessWorkspace> {
  const id = userId?.trim();
  if (!id) return PUBLIC_BUSINESS_WORKSPACE;
  return ensureOwnedBusinessWorkspace(id);
}

/** Ensure BusinessProfile + owned BusinessWorkspace for a user (W2.3 tenancy). */
export async function ensureOwnedBusinessWorkspace(
  userId: string,
  opts?: { name?: string; industry?: string },
): Promise<BusinessWorkspace> {
  const uid = userId.trim();
  if (!uid) throw new Error("userId is required.");
  const existing = await prisma.businessWorkspace.findUnique({ where: { ownerUserId: uid } });
  if (existing) {
    await prisma.businessProfile.upsert({
      where: { userId: uid },
      create: {
        userId: uid,
        name: (opts?.name || existing.name).trim().slice(0, 120) || existing.name,
        industry: (opts?.industry || existing.industry || null)?.toString().slice(0, 120) || null,
      },
      update: {
        ...(opts?.name ? { name: opts.name.trim().slice(0, 120) } : {}),
        ...(opts?.industry ? { industry: opts.industry.trim().slice(0, 120) } : {}),
      },
    });
    return readWorkspace(existing.id);
  }

  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { name: true, email: true },
  });
  const fields = newBusinessWorkspaceFields({
    name: opts?.name,
    userName: user?.name,
    email: user?.email,
    industry: opts?.industry,
  });
  await prisma.businessProfile.upsert({
    where: { userId: uid },
    create: { userId: uid, name: fields.name, industry: fields.industry || null },
    update: {
      ...(fields.name ? { name: fields.name } : {}),
      ...(fields.industry ? { industry: fields.industry } : {}),
    },
  });
  try {
    const created = await prisma.businessWorkspace.create({
      data: {
        ownerUserId: uid,
        name: fields.name,
        plan: fields.plan,
        industry: fields.industry,
      },
    });
    return readWorkspace(created.id);
  } catch (error) {
    if (!isUnique(error)) throw error;
    const raced = await prisma.businessWorkspace.findUnique({ where: { ownerUserId: uid } });
    if (!raced) throw error;
    return readWorkspace(raced.id);
  }
}

/** Update the company name / industry on the owned workspace + business profile. */
export async function updateOwnedBusinessProfile(
  userId: string,
  input: { name?: string; industry?: string },
) {
  const ws = await ensureOwnedBusinessWorkspace(userId);
  const name = (input.name ?? ws.name).trim().slice(0, 120);
  const industry = (input.industry ?? ws.industry).trim().slice(0, 120);
  if (!name) throw new Error("Company name is required.");
  await prisma.businessWorkspace.update({
    where: { id: ws.businessId },
    data: { name, industry },
  });
  await prisma.businessProfile.upsert({
    where: { userId },
    create: { userId, name, industry: industry || null },
    update: { name, industry: industry || null },
  });
  return readWorkspace(ws.businessId);
}

export async function setBusinessPlan(plan: string, workspaceId: string) {
  const code = plan.trim().toUpperCase();
  if (!isBusinessPlanCode(code)) {
    const { findActivePlan } = await import("@/lib/entitlements-db");
    const row = await findActivePlan(code);
    if (!row || row.audience !== "business") throw new Error("Unknown business plan.");
  }
  await readWorkspace(workspaceId);
  await prisma.businessWorkspace.update({ where: { id: workspaceId }, data: { plan: code } });
  return readWorkspace(workspaceId);
}

/** A shortlist or application note is stored only when it was entered. */
export function enteredNote(value: string | null | undefined): string | undefined {
  const note = (value ?? "").trim();
  return note.length > 0 ? note : undefined;
}

export async function addToShortlist(
  creatorSlug: string,
  note: string | undefined,
  workspaceId: string,
) {
  const ws = await readWorkspace(workspaceId);
  const limits = await businessEntitlementsForPlan(ws.plan);
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
      data: { workspaceId, creatorSlug, note: enteredNote(note) ?? null },
    });
  } catch (error) {
    if (!isUnique(error)) throw error;
  }
  return { ok: true as const, ws: await readWorkspace(workspaceId) };
}

export async function removeFromShortlist(creatorSlug: string, workspaceId: string) {
  await readWorkspace(workspaceId);
  await prisma.businessShortlistItem.deleteMany({
    where: { workspaceId, creatorSlug },
  });
  return readWorkspace(workspaceId);
}

export async function createBrief(
  input: Omit<CampaignBrief, "id" | "createdAt" | "status"> & { status?: CampaignBrief["status"] },
  workspaceId: string,
) {
  await readWorkspace(workspaceId);
  const brief = await prisma.businessBrief.create({
    data: {
      workspaceId,
      title: input.title,
      goal: input.goal,
      specialty: input.specialty,
      budget: input.budget,
      budgetCurrency: input.budgetCurrency || "USD",
      collabType: input.collabType ?? "",
      timeframe: input.timeframe ?? "",
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
  workspaceId: string,
) {
  await readWorkspace(workspaceId);
  const existing = await prisma.businessBrief.findFirst({
    where: { id, workspaceId },
  });
  if (!existing) throw new Error("Campaign intent not found.");
  const brief = await prisma.businessBrief.update({
    where: { id: existing.id },
    data: {
      title: input.title,
      goal: input.goal,
      specialty: input.specialty,
      budget: input.budget,
      budgetCurrency: input.budgetCurrency || existing.budgetCurrency,
      collabType: input.collabType ?? existing.collabType,
      timeframe: input.timeframe ?? existing.timeframe,
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
  budgetCurrency: string;
  collabType: string;
  timeframe: string;
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
    budgetCurrency: brief.budgetCurrency,
    collabType: brief.collabType,
    timeframe: brief.timeframe,
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

/** Best-effort split of a stored "City, State, Country" location string for editing. */
export function parseLocationParts(location: string): { city: string; state: string; country: string } {
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 3) return { city: parts[0]!, state: parts[1]!, country: parts.slice(2).join(", ") };
  if (parts.length === 2) return { city: parts[0]!, state: "", country: parts[1]! };
  if (parts.length === 1) return { city: parts[0]!, state: "", country: "" };
  return { city: "", state: "", country: "" };
}

function asCurrencyCode(value: string | undefined | null): string {
  const code = (value ?? "").trim().toUpperCase().slice(0, 3);
  return /^[A-Z]{3}$/.test(code) ? code : "USD";
}

export function buildCampaignIntentFields(input: {
  title?: string;
  goal?: string;
  specialty?: string;
  budget?: string;
  budgetCurrency?: string;
  location?: string;
  platform?: string;
  audience?: string;
  collabType?: string;
  timeframe?: string;
  summary?: string;
}) {
  const title = (input.title ?? "").trim();
  if (!title) throw new Error("A campaign title is required.");
  const summary = (input.summary ?? "").trim() || (input.audience ?? "").trim();
  return {
    title,
    goal: (input.goal ?? "").trim(),
    specialty: (input.specialty ?? "").trim(),
    budget: (input.budget ?? "").trim(),
    budgetCurrency: asCurrencyCode(input.budgetCurrency),
    collabType: (input.collabType ?? "").trim(),
    timeframe: (input.timeframe ?? "").trim(),
    location: (input.location ?? "").trim(),
    platform: (input.platform ?? "").trim(),
    summary,
    status: "draft" as const,
  };
}

export async function sendInquiry(
  input: {
    creatorSlug: string;
    message: string;
    briefId?: string;
  },
  workspaceId: string,
) {
  const ws = await readWorkspace(workspaceId);
  const limits = await businessEntitlementsForPlan(ws.plan);
  const month = new Date().toISOString().slice(0, 7);
  const sentThisMonth = ws.inquiries.filter((inquiry) => inquiry.createdAt.startsWith(month)).length;
  if (sentThisMonth >= limits.inquiryMaxPerMonth) {
    return {
      ok: false as const,
      error: `Monthly inquiry limit reached (${limits.inquiryMaxPerMonth}). Upgrade for higher limits.`,
    };
  }
  const message = input.message.trim();
  if (!message) {
    return { ok: false as const, error: "Write an inquiry message." };
  }
  const brief =
    input.briefId && ws.briefs.some((item) => item.id === input.briefId) ? input.briefId : undefined;
  const inquiry = await prisma.businessInquiry.create({
    data: {
      workspaceId,
      briefId: brief,
      creatorSlug: input.creatorSlug,
      message,
      status: "lead_created",
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

export async function updateInquiryStatus(
  id: string,
  status: Inquiry["status"],
  workspaceId: string,
) {
  await readWorkspace(workspaceId);
  const existing = await prisma.businessInquiry.findFirst({
    where: { id, workspaceId },
  });
  if (!existing) return { ok: false as const, error: "Inquiry not found." };
  const move = advanceLead(existing.status, status);
  if (!move.ok) return move;
  const updated = await prisma.businessInquiry.update({
    where: { id },
    data: { status: move.status },
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

/** Publishing a draft Campaign Intent to the marketplace moves it to active (#13, #15). */
export async function activateBrief(id: string, workspaceId: string) {
  await readWorkspace(workspaceId);
  const existing = await prisma.businessBrief.findFirst({ where: { id, workspaceId } });
  if (!existing || existing.status !== "draft") return;
  await prisma.businessBrief.update({ where: { id: existing.id }, data: { status: "active" } });
}

export async function queuedBriefIds(workspaceId: string) {
  await readWorkspace(workspaceId);
  const rows = await prisma.managedMatchRequest.findMany({
    where: { workspaceId, status: "queued" },
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

export async function requestManagedMatch(briefId: string, workspaceId: string) {
  const ws = await readWorkspace(workspaceId);
  const brief = ws.briefs.find((item) => item.id === briefId);
  if (!brief) return { ok: false as const, error: "Brief not found." };
  const [flagEnabled, queued] = await Promise.all([
    getManagedPromotionEnabled(),
    queuedBriefIds(workspaceId),
  ]);
  const gate = managedMatchGate({
    flagEnabled,
    planAllows: (await businessEntitlementsForPlan(ws.plan)).managedMatching,
    alreadyQueued: queued.includes(briefId),
  });
  if (!gate.ok) return gate;
  await prisma.managedMatchRequest.create({
    data: { workspaceId, briefId, status: "queued" },
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

/** Open creators score from lead tracking and collaboration features. A closed creator stays at the closed score. */
export function commercialReadinessFromEntitlements(
  openToCollab: boolean,
  limits: Pick<EntitlementLimits, "leadTracking" | "collabCta">,
): number {
  if (!openToCollab) return 30;
  if (limits.leadTracking) return 95;
  if (limits.collabCta) return 88;
  return 74;
}

/** Explainable business → creator fit for a brief. Blank brief fields are not scored. */
export function fitCreatorToBrief(creator: SeedCreator, brief: CampaignBrief): CreatorFit {
  const specialtyAsked = brief.specialty.trim();
  const specialtyHit = Boolean(
    specialtyAsked &&
      (creator.specialties.includes(specialtyAsked) ||
        creator.specialties.some((item) => item.includes(specialtyAsked) || specialtyAsked.includes(item))),
  );
  const specialtyFit = !specialtyAsked ? 0 : specialtyHit ? 94 : creator.specialties.length ? 62 : 40;

  const locationAsked = brief.location.trim();
  const geoHit = locationAsked ? geographyFits(creator, locationAsked) : false;
  const audienceGeo = !locationAsked ? 0 : geoHit ? 90 : 70;

  const platformAsked = brief.platform.trim();
  const platformHit = platformAsked ? creator.socials.some((social) => social.platform === platformAsked) : false;
  const platformFit = !platformAsked ? 0 : platformHit ? 92 : creator.socials.length ? 68 : 40;

  const limits = isPlanCode(creator.planTier) ? getEntitlements(creator.planTier) : EMPTY_ENTITLEMENTS;
  const commercialReadiness = commercialReadinessFromEntitlements(creator.openToCollab, limits);

  const parts = [
    specialtyAsked ? { weight: 0.35, value: specialtyFit } : null,
    locationAsked ? { weight: 0.2, value: audienceGeo } : null,
    platformAsked ? { weight: 0.25, value: platformFit } : null,
    { weight: 0.2, value: commercialReadiness },
  ].filter((part): part is { weight: number; value: number } => part !== null);
  const weightSum = parts.reduce((sum, part) => sum + part.weight, 0);
  const score = Math.round(parts.reduce((sum, part) => sum + part.value * part.weight, 0) / weightSum);

  const reasons: string[] = [];
  if (specialtyAsked && specialtyHit) {
    reasons.push(
      `Specialty match: ${specialtyLabel(specialtyAsked)} aligns with ${creator.specialties
        .slice(0, 2)
        .map(specialtyLabel)
        .join(", ")}`,
    );
  } else if (specialtyAsked) {
    reasons.push(`Partial specialty overlap — consider adjacent niches on ${creator.displayName}'s profile`);
  }
  if (locationAsked && geoHit) {
    reasons.push(`Geography fit for ${locationAsked}`);
  }
  if (platformHit) {
    reasons.push(`Active on ${platformAsked}`);
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
