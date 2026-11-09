/**
 * Dry-run report of funding and application links.
 * Prints JSON and does not update any row.
 */
import { classifyFundingLinks } from "../src/lib/collaboration-links";
import { prisma } from "../src/lib/db";

async function main() {
const fundings = await prisma.collaborationFunding.findMany({
  select: { id: true, collaborationId: true, title: true, creatorSlug: true },
});
const collaborations = await prisma.collaboration.findMany({
  select: { id: true, title: true, recipientSlug: true },
});
const applications = await prisma.marketplaceApplication.findMany({
  where: { status: { in: ["ACCEPTED", "COLLABORATION_DRAFTED"] } },
  select: { id: true, collaborationId: true, fromSlug: true, toSlug: true, status: true },
});
const findings = classifyFundingLinks(fundings, collaborations);
const summary = {
  fundings: {
    linked: findings.filter((row) => row.state === "linked").length,
    review: findings.filter((row) => row.state === "review").length,
    ambiguous: findings.filter((row) => row.state === "ambiguous").length,
    unlinked: findings.filter((row) => row.state === "unlinked").length,
  },
  acceptedApplicationsWithoutCollaboration: applications.filter((row) => !row.collaborationId).map((row) => row.id),
  ambiguousFundingIds: findings.filter((row) => row.state === "ambiguous").map((row) => row.id),
  reviewFundingIds: findings.filter((row) => row.state === "review").map((row) => row.id),
};
console.log(JSON.stringify(summary, null, 2));
await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
