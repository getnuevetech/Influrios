import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prisma } from "./db";
import {
  canCancelUnconfirmed,
  canOpenMilestoneDispute,
  decideDispute,
  disputeStatusAfterRefund,
} from "./disputes";
import { ledgerMovements, marketplaceDisposition, reconcileLedger } from "./ledger";
import { applyMarketplaceEvent } from "./marketplace-ledger";
import {
  cancelUnconfirmedFunding,
  decideMilestoneDispute,
  listDisputeReasons,
  openMilestoneDispute,
} from "./milestone-disputes";

describe("dispute rules", () => {
  it("opens only a held, unsettled milestone with a reason and no open case", () => {
    assert.equal(
      canOpenMilestoneDispute({
        fundingStatus: "held",
        milestoneStatus: "pending",
        alreadyOpen: false,
        hasReason: true,
      }).ok,
      true,
    );
    assert.equal(
      canOpenMilestoneDispute({
        fundingStatus: "awaiting_provider",
        milestoneStatus: "pending",
        alreadyOpen: false,
        hasReason: true,
      }).ok,
      false,
    );
    assert.equal(
      canOpenMilestoneDispute({
        fundingStatus: "held",
        milestoneStatus: "released",
        alreadyOpen: false,
        hasReason: true,
      }).ok,
      false,
    );
    assert.equal(
      canOpenMilestoneDispute({
        fundingStatus: "held",
        milestoneStatus: "refunded",
        alreadyOpen: false,
        hasReason: true,
      }).ok,
      false,
    );
    assert.equal(
      canOpenMilestoneDispute({
        fundingStatus: "held",
        milestoneStatus: "pending",
        alreadyOpen: true,
        hasReason: true,
      }).ok,
      false,
    );
    assert.equal(
      canOpenMilestoneDispute({
        fundingStatus: "held",
        milestoneStatus: "pending",
        alreadyOpen: false,
        hasReason: false,
      }).ok,
      false,
    );
  });

  it("cancels only an unconfirmed prefund when the policy is on", () => {
    assert.equal(canCancelUnconfirmed({ fundingStatus: "awaiting_provider", cancelUnconfirmed: true }).ok, true);
    assert.equal(canCancelUnconfirmed({ fundingStatus: "awaiting_provider", cancelUnconfirmed: false }).ok, false);
    assert.equal(canCancelUnconfirmed({ fundingStatus: "held", cancelUnconfirmed: true }).ok, false);
  });

  it("records a refund request without treating the decision as cash", () => {
    const full = decideDispute({
      status: "open",
      action: "refund",
      requestedCents: 0,
      heldCents: 5000,
      milestoneCents: 5000,
    });
    assert.equal(full.ok, true);
    if (full.ok) {
      assert.equal(full.status, "refund_requested");
      assert.equal(full.requestedRefundCents, 5000);
    }
    const partial = decideDispute({
      status: "under_review",
      action: "partial",
      requestedCents: 1200,
      heldCents: 5000,
      milestoneCents: 5000,
    });
    assert.equal(partial.ok, true);
    if (partial.ok) assert.equal(partial.requestedRefundCents, 1200);
    assert.equal(
      decideDispute({
        status: "open",
        action: "partial",
        requestedCents: 9000,
        heldCents: 5000,
        milestoneCents: 5000,
      }).ok,
      false,
    );
    assert.equal(
      decideDispute({
        status: "refund_requested",
        action: "release",
        requestedCents: 0,
        heldCents: 5000,
        milestoneCents: 5000,
      }).ok,
      false,
    );
    const withdrawn = decideDispute({
      status: "open",
      action: "withdraw",
      requestedCents: 0,
      heldCents: 5000,
      milestoneCents: 5000,
    });
    assert.equal(withdrawn.ok, true);
    if (withdrawn.ok) assert.equal(withdrawn.status, "withdrawn");
    const allowed = decideDispute({
      status: "under_review",
      action: "release",
      requestedCents: 0,
      heldCents: 5000,
      milestoneCents: 5000,
    });
    assert.equal(allowed.ok, true);
    if (allowed.ok) assert.equal(allowed.status, "resolved_release");
  });

  it("closes a refund request only when the provider refund covers the request", () => {
    assert.equal(
      disputeStatusAfterRefund({ requestedCents: 5000, refundedCents: 5000, milestoneCents: 5000 }),
      "resolved_refund",
    );
    assert.equal(
      disputeStatusAfterRefund({ requestedCents: 2000, refundedCents: 2000, milestoneCents: 5000 }),
      "resolved_partial",
    );
    assert.equal(
      disputeStatusAfterRefund({ requestedCents: 2000, refundedCents: 2500, milestoneCents: 5000 }),
      null,
    );
    assert.equal(disputeStatusAfterRefund({ requestedCents: null, refundedCents: 2000, milestoneCents: 5000 }), null);
  });

  it("blocks a release while a dispute is open", () => {
    assert.equal(
      marketplaceDisposition({
        eventType: "payout.released",
        fundingStatus: "held",
        amountCents: 5000,
        expectedCents: 5000,
        heldCents: 5000,
        milestoneStatus: "approved",
        disputeOpen: true,
      }),
      "reject",
    );
  });
});

