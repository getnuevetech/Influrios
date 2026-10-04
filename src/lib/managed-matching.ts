import { prisma } from "@/lib/db";
import { listDirectoryCreators } from "@/lib/directory";
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

export type MatchQueueItem = {
  id: string;
  briefId: string;
  briefTitle: string;
  businessName: string;
  status: string;
  createdAt: string;
};

const INTRO_STATUS_CODES: IntroStatus[] = [
  "draft",
  "outreach",
  "introduced",
  "in_conversation",
  "paid",
  "declined",
  "closed",
];

const FLAG_KEY = "managed_promotion";

function asIntroStatus(value: string): IntroStatus {
  return INTRO_STATUS_CODES.includes(value as IntroStatus) ? (value as IntroStatus) : "draft";
}

function isUnique(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && String(error.code) === "P2002";
}

type IntroRow = {
  id: string;
  businessName: string;
  businessId: string;
  creatorSlug: string;
  briefTitle: string;
  notes: string;
  status: string;
  feeExpected: string | null;
  createdAt: Date;
  updatedAt: Date;
  events: { status: string; note: string | null; createdAt: Date }[];
};

function mapIntro(row: IntroRow): ManagedIntro {
  return {
    id: row.id,
    businessName: row.businessName,
    businessId: row.businessId,
    creatorSlug: row.creatorSlug,
    briefTitle: row.briefTitle,
    notes: row.notes,
    status: asIntroStatus(row.status),
    feeExpected: row.feeExpected ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    timeline: [...row.events]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((event) => ({
        at: event.createdAt.toISOString(),
        status: asIntroStatus(event.status),
        note: event.note ?? undefined,
      })),
  };
}

let managedSeed: Promise<void> | null = null;

async function seedManaged() {
  const optCount = await prisma.creatorManagedOptIn.count();
  if (optCount === 0) {
    const creators = await listDirectoryCreators().catch(() => SEED_CREATORS);
    await prisma.creatorManagedOptIn.createMany({
      data: creators.map((creator) => ({
        creatorSlug: creator.slug,
        openToManaged: creator.openToCollab && creator.planTier !== "STARTER",
        targetingNotes: creator.offer ?? "",
        niches: creator.specialties.slice(0, 3),
      })),
      skipDuplicates: true,
    });
  }

  const intro = await prisma.managedIntro.findUnique({ where: { id: "intro-demo-1" } });
  const introCount = await prisma.managedIntro.count();
  if (intro || introCount > 0) return;
  const base = Date.now();
  try {
    await prisma.managedIntro.create({
      data: {
        id: "intro-demo-1",
        businessName: "Luminous Beauty",
        businessId: "demo-business",
        creatorSlug: "sofia-martinez",
        briefTitle: "Clean Skincare Launch",
        briefId: "brief-clean-launch",
        notes: "Manual intro — beauty educator fit for 3-post series.",
        status: "introduced",
        feeExpected: "15% success fee",
        events: {
          create: [
            { status: "draft", note: "Shortlist delivered", createdAt: new Date(base) },
            { status: "outreach", note: "Influencer contacted", createdAt: new Date(base + 1000) },
            { status: "introduced", note: "Both parties connected", createdAt: new Date(base + 2000) },
          ],
        },
      },
    });
  } catch (error) {
    if (!isUnique(error)) throw error;
  }
}

function ensureManaged() {
  if (!managedSeed) {
    managedSeed = seedManaged().catch((error) => {
      managedSeed = null;
      throw error;
    });
  }
  return managedSeed;
}

export async function getManagedPromotionEnabled() {
  const row = await prisma.featureFlag.upsert({
    where: { key: FLAG_KEY },
    update: {},
    create: {
      key: FLAG_KEY,
      enabled: true,
      description: "Agency workspaces can ask for managed matching. Turn this off to stop new requests.",
    },
  });
  return row.enabled;
}

export async function setManagedPromotionEnabled(enabled: boolean) {
  await prisma.featureFlag.upsert({
    where: { key: FLAG_KEY },
    update: { enabled },
    create: {
      key: FLAG_KEY,
      enabled,
      description: "Agency workspaces can ask for managed matching. Turn this off to stop new requests.",
    },
  });
  return enabled;
}

