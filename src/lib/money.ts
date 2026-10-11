/** Shared money formatting for ledger and demo UIs. */
export function formatMoney(cents: number, currency: string = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Format an amount only when a real currency code was stored. A blank code stays unlabeled. */
export function formatStoredMoney(cents: number, currency: string | null | undefined) {
  const code = (currency ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(cents / 100);
  }
  return formatMoney(cents, code);
}
