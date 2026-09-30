/**
 * Phase 8 — Creator Claim & Activation
 * Draft → claim → verify → publish (value before signup), file-backed demo store.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import { decideCount } from "@/lib/entitlements";
import { entitlementsForPlan } from "@/lib/entitlements-db";
import { evaluateCompletion, secondSocialDecision } from "@/lib/onboarding";
import { cookies } from "next/headers";
import path from "path";
import type { SeedCreator, SeedSocial } from "@/lib/seed-data";
import { SPECIALTY_TAXONOMY } from "@/lib/seed-data";

export type ClaimStage = "draft" | "claimed" | "verified" | "published";

export type ClaimDraft = {
  id: string;
  slug: string;
  stage: ClaimStage;
  inputHandle: string;
  platform: SeedSocial["platform"];
  displayName: string;
  title: string;
  bio: string;
  locationCity: string;
  locationCountry: string;
  specialties: string[];
  socials: SeedSocial[];
  image: string;
  email?: string;
  ownerName?: string;
  /** Demo verification code shown after claim — enter to verify */
  verifyCode?: string;
  verifiedAt?: string;
  publishedAt?: string;
  attribution: string;
  createdAt: string;
  updatedAt: string;
};

export type ClaimStore = {
  drafts: ClaimDraft[];
};

export type CompletenessItem = {
  id: string;
  label: string;
  done: boolean;
  weight: number;
  hint: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "claim-funnel.json");
const COOKIE_NAME = "influrios_creator_session";
const SESSION_DAYS = 14;
const DEMO_IMAGES = [
  "/demo/creators/creator-sofia.jpg",
  "/demo/creators/creator-priya.jpg",
  "/demo/creators/creator-marcus.jpg",
  "/demo/creators/creator-amara.jpg",
  "/demo/creators/creator-jordan.jpg",
  "/demo/creators/creator-daniel.jpg",
];

function secret() {
  return process.env.CREATOR_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || "influrios-creator-demo";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

async function ensureStore(): Promise<ClaimStore> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as ClaimStore;
  } catch {
    const store: ClaimStore = { drafts: [] };
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
    } catch {
      /* read-only FS — serve in-memory defaults */
    }
    return store;
  }
}

async function saveStore(store: ClaimStore) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch {
    /* ignore write failures in read-only environments */
  }
}

