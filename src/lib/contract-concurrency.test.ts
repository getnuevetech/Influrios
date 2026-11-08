import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contractContentDigest, signNativeContractParty } from "./contract-document";
import { prisma } from "./db";
import { nextProposalStatus, respondToTeamProposal } from "./team-proposal";

const hasDbUrl = Boolean(process.env.DATABASE_URL);

async function requireDb(t: { skip: (message?: string) => void }) {
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

describe("concurrent agreement and team responses", () => {
  it("two final signers produce one signed parent and a matching digest", async (t) => {
    if (!(await requireDb(t))) return;
    const stamp = Date.now().toString(36);
    const body = `Agreement ${stamp}\n/sig1/\n/sig2/`;
    const ann = await prisma.user.create({
      data: { email: `ann-${stamp}@example.com`, emailVerifiedAt: new Date(), name: "Ann Owner" },
    });
    const bea = await prisma.user.create({
      data: { email: `bea-${stamp}@example.com`, emailVerifiedAt: new Date(), name: "Bea Owner" },
    });
    const document = await prisma.contractDocument.create({
      data: {
        title: `Concurrent ${stamp}`,
        renderedBody: body,
        contentDigest: contractContentDigest(body),
        pdfBytes: Buffer.from("%PDF-1.4"),
        status: "sent",
        signingChannel: "native",
        parties: {
          create: [
            { role: "business", name: "Ann Owner", email: ann.email, userId: ann.id, status: "pending" },
            { role: "creator", name: "Bea Owner", email: bea.email, userId: bea.id, status: "pending" },
          ],
        },
      },
    });
    try {
      const [first, second] = await Promise.all([
        signNativeContractParty({ documentId: document.id, userId: ann.id, email: ann.email, typedName: "Ann Owner" }),
        signNativeContractParty({ documentId: document.id, userId: bea.id, email: bea.email, typedName: "Bea Owner" }),
      ]);
      assert.equal(first.ok, true);
      assert.equal(second.ok, true);
      const stored = await prisma.contractDocument.findUnique({
        where: { id: document.id },
        include: { parties: true },
      });
      assert.equal(stored?.status, "signed");
      assert.equal(stored?.parties.every((party) => party.status === "signed"), true);
      assert.equal(stored?.contentDigest, contractContentDigest(stored?.renderedBody ?? ""));
      assert.match(stored?.renderedBody ?? "", /Ann Owner/);
      assert.match(stored?.renderedBody ?? "", /Bea Owner/);
    } finally {
      await prisma.contractDocument.delete({ where: { id: document.id } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: { in: [ann.id, bea.id] } } });
    }
  });

  it("two team members accepting together reach accepted once", async (t) => {
    if (!(await requireDb(t))) return;
    const stamp = Date.now().toString(36);
    const proposal = await prisma.teamProposal.create({
      data: {
        workspaceId: `ws-${stamp}`,
        title: `Team ${stamp}`,
        status: "sent",
        members: {
          create: [
            { creatorSlug: `ada-${stamp}`, shareBps: 5000, status: "invited" },
            { creatorSlug: `bea-${stamp}`, shareBps: 5000, status: "invited" },
          ],
        },
      },
    });
    try {
      const [first, second] = await Promise.all([
        respondToTeamProposal({ proposalId: proposal.id, creatorSlug: `ada-${stamp}`, decision: "accepted" }),
        respondToTeamProposal({ proposalId: proposal.id, creatorSlug: `bea-${stamp}`, decision: "accepted" }),
      ]);
      assert.equal(first.ok, true);
      assert.equal(second.ok, true);
      const stored = await prisma.teamProposal.findUnique({
        where: { id: proposal.id },
        include: { members: true },
      });
      assert.equal(stored?.status, "accepted");
      assert.equal(stored?.members.every((member) => member.status === "accepted"), true);
      assert.equal(
        nextProposalStatus(stored?.members ?? [], `ada-${stamp}`, "accepted"),
        "accepted",
      );
    } finally {
      await prisma.teamProposal.delete({ where: { id: proposal.id } }).catch(() => undefined);
    }
  });
});
