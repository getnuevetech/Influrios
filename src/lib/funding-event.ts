/** A missing event currency does not invent a match. A present currency must equal the funding currency. */
export function fundingCurrencyMatches(eventCurrency: string | null | undefined, fundingCurrency: string): boolean {
  const event = (eventCurrency ?? "").trim().toUpperCase();
  const funding = fundingCurrency.trim().toUpperCase();
  if (!event || !funding) return true;
  return event === funding;
}
