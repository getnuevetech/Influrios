/** r5 isolated audit: publish a request for a business (fixture prep only). Localhost DB only. */
import { prisma } from "../../src/lib/db";
import { getWorkspace } from "../../src/lib/business";
import { upsertBusinessRequest } from "../../src/lib/marketplace-listings";
async function main() {
  if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL || "")) throw new Error("localhost DB only");
  const [email, title] = process.argv.slice(2);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("no user " + email);
  const ws = await getWorkspace(user.id);
  const req = await upsertBusinessRequest({
    brand: title, category: "tech", budget: "800", location: "Remote", tags: ["awareness", "youtube"],
    summary: `${title}: one YouTube video`, lookingFor: "Tech influencers", status: "published", sortOrder: 0,
    workspaceId: ws.businessId, currency: "USD", deliverableSummary: "1 YouTube video", platforms: ["YOUTUBE"],
  } as never);
  console.log(JSON.stringify({ requestId: req.id, workspaceId: ws.businessId }));
  await prisma.$disconnect();
}
main();
