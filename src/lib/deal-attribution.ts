import { prisma } from "@/lib/db";
import { attributionWindowStart, canAttributeRepeat } from "@/lib/attribution";

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
          { label: "Creator card", sortOrder: 2, active: true },
          { label: "Returning business", sortOrder: 3, active: true },
        ],
      });
    }
    await tx.marketplaceSettings.update({ where: { id: "default" }, data: { sourcesSeeded: true } });
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
  const windowDays = Math.round(input.windowDays);
  const minGrossCents = Math.round(input.minGrossCents);
  if (!Number.isFinite(windowDays) || windowDays < 1 || windowDays > 3650) {
    throw new Error("Attribution window must be between 1 and 3650 days.");
  }
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
  const repeatOfId = input.repeatOfId?.trim() || "";
  if (!repeatOfId) {
    return { ok: true as const, attributionLabel: source.label, repeatOfId: null as string | null };
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
  return { ok: true as const, attributionLabel: source.label, repeatOfId: prior!.id };
}
