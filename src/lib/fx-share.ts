import { splitGross } from "@/lib/ledger";

export function quoteFx(input: { usdCents: number; currency: string; minorPerUsd: number | null }) {
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false as const, error: "Use a three-letter currency." };
  if (!Number.isInteger(input.usdCents) || input.usdCents <= 0) {
    return { ok: false as const, error: "Enter a gross amount greater than zero." };
  }
  if (currency === "USD") {
    return {
      ok: true as const,
      currency,
      minorPerUsd: 100,
      usdCents: input.usdCents,
      convertedMinor: input.usdCents,
      source: "identity" as const,
      rate: null,
      minorDigits: 2,
      quoteId: null,
      quotedAt: null,
      rateType: null,
    };
  }
  if (input.minorPerUsd == null || !Number.isInteger(input.minorPerUsd) || input.minorPerUsd <= 0) {
    return { ok: false as const, error: `No admin FX rate is saved for ${currency}. Nothing was funded.` };
  }
  const convertedMinor = Math.round((input.usdCents * input.minorPerUsd) / 100);
  if (convertedMinor <= 0) {
    return { ok: false as const, error: `The admin FX rate for ${currency} converts this amount to zero.` };
  }
  return {
    ok: true as const,
    currency,
    minorPerUsd: input.minorPerUsd,
    usdCents: input.usdCents,
    convertedMinor,
    source: "admin" as const,
    rate: null,
    minorDigits: 2,
    quoteId: null,
    quotedAt: null,
    rateType: null,
  };
}

/** Target minor units from a Wise user rate. `rate` is target major units per 1 USD. */
export function quoteFromWiseRate(input: { usdCents: number; currency: string; rate: number; minorDigits: number }) {
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency) || currency === "USD") {
    return { ok: false as const, error: "Use a non-USD three-letter currency." };
  }
  if (!Number.isInteger(input.usdCents) || input.usdCents <= 0) {
    return { ok: false as const, error: "Enter a gross amount greater than zero." };
  }
  if (!Number.isInteger(input.minorDigits) || input.minorDigits < 0 || input.minorDigits > 4) {
    return { ok: false as const, error: "Minor digits must be from 0 to 4." };
  }
  if (!Number.isFinite(input.rate) || input.rate <= 0) {
    return { ok: false as const, error: "Wise did not return a user rate. Nothing was funded." };
  }
  const convertedMinor = Math.round((input.usdCents * input.rate * 10 ** input.minorDigits) / 100);
  const minorPerUsd = Math.round(input.rate * 10 ** input.minorDigits);
  if (convertedMinor <= 0 || minorPerUsd <= 0) {
    return { ok: false as const, error: "Wise did not return a user rate. Nothing was funded." };
  }
  return {
    ok: true as const,
    currency,
    minorPerUsd,
    usdCents: input.usdCents,
    convertedMinor,
    source: "wise" as const,
    rate: input.rate,
    minorDigits: input.minorDigits,
    quoteId: null as string | null,
    quotedAt: null as string | null,
    rateType: null as string | null,
  };
}

export function convertFee(
  usdFeeCents: number,
  fx: { currency: string; minorPerUsd: number; rate?: number | null; minorDigits?: number | null },
) {
  if (usdFeeCents <= 0) return 0;
  if (fx.currency === "USD") return usdFeeCents;
  if (fx.rate != null && fx.rate > 0 && fx.minorDigits != null) {
    return Math.round((usdFeeCents * fx.rate * 10 ** fx.minorDigits) / 100);
  }
  return Math.round((usdFeeCents * fx.minorPerUsd) / 100);
}

export function shareLines(amountCents: number, parties: { label: string; shareBps: number }[]) {
  const parts = splitGross(
    amountCents,
    parties.map((party) => party.shareBps),
  );
  if (!parts) return null;
  return parties.map((party, index) => ({
    party: partyKey(party.label, index),
    label: party.label,
    shareBps: party.shareBps,
    amountCents: parts[index],
  }));
}

function partyKey(label: string, index: number) {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "party";
  return `${index + 1}-${slug}`;
}

export function readShareSnapshot(value: unknown) {
  if (!Array.isArray(value)) return null;
  const rows = value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const label = "label" in row ? String(row.label) : "";
    const shareBps = "shareBps" in row ? Number(row.shareBps) : NaN;
    if (!label || !Number.isInteger(shareBps) || shareBps <= 0) return [];
    return [{ label, shareBps }];
  });
  if (rows.length === 0 || rows.reduce((sum, row) => sum + row.shareBps, 0) !== 10_000) return null;
  return rows;
}

export function readFxSnapshot(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const row = value as {
    usdCents?: unknown;
    minorPerUsd?: unknown;
    source?: unknown;
    currency?: unknown;
    rate?: unknown;
    quoteId?: unknown;
    quotedAt?: unknown;
  };
  const usdCents = Number(row.usdCents);
  const minorPerUsd = Number(row.minorPerUsd);
  const rate = Number(row.rate);
  if (!Number.isInteger(usdCents) || usdCents <= 0 || !Number.isInteger(minorPerUsd) || minorPerUsd <= 0) return null;
  const source = row.source === "wise" ? "wise" : row.source === "admin" ? "admin" : "identity";
  return {
    usdCents,
    minorPerUsd,
    currency: typeof row.currency === "string" ? row.currency : "USD",
    source,
    rate: Number.isFinite(rate) && rate > 0 ? rate : null,
    quoteId: typeof row.quoteId === "string" ? row.quoteId : "",
    quotedAt: typeof row.quotedAt === "string" ? row.quotedAt : "",
  };
}
