import { prisma } from "@/lib/db";

export async function ensureSettlementDefaults() {
  await prisma.marketplaceSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", reviewWindowHours: 72 },
  });
  const settings = await prisma.marketplaceSettings.findUnique({ where: { id: "default" } });
  if (!settings?.fxSeeded) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.marketplaceSettings.findUnique({ where: { id: "default" } });
      if (current?.fxSeeded) return;
      if ((await tx.fxRate.count()) === 0) {
        await tx.fxRate.createMany({
          data: [
            { currency: "GBP", minorPerUsd: 75, active: true },
            { currency: "NGN", minorPerUsd: 160_000, active: true },
          ],
        });
      }
      await tx.marketplaceSettings.update({ where: { id: "default" }, data: { fxSeeded: true } });
    });
  }
  if (!settings?.sharesSeeded) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.marketplaceSettings.findUnique({ where: { id: "default" } });
      if (current?.sharesSeeded) return;
      if ((await tx.revenueParty.count()) === 0) {
        await tx.revenueParty.createMany({
          data: [
            { label: "Creator", shareBps: 8000, sortOrder: 1, active: true },
            { label: "Platform", shareBps: 2000, sortOrder: 2, active: true },
          ],
        });
      }
      await tx.marketplaceSettings.update({ where: { id: "default" }, data: { sharesSeeded: true } });
    });
  }
}

export async function listFxRates() {
  await ensureSettlementDefaults();
  return prisma.fxRate.findMany({ orderBy: { currency: "asc" } });
}

export async function saveFxRates(rows: { currency: string; minorPerUsd: number; active: boolean }[]) {
  await ensureSettlementDefaults();
  const cleaned = rows
    .map((row) => ({
      currency: row.currency.trim().toUpperCase(),
      minorPerUsd: Math.round(row.minorPerUsd),
      active: row.active,
    }))
    .filter((row) => row.currency && row.currency !== "USD");
  if (cleaned.length === 0) throw new Error("Keep at least one FX rate. USD does not need a row.");
  if (cleaned.some((row) => !/^[A-Z]{3}$/.test(row.currency) || row.minorPerUsd <= 0 || row.minorPerUsd > 100_000_000)) {
    throw new Error("Each rate needs a three-letter currency and a positive minor-unit count.");
  }
  const seen = new Set<string>();
  await prisma.$transaction(async (tx) => {
    for (const row of cleaned) {
      if (seen.has(row.currency)) continue;
      seen.add(row.currency);
      await tx.fxRate.upsert({
        where: { currency: row.currency },
        update: { minorPerUsd: row.minorPerUsd, active: row.active },
        create: row,
      });
    }
    await tx.fxRate.deleteMany({ where: { currency: { notIn: [...seen] } } });
  });
}

export async function listRevenueParties() {
  await ensureSettlementDefaults();
  return prisma.revenueParty.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function saveRevenueParties(rows: { id?: string; label: string; sharePercent: number; active: boolean }[]) {
  await ensureSettlementDefaults();
  const cleaned = rows
    .map((row, index) => ({
      id: row.id,
      label: row.label.trim().slice(0, 80),
      shareBps: Math.round(row.sharePercent) * 100,
      active: row.active,
      sortOrder: index + 1,
    }))
    .filter((row) => row.label);
  const activeShare = cleaned.filter((row) => row.active).reduce((sum, row) => sum + row.shareBps, 0);
  if (activeShare !== 10_000) throw new Error("Active revenue shares must add up to 100%.");
  if (cleaned.some((row) => row.shareBps <= 0 || row.shareBps > 10_000)) {
    throw new Error("Each revenue share must be between 1% and 100%.");
  }
  await prisma.$transaction(async (tx) => {
    const keep = new Set<string>();
    for (const row of cleaned) {
      if (row.id) {
        await tx.revenueParty.update({
          where: { id: row.id },
          data: { label: row.label, shareBps: row.shareBps, active: row.active, sortOrder: row.sortOrder },
        });
        keep.add(row.id);
      } else {
        const created = await tx.revenueParty.create({
          data: { label: row.label, shareBps: row.shareBps, active: row.active, sortOrder: row.sortOrder },
        });
        keep.add(created.id);
      }
    }
    await tx.revenueParty.deleteMany({ where: { id: { notIn: [...keep] } } });
  });
}

export async function activeShareSnapshot() {
  const parties = await listRevenueParties();
  return parties.filter((party) => party.active).map((party) => ({ label: party.label, shareBps: party.shareBps }));
}
