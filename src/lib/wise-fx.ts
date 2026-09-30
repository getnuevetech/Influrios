export const WISE_HOSTS = [
  "https://api.wise.com",
  "https://api.wise-sandbox.com",
  "https://api.transferwise.com",
] as const;

export function wiseQuoteUrl(input: { baseUrl: string; apiVersion: string; profileId: string }) {
  const host = input.baseUrl.trim().replace(/\/$/, "");
  const version = input.apiVersion.trim();
  const profileId = input.profileId.trim();
  if (!(WISE_HOSTS as readonly string[]).includes(host)) return null;
  if (!/^[A-Za-z0-9]{1,16}$/.test(version)) return null;
  if (!/^[A-Za-z0-9-]{1,40}$/.test(profileId)) return null;
  return `${host}/${version}/profiles/${profileId}/quotes`;
}

export function readWiseUserRate(
  body: unknown,
  expected: { sourceCurrency: string; targetCurrency: string },
) {
  if (!body || typeof body !== "object") return null;
  const row = body as {
    rate?: unknown;
    sourceCurrency?: unknown;
    targetCurrency?: unknown;
    id?: unknown;
    rateType?: unknown;
    createdTime?: unknown;
  };
  const source = typeof row.sourceCurrency === "string" ? row.sourceCurrency.toUpperCase() : "";
  const target = typeof row.targetCurrency === "string" ? row.targetCurrency.toUpperCase() : "";
  const rate = typeof row.rate === "number" ? row.rate : Number(row.rate);
  if (source !== expected.sourceCurrency || target !== expected.targetCurrency) return null;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return {
    rate,
    quoteId: typeof row.id === "string" ? row.id.slice(0, 80) : "",
    rateType: typeof row.rateType === "string" ? row.rateType.slice(0, 20) : "",
    quotedAt: typeof row.createdTime === "string" ? row.createdTime.slice(0, 40) : "",
  };
}
