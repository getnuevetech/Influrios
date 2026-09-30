import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advanceMilestone,
  autoApproveDeadline,
  canRequestPrefund,
  fundingTerm,
  ledgerMovements,
  marketplaceDisposition,
  marketplaceSignature,
  reconcileLedger,
  shouldAutoApprove,
  splitGross,
  verifyMarketplaceSignature,
} from "./ledger";
import { applyMarketplaceEvent } from "./marketplace-ledger";
import { prisma } from "./db";

describe("marketplace ledger rules", () => {
  it("uses Protected Payment until the jurisdiction allows the escrow term", () => {
    assert.equal(fundingTerm(false), "Protected Payment");
    assert.equal(fundingTerm(true), "Escrow");
  });

  it("refuses a prefund when the jurisdiction or the provider is not ready", () => {
    assert.equal(canRequestPrefund({ jurisdictionEnabled: false, providerReady: true }).ok, false);
    assert.equal(canRequestPrefund({ jurisdictionEnabled: true, providerReady: false }).ok, false);
    assert.equal(canRequestPrefund({ jurisdictionEnabled: true, providerReady: true }).ok, true);
  });

  it("splits a gross by admin shares and keeps the total", () => {
    const parts = splitGross(10_000, [3400, 3300, 3300]);
    assert.deepEqual(parts, [3400, 3300, 3300]);
    assert.equal(splitGross(100, [5000, 5000])?.reduce((sum, part) => sum + part, 0), 100);
    assert.equal(splitGross(100, [4000, 4000]), null);
  });

  it("walks a milestone to approval and auto-approves only after the review window", () => {
    const submitted = advanceMilestone("pending", "submit");
    const approved = advanceMilestone("submitted", "approve");
    if (!submitted.ok || !approved.ok) throw new Error("milestone did not advance");
    assert.equal(submitted.status, "submitted");
    assert.equal(approved.status, "approved");
    assert.equal(advanceMilestone("pending", "approve").ok, false);
    assert.equal(advanceMilestone("approved", "submit").ok, false);
    const start = new Date("2026-09-30T12:00:00.000Z");
    const deadline = autoApproveDeadline(start, 72);
    assert.equal(shouldAutoApprove("submitted", deadline, new Date("2026-10-02T12:00:00.000Z")), false);
    assert.equal(shouldAutoApprove("submitted", deadline, new Date("2026-10-03T12:00:00.000Z")), true);
    assert.equal(shouldAutoApprove("pending", deadline, new Date("2026-10-03T12:00:00.000Z")), false);
  });

  it("reconciles provider holds without counting the fee as cash", () => {
    const open = reconcileLedger(
      [
        { kind: "hold", amountCents: 10_000 },
        { kind: "fee", amountCents: 1_000 },
      ],
      10_000,
    );
    assert.equal(open.heldCents, 10_000);
    assert.equal(open.balanced, true);
    const after = reconcileLedger(
      [
        { kind: "hold", amountCents: 10_000 },
        { kind: "release", amountCents: 3_400 },
        { kind: "refund", amountCents: 1_000 },
      ],
      10_000,
    );
    assert.equal(after.heldCents, 5_600);
    assert.equal(after.releasedCents, 3_400);
    assert.equal(after.balanced, true);
    const over = reconcileLedger([{ kind: "hold", amountCents: 10_001 }], 10_000);
    assert.equal(over.balanced, false);
  });

  it("applies a hold or release only when the funding and milestone are ready", () => {
    assert.equal(
      marketplaceDisposition({
        eventType: "funding.held",
        fundingStatus: "awaiting_provider",
        amountCents: 5000,
        expectedCents: 5000,
        heldCents: 0,
      }),
      "apply",
    );
    assert.equal(
      marketplaceDisposition({
        eventType: "funding.held",
        fundingStatus: "held",
        amountCents: 5000,
        expectedCents: 5000,
        heldCents: 5000,
      }),
      "reject",
    );
    assert.equal(
      marketplaceDisposition({
        eventType: "payout.released",
        fundingStatus: "held",
        amountCents: 2500,
        expectedCents: 2500,
        heldCents: 2500,
        milestoneStatus: "submitted",
      }),
      "reject",
    );
    assert.equal(
      marketplaceDisposition({
        eventType: "payout.released",
        fundingStatus: "held",
        amountCents: 2500,
        expectedCents: 2500,
        heldCents: 2500,
        milestoneStatus: "approved",
      }),
      "apply",
    );
    assert.equal(
      marketplaceDisposition({
        eventType: "provider.ping",
        fundingStatus: "held",
        amountCents: 1,
        expectedCents: 1,
        heldCents: 1,
      }),
      "ignore",
    );
  });

  it("checks the webhook signature", () => {
    const body = JSON.stringify({ id: "evt_1", type: "funding.held" });
    const signature = marketplaceSignature(body, "secret");
    assert.equal(verifyMarketplaceSignature(body, "secret", signature), true);
    assert.equal(verifyMarketplaceSignature(body, "secret", "nope"), false);
    assert.equal(verifyMarketplaceSignature(body, "", signature), false);
  });
});

