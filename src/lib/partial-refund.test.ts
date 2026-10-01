import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prisma } from "./db";
import { decideDispute } from "./disputes";
import { ledgerMovements, marketplaceDisposition, reconcileLedger, releasableCents } from "./ledger";
import { applyMarketplaceEvent } from "./marketplace-ledger";
import {
  decideMilestoneDispute,
  listDisputeReasons,
  openMilestoneDispute,
  setPartialRefundsForTests,
} from "./milestone-disputes";

describe("partial refund rules", () => {
  it("keeps the original milestone amount and refuses a refund that misses the request", () => {
    assert.equal(releasableCents(10_000, 0), 10_000);
    assert.equal(releasableCents(10_000, 3_000), 7_000);
    assert.equal(releasableCents(10_000, 10_000), 0);
    const blocked = decideDispute({
      status: "open",
      action: "partial",
      requestedCents: 3_000,
      heldCents: 10_000,
      milestoneCents: 10_000,
      partialAllowed: false,
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.match(blocked.error, /Nothing was refunded/);
    assert.equal(
      marketplaceDisposition({
        eventType: "payout.refunded",
        fundingStatus: "held",
        amountCents: 4_000,
        expectedCents: 10_000,
        heldCents: 10_000,
        requestedRefundCents: 3_000,
        milestoneRemainingCents: 10_000,
      }),
      "reject",
    );
    assert.equal(
      marketplaceDisposition({
        eventType: "payout.refunded",
        fundingStatus: "held",
        amountCents: 3_000,
        expectedCents: 10_000,
        heldCents: 10_000,
        requestedRefundCents: 3_000,
        milestoneRemainingCents: 10_000,
      }),
      "apply",
    );
    assert.equal(
      marketplaceDisposition({
        eventType: "payout.released",
        fundingStatus: "held",
        amountCents: 10_000,
        expectedCents: 7_000,
        heldCents: 7_000,
        milestoneStatus: "approved",
      }),
      "reject",
    );
    assert.equal(
      marketplaceDisposition({
        eventType: "payout.released",
        fundingStatus: "held",
        amountCents: 7_000,
        expectedCents: 7_000,
        heldCents: 7_000,
        milestoneStatus: "approved",
      }),
      "apply",
    );
  });
});

async function createPrefund(title: string) {
  return prisma.collaborationFunding.create({
    data: {
      jurisdictionCode: "US",
      businessName: "Partial test",
      creatorSlug: "sofia-martinez",
      title,
      grossCents: 10_000,
      feeCents: 1_000,
      feeSnapshotJson: { feeCents: 1_000 },
      serviceLevel: "contracted",
      status: "awaiting_provider",
      providerCode: "primary",
      milestones: {
        create: [{ title: "Delivery", amountCents: 10_000, sortOrder: 1, status: "pending", reviewWindowHours: 72 }],
      },
    },
    include: { milestones: true },
  });
}

async function cleanup(fundingId: string) {
  await prisma.processedWebhook.deleteMany({ where: { eventId: { contains: fundingId } } });
  await prisma.collaborationFunding.delete({ where: { id: fundingId } }).catch(() => undefined);
}

describe("partial refund ledger", () => {
  it("keeps a recorded partial request and releases only the remainder", async () => {
    const reasons = await listDisputeReasons();
    const reason = reasons.find((row) => row.active);
    if (!reason) throw new Error("expected a dispute reason");
    const funding = await createPrefund("Partial request");
    const milestone = funding.milestones[0];
    try {
      setPartialRefundsForTests(null);
      const held = await applyMarketplaceEvent({
        provider: "primary",
        eventId: `hold-${funding.id}`,
        eventType: "funding.held",
        fundingId: funding.id,
        amountCents: 10_000,
      });
      assert.equal(held.applied, true);
      const opened = await openMilestoneDispute({
        fundingId: funding.id,
        milestoneId: milestone.id,
        openedBy: "business",
        reasonId: reason.id,
        details: "The file does not match the brief.",
      });
      if (!opened.ok) throw new Error(opened.error);
      const requested = await decideMilestoneDispute({
        disputeId: opened.id,
        action: "partial",
        requestedCents: 3_000,
        actor: "ops@example.com",
      });
      assert.equal(requested.ok, true);
      setPartialRefundsForTests(false);
      const mismatch = await applyMarketplaceEvent({
        provider: "primary",
        eventId: `refund-mismatch-${funding.id}`,
        eventType: "payout.refunded",
        fundingId: funding.id,
        amountCents: 4_000,
        milestoneId: milestone.id,
      });
      assert.equal(mismatch.applied, false);
      assert.equal(mismatch.result, "rejected");
      const stillOpen = await prisma.milestoneDispute.findUnique({ where: { id: opened.id } });
      assert.equal(stillOpen?.status, "refund_requested");
      assert.equal(stillOpen?.requestedRefundCents, 3_000);
      const matched = await applyMarketplaceEvent({
        provider: "primary",
        eventId: `refund-match-${funding.id}`,
        eventType: "payout.refunded",
        fundingId: funding.id,
        amountCents: 3_000,
        milestoneId: milestone.id,
      });
      assert.equal(matched.applied, true);
      const afterRefund = await prisma.collaborationFunding.findUnique({
        where: { id: funding.id },
        include: { entries: true, milestones: true, disputes: true },
      });
      const refundedLedger = reconcileLedger(ledgerMovements(afterRefund?.entries ?? []), 10_000);
      assert.equal(refundedLedger.heldCents, 7_000);
      assert.equal(refundedLedger.refundedCents, 3_000);
      assert.equal(afterRefund?.milestones[0]?.amountCents, 10_000);
      assert.equal(afterRefund?.milestones[0]?.refundedCents, 3_000);
      assert.equal(afterRefund?.milestones[0]?.status, "pending");
      assert.equal(afterRefund?.disputes[0]?.status, "resolved_partial");
      const again = await openMilestoneDispute({
        fundingId: funding.id,
        milestoneId: milestone.id,
        openedBy: "business",
        reasonId: reason.id,
        details: "The remainder still needs a decision.",
      });
      if (!again.ok) throw new Error(again.error);
      const refused = await decideMilestoneDispute({
        disputeId: again.id,
        action: "partial",
        requestedCents: 1_000,
        actor: "ops@example.com",
      });
      assert.equal(refused.ok, false);
      if (!refused.ok) assert.match(refused.error, /Nothing was refunded/);
      const withdrawn = await decideMilestoneDispute({
        disputeId: again.id,
        action: "withdraw",
        actor: "ops@example.com",
      });
      assert.equal(withdrawn.ok, true);
      await prisma.fundingMilestone.update({ where: { id: milestone.id }, data: { status: "approved" } });
      const fullRelease = await applyMarketplaceEvent({
        provider: "primary",
        eventId: `release-full-${funding.id}`,
        eventType: "payout.released",
        fundingId: funding.id,
        amountCents: 10_000,
        milestoneId: milestone.id,
      });
      assert.equal(fullRelease.applied, false);
      const remainder = await applyMarketplaceEvent({
        provider: "primary",
        eventId: `release-rest-${funding.id}`,
        eventType: "payout.released",
        fundingId: funding.id,
        amountCents: 7_000,
        milestoneId: milestone.id,
      });
      assert.equal(remainder.applied, true);
      const finished = await prisma.collaborationFunding.findUnique({
        where: { id: funding.id },
        include: { entries: true, milestones: true },
      });
      const ledger = reconcileLedger(ledgerMovements(finished?.entries ?? []), 10_000);
      assert.equal(ledger.heldCents, 0);
      assert.equal(ledger.releasedCents, 7_000);
      assert.equal(ledger.refundedCents, 3_000);
      assert.equal(ledger.balanced, true);
      assert.equal(finished?.milestones[0]?.status, "released");
      assert.equal(finished?.milestones[0]?.amountCents, 10_000);
      assert.equal(finished?.status, "completed");
    } finally {
      setPartialRefundsForTests(null);
      await cleanup(funding.id);
    }
  });
});
