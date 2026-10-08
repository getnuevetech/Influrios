import { prisma } from "@/lib/db";
import { listDirectoryCreators } from "@/lib/directory";

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
  feeExpectedCents?: number | null;
  feeIntentRef?: string | null;
  feeProviderRef?: string | null;
  feeSettlementAt?: string | null;
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

type IntroRow = {
  id: string;
  businessName: string;
  businessId: string;
  creatorSlug: string;
  briefTitle: string;
  notes: string;
  status: string;
  feeExpected: string | null;
  feeExpectedCents: number | null;
  feeIntentRef: string | null;
  feeProviderRef: string | null;
  feeSettlementAt: Date | null;
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
    feeExpectedCents: row.feeExpectedCents,
    feeIntentRef: row.feeIntentRef,
    feeProviderRef: row.feeProviderRef,
    feeSettlementAt: row.feeSettlementAt?.toISOString() ?? null,
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
    const creators = await listDirectoryCreators();
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

function businessKey(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug ? `biz_${slug}` : "biz_account";
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
      businessId: input.businessId?.trim() || businessKey(input.businessName),
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

const TERMINAL_INTRO_STATUSES = new Set<IntroStatus>(["paid", "declined", "closed"]);

/** Default deal basis for sandbox intro-fee quotes when ops omit a gross. */
export const DEFAULT_INTRO_FEE_GROSS_CENTS = 10_000;

/**
 * W4 — quote managed_intro fee and open a sandbox settlement intent.
 * Does not create CollaborationFunding / protected holds (R073).
 */
export async function requestIntroFeeSettlement(
  introId: string,
  opts?: { jurisdiction?: string; grossValueCents?: number },
) {
  await ensureManaged();
  const intro = await prisma.managedIntro.findUnique({ where: { id: introId } });
  if (!intro) return { ok: false as const, error: "Introduction not found." };
  const status = asIntroStatus(intro.status);
  if (TERMINAL_INTRO_STATUSES.has(status) && status !== "paid") {
    return { ok: false as const, error: "This introduction is closed and cannot be billed." };
  }
  if (status === "paid" && intro.feeProviderRef) {
    return { ok: false as const, error: "Intro fee already settled." };
  }
  const gross =
    Number.isInteger(opts?.grossValueCents) && (opts?.grossValueCents ?? 0) > 0
      ? (opts!.grossValueCents as number)
      : DEFAULT_INTRO_FEE_GROSS_CENTS;
  const { resolveFee } = await import("@/lib/collaboration-fees");
  const quote = await resolveFee({
    jurisdiction: opts?.jurisdiction || "US",
    serviceLevel: "managed_intro",
    grossValueCents: gross,
    fundingMode: "NONE",
    relationshipSource: "managed_intro",
    promotionChannel: "sponsored",
  });
  if (!quote.rule || quote.feeCents <= 0) {
    return { ok: false as const, error: quote.explanation || "No managed introduction fee rule matched." };
  }
  const intentRef = intro.feeIntentRef || `intro_fee_${intro.id}`;
  const now = new Date();
  const feeQuoteJson = {
    ruleId: quote.rule.id,
    ruleName: quote.rule.name,
    ruleVersion: quote.rule.version,
    feeType: quote.rule.feeType,
    feeCents: quote.feeCents,
    percentBps: quote.rule.percentBps,
    fixedCents: quote.rule.fixedCents,
    grossValueCents: gross,
    jurisdiction: opts?.jurisdiction || "US",
    explanation: quote.explanation,
    capturedAt: now.toISOString(),
  };
  const row = await prisma.managedIntro.update({
    where: { id: intro.id },
    data: {
      feeExpectedCents: quote.feeCents,
      feeQuoteJson,
      feeIntentRef: intentRef,
      events: {
        create: {
          status: intro.status,
          note: `Fee settlement requested · ${quote.feeCents}¢ · intent ${intentRef}`,
          createdAt: now,
        },
      },
    },
    include: { events: true },
  });
  return {
    ok: true as const,
    introId: row.id,
    feeCents: quote.feeCents,
    intentRef,
    quote: {
      ruleId: quote.rule.id,
      explanation: quote.explanation,
      feeType: quote.rule.feeType,
    },
  };
}

/**
 * A typed reference is not payment. The intro stays unpaid until the provider webhook.
 */
export async function confirmIntroFeeSettlement(introId: string, _providerRef: string) {
  await ensureManaged();
  const intro = await prisma.managedIntro.findUnique({ where: { id: introId } });
  if (!intro) return { ok: false as const, error: "Introduction not found." };
  if (!intro.feeIntentRef || intro.feeExpectedCents == null) {
    return { ok: false as const, error: "Request an intro fee quote before confirming settlement." };
  }
  return {
    ok: false as const,
    error: "An intro fee is marked paid only when the provider webhook arrives. Nothing was marked paid.",
  };
}

/** Marks the intro paid from a verified provider event. The same payment id does not settle twice. */
export async function applyIntroFeeFromWebhook(input: { intentRef: string; paymentId: string; eventId: string }) {
  await ensureManaged();
  const intentRef = input.intentRef.trim();
  const paymentId = input.paymentId.trim().slice(0, 120);
  if (!intentRef || !paymentId) return { ok: false as const, error: "Payment id is required.", status: 400 };
  const intro = await prisma.managedIntro.findFirst({ where: { feeIntentRef: intentRef } });
  if (!intro) return { ok: false as const, error: "Introduction not found.", status: 404 };
  if (intro.feeExpectedCents == null) {
    return { ok: false as const, error: "Request an intro fee quote before settlement.", status: 409 };
  }
  if (asIntroStatus(intro.status) === "paid" && intro.feeProviderRef === paymentId) {
    return { ok: true as const, duplicate: true, introId: intro.id };
  }
  if (asIntroStatus(intro.status) === "paid") {
    return { ok: false as const, error: "Intro fee already settled with a different provider reference.", status: 409 };
  }
  const now = new Date();
  await prisma.managedIntro.update({
    where: { id: intro.id },
    data: {
      status: "paid",
      feeProviderRef: paymentId,
      feeSettlementAt: now,
      events: {
        create: {
          status: "paid",
          note: `Intro fee settled from provider webhook ${input.eventId} · ${intro.feeExpectedCents}¢`,
          createdAt: now,
        },
      },
    },
  });
  return { ok: true as const, duplicate: false, introId: intro.id };
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
