import { prisma } from "@/lib/db";
import {
  attributionExpiresAt,
  attributionWindowStart,
  canAttributeRepeat,
  canResolveAttributionClaim,
  normalizeAttributionExpiryDays,
  serviceLevelForFeeResolution,
} from "@/lib/attribution";

const CONFIRMED = ["held", "completed", "refunded"];

export async function ensureAttributionSources() {
  await prisma.marketplaceSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", reviewWindowHours: 72 },
  });
  const settings = await prisma.marketplaceSettings.findUnique({ where: { id: "default" } });
  if (settings?.sourcesSeeded) return;
  await prisma.$transaction(async (tx) => {
    const current = await tx.marketplaceSettings.findUnique({ where: { id: "default" } });
    if (current?.sourcesSeeded) return;
    const count = await tx.attributionSource.count();
    if (count === 0) {
      await tx.attributionSource.createMany({
        data: [
          { label: "Direct brief", sortOrder: 1, active: true },
          { label: "Influencer card", sortOrder: 2, active: true },
          { label: "Returning business", sortOrder: 3, active: true },
          { label: "Pre-existing relationship", sortOrder: 4, active: true },
        ],
      });
    }
    await tx.marketplaceSettings.update({ where: { id: "default" }, data: { sourcesSeeded: true } });
  });
  await prisma.attributionSource.updateMany({
    where: { label: "Influencer Card" },
    data: { label: "Influencer card" },
  });
}

