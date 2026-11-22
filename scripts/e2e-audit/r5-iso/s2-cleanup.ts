/** r5 isolated audit · FIXTURE cleanup: Business A withdraws its leftover open audit invitations to Influencer A
 *  and closes leftover open team proposals (as the business), through the real transitions. Localhost DB only. */
import { prisma } from "../../../src/lib/db";
import { transitionMarketplaceApplication } from "../../../src/lib/marketplace-listings";
async function main() {
  if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL || "")) throw new Error("localhost DB only");
  const open = await prisma.marketplaceApplication.findMany({
    where: { toSlug: "audit-r5iso01-a", fromSlug: null, status: { in: ["REQUESTED", "VIEWED", "RESPONDED", "NEGOTIATING"] } },
    select: { id: true },
  });
  for (const row of open) {
    await transitionMarketplaceApplication({ id: row.id, toStatus: "WITHDRAWN", note: "[Withdrawn by business] Audit fixture cleanup. " }).catch(() => undefined);
  }
  const teams = await prisma.teamProposal.updateMany({
    where: { status: { in: ["sent", "partial"] }, members: { some: { creatorSlug: "audit-r5iso01-a" } } },
    data: { status: "declined" },
  });
  console.log(JSON.stringify({ withdrawn: open.length, teamsClosed: teams.count }));
  await prisma.$disconnect();
}
main();
