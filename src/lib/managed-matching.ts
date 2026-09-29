import { promises as fs } from "fs";
import path from "path";
import { SEED_CREATORS } from "@/lib/seed-data";

export type IntroStatus =
  | "draft"
  | "outreach"
  | "introduced"
  | "in_conversation"
  | "paid"
  | "declined"
  | "closed";

export type ManagedIntro = {
  id: string;
  businessName: string;
  businessId: string;
  creatorSlug: string;
  briefTitle: string;
  notes: string;
  status: IntroStatus;
  feeExpected?: string;
  createdAt: string;
  updatedAt: string;
  timeline: { at: string; status: IntroStatus; note?: string }[];
};

export type CreatorOptIn = {
  creatorSlug: string;
  openToManaged: boolean;
  targetingNotes: string;
  niches: string[];
  updatedAt: string;
};

export type ManagedMatchingStore = {
  intros: ManagedIntro[];
  optIns: CreatorOptIn[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "managed-matching.json");

const DEFAULT_STORE: ManagedMatchingStore = {
  intros: [
    {
      id: "intro-demo-1",
      businessName: "Luminous Beauty",
      businessId: "demo-business",
      creatorSlug: "sofia-martinez",
      briefTitle: "Clean Skincare Launch",
      notes: "Manual intro — beauty educator fit for 3-post series.",
      status: "introduced",
      feeExpected: "15% success fee",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [
        { at: new Date().toISOString(), status: "draft", note: "Shortlist delivered" },
        { at: new Date().toISOString(), status: "outreach", note: "Creator contacted" },
        { at: new Date().toISOString(), status: "introduced", note: "Both parties connected" },
      ],
    },
  ],
  optIns: SEED_CREATORS.map((c) => ({
    creatorSlug: c.slug,
    openToManaged: c.openToCollab && c.planTier !== "STARTER",
    targetingNotes: c.offer ?? "",
    niches: c.specialties.slice(0, 3),
    updatedAt: new Date().toISOString(),
  })),
};

async function ensureStore(): Promise<ManagedMatchingStore> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as ManagedMatchingStore;
  } catch {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(STORE_PATH, JSON.stringify(DEFAULT_STORE, null, 2));
    } catch {
      /* read-only build context */
    }
    return structuredClone(DEFAULT_STORE);
  }
}

async function saveStore(store: ManagedMatchingStore) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}

export async function getManagedMatching(): Promise<ManagedMatchingStore> {
  return ensureStore();
}

export async function setCreatorOptIn(
  creatorSlug: string,
  patch: Partial<Omit<CreatorOptIn, "creatorSlug">>,
) {
  const store = await ensureStore();
  const idx = store.optIns.findIndex((o) => o.creatorSlug === creatorSlug);
  const prev = idx >= 0 ? store.optIns[idx] : null;
  const next: CreatorOptIn = {
    creatorSlug,
    openToManaged: patch.openToManaged ?? prev?.openToManaged ?? false,
    targetingNotes: patch.targetingNotes ?? prev?.targetingNotes ?? "",
    niches: patch.niches ?? prev?.niches ?? [],
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) store.optIns[idx] = next;
  else store.optIns.push(next);
  await saveStore(store);
  return next;
}

export async function createIntro(input: {
  businessName: string;
  businessId?: string;
  creatorSlug: string;
  briefTitle: string;
  notes?: string;
  feeExpected?: string;
}) {
  const store = await ensureStore();
  const now = new Date().toISOString();
  const intro: ManagedIntro = {
    id: `intro-${Date.now()}`,
    businessName: input.businessName,
    businessId: input.businessId ?? "demo-business",
    creatorSlug: input.creatorSlug,
    briefTitle: input.briefTitle,
    notes: input.notes ?? "",
    status: "draft",
    feeExpected: input.feeExpected,
    createdAt: now,
    updatedAt: now,
    timeline: [{ at: now, status: "draft", note: "Intro created from shortlist" }],
  };
  store.intros.unshift(intro);
  await saveStore(store);
  return intro;
}

export async function advanceIntro(id: string, status: IntroStatus, note?: string) {
  const store = await ensureStore();
  const intro = store.intros.find((i) => i.id === id);
  if (!intro) return null;
  const now = new Date().toISOString();
  intro.status = status;
  intro.updatedAt = now;
  intro.timeline.push({ at: now, status, note });
  await saveStore(store);
  return intro;
}

export const INTRO_STATUSES: { code: IntroStatus; label: string }[] = [
  { code: "draft", label: "Draft" },
  { code: "outreach", label: "Outreach" },
  { code: "introduced", label: "Introduced" },
  { code: "in_conversation", label: "In conversation" },
  { code: "paid", label: "Paid relationship" },
  { code: "declined", label: "Declined" },
  { code: "closed", label: "Closed" },
];
