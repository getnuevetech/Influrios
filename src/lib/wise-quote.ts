import { prisma } from "@/lib/db";
import { quoteFromWiseRate, quoteFx } from "@/lib/fx-share";
import { decryptSecret, encryptSecret } from "@/lib/provider-secrets";
import { readWiseUserRate, wiseQuoteUrl } from "@/lib/wise-fx";

const WISE_KIND = "fx";
const WISE_CODE = "wise";

let transport: typeof fetch | null = null;

/** Tests inject a transport. Production uses fetch. A missing quote is never treated as a rate. */
export function setWiseTransportForTests(next: typeof fetch | null) {
  transport = next;
}

function readExtra(value: unknown) {
  const row = value && typeof value === "object" ? (value as { profileId?: unknown; apiVersion?: unknown }) : {};
  return {
    profileId: typeof row.profileId === "string" ? row.profileId : "",
    apiVersion: typeof row.apiVersion === "string" && row.apiVersion ? row.apiVersion : "v3",
  };
}

export async function ensureWiseProvider() {
  await prisma.integrationProvider.upsert({
    where: { kind_code: { kind: WISE_KIND, code: WISE_CODE } },
    update: {},
    create: {
      kind: WISE_KIND,
      code: WISE_CODE,
      name: "Wise",
      enabled: false,
      baseUrl: "https://api.wise.com",
      extraJson: { profileId: "", apiVersion: "v3" },
    },
  });
}

export async function wiseFxConfig() {
  await ensureWiseProvider();
  const row = await prisma.integrationProvider.findUnique({
    where: { kind_code: { kind: WISE_KIND, code: WISE_CODE } },
  });
  const extra = readExtra(row?.extraJson);
  return {
    name: row?.name ?? "Wise",
    enabled: row?.enabled ?? false,
    baseUrl: row?.baseUrl || "https://api.wise.com",
    apiVersion: extra.apiVersion,
    profileId: extra.profileId,
    token: row?.secretCipher ? ("saved" as const) : ("missing" as const),
    ready: Boolean(row?.enabled && row.secretCipher && extra.profileId && wiseQuoteUrl({
      baseUrl: row?.baseUrl || "https://api.wise.com",
      apiVersion: extra.apiVersion,
      profileId: extra.profileId,
    })),
  };
}

export async function saveWiseProvider(input: {
  enabled: boolean;
  baseUrl: string;
  apiVersion: string;
  profileId: string;
  token: string;
  clearToken?: boolean;
}) {
  await ensureWiseProvider();
  const baseUrl = input.baseUrl.trim().replace(/\/$/, "");
  const apiVersion = input.apiVersion.trim();
  const profileId = input.profileId.trim();
  if (!wiseQuoteUrl({ baseUrl, apiVersion, profileId: profileId || "0" })) {
    throw new Error("Use a Wise or TransferWise host, a short API version, and a profile id.");
  }
  if (profileId && !/^[A-Za-z0-9-]{1,40}$/.test(profileId)) {
    throw new Error("Use a Wise or TransferWise host, a short API version, and a profile id.");
  }
  const existing = await prisma.integrationProvider.findUnique({
    where: { kind_code: { kind: WISE_KIND, code: WISE_CODE } },
  });
  let secretCipher = existing?.secretCipher ?? null;
  if (input.clearToken) secretCipher = null;
  if (input.token.trim()) secretCipher = encryptSecret(input.token.trim());
  return prisma.integrationProvider.update({
    where: { kind_code: { kind: WISE_KIND, code: WISE_CODE } },
    data: {
      enabled: input.enabled,
      baseUrl,
      secretCipher,
      extraJson: { profileId, apiVersion },
    },
  });
}

export async function quoteWiseUserRate(input: { currency: string; usdCents: number; minorDigits: number }) {
  const currency = input.currency.trim().toUpperCase();
  if (currency === "USD") return quoteFx({ usdCents: input.usdCents, currency, minorPerUsd: null });
  await ensureWiseProvider();
  const row = await prisma.integrationProvider.findUnique({
    where: { kind_code: { kind: WISE_KIND, code: WISE_CODE } },
  });
  const extra = readExtra(row?.extraJson);
  const url = row?.baseUrl
    ? wiseQuoteUrl({ baseUrl: row.baseUrl, apiVersion: extra.apiVersion, profileId: extra.profileId })
    : null;
  if (!row?.enabled || !row.secretCipher || !url) {
    return { ok: false as const, error: "Wise is not ready. Nothing was funded." };
  }
  const token = decryptSecret(row.secretCipher);
  if (!token) return { ok: false as const, error: "Wise is not ready. Nothing was funded." };
  try {
    const response = await (transport ?? fetch)(url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceCurrency: "USD",
        targetCurrency: currency,
        sourceAmount: input.usdCents / 100,
        targetAmount: null,
      }),
    });
    if (response.status < 200 || response.status >= 300) {
      return { ok: false as const, error: "Wise did not return a user rate. Nothing was funded." };
    }
    const parsed = readWiseUserRate(await response.json(), { sourceCurrency: "USD", targetCurrency: currency });
    if (!parsed) return { ok: false as const, error: "Wise did not return a user rate. Nothing was funded." };
    const quoted = quoteFromWiseRate({
      usdCents: input.usdCents,
      currency,
      rate: parsed.rate,
      minorDigits: input.minorDigits,
    });
    if (!quoted.ok) return quoted;
    await prisma.fxRate.update({
      where: { currency },
      data: { minorPerUsd: quoted.minorPerUsd },
    }).catch(() => undefined);
    return {
      ...quoted,
      quoteId: parsed.quoteId || null,
      quotedAt: parsed.quotedAt || new Date().toISOString(),
      rateType: parsed.rateType || null,
    };
  } catch {
    return { ok: false as const, error: "Wise did not return a user rate. Nothing was funded." };
  }
}
