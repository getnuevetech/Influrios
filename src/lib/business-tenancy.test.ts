import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prisma } from "./db";
import {
  DEMO_BUSINESS_WORKSPACE_ID,
  PUBLIC_BUSINESS_WORKSPACE,
  ensureOwnedBusinessWorkspace,
  getWorkspace,
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
    assert.notEqual(wsA.businessId, DEMO_BUSINESS_WORKSPACE_ID);

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
    assert.notEqual(demo.businessId, DEMO_BUSINESS_WORKSPACE_ID);
  });
});
