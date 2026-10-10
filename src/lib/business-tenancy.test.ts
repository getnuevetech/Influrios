import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prisma } from "./db";
import { readFileSync } from "node:fs";
import {
  PUBLIC_BUSINESS_WORKSPACE,
  ensureOwnedBusinessWorkspace,
  getWorkspace,
  enteredNote,
  newBusinessWorkspaceFields,
} from "./business";
import { listFundingsForBusiness } from "./marketplace-ledger";

const hasDbUrl = Boolean(process.env.DATABASE_URL);

async function requireDb(t: { skip: (msg?: string) => void }) {
  if (!hasDbUrl) {
    t.skip("DATABASE_URL not set");
    return false;
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    t.skip("Postgres not reachable");
    return false;
  }
}

describe("business workspace tenancy (W2.3)", () => {
  it("binds distinct workspaces + BusinessProfile per user", async (t) => {
    if (!(await requireDb(t))) return;
    const stamp = Date.now().toString(36);
    const userA = await prisma.user.create({
      data: {
        email: `biz-a-${stamp}@example.com`,
        name: `Brand A ${stamp}`,
        role: "BUSINESS",
      },
    });
    const userB = await prisma.user.create({
      data: {
        email: `biz-b-${stamp}@example.com`,
        name: `Brand B ${stamp}`,
        role: "BUSINESS",
      },
    });

    const wsA = await ensureOwnedBusinessWorkspace(userA.id, { name: `Acme ${stamp}` });
    const wsB = await ensureOwnedBusinessWorkspace(userB.id, { name: `Beta ${stamp}` });
    assert.notEqual(wsA.businessId, wsB.businessId);
    assert.equal(wsA.ownerUserId, userA.id);
    assert.equal(wsB.ownerUserId, userB.id);
    assert.notEqual(wsA.businessId, "demo-business");

    const again = await getWorkspace(userA.id);
    assert.equal(again.businessId, wsA.businessId);

    const profile = await prisma.businessProfile.findUnique({ where: { userId: userA.id } });
    assert.ok(profile);
    assert.equal(profile!.name, `Acme ${stamp}`);

    const fundingA = await prisma.collaborationFunding.create({
      data: {
        jurisdictionCode: "US",
        businessName: wsA.name,
        workspaceId: wsA.businessId,
        creatorSlug: `creator-${stamp}`,
        title: `Deal A ${stamp}`,
        currency: "USD",
        grossCents: 10_000,
        feeCents: 1_000,
        feeSnapshotJson: {},
        serviceLevel: "contracted",
        status: "held",
        providerCode: "marketplace_sandbox",
      },
    });
    const fundingB = await prisma.collaborationFunding.create({
      data: {
        jurisdictionCode: "US",
        businessName: wsA.name, // same display name must not leak across workspaces
        workspaceId: wsB.businessId,
        creatorSlug: `creator-${stamp}`,
        title: `Deal B ${stamp}`,
        currency: "USD",
        grossCents: 20_000,
        feeCents: 2_000,
        feeSnapshotJson: {},
        serviceLevel: "contracted",
        status: "held",
        providerCode: "marketplace_sandbox",
      },
    });

    const listedA = await listFundingsForBusiness(wsA.businessId);
    const listedB = await listFundingsForBusiness(wsB.businessId);
    assert.ok(listedA.some((row) => row.id === fundingA.id));
    assert.ok(!listedA.some((row) => row.id === fundingB.id));
    assert.ok(listedB.some((row) => row.id === fundingB.id));
    assert.ok(!listedB.some((row) => row.id === fundingA.id));

    await prisma.collaborationFunding.deleteMany({
      where: { id: { in: [fundingA.id, fundingB.id] } },
    });
    await prisma.businessWorkspace.deleteMany({
      where: { id: { in: [wsA.businessId, wsB.businessId] } },
    });
    await prisma.businessProfile.deleteMany({
      where: { userId: { in: [userA.id, userB.id] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  });

  it("logged-out getWorkspace is the free public workspace", async () => {
    const demo = await getWorkspace();
    assert.equal(demo.businessId, PUBLIC_BUSINESS_WORKSPACE.businessId);
    assert.equal(demo.plan, "BUSINESS_FREE");
    assert.notEqual(demo.businessId, "demo-business");
  });

  it("does not create the retired sample workspace", () => {
    const source = readFileSync("src/lib/business.ts", "utf8");
    const seed = readFileSync("prisma/seed.ts", "utf8");
    const sql = readFileSync(
      "prisma/migrations/20261009030000_remove_demo_business_workspace/migration.sql",
      "utf8",
    );
    assert.equal(source.includes("ensureDemoBusinessWorkspace"), false);
    assert.equal(source.includes("ensureDemoWorkspace"), false);
    assert.match(source, /removeUntouchedDemoBusinessWorkspace/);
    assert.match(seed, /removeUntouchedDemoBusinessWorkspace/);
    assert.match(sql, /demo-business/);
    assert.match(sql, /Luminous Beauty/);
    assert.match(sql, /brief-clean-launch/);
    assert.match(sql, /"ownerUserId" IS NULL/);
  });

  it("starts a new workspace on the free plan with a blank industry", () => {
    const named = newBusinessWorkspaceFields({
      userName: "Ada Okonkwo",
      email: "ada@example.com",
    });
    assert.equal(named.name, "Ada Okonkwo");
    assert.equal(named.industry, "");
    assert.equal(named.plan, "BUSINESS_FREE");

    const fromEmail = newBusinessWorkspaceFields({ email: "harbor@example.com" });
    assert.equal(fromEmail.name, "harbor");
    assert.equal(fromEmail.industry, "");

    const blank = newBusinessWorkspaceFields({});
    assert.equal(blank.name, "");
    assert.equal(blank.industry, "");
    assert.equal(blank.plan, "BUSINESS_FREE");

    const source = readFileSync("src/lib/business.ts", "utf8");
    const home = readFileSync("src/app/business/home/page.tsx", "utf8");
    assert.equal(source.includes('|| "General"'), false);
    assert.equal(source.includes('|| "Business"'), false);
    assert.equal(source.includes('plan: "BUSINESS_PRO"'), false);
    assert.equal(home.includes('|| "Business"'), false);
  });
});

describe("entered hub notes", () => {
  it("stores a shortlist or application note only when it was entered", () => {
    assert.equal(enteredNote("  Roster note  "), "Roster note");
    assert.equal(enteredNote("   "), undefined);
    assert.equal(enteredNote(null), undefined);
    assert.equal(enteredNote(undefined), undefined);

    const files = [
      "src/lib/business.ts",
      "src/app/collaboration/business/actions.ts",
      "src/app/collaboration/business/page.tsx",
      "src/app/collaboration/hub/actions.ts",
      "src/app/collaboration/hub/page.tsx",
      "src/components/shortlist-heart-button.tsx",
    ];
    const banned = [
      "Shortlisted from inquiry",
      "Saved from Discover",
      "Invited from shortlist",
      "Invited from suggestions",
      "Suggested for ",
      "we'd love to collaborate",
      "Apply from hub",
      "Connect from hub",
      "Invitation from ",
      "Application from ",
      "Marketplace application",
      "From inquiry ·",
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const phrase of banned) {
        assert.equal(source.includes(phrase), false, `${file} still contains ${phrase}`);
      }
    }
  });
});
