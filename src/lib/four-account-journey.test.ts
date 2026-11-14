import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { bankPayoutIsPaid, journeyFundingInitiation, proveFourAccountJourney } from "./four-account-journey";
import { prisma } from "./db";
import { ensureOwnedBusinessWorkspace } from "./business";
import { signNativeContractParty } from "./contract-document";
import { assertFundingAccess, requireBusinessFundingAccess } from "./funding-access";
import { approveFundingMilestone } from "./marketplace-ledger";
import { paymentStages } from "./payment-stages";
import { reviewVersionDecision } from "./version-review";
import type { AccountSession } from "./accounts";

function accountOf(user: { id: string; email: string; name: string | null; role: string }): AccountSession {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerifiedAt: new Date(),
    role: user.role,
    hasPassword: true,
  };
}

async function databaseReady() {
  if (!process.env.DATABASE_URL) return false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

describe("four account journey", () => {
  it("proves the private journey for influencer, business, agency, and admin", () => {
    const checks = proveFourAccountJourney();
    assert.equal(checks.length, 15);
    for (const row of checks) {
      assert.equal(row.ok, true, `${row.id} ${row.step}: ${row.detail}`);
    }
    const actors = new Set(checks.map((row) => row.actor));
    assert.deepEqual([...actors].sort(), ["admin", "agency", "business", "influencer"]);
    assert.equal(
      bankPayoutIsPaid({ fundingStatus: "held", milestoneStatuses: ["approved"], entryKinds: ["hold"] }),
      false,
    );
  });

  it("pauses new funding before a deposit is created and leaves reconciliation available", () => {
    const paused = journeyFundingInitiation({ rolloutEnabled: false, intent: "start_funding" });
    assert.equal(paused.ok, false);
    if (!paused.ok) assert.match(paused.error, /Nothing was charged/);
    assert.equal(journeyFundingInitiation({ rolloutEnabled: false, intent: "reconcile" }).ok, true);
    assert.equal(journeyFundingInitiation({ rolloutEnabled: false, intent: "refund" }).ok, true);
    assert.equal(journeyFundingInitiation({ rolloutEnabled: false, intent: "payout" }).ok, true);
    assert.equal(journeyFundingInitiation({ rolloutEnabled: true, intent: "start_funding" }).ok, true);
    const checkout = readFileSync("src/lib/funding-checkout.ts", "utf8");
    const start = checkout.indexOf("export async function startFundingDeposit");
    const gate = checkout.indexOf("journeyFundingInitiation", start);
    const created = checkout.indexOf("fundingDeposit.create", start);
    assert.ok(start > 0 && gate > start && created > gate);
    const approve = readFileSync("src/app/payments/actions.ts", "utf8");
    const action = approve.indexOf("export async function actionApproveMilestone");
    const access = approve.indexOf("requireBusinessFundingAccess", action);
    const version = approve.indexOf("reviewVersionDecision", action);
    const money = approve.indexOf("approveFundingMilestone", action);
    assert.ok(action > 0 && access > action && version > access && money > version);
  });
});

describe("four account records", () => {
  it("keeps the selected collaboration with its parties and leaves the others out", async (t) => {
    if (!(await databaseReady())) {
      t.skip("DATABASE_URL is not available");
      return;
    }
    const stamp = Date.now().toString(36);
    const business = await prisma.user.create({
      data: { email: `journey-biz-${stamp}@example.com`, name: `Business ${stamp}`, role: "BUSINESS" },
    });
    const otherBusiness = await prisma.user.create({
      data: { email: `journey-other-${stamp}@example.com`, name: `Other ${stamp}`, role: "BUSINESS" },
    });
    const influencer = await prisma.user.create({
      data: { email: `journey-inf-${stamp}@example.com`, name: `Influencer ${stamp}`, role: "CREATOR" },
    });
    const unselected = await prisma.user.create({
      data: { email: `journey-un-${stamp}@example.com`, name: `Unselected ${stamp}`, role: "CREATOR" },
    });
    const agency = await prisma.user.create({
      data: { email: `journey-ag-${stamp}@example.com`, name: `Agency ${stamp}`, role: "AGENCY" },
    });
    const admin = await prisma.user.create({
      data: { email: `journey-admin-${stamp}@example.com`, name: `Admin ${stamp}`, role: "ADMIN" },
    });
    const workspace = await ensureOwnedBusinessWorkspace(business.id, { name: `Journey ${stamp}` });
    await ensureOwnedBusinessWorkspace(otherBusiness.id, { name: `Other journey ${stamp}` });
    await prisma.creator.create({
      data: { userId: influencer.id, slug: `selected-${stamp}`, displayName: `Selected ${stamp}` },
    });
    await prisma.creator.create({
      data: { userId: unselected.id, slug: `other-${stamp}`, displayName: `Other influencer ${stamp}` },
    });
    const funding = await prisma.collaborationFunding.create({
      data: {
        jurisdictionCode: "US",
        businessName: workspace.name,
        workspaceId: workspace.businessId,
        creatorSlug: `selected-${stamp}`,
        title: `Journey ${stamp}`,
        currency: "USD",
        grossCents: 10_000,
        feeCents: 0,
        feeSnapshotJson: {},
        serviceLevel: "contracted",
        status: "awaiting_provider",
        providerCode: "marketplace_sandbox",
        milestones: {
          create: [{ title: "Delivery", amountCents: 10_000, sortOrder: 1, status: "submitted", revisionLimit: 2, reviewWindowHours: 72 }],
        },
      },
      include: { milestones: true },
    });
    const milestone = funding.milestones[0]!;
    await prisma.milestoneSubmission.createMany({
      data: [
        { fundingId: funding.id, milestoneId: milestone.id, creatorSlug: `selected-${stamp}`, version: 1, status: "revision_requested", note: "First version" },
        { fundingId: funding.id, milestoneId: milestone.id, creatorSlug: `selected-${stamp}`, version: 2, status: "submitted", note: "Second version" },
      ],
    });
    const document = await prisma.contractDocument.create({
      data: {
        workspaceId: workspace.businessId,
        fundingId: funding.id,
        title: `Journey agreement ${stamp}`,
        renderedBody: "Agreement body",
        pdfBytes: Buffer.from("journey"),
        status: "sent",
        signingChannel: "native",
        parties: {
          create: [
            { role: "business", name: `Business ${stamp}`, email: business.email, userId: business.id, status: "pending" },
            { role: "influencer", name: `Influencer ${stamp}`, email: influencer.email, userId: influencer.id, status: "pending" },
          ],
        },
      },
    });
    try {
      const businessAccess = await assertFundingAccess(accountOf(business), funding.id);
      const otherAccess = await assertFundingAccess(accountOf(otherBusiness), funding.id);
      const influencerAccess = await assertFundingAccess(accountOf(influencer), funding.id);
      const unselectedAccess = await assertFundingAccess(accountOf(unselected), funding.id);
      const agencyAccess = await assertFundingAccess(accountOf(agency), funding.id);
      const adminAccess = await assertFundingAccess(accountOf(admin), funding.id);
      assert.equal(businessAccess.ok, true);
      assert.equal(requireBusinessFundingAccess(businessAccess).ok, true);
      assert.equal(otherAccess.ok, false);
      assert.equal(influencerAccess.ok, true);
      assert.equal(requireBusinessFundingAccess(influencerAccess).ok, false);
      assert.equal(unselectedAccess.ok, false);
      assert.equal(agencyAccess.ok, false);
      assert.equal(adminAccess.ok, false);

      const stranger = await signNativeContractParty({
        documentId: document.id,
        userId: unselected.id,
        email: unselected.email,
        typedName: "Unselected Person",
      });
      assert.equal(stranger.ok, false);
      if (!stranger.ok) assert.match(stranger.error, /Nothing was signed/);
      const businessSign = await signNativeContractParty({
        documentId: document.id,
        userId: business.id,
        email: business.email,
        typedName: "Business Signer",
      });
      assert.equal(businessSign.ok, true);
      if (businessSign.ok) assert.equal(businessSign.status, "sent");
      const storedContract = await prisma.contractDocument.findUnique({ where: { id: document.id } });
      assert.equal(storedContract?.status, "sent");

      const submissions = await prisma.milestoneSubmission.findMany({
        where: { milestoneId: milestone.id },
        select: { version: true, status: true },
      });
      const oldVersion = reviewVersionDecision({ versions: submissions, requestedVersion: 1, intent: "approve" });
      assert.equal(oldVersion.ok, false);
      const approved = await approveFundingMilestone(funding.id, milestone.id);
      assert.equal(approved.ok, true);
      const stored = await prisma.collaborationFunding.findUnique({
        where: { id: funding.id },
        include: { milestones: true, entries: true },
      });
      assert.equal(stored?.status, "awaiting_provider");
      assert.equal(stored?.milestones[0]?.status, "approved");
      assert.equal(stored?.entries.length, 0);
      const stages = paymentStages({
        fundingStatus: stored?.status ?? "",
        milestoneStatuses: stored?.milestones.map((row) => row.status) ?? [],
        entryKinds: [],
      });
      assert.equal(stages.find((stage) => stage.id === "bank")?.status === "Paid", false);
    } finally {
      await prisma.contractDocument.delete({ where: { id: document.id } }).catch(() => undefined);
      await prisma.collaborationFunding.delete({ where: { id: funding.id } }).catch(() => undefined);
      await prisma.creator.deleteMany({ where: { userId: { in: [influencer.id, unselected.id] } } }).catch(() => undefined);
      await prisma.businessWorkspace.deleteMany({ where: { ownerUserId: { in: [business.id, otherBusiness.id] } } }).catch(() => undefined);
      await prisma.businessProfile.deleteMany({ where: { userId: { in: [business.id, otherBusiness.id] } } }).catch(() => undefined);
      await prisma.user.deleteMany({
        where: { id: { in: [business.id, otherBusiness.id, influencer.id, unselected.id, agency.id, admin.id] } },
      }).catch(() => undefined);
    }
  });
});
