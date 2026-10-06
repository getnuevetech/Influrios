/**
 * Maps Airwallex beneficiary-schema responses onto corridor fields.
 * A schema the API did not accept is not written.
 */

export type SchemaAttempt = {
  transferMethod: "LOCAL" | "SWIFT";
  entityType: "PERSONAL" | "COMPANY";
  currency: string;
  accepted: boolean;
};

export type CorridorSyncFields = {
  currency: string;
  payoutMethods: Array<"local_bank" | "usd_bank">;
  accountTypes: Array<"PERSONAL" | "COMPANY">;
  rawMethods: Array<"LOCAL" | "SWIFT">;
};

export function schemaAttemptFromResponse(input: {
  transferMethod: "LOCAL" | "SWIFT";
  entityType: "PERSONAL" | "COMPANY";
  currency: string;
  status: number;
  body: unknown;
}): SchemaAttempt {
  const record = input.body && typeof input.body === "object" && !Array.isArray(input.body) ? (input.body as Record<string, unknown>) : null;
  const hasSchema = Boolean(
    record &&
      !record.code &&
      (Array.isArray(record.fields) || Array.isArray(record.condition) || (record.schema && typeof record.schema === "object")),
  );
  const echoedMethod = record?.transfer_method === "SWIFT" || record?.transfer_method === "LOCAL" ? record.transfer_method : input.transferMethod;
  const echoedCurrency = typeof record?.account_currency === "string" && record.account_currency.trim() ? record.account_currency : input.currency;
  return {
    transferMethod: echoedMethod,
    entityType: input.entityType,
    currency: echoedCurrency.trim().toUpperCase(),
    accepted: input.status >= 200 && input.status < 300 && hasSchema,
  };
}

/** Keep only methods and account types the sandbox schema accepted. */
export function corridorFieldsFromSchemaAttempts(attempts: SchemaAttempt[]): CorridorSyncFields | null {
  const accepted = attempts.filter((row) => row.accepted && row.currency.trim());
  if (!accepted.length) return null;
  const currency = accepted[0].currency.trim().toUpperCase();
  const rawMethods: Array<"LOCAL" | "SWIFT"> = [];
  const payoutMethods: Array<"local_bank" | "usd_bank"> = [];
  for (const row of accepted) {
    if (!rawMethods.includes(row.transferMethod)) rawMethods.push(row.transferMethod);
    if (row.transferMethod === "LOCAL" && !payoutMethods.includes("local_bank")) payoutMethods.push("local_bank");
    if (row.transferMethod === "SWIFT" && currency === "USD" && !payoutMethods.includes("usd_bank")) payoutMethods.push("usd_bank");
  }
  const accountTypes = [...new Set(accepted.map((row) => row.entityType))];
  return { currency, payoutMethods, accountTypes, rawMethods };
}
