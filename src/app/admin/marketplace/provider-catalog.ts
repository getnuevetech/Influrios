/**
 * Admin-only catalog for Marketplace ledger provider dropdowns.
 * Kept out of collaboration domain modules so provider brand names stay on the admin surface.
 */

export const MARKETPLACE_PROVIDER_CATALOG = [
  {
    code: "primary",
    name: "Primary marketplace",
    detail: "Default when a jurisdiction does not assign another provider",
  },
  {
    code: "airwallex",
    name: "Airwallex",
    detail: "Assign on jurisdictions that fund through Airwallex",
  },
  {
    code: "stripe",
    name: "Stripe",
    detail: "Assign on jurisdictions that fund through Stripe",
  },
  {
    code: "flutterwave",
    name: "Flutterwave",
    detail: "Assign on jurisdictions that fund through Flutterwave",
  },
  {
    code: "mpesa",
    name: "M-Pesa",
    detail: "Assign on jurisdictions that fund through M-Pesa",
  },
] as const;

export type MarketplaceProviderCatalogEntry = (typeof MARKETPLACE_PROVIDER_CATALOG)[number];

export function marketplaceProviderCatalogEntry(code: string | null | undefined) {
  const normalized = (code ?? "").trim().toLowerCase();
  return MARKETPLACE_PROVIDER_CATALOG.find((row) => row.code === normalized) ?? null;
}

/** Display name for a marketplace provider code (catalog first, then stored name). */
export function marketplaceProviderCatalogLabel(code: string, storedName?: string | null) {
  const entry = marketplaceProviderCatalogEntry(code);
  if (entry) return entry.name;
  const stored = (storedName ?? "").trim();
  return stored || code.trim() || "Marketplace provider";
}

/** Codes still available to add on the Marketplace provider admin form. */
export function marketplaceProvidersAvailableToAdd(configuredCodes: string[]) {
  const taken = new Set(configuredCodes.map((code) => code.trim().toLowerCase()).filter(Boolean));
  return MARKETPLACE_PROVIDER_CATALOG.filter((row) => !taken.has(row.code));
}
