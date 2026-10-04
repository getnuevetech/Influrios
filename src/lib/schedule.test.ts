import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prisma } from "./db";
import { listAttributionSources } from "./deal-attribution";
import { applyMarketplaceEvent, requestPrefund, saveFundingSchedule, sweepDueRecurrences } from "./marketplace-ledger";
import { planSchedule, recurrenceIsDue, splitTranches } from "./schedule";

describe("funding schedule rules", () => {
  it("splits a staged gross without losing cents", () => {
    assert.deepEqual(splitTranches(10_000, 3), [3333, 3333, 3334]);
    assert.equal(splitTranches(10_000, 3)?.reduce((sum, part) => sum + part, 0), 10_000);
    assert.equal(splitTranches(2, 3), null);
    assert.equal(splitTranches(100, 1), null);
  });

  it("plans a staged or recurring prefund only when that schedule is on", () => {
    const staged = planSchedule({
      kind: "staged",
      grossCents: 300,
      stageCount: 3,
      stagedEnabled: true,
      recurringEnabled: true,
      maxStages: 4,
      maxRecurrences: 6,
      intervalDays: 30,
    });
    assert.equal(staged.ok, true);
    if (staged.ok) assert.deepEqual(staged.parts, [100, 100, 100]);
    assert.equal(
      planSchedule({
        kind: "staged",
        grossCents: 300,
        stageCount: 3,
        stagedEnabled: false,
        recurringEnabled: true,
        maxStages: 4,
        maxRecurrences: 6,
        intervalDays: 30,
      }).ok,
      false,
    );
    const recurring = planSchedule({
      kind: "recurring",
      grossCents: 500,
      occurrenceCount: 4,
      stagedEnabled: true,
      recurringEnabled: true,
      maxStages: 4,
      maxRecurrences: 6,
      intervalDays: 30,
    });
    assert.equal(recurring.ok, true);
    if (recurring.ok) {
      assert.deepEqual(recurring.parts, [500]);
      assert.equal(recurring.trancheCount, 4);
    }
    assert.equal(
      planSchedule({
        kind: "recurring",
        grossCents: 500,
        occurrenceCount: 4,
        stagedEnabled: true,
        recurringEnabled: false,
        maxStages: 4,
        maxRecurrences: 6,
        intervalDays: 30,
      }).ok,
      false,
    );
  });

  it("waits out the interval after the provider hold", () => {
    const holdAt = new Date("2026-09-01T00:00:00.000Z");
    assert.equal(recurrenceIsDue({ holdAt, intervalDays: 30, now: new Date("2026-09-30T00:00:00.000Z") }), false);
    assert.equal(recurrenceIsDue({ holdAt, intervalDays: 30, now: new Date("2026-10-01T00:00:00.000Z") }), true);
    assert.equal(recurrenceIsDue({ holdAt: null, intervalDays: 30, now: new Date("2026-10-01T00:00:00.000Z") }), false);
  });
});

