import { storedCurrencyCode } from "@/lib/money";

/** Payout method codes stored on a corridor. Blank entries are left out. */
export function storedPayoutMethodList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const methods: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const method = item.trim();
    if (!method || methods.includes(method)) continue;
    methods.push(method);
  }
  return methods;
}

/**
 * Facts copied onto a new prefund.
 * A saved corridor currency wins. A blank corridor currency uses the jurisdiction currency.
 * A blank collection route stays blank. A payout method is copied only when it is on that corridor.
 */
export function corridorPrefundSnapshot(input: {
  corridorCurrency?: string | null;
  jurisdictionCurrency?: string | null;
  collectionProviderCode?: string | null;
  payoutMethods?: unknown;
  payoutMethod?: string | null;
}): {
  currency: string | null;
  collectionProviderCode: string;
  payoutMethod: string;
  payoutMethodError: string | null;
} {
  const corridorCurrency = storedCurrencyCode(input.corridorCurrency);
  const jurisdictionCurrency = storedCurrencyCode(input.jurisdictionCurrency);
  const currency = corridorCurrency ?? jurisdictionCurrency;
  const collectionProviderCode = (input.collectionProviderCode ?? "").trim();
  const methods = storedPayoutMethodList(input.payoutMethods);
  const chosen = (input.payoutMethod ?? "").trim();
  if (!chosen) {
    return { currency, collectionProviderCode, payoutMethod: "", payoutMethodError: null };
  }
  if (!methods.includes(chosen)) {
    return {
      currency,
      collectionProviderCode,
      payoutMethod: "",
      payoutMethodError: "Choose a payout method saved on this corridor. Nothing was funded.",
    };
  }
  return { currency, collectionProviderCode, payoutMethod: chosen, payoutMethodError: null };
}

/** Checkout uses the route and method already stored on the prefund. */
export function checkoutUsesStoredCorridor(input: {
  collectionProviderCode?: string | null;
  payoutMethod?: string | null;
}): { ok: true; collectionProviderCode: string; payoutMethod: string } | { ok: false; error: string } {
  const collectionProviderCode = (input.collectionProviderCode ?? "").trim();
  const payoutMethod = (input.payoutMethod ?? "").trim();
  if (!collectionProviderCode) {
    return { ok: false, error: "This prefund has no collection route. Nothing was charged." };
  }
  if (!payoutMethod) {
    return { ok: false, error: "This prefund has no payout method. Nothing was charged." };
  }
  return { ok: true, collectionProviderCode, payoutMethod };
}

/** An identity session is opened only for an enabled gateway. */
export function gatewayIdentitySessionAllowed(provider: { enabled: boolean } | null | undefined): boolean {
  return provider?.enabled === true;
}

/** A provider identity URL is used only when it is https. */
export function storedIdentitySessionUrl(value: string | null | undefined): string | null {
  const url = (value ?? "").trim();
  return url.startsWith("https://") ? url : null;
}
