/**
 * One-off clean-up after country fields became dropdowns over one list.
 *
 *   npx tsx scripts/normalize-countries.ts           # report only, changes nothing
 *   npx tsx scripts/normalize-countries.ts --apply   # write the changes
 *
 * - Influencer profile countries: rewrite recognised spellings ("USA", "us", "United States of America")
 *   to the catalog name ("United States").
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
  console.log(`\n${apply ? "Applied" : "Would apply"}: ${renamed} profile countries renamed.`);
  if (unknown.length) console.log(`Needs a person (choose the country on the profile):\n  ${unknown.join("\n  ")}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