export async function listAttributionSources() {
  await ensureAttributionSources();
  return prisma.attributionSource.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function saveAttributionSources(rows: { id?: string; label: string; active: boolean }[]) {
  await ensureAttributionSources();
  const cleaned = rows
    .map((row, index) => ({
      id: row.id,
      label: row.label.trim().slice(0, 120),
      active: row.active,
      sortOrder: index + 1,
    }))
    .filter((row) => row.label);
  if (cleaned.length === 0) throw new Error("Keep at least one attribution source.");
  await prisma.$transaction(async (tx) => {
    const keep = new Set<string>();
    for (const row of cleaned) {
      if (row.id) {
        await tx.attributionSource.update({
          where: { id: row.id },
          data: { label: row.label, active: row.active, sortOrder: row.sortOrder },
        });
        keep.add(row.id);
      } else {
        const created = await tx.attributionSource.create({
          data: { label: row.label, active: row.active, sortOrder: row.sortOrder },
        });
        keep.add(created.id);
      }
    }
    await tx.attributionSource.deleteMany({ where: { id: { notIn: [...keep] } } });
  });
}

export async function saveAttributionPolicy(input: { windowDays: number; minGrossCents: number }) {
  await ensureAttributionSources();
  const windowDays = normalizeAttributionExpiryDays(input.windowDays);
  const minGrossCents = Math.round(input.minGrossCents);
  if (!Number.isFinite(minGrossCents) || minGrossCents < 0 || minGrossCents > 100_000_000) {
    throw new Error("Repeat minimum must be zero or a positive amount.");
  }
  return prisma.marketplaceSettings.update({
    where: { id: "default" },
    data: { attributionWindowDays: windowDays, repeatMinGrossCents: minGrossCents },
  });
}

export async function listRepeatCandidates() {
  await ensureAttributionSources();
  const settings = await prisma.marketplaceSettings.findUnique({ where: { id: "default" } });
  const windowDays = settings?.attributionWindowDays ?? 90;
  const minGrossCents = settings?.repeatMinGrossCents ?? 0;
  return prisma.collaborationFunding.findMany({
    where: {
      status: { in: CONFIRMED },
      grossCents: { gte: minGrossCents },
      createdAt: { gte: attributionWindowStart(new Date(), windowDays) },
      attributionStatus: { in: ["active", "contested"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      businessName: true,
      creatorSlug: true,
      grossCents: true,
      status: true,
      createdAt: true,
      attributionStatus: true,
    },
    take: 30,
  });
}

export async function resolveDealAttribution(input: {
  businessName: string;
  creatorSlug: string;
  sourceId?: string | null;
  repeatOfId?: string | null;
}) {
  await ensureAttributionSources();
  const settings = await prisma.marketplaceSettings.findUnique({ where: { id: "default" } });
  const windowDays = settings?.attributionWindowDays ?? 90;
  const minGrossCents = settings?.repeatMinGrossCents ?? 0;
  const sourceId = input.sourceId?.trim() || "";
  const source = sourceId ? await prisma.attributionSource.findUnique({ where: { id: sourceId } }) : null;
  if (!source?.active) return { ok: false as const, error: "Choose an attribution source." };

  const openClaim = await prisma.attributionClaim.findFirst({
    where: {
      businessName: { equals: input.businessName.trim(), mode: "insensitive" },
      creatorSlug: input.creatorSlug.trim(),
      status: { in: ["open", "under_review"] },
      claimType: "PRE_EXISTING_RELATIONSHIP",
    },
    orderBy: { createdAt: "desc" },
  });
  const upheldClaim = await prisma.attributionClaim.findFirst({
    where: {
      businessName: { equals: input.businessName.trim(), mode: "insensitive" },
      creatorSlug: input.creatorSlug.trim(),
      status: "upheld",
      claimType: "PRE_EXISTING_RELATIONSHIP",
    },
    orderBy: { resolvedAt: "desc" },
  });

  const expiresAt = attributionExpiresAt(new Date(), windowDays);
  const isPreExistingSource = /pre-?existing/i.test(source.label);

  let attributionStatus: "active" | "contested" | "pre_existing" = "active";
  if (upheldClaim || isPreExistingSource) attributionStatus = "pre_existing";
  else if (openClaim) attributionStatus = "contested";

  const repeatOfId = input.repeatOfId?.trim() || "";
  if (!repeatOfId) {
    return {
      ok: true as const,
      attributionLabel: source.label,
      repeatOfId: null as string | null,
      attributionStatus,
      attributionExpiresAt: expiresAt,
    };
  }

  if (attributionStatus === "pre_existing") {
    return {
      ok: false as const,
      error: "A pre-existing relationship claim prevents repeat attribution fees on this pair.",
    };
  }

  const prior = await prisma.collaborationFunding.findUnique({ where: { id: repeatOfId } });
  const gate = canAttributeRepeat({
    prior: prior
      ? {
          businessName: prior.businessName,
          creatorSlug: prior.creatorSlug,
          status: prior.status,
          grossCents: prior.grossCents,
          createdAt: prior.createdAt,
        }
      : null,
    businessName: input.businessName,
    creatorSlug: input.creatorSlug,
    minGrossCents,
    windowStart: attributionWindowStart(new Date(), windowDays),
  });
  if (!gate.ok) return gate;
  return {
    ok: true as const,
    attributionLabel: source.label,
    repeatOfId: prior!.id,
    attributionStatus,
    attributionExpiresAt: expiresAt,
  };
}

export async function fileAttributionClaim(input: {
  businessName: string;
  creatorSlug: string;
  evidence: string;
  fundingId?: string | null;
  filedBy?: string;
}) {
  await ensureAttributionSources();
  const businessName = input.businessName.trim().slice(0, 120);
  const creatorSlug = input.creatorSlug.trim().slice(0, 80);
  const evidence = input.evidence.trim().slice(0, 2000);
  if (!businessName || !creatorSlug) {
    return { ok: false as const, error: "Business and influencer are required." };
  }
  if (evidence.length < 12) {
    return { ok: false as const, error: "Add evidence for the pre-existing relationship claim." };
  }
  const existing = await prisma.attributionClaim.findFirst({
    where: {
      businessName: { equals: businessName, mode: "insensitive" },
      creatorSlug,
      status: { in: ["open", "under_review"] },
    },
  });
  if (existing) {
    return { ok: false as const, error: "An open attribution claim already exists for this pair." };
  }
  const claim = await prisma.attributionClaim.create({
    data: {
      businessName,
      creatorSlug,
      fundingId: input.fundingId?.trim() || null,
      claimType: "PRE_EXISTING_RELATIONSHIP",
      status: "open",
      evidence,
      filedBy: (input.filedBy ?? "business").slice(0, 40),
    },
  });
  if (input.fundingId) {
    await prisma.collaborationFunding.updateMany({
      where: { id: input.fundingId },
      data: { attributionStatus: "contested" },
    });
  }
  void import("@/lib/jobs")
    .then(async ({ notifyCollabFundingEvent, notifyCollabParties }) => {
      if (input.fundingId) {
        await notifyCollabFundingEvent({
          fundingId: input.fundingId,
          kind: "preexisting_relationship_claimed",
          detail: evidence.slice(0, 200),
        });
        return;
      }
      await notifyCollabParties({
        kind: "preexisting_relationship_claimed",
        businessName,
        creatorSlug,
        detail: evidence.slice(0, 200),
      });
    })
    .catch(() => undefined);
  return { ok: true as const, id: claim.id };
}

export async function listAttributionClaims(status?: string) {
  await ensureAttributionSources();
  return prisma.attributionClaim.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function resolveAttributionClaim(input: {
  claimId: string;
  decision: "upheld" | "rejected";
  adminNote?: string;
  actor?: string;
}) {
  const claim = await prisma.attributionClaim.findUnique({ where: { id: input.claimId } });
  if (!claim) return { ok: false as const, error: "Claim not found." };
  const gate = canResolveAttributionClaim({ status: claim.status, decision: input.decision });
  if (!gate.ok) return gate;
  const now = new Date();
  await prisma.attributionClaim.update({
    where: { id: claim.id },
    data: {
      status: gate.nextStatus,
      adminNote: String(input.adminNote ?? "").trim().slice(0, 1000),
      resolvedBy: (input.actor ?? "admin").slice(0, 80),
      resolvedAt: now,
    },
  });
  const fundingStatus = gate.nextStatus === "upheld" ? "pre_existing" : "active";
  if (claim.fundingId) {
    await prisma.collaborationFunding.updateMany({
      where: { id: claim.fundingId },
      data: { attributionStatus: fundingStatus },
    });
  }
  await prisma.collaborationFunding.updateMany({
    where: {
      businessName: { equals: claim.businessName, mode: "insensitive" },
      creatorSlug: claim.creatorSlug,
      status: { in: ["awaiting_provider", "held"] },
    },
    data: { attributionStatus: fundingStatus },
  });
  return { ok: true as const, status: gate.nextStatus };
}

export { serviceLevelForFeeResolution };
