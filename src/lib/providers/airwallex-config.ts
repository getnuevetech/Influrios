import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/provider-secrets";
import { readProviderExtra } from "@/lib/providers";

export type AirwallexSettings = {
  clientId: string;
  apiKey: string;
  webhookSecret: string;
  baseUrl: string;
  holdingAccountId: string;
  operationsAccountId: string;
};

type AirwallexSource = {
  enabled?: boolean;
  clientId?: string | null;
  apiKey?: string | null;
  webhookSecret?: string | null;
  baseUrl?: string | null;
  holdingAccountId?: string | null;
  operationsAccountId?: string | null;
};

function filled(value: string | null | undefined) {
  return value?.trim() ?? "";
}

/** Admin row when it is enabled and has a client id, API key, and base URL. Otherwise the environment. */
export function airwallexSettingsFromSources(input: {
  row: AirwallexSource | null;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): AirwallexSettings | null {
  const env = (input.env ?? process.env) as Record<string, string | undefined>;
  const row = input.row;
  const fromRow =
    row?.enabled && filled(row.clientId) && filled(row.apiKey) && filled(row.baseUrl)
      ? {
          clientId: filled(row.clientId),
          apiKey: filled(row.apiKey),
          webhookSecret: filled(row.webhookSecret),
          baseUrl: filled(row.baseUrl).replace(/\/$/, ""),
          holdingAccountId: filled(row.holdingAccountId),
          operationsAccountId: filled(row.operationsAccountId),
        }
      : null;
  if (fromRow) {
    return {
      ...fromRow,
      webhookSecret: fromRow.webhookSecret || filled(env.AIRWALLEX_WEBHOOK_SECRET),
      holdingAccountId: fromRow.holdingAccountId || filled(env.AIRWALLEX_HOLDING_ACCOUNT_ID),
      operationsAccountId: fromRow.operationsAccountId || filled(env.AIRWALLEX_OPERATIONS_ACCOUNT_ID),
    };
  }
  const clientId = filled(env.AIRWALLEX_CLIENT_ID);
  const apiKey = filled(env.AIRWALLEX_API_KEY);
  const baseUrl = filled(env.AIRWALLEX_BASE_URL || "https://api-demo.airwallex.com");
  if (!clientId || !apiKey) return null;
  return {
    clientId,
    apiKey,
    webhookSecret: filled(env.AIRWALLEX_WEBHOOK_SECRET),
    baseUrl: baseUrl.replace(/\/$/, ""),
    holdingAccountId: filled(env.AIRWALLEX_HOLDING_ACCOUNT_ID),
    operationsAccountId: filled(env.AIRWALLEX_OPERATIONS_ACCOUNT_ID),
  };
}

export async function loadAirwallexConfig(): Promise<AirwallexSettings | null> {
  try {
    const row = await prisma.integrationProvider.findUnique({
      where: { kind_code: { kind: "payment", code: "airwallex" } },
    });
    const extra = readProviderExtra(row?.extraJson);
    const apiKey = row?.secretCipher ? decryptSecret(row.secretCipher) : "";
    const webhookSecret = row?.webhookCipher ? decryptSecret(row.webhookCipher) : "";
    return airwallexSettingsFromSources({
      row: row
        ? {
            enabled: row.enabled,
            clientId: row.publicKey,
            apiKey,
            webhookSecret,
            baseUrl: row.baseUrl,
            holdingAccountId: extra.holdingAccountId,
            operationsAccountId: extra.operationsAccountId,
          }
        : null,
    });
  } catch {
    return airwallexSettingsFromSources({ row: null });
  }
}
