/** r5 isolated audit · S1 retest fixture: Business A publishes one request per scenario and invites Influencer A (and B for permission checks). Localhost DB only. */
import { prisma } from "../../../src/lib/db";
import { getWorkspace } from "../../../src/lib/business";
import { inviteCreatorsIndependently, upsertBusinessRequest } from "../../../src/lib/marketplace-listings";

async function main() {
  if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL || "")) throw new Error("localhost DB only");
  const [email, stamp] = process.argv.slice(2);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("no user " + email);
  const ws = await getWorkspace(user.id);
  const out: Record<string, string> = {};
  for (const [key, slugs] of [
    ["S1-M1 Matrix walk", ["audit-r5iso01-a"]],
    ["S1-M2 Follow-up", ["audit-r5iso01-a"]],
    ["S1-M3 Decline", ["audit-r5iso01-a"]],
    ["S1-M4 Concurrent withdraw", ["audit-r5iso01-a"]],
    ["S1-P1 Other influencer", ["audit-r5iso01-b"]],
  ] as const) {
    const brand = `${key} ${stamp}`;
    const req = await upsertBusinessRequest({
      brand, category: "tech", budget: "800", location: "Remote", tags: ["awareness"],
      summary: `${brand}: one YouTube video`, lookingFor: "Tech influencers", status: "published", sortOrder: 0,
      workspaceId: ws.businessId, currency: "USD", deliverableSummary: "1 YouTube video", platforms: ["YOUTUBE"],
    } as never);
    const res = await inviteCreatorsIndependently({
      workspaceId: ws.businessId, actorUserId: user.id, creatorSlugs: [...slugs], requestId: req.id,
      offerText: "USD 800", deliverables: "1 YouTube video", responseDeadline: new Date(Date.now() + 7 * 864e5), note: brand,
    });
    if (!res.ok) throw new Error(res.error);
    out[key] = res.ids[0];
  }
  console.log(JSON.stringify(out));
  await prisma.$disconnect();
}
main();
