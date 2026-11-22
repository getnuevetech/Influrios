/** r5 isolated audit · S2 retest fixture. Business A: one campaign brief, invitations to Influencer A
 *  (W1 withdraw with reason, W2 withdraw from detail, E1 expire), and a team proposal to A + B. Localhost DB only. */
import { prisma } from "../../../src/lib/db";
import { getWorkspace } from "../../../src/lib/business";
import { inviteCreatorsIndependently } from "../../../src/lib/marketplace-listings";
import { createTeamProposal } from "../../../src/lib/team-proposal";

async function main() {
  if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL || "")) throw new Error("localhost DB only");
  const [email, stamp] = process.argv.slice(2);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("no user " + email);
  const ws = await getWorkspace(user.id);
  const out: Record<string, string> = {};
  for (const key of ["S2-W1 Withdraw with reason", "S2-W2 Withdraw from detail", "S2-E1 Expire at deadline"]) {
    const title = `${key} ${stamp}`;
    const brief = await prisma.businessBrief.create({
      data: { workspaceId: ws.businessId, title, goal: "awareness", specialty: "tech", budget: "800", location: "Remote", platform: "YouTube", summary: `${title}: one video`, distribution: "private", status: "active" },
    });
    const res = await inviteCreatorsIndependently({
      workspaceId: ws.businessId, actorUserId: user.id, creatorSlugs: ["audit-r5iso01-a"], briefId: brief.id,
      offerText: "USD 800", deliverables: "1 YouTube video", responseDeadline: new Date(Date.now() + 7 * 864e5), note: title,
    });
    if (!res.ok) throw new Error(res.error);
    out[key] = res.ids[0];
    out[key + ":brief"] = brief.id;
  }
  for (const key of ["S2-T1 Team decline closes", "S2-T2 Team listing"]) {
    const res = await createTeamProposal({ workspaceId: ws.businessId, title: `${key} ${stamp}`, campaignIntent: "Team video", creatorSlugs: ["audit-r5iso01-a", "audit-r5iso01-b"] });
    if (!res.ok) throw new Error(res.error);
    out[key] = res.id;
  }
  console.log(JSON.stringify(out));
  await prisma.$disconnect();
}
main();
