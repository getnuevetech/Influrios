/** r5 isolated audit: funded (held) workroom between business A and influencer B, 2 milestones.
 * Synthetic sandbox ledger hold only. Localhost DB only. No provider, no live money. */
import { prisma } from "../../src/lib/db";
import { getWorkspace } from "../../src/lib/business";
async function main() {
  if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL || "")) throw new Error("localhost DB only");
  const biz = await prisma.user.findUniqueOrThrow({ where: { email: "audit.r5iso01.business-a@example.com" } });
  const ws = await getWorkspace(biz.id);
  const gross = 80000;
  const funding = await prisma.collaborationFunding.create({
    data: {
      jurisdictionCode: "US", businessName: ws.name || "AUDIT r5iso01 Co A", creatorSlug: "audit-r5iso01-b",
      title: "AUDIT r5 Workroom notices", currency: "USD", grossCents: gross, feeCents: 0,
      feeSnapshotJson: { feeType: "", feeCents: 0, explanation: "AUDIT r5 fixture", capturedAt: new Date().toISOString() },
      serviceLevel: "managed_campaign", status: "held", providerCode: "sandbox", fundingMode: "FULL",
      scheduleKind: "once", trancheIndex: 1, trancheCount: 1, workspaceId: ws.businessId,
      milestones: { create: [
        { title: "AUDIT r5 Milestone 1", amountCents: 40000, sortOrder: 0, status: "pending", reviewWindowHours: 72, revisionLimit: 2 },
        { title: "AUDIT r5 Milestone 2", amountCents: 40000, sortOrder: 1, status: "pending", reviewWindowHours: 72, revisionLimit: 2 },
      ] },
    },
    include: { milestones: true },
  });
  await prisma.ledgerEntry.create({ data: { fundingId: funding.id, kind: "hold", amountCents: gross, party: "business", provider: "sandbox", eventId: `r5-hold-${funding.id}` } });
  console.log(JSON.stringify({ fundingId: funding.id, milestones: funding.milestones.map((m) => ({ id: m.id, title: m.title })) }));
  await prisma.$disconnect();
}
main();
