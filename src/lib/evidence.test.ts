import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prisma } from "./db";
import { canAddEvidence, evidenceLink } from "./disputes";
import { applyMarketplaceEvent } from "./marketplace-ledger";
import { addDisputeEvidence, listDisputeReasons, openMilestoneDispute } from "./milestone-disputes";

describe("dispute evidence rules", () => {
  it("allows another note only while the dispute is open and under the copied cap", () => {
    assert.equal(canAddEvidence({ status: "open", evidenceCount: 0, evidenceLimit: 1 }).ok, true);
    assert.equal(canAddEvidence({ status: "under_review", evidenceCount: 1, evidenceLimit: 1 }).ok, false);
    assert.equal(canAddEvidence({ status: "withdrawn", evidenceCount: 0, evidenceLimit: 2 }).ok, false);
    assert.equal(canAddEvidence({ status: "open", evidenceCount: 0, evidenceLimit: 0 }).ok, false);
  });

  it("keeps an https link and rejects anything else", () => {
    assert.equal(evidenceLink("").ok, true);
    const ok = evidenceLink("https://files.example.com/brief.pdf");
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.url, "https://files.example.com/brief.pdf");
    assert.equal(evidenceLink("http://files.example.com/brief.pdf").ok, false);
    assert.equal(evidenceLink("javascript:alert(1)").ok, false);
    assert.equal(evidenceLink("https://user:pass@files.example.com/a").ok, false);
  });
});

async function createHeld(title: string) {
  const funding = await prisma.collaborationFunding.create({
    data: {
      jurisdictionCode: "US",
      businessName: "Evidence test",
      creatorSlug: "sofia-martinez",
      title,
      grossCents: 10_000,
      feeCents: 0,
      feeSnapshotJson: { feeCents: 0 },
      serviceLevel: "contracted",
      status: "awaiting_provider",
      providerCode: "primary",
      milestones: {
        create: [{ title: "Delivery", amountCents: 10_000, sortOrder: 1, status: "pending", reviewWindowHours: 72 }],
      },
    },
    include: { milestones: true },
  });
  await applyMarketplaceEvent({
    provider: "primary",
    eventId: `hold-${funding.id}`,
    eventType: "funding.held",
    fundingId: funding.id,
    amountCents: 10_000,
  });
  return funding;
}

async function cleanup(fundingId: string) {
  await prisma.processedWebhook.deleteMany({ where: { eventId: { contains: fundingId } } });
  await prisma.collaborationFunding.delete({ where: { id: fundingId } }).catch(() => undefined);
}

describe("milestone dispute evidence", () => {
  it("stores one note without a ledger entry and keeps the frozen cap", async () => {
    const settings = await prisma.marketplaceSettings.findUnique({ where: { id: "default" } });
    const reasons = await listDisputeReasons();
    const reason = reasons.find((row) => row.active);
    if (!reason) throw new Error("expected a dispute reason");
    const funding = await createHeld("Evidence once");
    try {
      await prisma.marketplaceSettings.update({ where: { id: "default" }, data: { maxEvidence: 1 } });
      const opened = await openMilestoneDispute({
        fundingId: funding.id,
        milestoneId: funding.milestones[0].id,
        openedBy: "business",
        reasonId: reason.id,
        details: "The file does not match the brief.",
      });
      assert.equal(opened.ok, true);
      if (!opened.ok) return;
      const saved = await addDisputeEvidence({
        disputeId: opened.id,
        fundingId: funding.id,
        author: "business",
        body: "The approved storyboard is attached.",
        url: "https://files.example.com/storyboard.pdf",
      });
      assert.equal(saved.ok, true);
      await prisma.marketplaceSettings.update({ where: { id: "default" }, data: { maxEvidence: 9 } });
      const badLink = await addDisputeEvidence({
        disputeId: opened.id,
        fundingId: funding.id,
        author: "creator",
        body: "A plain http link is refused.",
        url: "http://files.example.com/nope.pdf",
      });
      assert.equal(badLink.ok, false);
      await prisma.marketplaceSettings.update({ where: { id: "default" }, data: { maxEvidence: 9 } });
      const again = await addDisputeEvidence({
        disputeId: opened.id,
        fundingId: funding.id,
        author: "creator",
        body: "A second file should not be accepted.",
        url: "https://files.example.com/second.pdf",
      });
      assert.equal(again.ok, false);
      const dispute = await prisma.milestoneDispute.findUnique({
        where: { id: opened.id },
        include: { notes: true, funding: { include: { entries: true } } },
      });
      assert.equal(dispute?.evidenceLimit, 1);
      assert.equal(dispute?.notes.length, 1);
      assert.equal(dispute?.notes[0]?.url, "https://files.example.com/storyboard.pdf");
      assert.equal(dispute?.funding.entries.length, 1);
      assert.equal(dispute?.funding.entries[0]?.kind, "hold");
    } finally {
      if (settings) {
        await prisma.marketplaceSettings.update({
          where: { id: "default" },
          data: { maxEvidence: settings.maxEvidence },
        });
      }
      await cleanup(funding.id);
    }
  });

  it("refuses evidence after the dispute is withdrawn", async () => {
    const reasons = await listDisputeReasons();
    const reason = reasons.find((row) => row.active);
    if (!reason) throw new Error("expected a dispute reason");
    const funding = await createHeld("Evidence after close");
    try {
      const opened = await openMilestoneDispute({
        fundingId: funding.id,
        milestoneId: funding.milestones[0].id,
        openedBy: "creator",
        reasonId: reason.id,
        details: "The file does not match the brief.",
      });
      assert.equal(opened.ok, true);
      if (!opened.ok) return;
      await prisma.milestoneDispute.update({ where: { id: opened.id }, data: { status: "withdrawn" } });
      const saved = await addDisputeEvidence({
        disputeId: opened.id,
        author: "ops",
        body: "This note arrives too late.",
      });
      assert.equal(saved.ok, false);
      const notes = await prisma.disputeNote.count({ where: { disputeId: opened.id } });
      assert.equal(notes, 0);
    } finally {
      await cleanup(funding.id);
    }
  });
});
