/**
 * Admin-only helpers for Marketplace ledger provider dropdowns.
 * Options come from Payment gateways (+ Primary), so a new gateway appears here
 * for per-country / jurisdiction assignment without inventing free-text codes.
 * Kept out of collaboration domain modules so provider brand names stay on the admin surface.
 */

export type MarketplaceProviderOption = {
  code: string;
  name: string;
  detail: string;
};

export const PRIMARY_MARKETPLACE_PROVIDER: MarketplaceProviderOption = {
  code: "primary",
  name: "Primary marketplace",
  detail: "Default when a jurisdiction does not assign another provider",
};

/**
 * Build the Provider dropdown from live Payment gateways, always including Primary.
 * Already-saved marketplace rows that are not (yet) on Payment gateways stay listed
 * so existing jurisdiction assignments remain visible.
 */
export function buildMarketplaceProviderOptions(input: {
  paymentGateways: { code: string; name: string; enabled?: boolean }[];
  configuredMarketplace?: { code: string; name: string }[];
}): MarketplaceProviderOption[] {
  const byCode = new Map<string, MarketplaceProviderOption>();
  byCode.set(PRIMARY_MARKETPLACE_PROVIDER.code, { ...PRIMARY_MARKETPLACE_PROVIDER });

  for (const gateway of input.paymentGateways) {
    const code = gateway.code.trim().toLowerCase();
    if (!code || code === "demo" || code === "primary") continue;
    const name = gateway.name.trim() || code;
    byCode.set(code, {
      code,
      name,
      detail: gateway.enabled
        ? "From Payment gateways — use on jurisdictions that fund on this rail"
        : "From Payment gateways (disabled there until you enable it)",
    });
  }

  for (const row of input.configuredMarketplace ?? []) {
    const code = row.code.trim().toLowerCase();
    if (!code || code === "demo" || byCode.has(code)) continue;
    byCode.set(code, {
      code,
      name: row.name.trim() || code,
      detail: "Already saved on Marketplace ledger",
    });
  }

  return [...byCode.values()].sort((a, b) => {
    if (a.code === "primary") return -1;
    if (b.code === "primary") return 1;
    return a.name.localeCompare(b.name);
  });
}

/** Display name for a marketplace provider code (options first, then stored name). */
export function marketplaceProviderCatalogLabel(
  code: string,
  storedName?: string | null,
  options?: MarketplaceProviderOption[],
) {
  const normalized = code.trim().toLowerCase();
  if (normalized === "primary") return PRIMARY_MARKETPLACE_PROVIDER.name;
  const fromOptions = options?.find((row) => row.code === normalized);
  if (fromOptions) return fromOptions.name;
  const stored = (storedName ?? "").trim();
  return stored || code.trim() || "Marketplace provider";
}

/**
 * Options for the jurisdiction "Approved providers" multi-select.
 * Starts from Payment gateways (+ Primary), then keeps any already-saved codes
 * that are not on gateways yet so a save does not drop them.
 */
export function approvedProviderPickerOptions(
  options: MarketplaceProviderOption[],
  selectedCodes: string[] = [],
): MarketplaceProviderOption[] {
  const byCode = new Map(options.map((row) => [row.code, row]));
  for (const raw of selectedCodes) {
    const code = raw.trim().toLowerCase();
    if (!code || code === "demo" || byCode.has(code)) continue;
    byCode.set(code, {
      code,
      name: code,
      detail: "Already saved on this jurisdiction",
    });
  }
  return [...byCode.values()].sort((a, b) => {
    if (a.code === "primary") return -1;
    if (b.code === "primary") return 1;
    return a.name.localeCompare(b.name);
  });
}
