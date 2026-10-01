import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prisma } from "./db";
import { canRequestChangeOrder, sharesFromAmounts, splitGross } from "./ledger";
import { applyMarketplaceEvent, requestChangeOrder, setChangeOrdersForTests, setGrossCapForTests } from "./marketplace-ledger";

describe("change order rules", () => {
  it("keeps the existing shares and refuses a confirmed prefund", () => {
    const shares = sharesFromAmounts([6_000, 4_000]);
    assert.deepEqual(shares, [6_000, 4_000]);
    assert.deepEqual(shares ? splitGross(5_000, shares) : null, [3_000, 2_000]);
    assert.equal(sharesFromAmounts([0, 100]), null);
    const off = canRequestChangeOrder({
      enabled: false,
      fundingStatus: "awaiting_provider",
      changeOrderCount: 0,
      changeOrderLimit: 2,
      hasHold: false,
    });
    assert.equal(off.ok, false);
    if (!off.ok) assert.match(off.error, /Nothing was changed/);
    const held = canRequestChangeOrder({
      enabled: true,
      fundingStatus: "held",
      changeOrderCount: 0,
      changeOrderLimit: 2,
      hasHold: true,
    });
    assert.equal(held.ok, false);
    if (!held.ok) assert.match(held.error, /already with the provider/);
    const used = canRequestChangeOrder({
      enabled: true,
      fundingStatus: "awaiting_provider",
      changeOrderCount: 1,
      changeOrderLimit: 1,
      hasHold: false,
    });
    assert.equal(used.ok, false);
  });
});

async function createPrefund(title: string, status = "awaiting_provider") {
  return prisma.collaborationFunding.create({
    data: {
      jurisdictionCode: "US",
      businessName: "Change order test",
      creatorSlug: "sofia-martinez",
      title,
      grossCents: 10_000,
      feeCents: 1_000,
      feeSnapshotJson: { feeCents: 1_000, ruleId: "frozen-rule" },
      fxSnapshotJson: { usdCents: 10_000, minorPerUsd: 100, currency: "USD", source: "identity" },
      serviceLevel: "contracted",
      status,
      providerCode: "primary",
      changeOrderLimit: 1,
      milestones: {
        create: [
          { title: "Kickoff", amountCents: 6_000, sortOrder: 1, status: "pending", reviewWindowHours: 72 },
          { title: "Delivery", amountCents: 4_000, sortOrder: 2, status: "pending", reviewWindowHours: 72 },
        ],
      },
    },
  });
}

async function cleanup(fundingId: string) {
  await prisma.processedWebhook.deleteMany({ where: { eventId: { contains: fundingId } } });
  await prisma.collaborationFunding.delete({ where: { id: fundingId } }).catch(() => undefined);
}

describe("change order ledger", () => {
  it("stores the earlier fee snapshot and leaves the ledger empty", async () => {
    const funding = await createPrefund("Change order amend");
    try {
      setChangeOrdersForTests(null);
      setGrossCapForTests(null);
      const changed = await requestChangeOrder({
        fundingId: funding.id,
        grossCents: 5_000,
        note: "The brief now covers one video.",
      });
      assert.equal(changed.ok, true);
      const row = await prisma.collaborationFunding.findUnique({
        where: { id: funding.id },
        include: { milestones: { orderBy: { sortOrder: "asc" } }, changeOrders: true, entries: true },
      });
      assert.equal(row?.grossCents, 5_000);
      assert.equal(row?.changeOrderCount, 1);
      assert.equal(row?.entries.length, 0);
      assert.deepEqual(
        row?.milestones.map((milestone) => milestone.amountCents),
        [3_000, 2_000],
      );
      assert.equal(row?.changeOrders.length, 1);
      assert.deepEqual(row?.changeOrders[0]?.previousFeeSnapshotJson, { feeCents: 1_000, ruleId: "frozen-rule" });
      const again = await requestChangeOrder({
        fundingId: funding.id,
        grossCents: 4_000,
        note: "A second amendment after the copied limit.",
      });
      assert.equal(again.ok, false);
      if (!again.ok) assert.match(again.error, /Nothing was changed/);
      const still = await prisma.collaborationFunding.findUnique({ where: { id: funding.id } });
      assert.equal(still?.grossCents, 5_000);
      assert.equal(still?.changeOrderCount, 1);
      const oldHold = await applyMarketplaceEvent({
        provider: "primary",
        eventId: `hold-old-${funding.id}`,
        eventType: "funding.held",
        fundingId: funding.id,
        amountCents: 10_000,
      });
      assert.equal(oldHold.applied, false);
      const newHold = await applyMarketplaceEvent({
        provider: "primary",
        eventId: `hold-new-${funding.id}`,
        eventType: "funding.held",
        fundingId: funding.id,
        amountCents: 5_000,
      });
      assert.equal(newHold.applied, true);
    } finally {
      setChangeOrdersForTests(null);
      setGrossCapForTests(null);
      await cleanup(funding.id);
    }
  });

  it("refuses a change when the switch is off, the cap is exceeded, or the provider already holds it", async () => {
    const waiting = await createPrefund("Change order blocked");
    const held = await createPrefund("Change order held", "held");
    try {
      setChangeOrdersForTests(false);
      const blocked = await requestChangeOrder({
        fundingId: waiting.id,
        grossCents: 5_000,
        note: "The switch is off for this amendment.",
      });
      assert.equal(blocked.ok, false);
      if (!blocked.ok) assert.match(blocked.error, /Nothing was changed/);
      setChangeOrdersForTests(null);
      setGrossCapForTests(4_000);
      const overCap = await requestChangeOrder({
        fundingId: waiting.id,
        grossCents: 5_000,
        note: "This gross is above the current cap.",
      });
      assert.equal(overCap.ok, false);
      if (!overCap.ok) assert.match(overCap.error, /Nothing was changed/);
      setGrossCapForTests(null);
      const confirmed = await requestChangeOrder({
        fundingId: held.id,
        grossCents: 5_000,
        note: "The provider already confirmed this prefund.",
      });
      assert.equal(confirmed.ok, false);
      if (!confirmed.ok) assert.match(confirmed.error, /already with the provider/);
      const unchanged = await prisma.collaborationFunding.findUnique({
        where: { id: waiting.id },
        include: { changeOrders: true },
      });
      assert.equal(unchanged?.grossCents, 10_000);
      assert.equal(unchanged?.changeOrderCount, 0);
      assert.deepEqual(unchanged?.feeSnapshotJson, { feeCents: 1_000, ruleId: "frozen-rule" });
      assert.equal(unchanged?.changeOrders.length, 0);
      const heldRow = await prisma.collaborationFunding.findUnique({
        where: { id: held.id },
        include: { changeOrders: true },
      });
      assert.equal(heldRow?.grossCents, 10_000);
      assert.equal(heldRow?.changeOrders.length, 0);
    } finally {
      setChangeOrdersForTests(null);
      setGrossCapForTests(null);
      await cleanup(waiting.id);
      await cleanup(held.id);
    }
  });
});
