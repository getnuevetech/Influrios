import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/provider-secrets";

export type MeiliConfig = { host: string; apiKey: string };

export function meiliConfigFromEnv(env: NodeJS.ProcessEnv = process.env): MeiliConfig | null {
  const host = env.MEILI_HOST?.trim() ?? "";
  if (!host) return null;
  return { host: host.replace(/\/$/, ""), apiKey: env.MEILI_API_KEY?.trim() ?? "" };
}

export function meiliConfigFromRow(row: { enabled: boolean; host: string; apiKey: string } | null): MeiliConfig | null {
  if (!row?.enabled || !row.host.trim()) return null;
  return { host: row.host.trim().replace(/\/$/, ""), apiKey: row.apiKey.trim() };
}

/** Environment host wins. Otherwise the enabled Meilisearch row saved in admin. */
export async function loadMeiliConfig(): Promise<MeiliConfig | null> {
  const fromEnv = meiliConfigFromEnv();
  if (fromEnv) return fromEnv;
  try {
    const row = await prisma.integrationProvider.findUnique({
      where: { kind_code: { kind: "search", code: "meilisearch" } },
    });
    const apiKey = row?.secretCipher ? decryptSecret(row.secretCipher) ?? "" : "";
    return meiliConfigFromRow(row ? { enabled: row.enabled, host: row.baseUrl ?? "", apiKey } : null);
  } catch {
    return null;
  }
}
