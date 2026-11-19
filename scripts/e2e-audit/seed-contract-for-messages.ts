/**
 * Seed a draft ContractDocument between business A and influencer A for J22 messaging.
 * Does not mark signed / funded — messaging-only fixture.
 */
import { readFileSync } from "fs";
import { prisma } from "../../src/lib/db";

function loadEnvLocal() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const eq = t.indexOf("=");
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}
loadEnvLocal();

async function main() {
  const fixtures = JSON.parse(readFileSync("/cursor/stores/self/docs/e2e-audit/local-fixtures.json", "utf8"));
  const biz = await prisma.user.findUnique({ where: { email: fixtures.members.businessA } });
  const inf = await prisma.user.findUnique({ where: { email: fixtures.members.influencerA } });
  const unrelated = await prisma.user.findUnique({ where: { email: fixtures.members.influencerUnrelated } });
  if (!biz || !inf || !unrelated) throw new Error("Missing fixture users");
  const creator = await prisma.creator.findFirst({ where: { userId: inf.id } });
  if (!creator) throw new Error("Missing creator");
  const workspace = await prisma.businessWorkspace.findFirst({ where: { ownerUserId: biz.id } });

  const doc = await prisma.contractDocument.create({
    data: {
      title: `AUDIT ${fixtures.run} messaging fixture`,
      status: "draft",
      documentType: "collaboration",
      workspaceId: workspace?.id,
      renderedBody: "AUDIT local messaging fixture body. Not a signed agreement.",
      pdfBytes: Buffer.from("%PDF-1.4 AUDIT messaging fixture"),
      contentDigest: "audit-messaging-fixture",
      sourceJson: { audit: true, purpose: "j22-messaging" },
      parties: {
        create: [
          {
            role: "business",
            name: biz.name || "Business A",
            email: biz.email,
            userId: biz.id,
            shareBps: 0,
          },
          {
            role: "creator",
            name: inf.name || "Influencer A",
            email: inf.email,
            userId: inf.id,
            creatorSlug: creator.slug,
            shareBps: 10000,
          },
        ],
      },
    },
    include: { parties: true },
  });

  console.log(
    JSON.stringify({
      ok: true,
      documentId: doc.id,
      status: doc.status,
      businessPartyId: doc.parties.find((p) => p.role === "business")?.id,
      creatorPartyId: doc.parties.find((p) => p.role === "creator")?.id,
      businessEmail: biz.email,
      influencerEmail: inf.email,
      unrelatedEmail: unrelated.email,
      creatorSlug: creator.slug,
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
