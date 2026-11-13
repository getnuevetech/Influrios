import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { homePathForRole, type AccountSession } from "./accounts";
import { safeNextPath } from "./account-policy";
import { advanceMilestone } from "./ledger";
import { inviteeResponsePlan } from "./marketplace-listings";
import { approveFundingMilestone } from "./marketplace-ledger";
import { providerEventMayAdvance, returnedPayoutPostings } from "./payment-engine";
import { paymentStages } from "./payment-stages";
import { prisma } from "./db";
import { ensureOwnedBusinessWorkspace } from "./business";
import { assertFundingAccess, requireBusinessFundingAccess } from "./funding-access";
import { listContractsForUser, signNativeContractParty } from "./contract-document";

const providerEvent = {
  eventName: "payment_intent.succeeded",
  holdingAvailable: true,
  beneficiaryConfirmed: false,
  amountCents: 375_000,
  expectedAmountCents: 375_000,
  currency: "USD",
  expectedCurrency: "USD",
  accountId: "acct",
  expectedAccountId: "acct",
  environment: "demo",
  expectedEnvironment: "demo",
  fundingId: "deal-1",
  expectedFundingId: "deal-1",
  duplicate: false,
};

function read(path: string) {
  return readFileSync(path, "utf8");
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

describe("acceptance scenarios", () => {
  it("R01 keeps each role on its home, preserves an authorized return, and leaves settings separate", () => {
    assert.equal(homePathForRole("CREATOR"), "/creator");
    assert.equal(homePathForRole("BUSINESS"), "/business/home");
    assert.equal(homePathForRole("AGENCY"), "/agency");
    assert.equal(safeNextPath("/collaboration/contracts/deal-1?next=sign"), "/collaboration/contracts/deal-1?next=sign");
    assert.equal(safeNextPath("https://evil.example/payments"), "/creator");
    const shell = read("src/components/account-shell.tsx");
    assert.match(shell, /href: "\/account", label: "Settings"/);
    assert.equal(shell.includes('href: "/account", label: "Dashboard"'), false);
  });

  it("R03 rejects a withdrawn invitation without signing or funding", () => {
    const revoked = inviteeResponsePlan({ status: "WITHDRAWN", intent: "interested" });
    assert.equal(revoked.ok, false);
    if (revoked.ok) return;
    assert.match(revoked.error, /Nothing was signed or funded/);
    assert.equal(revoked.error.includes("ACCEPTED"), false);
  });

  it("R06 does not advance a duplicate, mismatched, or unconfirmed collection", () => {
    const duplicate = providerEventMayAdvance({ ...providerEvent, duplicate: true });
    assert.equal(duplicate.advance, false);
    if (!duplicate.advance) assert.match(duplicate.reason, /already applied/);
    const otherDeal = providerEventMayAdvance({ ...providerEvent, fundingId: "deal-2" });
    assert.equal(otherDeal.advance, false);
    const checkoutReturn = providerEventMayAdvance({ ...providerEvent, holdingAvailable: false });
    assert.equal(checkoutReturn.advance, false);
    if (!checkoutReturn.advance) assert.match(checkoutReturn.reason, /without evidence/);
  });

  it("R07 approves a submitted milestone once", () => {
    const first = advanceMilestone("submitted", "approve");
    assert.equal(first.ok, true);
    assert.equal(advanceMilestone("approved", "approve").ok, false);
  });

  it("R08 keeps a returned payout off the refund ledger and unpaid until the bank confirms", () => {
    const returned = returnedPayoutPostings({ amountCents: 343_000, alreadyReturned: false });
    assert.equal(returned.ok, true);
    if (!returned.ok) return;
    assert.deepEqual(
      returned.entries.map((entry) => entry.kind),
      ["return"],
    );
    assert.equal(returned.entries.some((entry) => entry.kind === "refund"), false);
    const again = returnedPayoutPostings({ amountCents: 343_000, alreadyReturned: true });
    assert.equal(again.ok, false);
    const stages = paymentStages({
      fundingStatus: "held",
      milestoneStatuses: ["returned"],
      entryKinds: ["hold", "release", "return"],
    });
    assert.equal(stages.find((stage) => stage.id === "bank")?.status, "Returned");
    assert.equal(stages.some((stage) => stage.status === "Paid"), false);
  });

  it("R11 disables a second duplicate while the first is still saving", () => {
    const ui = read("src/components/admin-access-levels-ui.tsx");
    const button = ui.slice(ui.indexOf("function DuplicateRoleButton"));
    assert.match(button, /disabled=\{pending\}/);
    assert.match(button, /Duplicating/);
    assert.match(ui, /Only permissions you can delegate are available/);
    assert.match(ui, /System roles are read-only/);
  });

  it("R13 gives the shared dialogs a name, a modal boundary, and an internal scroll", () => {
    const dialog = read("src/components/account-dialog.tsx");
    const record = read("src/components/payment-journey/record-dialog.tsx");
    const agreement = read("src/components/contract-agreement-dialog.tsx");
    const roles = read("src/components/admin-access-levels-ui.tsx");
    for (const source of [dialog, record, roles]) {
      assert.match(source, /role="dialog"/);
      assert.match(source, /aria-modal="true"/);
      assert.match(source, /aria-labelledby=/);
      assert.match(source, /useAccountDialogBehavior/);
    }
    assert.match(dialog, /overflow-y-auto/);
    assert.match(dialog, /inset-0/);
    assert.match(record, /scroll=\{false\}/);
    assert.match(agreement, /role="tablist"/);
    assert.match(agreement, /role="tabpanel"/);
    assert.match(agreement, /overflow-y-auto/);
  });

  it("R14 shows a failed money load as unavailable and retries without a new instruction", () => {
    const payments = read("src/app/payments/payments-panel.tsx");
    const earnings = read("src/app/creator/earnings/earnings-panel.tsx");
    const note = read("src/components/unavailable-note.tsx");
    assert.match(payments, /UnavailableNote label="Payment data"/);
    assert.equal(payments.includes("listFundingsForBusiness(workspace.businessId).catch(() => [])"), false);
    assert.equal(payments.includes("listFundingsForCreator(creator.slug).catch(() => [])"), false);
    assert.match(earnings, /UnavailableNote label="Earnings"/);
    assert.match(earnings, /This is not zero/);
    assert.match(note, /This is not zero/);
    assert.match(note, /<Link href=\{href\}/);
    assert.equal(note.includes("<form"), false);
    assert.equal(note.includes("payout"), false);
  });
});

describe("acceptance scenarios with a database", () => {
  it("R02 denies another business, creator, contract party, and attachment route", async (t) => {
    if (!(await databaseReady())) {
      t.skip("DATABASE_URL is not available");
      return;
    }
    const stamp = Date.now().toString(36);
    const userA = await prisma.user.create({
      data: { email: `tenant-a-${stamp}@example.com`, name: `Brand A ${stamp}`, role: "BUSINESS" },
    });
    const userB = await prisma.user.create({
      data: { email: `tenant-b-${stamp}@example.com`, name: `Brand B ${stamp}`, role: "BUSINESS" },
    });
    const creator = await prisma.user.create({
      data: { email: `tenant-c-${stamp}@example.com`, name: `Influencer ${stamp}`, role: "CREATOR" },
    });
    const stranger = await prisma.user.create({
      data: { email: `tenant-d-${stamp}@example.com`, name: `Stranger ${stamp}`, role: "CREATOR" },
    });
    const wsA = await ensureOwnedBusinessWorkspace(userA.id, { name: `Acme ${stamp}` });
    const wsB = await ensureOwnedBusinessWorkspace(userB.id, { name: `Beta ${stamp}` });
    await prisma.creator.create({
      data: { userId: creator.id, slug: `ada-${stamp}`, displayName: `Ada ${stamp}` },
    });
    const funding = await prisma.collaborationFunding.create({
      data: {
        jurisdictionCode: "US",
        businessName: wsA.name,
        workspaceId: wsA.businessId,
        creatorSlug: `ada-${stamp}`,
        title: `Private deal ${stamp}`,
        currency: "USD",
        grossCents: 10_000,
        feeCents: 1_000,
        feeSnapshotJson: {},
        serviceLevel: "contracted",
        status: "held",
        providerCode: "marketplace_sandbox",
      },
    });
    const privateTerms = `Private terms ${stamp}`;
    const document = await prisma.contractDocument.create({
      data: {
        title: `Private agreement ${stamp}`,
        renderedBody: privateTerms,
        pdfBytes: Buffer.from("%PDF-1.4"),
        status: "sent",
        signingChannel: "native",
        workspaceId: wsA.businessId,
        parties: {
          create: [{ role: "business", name: userA.name ?? "Brand A", email: userA.email, userId: userA.id, status: "pending" }],
        },
      },
    });
    try {
      const owner = await assertFundingAccess(accountOf(userA), funding.id);
      const otherBusiness = await assertFundingAccess(accountOf(userB), funding.id);
      const influencer = await assertFundingAccess(accountOf(creator), funding.id);
      const outsider = await assertFundingAccess(accountOf(stranger), funding.id);
      assert.equal(owner.ok, true);
      assert.equal(otherBusiness.ok, false);
      assert.equal(influencer.ok, true);
      if (influencer.ok) assert.equal(requireBusinessFundingAccess(influencer).ok, false);
      assert.equal(outsider.ok, false);
      assert.notEqual(wsA.businessId, wsB.businessId);

      const seenByStranger = await listContractsForUser(stranger.id, stranger.email);
      assert.equal(seenByStranger.some((row) => row.id === document.id), false);
      assert.equal(seenByStranger.some((row) => row.renderedBody.includes(privateTerms)), false);
      const forged = await signNativeContractParty({
        documentId: document.id,
        userId: stranger.id,
        email: stranger.email,
        typedName: "Stranger",
      });
      assert.equal(forged.ok, false);
      const stored = await prisma.contractDocument.findUnique({ where: { id: document.id } });
      assert.equal(stored?.status, "sent");
      assert.equal(stored?.renderedBody, privateTerms);

      const attachment = read("src/app/api/deliverables/[fileId]/route.ts");
      assert.match(attachment, /assertFundingAccess/);
      assert.equal(attachment.includes("listFundings("), false);
    } finally {
      await prisma.contractDocument.delete({ where: { id: document.id } }).catch(() => undefined);
      await prisma.collaborationFunding.delete({ where: { id: funding.id } }).catch(() => undefined);
      await prisma.creator.deleteMany({ where: { userId: creator.id } }).catch(() => undefined);
      await prisma.businessWorkspace.deleteMany({ where: { id: { in: [wsA.businessId, wsB.businessId] } } }).catch(() => undefined);
      await prisma.businessProfile.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id, creator.id, stranger.id] } } }).catch(() => undefined);
    }
  });

  it("R07 applies one approval when two requests arrive together", async (t) => {
    if (!(await databaseReady())) {
      t.skip("DATABASE_URL is not available");
      return;
    }
    const stamp = Date.now().toString(36);
    const funding = await prisma.collaborationFunding.create({
      data: {
        jurisdictionCode: "US",
        businessName: `Approval ${stamp}`,
        creatorSlug: `ada-${stamp}`,
        title: `Approval ${stamp}`,
        currency: "USD",
        grossCents: 10_000,
        feeCents: 0,
        feeSnapshotJson: {},
        serviceLevel: "contracted",
        status: "awaiting_provider",
        providerCode: "marketplace_sandbox",
        milestones: {
          create: [
            {
              title: "Delivery",
              amountCents: 10_000,
              sortOrder: 1,
              status: "submitted",
              reviewWindowHours: 72,
              revisionLimit: 1,
            },
          ],
        },
      },
      include: { milestones: true },
    });
    const milestoneId = funding.milestones[0]!.id;
    try {
      const [first, second] = await Promise.all([
        approveFundingMilestone(funding.id, milestoneId),
        approveFundingMilestone(funding.id, milestoneId),
      ]);
      assert.equal([first, second].filter((result) => result.ok).length, 1);
      const stored = await prisma.fundingMilestone.findUnique({
        where: { id: milestoneId },
        include: { funding: { include: { entries: true } } },
      });
      assert.equal(stored?.status, "approved");
      assert.equal(stored?.funding.entries.length, 0);
      const replay = await approveFundingMilestone(funding.id, milestoneId);
      assert.equal(replay.ok, false);
    } finally {
      await prisma.collaborationFunding.delete({ where: { id: funding.id } }).catch(() => undefined);
    }
  });
});
