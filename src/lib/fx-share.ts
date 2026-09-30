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
  };
}

export function convertFee(usdFeeCents: number, fx: { currency: string; minorPerUsd: number }) {
  if (usdFeeCents <= 0) return 0;
  if (fx.currency === "USD") return usdFeeCents;
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
  const row = value as { usdCents?: unknown; minorPerUsd?: unknown; source?: unknown; currency?: unknown };
  const usdCents = Number(row.usdCents);
  const minorPerUsd = Number(row.minorPerUsd);
  if (!Number.isInteger(usdCents) || usdCents <= 0 || !Number.isInteger(minorPerUsd) || minorPerUsd <= 0) return null;
  return {
    usdCents,
    minorPerUsd,
    currency: typeof row.currency === "string" ? row.currency : "USD",
    source: row.source === "admin" ? "admin" : "identity",
  };
}