export async function getManagedMatching(): Promise<ManagedMatchingStore> {
  await ensureManaged();
  const [intros, optIns] = await Promise.all([
    prisma.managedIntro.findMany({
      include: { events: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.creatorManagedOptIn.findMany({ orderBy: { creatorSlug: "asc" } }),
  ]);
  return {
    intros: intros.map(mapIntro),
    optIns: optIns.map((row) => ({
      creatorSlug: row.creatorSlug,
      openToManaged: row.openToManaged,
      targetingNotes: row.targetingNotes,
      niches: row.niches,
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

export async function setCreatorOptIn(
  creatorSlug: string,
  patch: Partial<Omit<CreatorOptIn, "creatorSlug">>,
) {
  await ensureManaged();
  const prev = await prisma.creatorManagedOptIn.findUnique({ where: { creatorSlug } });
  const row = await prisma.creatorManagedOptIn.upsert({
    where: { creatorSlug },
    update: {
      openToManaged: patch.openToManaged ?? prev?.openToManaged ?? false,
      targetingNotes: patch.targetingNotes ?? prev?.targetingNotes ?? "",
      niches: patch.niches ?? prev?.niches ?? [],
    },
    create: {
      creatorSlug,
      openToManaged: patch.openToManaged ?? false,
      targetingNotes: patch.targetingNotes ?? "",
      niches: patch.niches ?? [],
    },
  });
  return {
    creatorSlug: row.creatorSlug,
    openToManaged: row.openToManaged,
    targetingNotes: row.targetingNotes,
    niches: row.niches,
    updatedAt: row.updatedAt.toISOString(),
  } satisfies CreatorOptIn;
}

export async function createIntro(input: {
  businessName: string;
  businessId?: string;
  creatorSlug: string;
  briefTitle: string;
  briefId?: string;
  notes?: string;
  feeExpected?: string;
}) {
  await ensureManaged();
  const now = new Date();
  const row = await prisma.managedIntro.create({
    data: {
      businessName: input.businessName,
      businessId: input.businessId ?? "demo-business",
      creatorSlug: input.creatorSlug,
      briefTitle: input.briefTitle,
      briefId: input.briefId,
      notes: input.notes ?? "",
      status: "draft",
      feeExpected: input.feeExpected,
      events: {
        create: { status: "draft", note: "Intro created from shortlist", createdAt: now },
      },
    },
    include: { events: true },
  });
  return mapIntro(row);
}

export async function advanceIntro(id: string, status: IntroStatus, note?: string) {
  await ensureManaged();
  const existing = await prisma.managedIntro.findUnique({ where: { id } });
  if (!existing) return null;
  const now = new Date();
  const row = await prisma.managedIntro.update({
    where: { id },
    data: {
      status,
      events: { create: { status, note, createdAt: now } },
    },
    include: { events: true },
  });
  return mapIntro(row);
}

export async function listQueuedMatchRequests(): Promise<MatchQueueItem[]> {
  const rows = await prisma.managedMatchRequest.findMany({
    where: { status: "queued" },
    include: { brief: true, workspace: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    briefId: row.briefId,
    briefTitle: row.brief.title,
    businessName: row.workspace.name,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function recordIntroFromRequest(input: {
  requestId: string;
  creatorSlug: string;
  notes?: string;
  feeExpected?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.managedMatchRequest.findUnique({
      where: { id: input.requestId },
      include: { brief: true, workspace: true },
    });
    if (!request || request.status !== "queued") {
      return { ok: false as const, error: "This request is no longer in the queue." };
    }
    if (!input.creatorSlug) {
      return { ok: false as const, error: "Choose an influencer for the introduction." };
    }
    const now = new Date();
    const intro = await tx.managedIntro.create({
      data: {
        businessName: request.workspace.name,
        businessId: request.workspaceId,
        creatorSlug: input.creatorSlug,
        briefTitle: request.brief.title,
        briefId: request.briefId,
        notes: input.notes ?? "",
        status: "draft",
        feeExpected: input.feeExpected,
        events: {
          create: { status: "draft", note: "Recorded from the managed queue", createdAt: now },
        },
      },
    });
    const updated = await tx.managedMatchRequest.updateMany({
      where: { id: request.id, status: "queued" },
      data: { status: "intro_recorded", introId: intro.id },
    });
    if (updated.count !== 1) {
      throw new Error("This request is no longer in the queue.");
    }
    return { ok: true as const, introId: intro.id };
  });
}

export const INTRO_STATUSES: { code: IntroStatus; label: string }[] = [
  { code: "draft", label: "Draft" },
  { code: "outreach", label: "Outreach" },
  { code: "introduced", label: "Introduced" },
  { code: "in_conversation", label: "In conversation" },
  { code: "paid", label: "Intro fee settled" },
  { code: "declined", label: "Declined" },
  { code: "closed", label: "Closed" },
];