async function createPrefund(title: string) {
  return prisma.collaborationFunding.create({
    data: {
      jurisdictionCode: "US",
      businessName: "Dispute test",
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

describe("milestone dispute ledger", () => {
  it("cancels an unconfirmed prefund without posting a hold", async () => {
    const funding = await createPrefund("Cancel unconfirmed");
    try {
      const result = await cancelUnconfirmedFunding(funding.id);
      const stored = await prisma.collaborationFunding.findUnique({
        where: { id: funding.id },
        include: { entries: true },
      });
      assert.equal(result.ok, true);
      assert.equal(stored?.status, "cancelled");
      assert.equal(stored?.entries.length, 0);
    } finally {
      await cleanup(funding.id);
    }
  });

  it("leaves an unconfirmed prefund in place when cancellation is turned off", async () => {
    await prisma.marketplaceSettings.upsert({
      where: { id: "default" },
      update: { cancelUnconfirmed: false },
      create: { id: "default", reviewWindowHours: 72, cancelUnconfirmed: false },
    });
    const funding = await createPrefund("Cancel policy off");
    try {
      const result = await cancelUnconfirmedFunding(funding.id);
      const stored = await prisma.collaborationFunding.findUnique({ where: { id: funding.id } });
      assert.equal(result.ok, false);
      assert.equal(stored?.status, "awaiting_provider");
    } finally {
      await prisma.marketplaceSettings.update({ where: { id: "default" }, data: { cancelUnconfirmed: true } });
      await cleanup(funding.id);
    }
  });

  it("blocks release until the dispute is withdrawn, and a refund webhook closes the request", async () => {
    const reasons = await listDisputeReasons();
    const reason = reasons.find((row) => row.active);
    if (!reason) throw new Error("expected a dispute reason");

    const blocked = await createPrefund("Open dispute blocks release");
    const refunded = await createPrefund("Refund closes dispute");
    try {
      const held = await applyMarketplaceEvent({
        provider: "primary",
        eventId: `hold-${blocked.id}`,
        eventType: "funding.held",
        fundingId: blocked.id,
        amountCents: 10_000,
      });
      assert.equal(held.applied, true);
      const milestone = blocked.milestones[0];
      await prisma.fundingMilestone.update({ where: { id: milestone.id }, data: { status: "approved" } });
      const opened = await openMilestoneDispute({
        fundingId: blocked.id,
        milestoneId: milestone.id,
        openedBy: "business",
        reasonId: reason.id,
        details: "The file does not match the brief.",
      });
      assert.equal(opened.ok, true);
      const duplicate = await openMilestoneDispute({
        fundingId: blocked.id,
        milestoneId: milestone.id,
        openedBy: "creator",
        reasonId: reason.id,
        details: "The file does not match the brief.",
      });
      assert.equal(duplicate.ok, false);
      const release = await applyMarketplaceEvent({
        provider: "primary",
        eventId: `release-${blocked.id}`,
        eventType: "payout.released",
        fundingId: blocked.id,
        amountCents: 10_000,
        milestoneId: milestone.id,
      });
      assert.equal(release.applied, false);
      assert.equal(release.result, "rejected");
      if (!opened.ok) throw new Error("dispute did not open");
      const withdrawn = await decideMilestoneDispute({
        disputeId: opened.id,
        action: "withdraw",
        actor: "ops@example.com",
      });
      assert.equal(withdrawn.ok, true);
      const afterWithdraw = await applyMarketplaceEvent({
        provider: "primary",
        eventId: `release-after-${blocked.id}`,
        eventType: "payout.released",
        fundingId: blocked.id,
        amountCents: 10_000,
        milestoneId: milestone.id,
      });
      assert.equal(afterWithdraw.applied, true);
      const released = await prisma.collaborationFunding.findUnique({
        where: { id: blocked.id },
        include: { entries: true, milestones: true },
      });
      const releasedLedger = reconcileLedger(ledgerMovements(released?.entries ?? []), 10_000);
      assert.equal(releasedLedger.heldCents, 0);
      assert.equal(releasedLedger.releasedCents, 10_000);
      assert.equal(released?.milestones[0]?.status, "released");

      const refundHold = await applyMarketplaceEvent({
        provider: "primary",
        eventId: `hold-${refunded.id}`,
        eventType: "funding.held",
        fundingId: refunded.id,
        amountCents: 10_000,
      });
      assert.equal(refundHold.applied, true);
      const refundMilestone = refunded.milestones[0];
      const refundOpened = await openMilestoneDispute({
        fundingId: refunded.id,
        milestoneId: refundMilestone.id,
        openedBy: "creator",
        reasonId: reason.id,
        details: "The work was not delivered.",
      });
      if (!refundOpened.ok) throw new Error(refundOpened.error);
      const before = await prisma.ledgerEntry.count({ where: { fundingId: refunded.id } });
      const decision = await decideMilestoneDispute({
        disputeId: refundOpened.id,
        action: "refund",
        actor: "ops@example.com",
      });
      assert.equal(decision.ok, true);
      if (decision.ok) assert.equal(decision.status, "refund_requested");
      const afterDecision = await prisma.collaborationFunding.findUnique({
        where: { id: refunded.id },
        include: { entries: true },
      });
      assert.equal(afterDecision?.entries.length, before);
      assert.equal(reconcileLedger(ledgerMovements(afterDecision?.entries ?? []), 10_000).heldCents, 10_000);
      const refund = await applyMarketplaceEvent({
        provider: "primary",
        eventId: `refund-${refunded.id}`,
        eventType: "payout.refunded",
        fundingId: refunded.id,
        amountCents: 10_000,
        milestoneId: refundMilestone.id,
      });
      assert.equal(refund.applied, true);
      const finished = await prisma.collaborationFunding.findUnique({
        where: { id: refunded.id },
        include: { entries: true, milestones: true, disputes: true },
      });
      const ledger = reconcileLedger(ledgerMovements(finished?.entries ?? []), 10_000);
      assert.equal(ledger.heldCents, 0);
      assert.equal(ledger.refundedCents, 10_000);
      assert.equal(ledger.balanced, true);
      assert.equal(finished?.milestones[0]?.status, "refunded");
      assert.equal(finished?.disputes[0]?.status, "resolved_refund");
    } finally {
      await cleanup(blocked.id);
      await cleanup(refunded.id);
    }
  });
});
