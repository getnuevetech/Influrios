import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, describe, it } from "node:test";
import type { AccountSession } from "./accounts";
import { ensureOwnedBusinessWorkspace } from "./business";
import { prisma } from "./db";
import { deliverableFileRule } from "./deliverable-file-rules";
import { readDeliverableFile, saveDeliverableFiles } from "./deliverable-files";
import { assertFundingAccess } from "./funding-access";

async function databaseReady() {
  if (!process.env.DATABASE_URL) return false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

function accountOf(user: { id: string; email: string; role: string; name: string | null }): AccountSession {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    emailVerifiedAt: new Date(),
    hasPassword: true,
  };
}

describe("deliverable upload path (COR-21)", () => {
  it("keeps client helpers browser-safe and form dispatch uses startTransition", () => {
    const submit = readFileSync("src/components/deliverable-submit-form.tsx", "utf8");
    const add = readFileSync("src/components/deliverable-add-files-form.tsx", "utf8");
    const field = readFileSync("src/components/deliverable-file-field.tsx", "utf8");
    const rules = readFileSync("src/lib/deliverable-file-rules.ts", "utf8");
    const link = readFileSync("src/lib/deliverable-link.ts", "utf8");
    assert.equal(rules.includes("from \"fs\""), false);
    assert.equal(rules.includes("from \"crypto\""), false);
    assert.equal(rules.includes("@/lib/db"), false);
    assert.equal(link.includes("@/lib/db"), false);
    assert.equal(link.includes("marketplace-ledger"), false);
    assert.match(submit, /startTransition\s*\(\s*\(\)\s*=>\s*\{\s*formAction/);
    assert.match(add, /startTransition\s*\(\s*\(\)\s*=>\s*\{\s*formAction/);
    assert.equal(field.includes(".slice(0, DELIVERABLE_FILE_LIMIT)"), false);
    assert.match(field, /Add up to \$\{DELIVERABLE_FILE_LIMIT\} files/);
    assert.equal(deliverableFileRule("text/html", "pack.zip"), null);
    assert.equal(deliverableFileRule("application/x-zip-compressed", "pack.zip")?.kind, "file");
  });

  it("persists a file, reopens bytes, allows parties, and denies cross-account", async (t) => {
    if (!(await databaseReady())) {
      t.skip("DATABASE_URL is not available");
      return;
    }
    const stamp = Date.now().toString(36);
    const business = await prisma.user.create({
      data: { email: `deliv-biz-${stamp}@example.com`, name: `Biz ${stamp}`, role: "BUSINESS" },
    });
    const creatorUser = await prisma.user.create({
      data: { email: `deliv-cre-${stamp}@example.com`, name: `Creator ${stamp}`, role: "CREATOR" },
    });
    const stranger = await prisma.user.create({
      data: { email: `deliv-str-${stamp}@example.com`, name: `Stranger ${stamp}`, role: "BUSINESS" },
    });
    const workspace = await ensureOwnedBusinessWorkspace(business.id, { name: `Workspace ${stamp}` });
    await ensureOwnedBusinessWorkspace(stranger.id, { name: `Other ${stamp}` });
    await prisma.creator.create({
      data: { userId: creatorUser.id, slug: `deliv-${stamp}`, displayName: `Creator ${stamp}` },
    });
    const funding = await prisma.collaborationFunding.create({
      data: {
        jurisdictionCode: "US",
        businessName: `Biz ${stamp}`,
        workspaceId: workspace.businessId,
        creatorSlug: `deliv-${stamp}`,
        title: `Deliverable ${stamp}`,
        currency: "USD",
        grossCents: 10_000,
        feeCents: 0,
        feeSnapshotJson: {},
        serviceLevel: "contracted",
        status: "held",
        providerCode: "marketplace_sandbox",
      },
    });
    const milestone = await prisma.fundingMilestone.create({
      data: {
        fundingId: funding.id,
        title: "Kickoff",
        amountCents: 10_000,
        sortOrder: 0,
        status: "pending",
        reviewWindowHours: 72,
      },
    });
    const submission = await prisma.milestoneSubmission.create({
      data: {
        fundingId: funding.id,
        milestoneId: milestone.id,
        creatorSlug: `deliv-${stamp}`,
        version: 1,
        note: "Cut for review",
        linkUrl: "https://drive.example/cut",
        status: "submitted",
      },
    });
    const pdf = new File([new Uint8Array([37, 80, 68, 70, 45, 49])], "cut.pdf", { type: "application/pdf" });
    let fileId = "";
    try {
      const stored = await saveDeliverableFiles({
        fundingId: funding.id,
        milestoneId: milestone.id,
        submissionId: submission.id,
        audience: "creator",
        files: [pdf],
      });
      assert.equal(stored.ok, true);
      if (!stored.ok) return;
      fileId = stored.ids[0] ?? "";
      assert.ok(fileId);

      const row = await prisma.milestoneFile.findUnique({ where: { id: fileId } });
      assert.ok(row);
      assert.equal(row?.fileName, "cut.pdf");
      assert.equal(row?.submissionId, submission.id);

      const bytes = await readDeliverableFile(row!.storagePath);
      assert.equal(Buffer.from(bytes.bytes).equals(Buffer.from([37, 80, 68, 70, 45, 49])), true);

      const owner = await assertFundingAccess(accountOf(business), funding.id);
      const influencer = await assertFundingAccess(accountOf(creatorUser), funding.id);
      const outsider = await assertFundingAccess(accountOf(stranger), funding.id);
      assert.equal(owner.ok, true);
      assert.equal(influencer.ok, true);
      assert.equal(outsider.ok, false);

      const route = readFileSync("src/app/api/deliverables/[fileId]/route.ts", "utf8");
      assert.match(route, /assertFundingAccess/);
      assert.match(route, /status: 401/);
      assert.match(route, /status: 404/);
    } finally {
      if (fileId) await prisma.milestoneFile.delete({ where: { id: fileId } }).catch(() => undefined);
      await prisma.milestoneSubmission.delete({ where: { id: submission.id } }).catch(() => undefined);
      await prisma.fundingMilestone.delete({ where: { id: milestone.id } }).catch(() => undefined);
      await prisma.collaborationFunding.delete({ where: { id: funding.id } }).catch(() => undefined);
      await prisma.creator.deleteMany({ where: { userId: creatorUser.id } }).catch(() => undefined);
      await prisma.businessWorkspace.deleteMany({ where: { ownerUserId: { in: [business.id, stranger.id] } } }).catch(() => undefined);
      await prisma.businessProfile.deleteMany({ where: { userId: { in: [business.id, stranger.id] } } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: { in: [business.id, creatorUser.id, stranger.id] } } }).catch(() => undefined);
    }
  });
});

after(async () => {
  await prisma.$disconnect().catch(() => undefined);
});
