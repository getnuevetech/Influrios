/** r5 isolated audit · S2: FIXTURE moves one invitation's Respond-by date into the past, or runs the real expiry sweep. Localhost DB only. */
import { prisma } from "../../../src/lib/db";
import { sweepExpiredMarketplaceApplications } from "../../../src/lib/marketplace-listings";
async function main() {
  if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL || "")) throw new Error("localhost DB only");
  const [mode, id] = process.argv.slice(2);
  if (mode === "past") {
    await prisma.marketplaceApplication.update({ where: { id }, data: { responseDeadline: new Date(Date.now() - 60_000) } });
    console.log(JSON.stringify({ fixture: "responseDeadline moved 1 minute into the past", id }));
  } else {
    console.log(JSON.stringify(await sweepExpiredMarketplaceApplications()));
  }
  await prisma.$disconnect();
}
main();
