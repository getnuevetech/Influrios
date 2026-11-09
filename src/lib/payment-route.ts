import { createHash } from "crypto";
import { storedCurrencyCode } from "@/lib/money";

export type PaymentRouteInput = {
  countryCode: string;
  corridorActive?: boolean | null;
  corridorCurrency?: string | null;
  corridorCollectionProvider?: string | null;
  corridorPayoutMethods?: string[] | null;
  jurisdictionCurrency?: string | null;
  jurisdictionMinorDigits?: number | null;
  jurisdictionHoldingProvider?: string | null;
  jurisdictionProtectedPayments?: boolean | null;
  gatewayProvider?: string | null;
  gatewayActive?: boolean | null;
};

export type PaymentRouteDecision = {
  countryCode: string;
  currency: string | null;
  minorDigits: number | null;
  collectionProvider: string | null;
  holdingProvider: string | null;
  payoutRouteProvider: string | null;
  payoutMethods: string[];
  conflicts: string[];
  ready: boolean;
  blockedReason: string | null;
  version: string;
};

function clean(value: string | null | undefined) {
  const text = (value ?? "").trim();
  return text || null;
}

/** One route decision for a country. Collection and holding may differ. Two answers for the same job conflict. */
export function decidePaymentRoute(input: PaymentRouteInput): PaymentRouteDecision {
  const countryCode = input.countryCode.trim().toUpperCase();
  const corridorCurrency = storedCurrencyCode(input.corridorCurrency);
  const jurisdictionCurrency = storedCurrencyCode(input.jurisdictionCurrency);
  const currency = corridorCurrency ?? jurisdictionCurrency;
  const collectionProvider = clean(input.corridorCollectionProvider);
  const holdingProvider = clean(input.jurisdictionHoldingProvider);
  const payoutRouteProvider = input.gatewayActive === false ? null : clean(input.gatewayProvider);
  const payoutMethods = (input.corridorPayoutMethods ?? []).map((method) => method.trim()).filter(Boolean);
  const conflicts: string[] = [];
  if (corridorCurrency && jurisdictionCurrency && corridorCurrency !== jurisdictionCurrency) {
    conflicts.push(
      `${countryCode} currency is ${corridorCurrency} on the corridor and ${jurisdictionCurrency} on the jurisdiction.`,
    );
  }
  if (collectionProvider && payoutRouteProvider && collectionProvider !== payoutRouteProvider) {
    conflicts.push(
      `${countryCode} collects with ${collectionProvider} and the gateway route assigns ${payoutRouteProvider}.`,
    );
  }
  let blockedReason: string | null = null;
  if (input.corridorActive === false) blockedReason = `${countryCode} corridor is suspended.`;
  else if (input.jurisdictionProtectedPayments === false) blockedReason = `${countryCode} is not open for protected payments.`;
  else if (!currency) blockedReason = `${countryCode} has no currency on the corridor or the jurisdiction.`;
  else if (conflicts.length > 0) blockedReason = conflicts[0];
  const minorDigits =
    input.jurisdictionMinorDigits == null || !Number.isInteger(input.jurisdictionMinorDigits)
      ? null
      : input.jurisdictionMinorDigits;
  const version = createHash("sha256")
    .update(
      JSON.stringify({
        countryCode,
        currency,
        minorDigits,
        collectionProvider,
        holdingProvider,
        payoutRouteProvider,
        payoutMethods,
      }),
    )
    .digest("hex")
    .slice(0, 16);
  return {
    countryCode,
    currency,
    minorDigits,
    collectionProvider,
    holdingProvider,
    payoutRouteProvider,
    payoutMethods,
    conflicts,
    ready: blockedReason == null && Boolean(collectionProvider),
    blockedReason: blockedReason ?? (collectionProvider ? null : `${countryCode} has no collection provider.`),
    version,
  };
}

export function readRouteSnapshot(value: unknown): PaymentRouteDecision | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<PaymentRouteDecision>;
  if (!row.countryCode || !row.version) return null;
  return {
    countryCode: String(row.countryCode),
    currency: row.currency ? String(row.currency) : null,
    minorDigits: typeof row.minorDigits === "number" ? row.minorDigits : null,
    collectionProvider: row.collectionProvider ? String(row.collectionProvider) : null,
    holdingProvider: row.holdingProvider ? String(row.holdingProvider) : null,
    payoutRouteProvider: row.payoutRouteProvider ? String(row.payoutRouteProvider) : null,
    payoutMethods: Array.isArray(row.payoutMethods) ? row.payoutMethods.map(String) : [],
    conflicts: Array.isArray(row.conflicts) ? row.conflicts.map(String) : [],
    ready: Boolean(row.ready),
    blockedReason: row.blockedReason ? String(row.blockedReason) : null,
    version: String(row.version),
  };
}
