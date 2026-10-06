/**
 * Phase M / Slice K — fill corridor payout fields from the Airwallex sandbox schema API.
 * Writes only currencies, transfer methods, and account types the API accepts.
 *
 *   AIRWALLEX_CLIENT_ID=... AIRWALLEX_API_KEY=... npx tsx scripts/airwallex-sandbox-sync.ts
 *   AIRWALLEX_BASE_URL defaults to https://api-demo.airwallex.com
 */
import { prisma } from "../src/lib/db";
import {
  corridorFieldsFromSchemaAttempts,
  schemaAttemptFromResponse,
  type SchemaAttempt,
} from "../src/lib/providers/airwallex-corridor";

const baseUrl = (process.env.AIRWALLEX_BASE_URL || "https://api-demo.airwallex.com").replace(/\/$/, "");
const clientId = process.env.AIRWALLEX_CLIENT_ID?.trim() ?? "";
const apiKey = process.env.AIRWALLEX_API_KEY?.trim() ?? "";

async function login(fetchImpl: typeof fetch): Promise<string> {
  const response = await fetchImpl(`${baseUrl}/api/v1/authentication/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-client-id": clientId,
      "x-api-key": apiKey,
    },
  });
  const body = (await response.json().catch(() => null)) as { token?: string } | null;
  if (!response.ok || !body?.token) {
    throw new Error("Airwallex sandbox login did not return a token. Nothing was written.");
  }
  return body.token;
}

async function schemaAttempt(
  fetchImpl: typeof fetch,
  token: string,
  input: { countryCode: string; currency: string; transferMethod: "LOCAL" | "SWIFT"; entityType: "PERSONAL" | "COMPANY" },
): Promise<SchemaAttempt> {
  const response = await fetchImpl(`${baseUrl}/api/v1/beneficiary_api_schemas/generate`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      bank_country_code: input.countryCode,
      account_currency: input.currency,
      transfer_method: input.transferMethod,
      entity_type: input.entityType,
    }),
  });
  const body = await response.json().catch(() => null);
  return schemaAttemptFromResponse({
    transferMethod: input.transferMethod,
    entityType: input.entityType,
    currency: input.currency,
    status: response.status,
    body,
  });
}

async function main() {
  if (!clientId || !apiKey) {
    console.error("AIRWALLEX_CLIENT_ID and AIRWALLEX_API_KEY are required. Nothing was written.");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required. Nothing was written.");
    process.exit(1);
  }
  const token = await login(fetch);
  const corridors = await prisma.countryActivationCorridor.findMany({
    where: { collectionProviderCode: "airwallex" },
    orderBy: { countryCode: "asc" },
  });
  if (!corridors.length) {
    console.error("No corridor has collection provider airwallex. Nothing was written.");
    process.exit(1);
  }
  for (const corridor of corridors) {
    const attempts: SchemaAttempt[] = [];
    for (const transferMethod of ["LOCAL", "SWIFT"] as const) {
      for (const entityType of ["PERSONAL", "COMPANY"] as const) {
        attempts.push(
          await schemaAttempt(fetch, token, {
            countryCode: corridor.countryCode,
            currency: corridor.currency,
            transferMethod,
            entityType,
          }),
        );
      }
    }
    const fields = corridorFieldsFromSchemaAttempts(attempts);
    if (!fields || !fields.payoutMethods.length) {
      console.log(`${corridor.countryCode}: sandbox schema did not accept a payout method. Row left unchanged.`);
      continue;
    }
    const note = `Airwallex sandbox schema ${new Date().toISOString()}: ${fields.rawMethods.join(", ")} for ${fields.accountTypes.join(", ")}.`;
    await prisma.countryActivationCorridor.update({
      where: { countryCode: corridor.countryCode },
      data: {
        currency: fields.currency,
        payoutMethodsJson: fields.payoutMethods,
        notes: note.slice(0, 500),
      },
    });
    console.log(
      `${corridor.countryCode}: currency=${fields.currency} methods=${fields.payoutMethods.join(",")} accounts=${fields.accountTypes.join(",")}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
