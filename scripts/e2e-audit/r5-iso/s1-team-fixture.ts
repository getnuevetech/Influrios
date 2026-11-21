/** r5 isolated audit · S1: team proposal from Business A to Influencers A + B (INV-DC-015 retest). Localhost DB only. */
import { prisma } from "../../../src/lib/db";
import { getWorkspace } from "../../../src/lib/business";
import { createTeamProposal } from "../../../src/lib/team-proposal";
async function main() {
  if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL || "")) throw new Error("localhost DB only");
  const [email, title] = process.argv.slice(2);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("no user " + email);
  const ws = await getWorkspace(user.id);
  const res = await createTeamProposal({ workspaceId: ws.businessId, title, campaignIntent: "Team unboxing", creatorSlugs: ["audit-r5iso01-a", "audit-r5iso01-b"] });
  if (!res.ok) throw new Error(res.error);
  console.log(JSON.stringify({ id: (res as { proposal?: { id: string }; id?: string }).proposal?.id ?? (res as { id?: string }).id }));
  await prisma.$disconnect();
}
main();
