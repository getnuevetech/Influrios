/**
 * Writes corridor capability rows from the Airwallex sandbox.
 * Stores account type, currencies, and payout method only when the API returns them.
 *
 * Usage: npx tsx scripts/airwallex-sandbox-sync.ts
 */
import { prisma } from "../src/lib/db";
import { loadAirwallexConfig } from "../src/lib/providers/airwallex-config";
import {
  capabilityPatchFromAirwallex,
  capabilityRowData,
  fetchAirwallexCountryCapability,
  loginAirwallex,
} from "../src/lib/providers/airwallex";

async function main() {
  const settings = await loadAirwallexConfig();
  if (!settings) {
    console.error("Airwallex is not configured. Nothing was written.");
    process.exit(1);
  }
  const login = await loginAirwallex({
    baseUrl: settings.baseUrl,
    clientId: settings.clientId,
    apiKey: settings.apiKey,
  });
  if (!login.ok) {
    console.error(login.error);
    process.exit(1);
  }
  const corridors = await prisma.countryActivationCorridor.findMany({ orderBy: { countryCode: "asc" } });
  let written = 0;
  for (const corridor of corridors) {
    const fetched = await fetchAirwallexCountryCapability({
      baseUrl: settings.baseUrl,
      token: login.token,
      countryCode: corridor.countryCode,
    });
    if (!fetched.ok) {
      console.error(`${corridor.countryCode}: ${fetched.error}`);
      continue;
    }
    const data = capabilityRowData(capabilityPatchFromAirwallex(fetched.payload));
    if (Object.keys(data).length === 0) {
      console.log(`${corridor.countryCode}: API returned no capability fields. Nothing was written.`);
      continue;
    }
    await prisma.providerCorridorCapability.upsert({
      where: { providerCode_countryCode: { providerCode: "airwallex", countryCode: corridor.countryCode } },
      create: { providerCode: "airwallex", countryCode: corridor.countryCode, ...data },
      update: data,
    });
    written += 1;
    console.log(`${corridor.countryCode}: ${JSON.stringify(data)}`);
  }
  console.log(`Wrote ${written} capability rows.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Airwallex sync failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
