import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prisma } from "./db";

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

describe("funding collaboration link (W2.5)", () => {
  it("persists collaborationId on funding and joins pipeline by FK", async (t) => {
    if (!(await requireDb(t))) return;
    const stamp = Date.now().toString(36);
    const collab = await prisma.collaboration.create({
      data: {
        initiatorSlug: `init-${stamp}`,
        recipientSlug: `recv-${stamp}`,
        title: `Collab ${stamp}`,
        scope: "Scope",
        roleInitiator: "Host",
        roleRecipient: "Guest",
        commercial: "Paid",
        status: "accepted",
        why: "test",
        reasons: [],
        score: 80,
      },
    });
    const funding = await prisma.collaborationFunding.create({
      data: {
        jurisdictionCode: "US",
        businessName: `Biz ${stamp}`,
        collaborationId: collab.id,
        creatorSlug: `recv-${stamp}`,
        title: `Different title ${stamp}`,
        currency: "USD",
        grossCents: 5000,
        feeCents: 500,
        feeSnapshotJson: {},
        serviceLevel: "contracted",
        status: "held",
        providerCode: "marketplace_sandbox",
      },
    });

    const loaded = await prisma.collaborationFunding.findUnique({ where: { id: funding.id } });
    assert.equal(loaded?.collaborationId, collab.id);

    // Hub prefers FK over title mismatch.
    const byFk = await prisma.collaborationFunding.findFirst({
      where: { collaborationId: collab.id },
    });
    assert.equal(byFk?.id, funding.id);
    assert.notEqual(byFk?.title.toLowerCase(), collab.title.toLowerCase());

    await prisma.collaborationFunding.delete({ where: { id: funding.id } });
    await prisma.collaboration.delete({ where: { id: collab.id } });
  });
});