export async function getClaimStore() {
  return ensureStore();
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function titleCase(s: string) {
  return s
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function detectPlatform(raw: string): { platform: SeedSocial["platform"]; handle: string } {
  const cleaned = raw.trim();
  const lower = cleaned.toLowerCase();
  let platform: SeedSocial["platform"] = "INSTAGRAM";
  if (lower.includes("tiktok.com") || lower.includes("tiktok")) platform = "TIKTOK";
  else if (lower.includes("youtube.com") || lower.includes("youtu.be") || lower.includes("youtube"))
    platform = "YOUTUBE";
  else if (lower.includes("x.com") || lower.includes("twitter.com") || lower.startsWith("@x/"))
    platform = "X";

  let handle = cleaned
    .replace(/^https?:\/\//, "")
    .replace(/^(www\.)?/, "")
    .replace(/^(instagram|tiktok|youtube|www)\.com\//, "")
    .replace(/^x\.com\//, "")
    .replace(/^twitter\.com\//, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .trim();

  if (!handle) handle = "creator";
  return { platform, handle };
}

function platformUrl(platform: SeedSocial["platform"], handle: string) {
  if (platform === "TIKTOK") return `https://tiktok.com/@${handle}`;
  if (platform === "YOUTUBE") return `https://youtube.com/@${handle}`;
  if (platform === "X") return `https://x.com/${handle}`;
  return `https://instagram.com/${handle}`;
}

function guessSpecialty(handle: string, platform: string): string[] {
  const hay = `${handle} ${platform}`.toLowerCase();
  for (const s of SPECIALTY_TAXONOMY) {
    if (hay.includes(s.slug) || hay.includes(s.name.toLowerCase().split(" ")[0]!)) {
      return [s.slug];
    }
  }
  return ["lifestyle"];
}

/** Build a private draft card from one social URL/handle — no signup required. */
export async function createDraftFromHandle(
  input: string,
  attribution = "ORGANIC_SIGNUP",
): Promise<ClaimDraft> {
  const store = await ensureStore();
  const { platform, handle } = detectPlatform(input);
  const baseSlug = slugify(handle) || `creator-${randomBytes(3).toString("hex")}`;
  let slug = baseSlug;
  let n = 2;
  while (
    store.drafts.some((d) => d.slug === slug) ||
    // avoid colliding with common seed names lightly
    ["sofia-martinez", "priya-sharma", "marcus-lee"].includes(slug)
  ) {
    slug = `${baseSlug}-${n++}`;
  }

  const displayName = titleCase(handle.replace(/[0-9]+$/g, "")) || "New Creator";
  const specialty = guessSpecialty(handle, platform);
  const specialtyName =
    SPECIALTY_TAXONOMY.find((s) => s.slug === specialty[0])?.name ?? "Lifestyle";
  const now = new Date().toISOString();
  const image = DEMO_IMAGES[Math.abs(hash(handle)) % DEMO_IMAGES.length]!;

  const draft: ClaimDraft = {
    id: `draft_${randomBytes(6).toString("hex")}`,
    slug,
    stage: "draft",
    inputHandle: input.trim(),
    platform,
    displayName,
    title: `${specialtyName} Creator`,
    bio: `Draft Influencer Card for @${handle}. Confirm specialties, bio, and location after you claim — nothing publishes until you say so.`,
    locationCity: "Your city",
    locationCountry: "Your country",
    specialties: specialty,
    socials: [
      {
        platform,
        handle: `@${handle}`,
        url: platformUrl(platform, handle),
        followers: 1200 + (Math.abs(hash(handle)) % 8000),
      },
    ],
    image,
    attribution,
    createdAt: now,
    updatedAt: now,
  };

  store.drafts.unshift(draft);
  await saveStore(store);
  await rememberOnboarding(() => syncSession(draft));
  return draft;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export async function getDraft(id: string) {
  const store = await ensureStore();
  return store.drafts.find((d) => d.id === id) ?? null;
}

export async function getDraftBySlug(slug: string) {
  const store = await ensureStore();
  return store.drafts.find((d) => d.slug === slug) ?? null;
}

export async function listPublishedClaimCreators(): Promise<SeedCreator[]> {
  const store = await ensureStore();
  return store.drafts.filter((draft) => draft.stage === "published").map(draftToSeedCreator);
}

export async function getPublishedCreatorBySlug(slug: string): Promise<SeedCreator | null> {
  const draft = await getDraftBySlug(slug);
  if (!draft || draft.stage !== "published") return null;
  return draftToSeedCreator(draft);
}

export function draftToSeedCreator(draft: ClaimDraft): SeedCreator {
  return {
    slug: draft.slug,
    displayName: draft.displayName,
    title: draft.title,
    bio: draft.bio,
    locationCity: draft.locationCity,
    locationCountry: draft.locationCountry,
    languages: ["English"],
    avatarColor: "#633CFF",
    image: draft.image,
    badge: draft.stage === "published" ? "Rising Star" : "Draft",
    statusLabel: draft.stage === "published" ? "Open to partnerships" : "Draft — not public",
    planTier: "STARTER",
    specialties: draft.specialties,
    socials: draft.socials,
    openToCollab: true,
    verified: draft.stage === "verified" || draft.stage === "published",
  };
}

export async function claimDraft(input: {
  draftId: string;
  email: string;
  name: string;
}): Promise<ClaimDraft> {
  const store = await ensureStore();
  const draft = store.drafts.find((d) => d.id === input.draftId);
  if (!draft) throw new Error("Draft not found");
  if (draft.stage === "published") throw new Error("Already published");

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email.includes("@") || !name) throw new Error("Name and valid email required");

  draft.email = email;
  draft.ownerName = name;
  draft.displayName = name;
  draft.stage = "claimed";
  draft.verifyCode = String(100000 + (Math.abs(hash(email + draft.id)) % 900000));
  draft.updatedAt = new Date().toISOString();
  await saveStore(store);
  await rememberOnboarding(() => recordClaimRow(draft));
  return draft;
}

export async function verifyDraft(draftId: string, code: string): Promise<ClaimDraft> {
  const store = await ensureStore();
  const draft = store.drafts.find((d) => d.id === draftId);
  if (!draft) throw new Error("Draft not found");
  if (draft.stage === "draft") throw new Error("Claim the card before verifying");
  if (!draft.verifyCode || code.trim() !== draft.verifyCode) {
    await rememberOnboarding(() =>
      recordAttempt(draft, { channel: "EMAIL", success: false, detail: "invalid demo code" }),
    );
    throw new Error("Invalid verification code");
  }
  draft.stage = "verified";
  draft.verifiedAt = new Date().toISOString();
  draft.updatedAt = draft.verifiedAt;
  // Replace placeholder location once verified
  if (draft.locationCity === "Your city") {
    draft.locationCity = "Lagos";
    draft.locationCountry = "Nigeria";
  }
  await saveStore(store);
  await rememberOnboarding(() =>
    recordAttempt(draft, {
      channel: "EMAIL",
      success: true,
      detail: "demo email code accepted; social account remains unverified",
    }),
  );
  return draft;
}

export async function publishDraft(draftId: string): Promise<ClaimDraft> {
  const store = await ensureStore();
  const draft = store.drafts.find((d) => d.id === draftId);
  if (!draft) throw new Error("Draft not found");
  if (draft.stage !== "verified" && draft.stage !== "published") {
    throw new Error("Verify ownership before publishing");
  }
  draft.stage = "published";
  draft.publishedAt = new Date().toISOString();
  draft.updatedAt = draft.publishedAt;
  await saveStore(store);
  await rememberOnboarding(async () => {
    const { persistPublishedClaim } = await import("@/lib/claim-persist");
    await persistPublishedClaim(draft);
    const { invalidateDirectoryCache } = await import("@/lib/directory");
    invalidateDirectoryCache();
  });
  return draft;
}

export async function addDraftSocial(
  draftId: string,
  social: SeedSocial,
): Promise<ClaimDraft> {
  const store = await ensureStore();
  const draft = store.drafts.find((item) => item.id === draftId);
  if (!draft) throw new Error("Draft not found");
  const limits = await entitlementsForPlan("STARTER");
  const decision = secondSocialDecision(draft.socials.length, limits, "STARTER");
  if (!decision.ok) {
    const upgrade = decision.upgradePlanCode ? ` Upgrade to ${decision.upgradePlanCode}.` : "";
    throw new Error(
      `card.social_links.max limit ${decision.limit}.${upgrade} Starter includes ${decision.limit} social ${decision.limit === 1 ? "link" : "links"}.`,
    );
  }
  draft.socials.push(social);
  draft.updatedAt = new Date().toISOString();
  await saveStore(store);
  await rememberOnboarding(() => syncSession(draft));
  return draft;
}

export async function updateDraftProfile(
  draftId: string,
  patch: Partial<
    Pick<
      ClaimDraft,
      "displayName" | "title" | "bio" | "locationCity" | "locationCountry" | "specialties"
    >
  >,
): Promise<ClaimDraft> {
  const store = await ensureStore();
  const draft = store.drafts.find((d) => d.id === draftId);
  if (!draft) throw new Error("Draft not found");
  if (patch.specialties) {
    const limits = await entitlementsForPlan("STARTER");
    const decision = decideCount(limits, "specialtiesMax", patch.specialties.length, "STARTER");
    if (!decision.ok) {
      const upgrade = decision.upgradePlanCode ? ` Upgrade to ${decision.upgradePlanCode}.` : "";
      throw new Error(
        `This card includes ${decision.limit} ${decision.limit === 1 ? "specialty" : "specialties"}.${upgrade}`,
      );
    }
  }
  Object.assign(draft, patch);
  draft.updatedAt = new Date().toISOString();
  await saveStore(store);
  return draft;
}

export function completenessFor(draft: ClaimDraft): {
  score: number;
  items: CompletenessItem[];
} {
  return evaluateCompletion(draft);
}

async function rememberOnboarding(work: () => Promise<void>) {
  try {
    await work();
  } catch (error) {
    console.error("onboarding persist skipped", error);
  }
}

async function syncSession(draft: ClaimDraft) {
  const { syncOnboardingSession } = await import("@/lib/claim-persist");
  await syncOnboardingSession(draft);
}

async function recordClaimRow(draft: ClaimDraft) {
  const { recordClaim } = await import("@/lib/claim-persist");
  await recordClaim(draft);
}

async function recordAttempt(
  draft: ClaimDraft,
  input: { channel: "EMAIL" | "SOCIAL"; success: boolean; detail?: string },
) {
  const { recordVerificationAttempt } = await import("@/lib/claim-persist");
  await recordVerificationAttempt({ draft, ...input });
}

export async function setCreatorSession(draftId: string) {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  const body = Buffer.from(JSON.stringify({ draftId, exp }), "utf8").toString("base64url");
  const token = `${body}.${sign(body)}`;
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function clearCreatorSession() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function getCreatorSessionDraft(): Promise<ClaimDraft | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      draftId: string;
      exp: number;
    };
    if (parsed.exp < Date.now()) return null;
    return getDraft(parsed.draftId);
  } catch {
    return null;
  }
}

export const CREATOR_COOKIE = COOKIE_NAME;
