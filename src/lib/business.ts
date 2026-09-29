import { getBusinessEntitlements, type BusinessPlanCode } from "@/lib/business-entitlements";
import { SEED_CREATORS, specialtyLabel, type SeedCreator } from "@/lib/seed-data";
import { promises as fs } from "fs";
import path from "path";

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

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "business-workspace.json");

const DEFAULT_WORKSPACE: BusinessWorkspace = {
  businessId: "demo-business",
  name: "Luminous Beauty",
  plan: "BUSINESS_PRO",
  industry: "Skincare & Wellness",
  shortlist: [
    { creatorSlug: "sofia-martinez", addedAt: new Date().toISOString(), note: "Top beauty fit" },
    { creatorSlug: "amara-okonkwo", addedAt: new Date().toISOString(), note: "Natural-hair angle" },
  ],
  briefs: [
    {
      id: "brief-clean-launch",
      title: "Clean Skincare Launch",
      goal: "Product Launch",
      specialty: "beauty",
      budget: "$5K – $10K",
      location: "USA",
      platform: "INSTAGRAM",
      summary: "Seeking beauty educators for a 3-post launch series with honest routine content.",
      createdAt: new Date().toISOString(),
      status: "active",
    },
  ],
  inquiries: [],
};

async function ensureStore(): Promise<BusinessWorkspace> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as BusinessWorkspace;
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(DEFAULT_WORKSPACE, null, 2));
    return structuredClone(DEFAULT_WORKSPACE);
  }
}

async function saveStore(ws: BusinessWorkspace) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(ws, null, 2));
}

export async function getWorkspace(): Promise<BusinessWorkspace> {
  return ensureStore();
}

export async function setBusinessPlan(plan: BusinessPlanCode) {
  const ws = await ensureStore();
  ws.plan = plan;
  await saveStore(ws);
  return ws;
}

export async function addToShortlist(creatorSlug: string, note?: string) {
  const ws = await ensureStore();
  const limits = getBusinessEntitlements(ws.plan);
  if (ws.shortlist.some((s) => s.creatorSlug === creatorSlug)) return { ok: true as const, ws };
  if (ws.shortlist.length >= limits.shortlistMax) {
    return {
      ok: false as const,
      error: `Shortlist limit reached (${limits.shortlistMax}). Upgrade Business Pro for larger lists.`,
      ws,
    };
  }
  if (!SEED_CREATORS.some((c) => c.slug === creatorSlug)) {
    return { ok: false as const, error: "Creator not found", ws };
  }
  ws.shortlist.unshift({
    creatorSlug,
    addedAt: new Date().toISOString(),
    note,
  });
  await saveStore(ws);
  return { ok: true as const, ws };
}

export async function removeFromShortlist(creatorSlug: string) {
  const ws = await ensureStore();
  ws.shortlist = ws.shortlist.filter((s) => s.creatorSlug !== creatorSlug);
  await saveStore(ws);
  return ws;
}

export async function createBrief(input: Omit<CampaignBrief, "id" | "createdAt" | "status">) {
  const ws = await ensureStore();
  const brief: CampaignBrief = {
    ...input,
    id: `brief-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: "active",
  };
  ws.briefs.unshift(brief);
  await saveStore(ws);
  return brief;
}

export async function sendInquiry(input: {
  creatorSlug: string;
  message: string;
  briefId?: string;
}) {
  const ws = await ensureStore();
  const limits = getBusinessEntitlements(ws.plan);
  const month = new Date().toISOString().slice(0, 7);
  const sentThisMonth = ws.inquiries.filter((i) => i.createdAt.startsWith(month)).length;
  if (sentThisMonth >= limits.inquiryMaxPerMonth) {
    return {
      ok: false as const,
      error: `Monthly inquiry limit reached (${limits.inquiryMaxPerMonth}). Upgrade for higher limits.`,
    };
  }
  const inquiry: Inquiry = {
    id: `inq-${Date.now()}`,
    creatorSlug: input.creatorSlug,
    briefId: input.briefId,
    message: input.message,
    status: "sent",
    createdAt: new Date().toISOString(),
  };
  ws.inquiries.unshift(inquiry);
  await saveStore(ws);
  return { ok: true as const, inquiry };
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

/** Explainable business → creator fit for a brief. */
export function fitCreatorToBrief(creator: SeedCreator, brief: CampaignBrief): CreatorFit {
  const specialtyHit =
    creator.specialties.includes(brief.specialty) ||
    creator.specialties.some((s) => s.includes(brief.specialty) || brief.specialty.includes(s));
  const specialtyFit = specialtyHit ? 94 : creator.specialties.length ? 62 : 40;

  const geoHay = `${creator.locationCity} ${creator.locationCountry}`.toLowerCase();
  const audienceGeo = brief.location && geoHay.includes(brief.location.toLowerCase()) ? 90 : 70;

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
  if (brief.location && geoHay.includes(brief.location.toLowerCase())) {
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

export function rankCreatorsForBrief(brief: CampaignBrief): CreatorFit[] {
  return SEED_CREATORS.map((c) => fitCreatorToBrief(c, brief)).sort((a, b) => b.score - a.score);
}