describe("marketplace webhook idempotency", () => {
  it("holds once and does not apply a second event id as another hold", async () => {
    const funding = await prisma.collaborationFunding.create({
      data: {
        jurisdictionCode: "US",
        businessName: "Ledger test",
        creatorSlug: "sofia-martinez",
        title: "Idempotent prefund",
        grossCents: 10_000,
        feeCents: 1_000,
        feeSnapshotJson: { feeCents: 1_000 },
        serviceLevel: "contracted",
        status: "awaiting_provider",
        providerCode: "primary",
        milestones: {
          create: [{ title: "Only", amountCents: 10_000, sortOrder: 1, status: "pending", reviewWindowHours: 72 }],
        },
      },
      include: { milestones: true },
    });
    const first = await applyMarketplaceEvent({
      provider: "primary",
      eventId: `hold-${funding.id}`,
      eventType: "funding.held",
      fundingId: funding.id,
      amountCents: 10_000,
    });
    const duplicate = await applyMarketplaceEvent({
      provider: "primary",
      eventId: `hold-${funding.id}`,
      eventType: "funding.held",
      fundingId: funding.id,
      amountCents: 10_000,
    });
    const secondId = await applyMarketplaceEvent({
      provider: "primary",
      eventId: `hold-again-${funding.id}`,
      eventType: "funding.held",
      fundingId: funding.id,
      amountCents: 10_000,
    });
    const stored = await prisma.collaborationFunding.findUnique({
      where: { id: funding.id },
      include: { entries: true },
    });
    assert.equal(first.applied, true);
    assert.equal(duplicate.applied, false);
    assert.equal(duplicate.result, "duplicate");
    assert.equal(secondId.applied, false);
    assert.equal(secondId.result, "rejected");
    assert.equal(stored?.status, "held");
    assert.equal(stored?.entries.filter((entry) => entry.kind === "hold").length, 1);
    assert.equal(stored?.entries.filter((entry) => entry.kind === "fee").length, 1);

    const milestone = funding.milestones[0];
    await prisma.fundingMilestone.update({ where: { id: milestone.id }, data: { status: "approved" } });
    const release = await applyMarketplaceEvent({
      provider: "primary",
      eventId: `release-${funding.id}`,
      eventType: "payout.released",
      fundingId: funding.id,
      amountCents: 10_000,
      milestoneId: milestone.id,
    });
    const releaseAgain = await applyMarketplaceEvent({
      provider: "primary",
      eventId: `release-${funding.id}`,
      eventType: "payout.released",
      fundingId: funding.id,
      amountCents: 10_000,
      milestoneId: milestone.id,
    });
    const finished = await prisma.collaborationFunding.findUnique({
      where: { id: funding.id },
      include: { entries: true, milestones: true },
    });
    assert.equal(release.applied, true);
    assert.equal(releaseAgain.result, "duplicate");
    assert.equal(finished?.status, "completed");
    assert.equal(finished?.milestones[0]?.status, "released");
    const ledger = reconcileLedger(ledgerMovements(finished?.entries ?? []), 10_000);
    assert.equal(ledger.heldCents, 0);
    assert.equal(ledger.releasedCents, 10_000);
    assert.equal(ledger.balanced, true);
  });
});
