import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prisma } from "./db";
import { requestRevision } from "./ledger";
import { applyMarketplaceEvent, requestFundingRevision, saveMarketplaceSettings } from "./marketplace-ledger";
import { listDisputeReasons, openMilestoneDispute } from "./milestone-disputes";

describe("revision rules", () => {
  it("sends submitted work back until the saved limit", () => {
    const first = requestRevision({
      fundingStatus: "held",
      milestoneStatus: "submitted",
      revisionCount: 0,
      revisionLimit: 1,
      disputeOpen: false,
    });
    assert.equal(first.ok, true);
    if (first.ok) assert.equal(first.revisionCount, 1);
    assert.equal(
      requestRevision({
        fundingStatus: "held",
        milestoneStatus: "submitted",
        revisionCount: 1,
        revisionLimit: 1,
        disputeOpen: false,
      }).ok,
      false,
    );
    assert.equal(
      requestRevision({
        fundingStatus: "awaiting_provider",
        milestoneStatus: "submitted",
        revisionCount: 0,
        revisionLimit: 2,
        disputeOpen: false,
      }).ok,
      false,
    );
    assert.equal(
      requestRevision({
        fundingStatus: "held",
        milestoneStatus: "approved",
        revisionCount: 0,
        revisionLimit: 2,
        disputeOpen: false,
      }).ok,
      false,
    );
    assert.equal(
      requestRevision({
        fundingStatus: "held",
        milestoneStatus: "submitted",
        revisionCount: 0,
        revisionLimit: 2,
        disputeOpen: true,
      }).ok,
      false,
    );
    assert.equal(
      requestRevision({
        fundingStatus: "held",
        milestoneStatus: "submitted",
        revisionCount: 0,
        revisionLimit: 0,
        disputeOpen: false,
      }).ok,
      false,
    );
  });
});

async function createSubmitted(title: string, revisionLimit: number) {
  return prisma.collaborationFunding.create({
    data: {
      jurisdictionCode: "US",
      businessName: "Revision test",
      creatorSlug: "sofia-martinez",
      title,
      grossCents: 10_000,
      feeCents: 0,
      feeSnapshotJson: { feeCents: 0 },
      serviceLevel: "contracted",
      status: "awaiting_provider",
      providerCode: "primary",
      milestones: {
        create: [
          {
            title: "Delivery",
            amountCents: 10_000,
            sortOrder: 1,
            status: "pending",
            reviewWindowHours: 72,
            revisionLimit,
          },
        ],
      },
    },
    include: { milestones: true },
  });
}

async function cleanup(fundingId: string) {
  await prisma.processedWebhook.deleteMany({ where: { eventId: { contains: fundingId } } });
  await prisma.collaborationFunding.delete({ where: { id: fundingId } }).catch(() => undefined);
}

describe("milestone revision ledger", () => {
  it("returns submitted work without a ledger entry and keeps the frozen limit", async () => {
    const settings = await prisma.marketplaceSettings.findUnique({ where: { id: "default" } });
    const funding = await createSubmitted("Revision once", 1);
    try {
      const held = await applyMarketplaceEvent({
        provider: "primary",
        eventId: `hold-${funding.id}`,
        eventType: "funding.held",
        fundingId: funding.id,
        amountCents: 10_000,
      });
      assert.equal(held.applied, true);
      const milestone = funding.milestones[0];
      await prisma.fundingMilestone.update({
        where: { id: milestone.id },
        data: { status: "submitted", submittedAt: new Date(), autoApproveAt: new Date(Date.now() + 60_000) },
      });
      const revised = await requestFundingRevision(funding.id, milestone.id, "Please replace the cover image.");
      assert.equal(revised.ok, true);
      const stored = await prisma.fundingMilestone.findUnique({
        where: { id: milestone.id },
        include: { funding: { include: { entries: true } } },
      });
      assert.equal(stored?.status, "pending");
      assert.equal(stored?.revisionCount, 1);
      assert.equal(stored?.revisionLimit, 1);
      assert.equal(stored?.autoApproveAt, null);
      assert.equal(stored?.submittedAt, null);
      assert.equal(stored?.funding.entries.length, 1);
      assert.equal(stored?.funding.entries[0]?.kind, "hold");
      await saveMarketplaceSettings({
        reviewWindowHours: settings?.reviewWindowHours ?? 72,
        maxRevisions: 9,
        cancelUnconfirmed: settings?.cancelUnconfirmed ?? true,
      });
      const again = await requestFundingRevision(funding.id, milestone.id, "Please replace the cover image.");
      assert.equal(again.ok, false);
      const frozen = await prisma.fundingMilestone.findUnique({ where: { id: milestone.id } });
      assert.equal(frozen?.revisionLimit, 1);
      assert.equal(frozen?.revisionCount, 1);
      assert.equal(frozen?.status, "pending");
    } finally {
      if (settings) {
        await prisma.marketplaceSettings.update({
          where: { id: "default" },
          data: { maxRevisions: settings.maxRevisions, reviewWindowHours: settings.reviewWindowHours },
        });
      }
      await cleanup(funding.id);
    }
  });

  it("refuses a revision while a dispute is open", async () => {
    const reasons = await listDisputeReasons();
    const reason = reasons.find((row) => row.active);
    if (!reason) throw new Error("expected a dispute reason");
    const funding = await createSubmitted("Revision during dispute", 2);
    try {
      await applyMarketplaceEvent({
        provider: "primary",
        eventId: `hold-${funding.id}`,
        eventType: "funding.held",
        fundingId: funding.id,
        amountCents: 10_000,
      });
      const milestone = funding.milestones[0];
      await prisma.fundingMilestone.update({
        where: { id: milestone.id },
        data: { status: "submitted", submittedAt: new Date() },
      });
      const opened = await openMilestoneDispute({
        fundingId: funding.id,
        milestoneId: milestone.id,
        openedBy: "business",
        reasonId: reason.id,
        details: "The file does not match the brief.",
      });
      assert.equal(opened.ok, true);
      const revised = await requestFundingRevision(funding.id, milestone.id, "Please replace the cover image.");
      assert.equal(revised.ok, false);
      const stored = await prisma.fundingMilestone.findUnique({ where: { id: milestone.id } });
      assert.equal(stored?.status, "submitted");
      assert.equal(stored?.revisionCount, 0);
    } finally {
      await cleanup(funding.id);
    }
  });
});
