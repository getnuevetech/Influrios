/** Shared money formatting for ledger and demo UIs. */
export function formatMoney(cents: number, currency: string = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Contract / schedule money — always keep cents so milestone fees and nets
 * reconcile to the signed totals (e.g. $207.90 must not display as $208).
 */
export function formatContractMoney(cents: number, currency: string = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** A stored ISO currency code, or null when the field is blank or not three letters. */
export function storedCurrencyCode(value: string | null | undefined): string | null {
  const code = (value ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

/** Format an amount only when a real currency code was stored. A blank code stays unlabeled. */
export function formatStoredMoney(cents: number, currency: string | null | undefined) {
  const code = storedCurrencyCode(currency);
  if (!code) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(cents / 100);
  }
  return formatMoney(cents, code);
}
