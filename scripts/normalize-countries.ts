/**
 * One-off clean-up after country fields became dropdowns over one list.
 *
 *   npx tsx scripts/normalize-countries.ts           # report only, changes nothing
 *   npx tsx scripts/normalize-countries.ts --apply   # write the changes
 *
 * - Influencer profile countries: rewrite recognised spellings ("USA", "us", "United States of America")
 *   to the catalog name ("United States").
 * - Verified KYC with no country: fill it from the influencer's profile country, so agreements and
 *   payouts read the same country.
 * - Lists values it cannot recognise; fix those by choosing the country on the profile.
 */
import { prisma } from "../src/lib/db";
import { resolveCountry } from "../src/lib/countries";

async function main() {
  const apply = process.argv.includes("--apply");
  const creators = await prisma.creator.findMany({ select: { id: true, slug: true, locationCountry: true } });
  const unknown: string[] = [];
  let renamed = 0;
  for (const row of creators) {
    const raw = (row.locationCountry ?? "").trim();
    if (!raw) continue;
    const country = resolveCountry(raw);
    if (!country) {
      unknown.push(`${row.slug}: "${raw}"`);
      continue;
    }
    if (country.name !== raw) {
      renamed += 1;
      console.log(`profile ${row.slug}: "${raw}" -> "${country.name}"`);
      if (apply) await prisma.creator.update({ where: { id: row.id }, data: { locationCountry: country.name } });
    }
  }
  const kyc = await prisma.creatorKycSubmission.findMany({
    where: { status: "verified", countryCode: "" },
    select: { id: true, creatorSlug: true },
  });
  let filled = 0;
  for (const row of kyc) {
    const profile = creators.find((creator) => creator.slug === row.creatorSlug);
    const country = resolveCountry(profile?.locationCountry);
    if (!country) {
      unknown.push(`${row.creatorSlug}: verified KYC but no recognisable profile country`);
      continue;
    }
    filled += 1;
    console.log(`kyc ${row.creatorSlug}: country -> ${country.code}`);
    if (apply) await prisma.creatorKycSubmission.update({ where: { id: row.id }, data: { countryCode: country.code } });
  }
  console.log(`\n${apply ? "Applied" : "Would apply"}: ${renamed} profile countries renamed, ${filled} KYC countries filled.`);
  if (unknown.length) console.log(`Needs a person (choose the country on the profile):\n  ${unknown.join("\n  ")}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