describe("staged and recurring prefunds", () => {
  async function enableUsScheduleCapabilities() {
    const before = await prisma.collaborationJurisdiction.findUnique({ where: { code: "US" } });
    await prisma.collaborationJurisdiction.update({
      where: { code: "US" },
      data: {
        protectedPaymentsEnabled: true,
        fullPrefundingEnabled: true,
        stagedPrefundingEnabled: true,
        recurringFundingEnabled: true,
        legalReviewStatus: "APPROVED",
      },
    });
    return before;
  }

  it("creates no rows when the provider is not ready", async () => {
    const jurisdiction = await enableUsScheduleCapabilities();
    const sources = await listAttributionSources();
    const source = sources.find((row) => row.active);
    if (!source) throw new Error("expected an attribution source");
    const titled = { title: { startsWith: "Staged while provider is off" } };
    const before = await prisma.collaborationFunding.count({ where: titled });
    try {
      const result = await requestPrefund({
        jurisdictionCode: "US",
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        title: "Staged while provider is off",
        grossCents: 30_000,
        sourceId: source.id,
        scheduleKind: "staged",
        stageCount: 3,
      });
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.error, /not ready/);
      assert.equal(await prisma.collaborationFunding.count({ where: titled }), before);
    } finally {
      if (jurisdiction) {
        await prisma.collaborationJurisdiction.update({
          where: { code: "US" },
          data: {
            protectedPaymentsEnabled: jurisdiction.protectedPaymentsEnabled,
            fullPrefundingEnabled: jurisdiction.fullPrefundingEnabled,
            stagedPrefundingEnabled: jurisdiction.stagedPrefundingEnabled,
            recurringFundingEnabled: jurisdiction.recurringFundingEnabled,
            legalReviewStatus: jurisdiction.legalReviewStatus,
          },
        });
      }
    }
  });

  it("splits a staged gross into unfunded prefunds and opens the next recurrence only after the interval", async () => {
    const provider = await prisma.integrationProvider.findUnique({
      where: { kind_code: { kind: "marketplace", code: "primary" } },
    });
    const settings = await prisma.marketplaceSettings.findUnique({ where: { id: "default" } });
    const sources = await listAttributionSources();
    const source = sources.find((row) => row.active);
    if (!source || !settings) throw new Error("marketplace settings are missing");
    const jurisdiction = await enableUsScheduleCapabilities();
    const ids: string[] = [];
    try {
      await prisma.integrationProvider.update({
        where: { kind_code: { kind: "marketplace", code: "primary" } },
        data: { enabled: true, webhookCipher: provider?.webhookCipher ?? "v1.dGVzdC1pdi1wYWRk.dGVzdC10YWc.dGVzdA" },
      });
      const staged = await requestPrefund({
        jurisdictionCode: "US",
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        title: "Launch stages",
        grossCents: 30_000,
        sourceId: source.id,
        scheduleKind: "staged",
        stageCount: 3,
      });
      assert.equal(staged.ok, true);
      if (!staged.ok) return;
      const stagedRows = await prisma.collaborationFunding.findMany({
        where: { title: { startsWith: "Launch stages" } },
        include: { entries: true, milestones: true },
        orderBy: { trancheIndex: "asc" },
      });
      ids.push(...stagedRows.map((row) => row.id));
      assert.equal(stagedRows.length, 3);
      assert.deepEqual(
        stagedRows.map((row) => row.grossCents),
        [10_000, 10_000, 10_000],
      );
      assert.equal(stagedRows.every((row) => row.status === "awaiting_provider" && row.entries.length === 0), true);
      assert.equal(
        stagedRows.every((row) => row.milestones.reduce((sum, milestone) => sum + milestone.amountCents, 0) === row.grossCents),
        true,
      );
      const held = await applyMarketplaceEvent({
        provider: "primary",
        eventId: `hold-${stagedRows[0].id}`,
        eventType: "funding.held",
        fundingId: stagedRows[0].id,
        amountCents: stagedRows[0].grossCents,
      });
      assert.equal(held.applied, true);
      const afterHold = await prisma.collaborationFunding.findMany({
        where: { id: { in: stagedRows.map((row) => row.id) } },
        include: { entries: true },
        orderBy: { trancheIndex: "asc" },
      });
      assert.equal(afterHold[0]?.status, "held");
      assert.equal(afterHold[0]?.entries.filter((entry) => entry.kind === "hold").length, 1);
      assert.equal(afterHold[1]?.status, "awaiting_provider");
      assert.equal(afterHold[1]?.entries.length, 0);

      const recurring = await requestPrefund({
        jurisdictionCode: "US",
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        title: "Monthly retain",
        grossCents: 15_000,
        sourceId: source.id,
        scheduleKind: "recurring",
        occurrenceCount: 3,
      });
      assert.equal(recurring.ok, true);
      if (!recurring.ok) return;
      ids.push(recurring.id);
      const first = await prisma.collaborationFunding.findUnique({ where: { id: recurring.id } });
      assert.equal(first?.trancheIndex, 1);
      assert.equal(first?.trancheCount, 3);
      assert.equal(first?.intervalDays, settings.recurringIntervalDays);
      const confirmed = await applyMarketplaceEvent({
        provider: "primary",
        eventId: `hold-${recurring.id}`,
        eventType: "funding.held",
        fundingId: recurring.id,
        amountCents: 15_000,
      });
      assert.equal(confirmed.applied, true);
      const hold = await prisma.ledgerEntry.findFirst({
        where: { fundingId: recurring.id, kind: "hold" },
        orderBy: { createdAt: "asc" },
      });
      if (!hold) throw new Error("hold was not posted");
      const frozenFee = first?.feeSnapshotJson;
      await saveFundingSchedule({
        stagedFundingEnabled: settings.stagedFundingEnabled,
        recurringFundingEnabled: settings.recurringFundingEnabled,
        maxStages: settings.maxStages,
        recurringIntervalDays: settings.recurringIntervalDays + 30,
        maxRecurrences: settings.maxRecurrences,
      });
      await sweepDueRecurrences(new Date(hold.createdAt.getTime() + 24 * 60 * 60 * 1000));
      assert.equal(await prisma.collaborationFunding.count({ where: { scheduleId: first?.scheduleId } }), 1);
      await sweepDueRecurrences(new Date(hold.createdAt.getTime() + (settings.recurringIntervalDays + 1) * 24 * 60 * 60 * 1000));
      const series = await prisma.collaborationFunding.findMany({
        where: { scheduleId: first?.scheduleId },
        include: { entries: true },
        orderBy: { trancheIndex: "asc" },
      });
      ids.push(...series.map((row) => row.id));
      assert.equal(series.length, 2);
      assert.equal(series[1]?.status, "awaiting_provider");
      assert.equal(series[1]?.entries.length, 0);
      assert.equal(series[1]?.grossCents, 15_000);
      assert.equal(series[1]?.intervalDays, settings.recurringIntervalDays);
      const firstAfter = await prisma.collaborationFunding.findUnique({ where: { id: recurring.id } });
      assert.deepEqual(firstAfter?.feeSnapshotJson, frozenFee);
      await sweepDueRecurrences(new Date(hold.createdAt.getTime() + (settings.recurringIntervalDays + 1) * 24 * 60 * 60 * 1000));
      assert.equal(await prisma.collaborationFunding.count({ where: { scheduleId: first?.scheduleId } }), 2);
      await saveFundingSchedule({
        stagedFundingEnabled: false,
        recurringFundingEnabled: false,
        maxStages: settings.maxStages,
        recurringIntervalDays: settings.recurringIntervalDays,
        maxRecurrences: settings.maxRecurrences,
      });
      const blocked = await requestPrefund({
        jurisdictionCode: "US",
        businessName: "Harbor Co",
        creatorSlug: "sofia-martinez",
        title: "Blocked schedule",
        grossCents: 15_000,
        sourceId: source.id,
        scheduleKind: "recurring",
        occurrenceCount: 2,
      });
      assert.equal(blocked.ok, false);
    } finally {
      const unique = [...new Set(ids)];
      if (unique.length) {
        await prisma.processedWebhook.deleteMany({
          where: { OR: unique.map((id) => ({ eventId: { contains: id } })) },
        });
        await prisma.collaborationFunding.deleteMany({ where: { id: { in: unique } } });
      }
      await prisma.collaborationFunding.deleteMany({
        where: { title: { in: ["Launch stages", "Monthly retain", "Blocked schedule"] } },
      });
      await saveFundingSchedule({
        stagedFundingEnabled: settings.stagedFundingEnabled,
        recurringFundingEnabled: settings.recurringFundingEnabled,
        maxStages: settings.maxStages,
        recurringIntervalDays: settings.recurringIntervalDays,
        maxRecurrences: settings.maxRecurrences,
      });
      if (provider) {
        await prisma.integrationProvider.update({
          where: { id: provider.id },
          data: { enabled: provider.enabled, webhookCipher: provider.webhookCipher, name: provider.name },
        });
      }
      if (jurisdiction) {
        await prisma.collaborationJurisdiction.update({
          where: { code: "US" },
          data: {
            protectedPaymentsEnabled: jurisdiction.protectedPaymentsEnabled,
            fullPrefundingEnabled: jurisdiction.fullPrefundingEnabled,
            stagedPrefundingEnabled: jurisdiction.stagedPrefundingEnabled,
            recurringFundingEnabled: jurisdiction.recurringFundingEnabled,
            legalReviewStatus: jurisdiction.legalReviewStatus,
          },
        });
      }
    }
  });
});
