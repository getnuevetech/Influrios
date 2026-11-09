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

/** One route decision for a country. Collection, holding, and the gateway assignment may differ. Two currencies for one country conflict. */
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

export type RouteAccountRefs = {
  holdingAccountId: string;
  operationsAccountId: string;
  payoutAccountId: string;
};

/** Account ids captured with the route. A later admin edit does not replace them. */
export function freezeRouteAccounts(input: {
  requiresHoldingAccount: boolean;
  holdingAccountId: string;
  operationsAccountId: string;
}): { ok: true; accounts: RouteAccountRefs } | { ok: false; error: string } {
  const holdingAccountId = input.holdingAccountId.trim();
  const operationsAccountId = input.operationsAccountId.trim();
  if (input.requiresHoldingAccount && !holdingAccountId) {
    return { ok: false, error: "Save the holding account before funding this route." };
  }
  return { ok: true, accounts: { holdingAccountId, operationsAccountId, payoutAccountId: "" } };
}

export function readRouteAccounts(value: unknown): RouteAccountRefs | null {
  if (!value || typeof value !== "object" || !("accounts" in value)) return null;
  const accounts = (value as { accounts?: Partial<RouteAccountRefs> }).accounts;
  if (!accounts || typeof accounts !== "object") return null;
  return {
    holdingAccountId: String(accounts.holdingAccountId ?? "").trim(),
    operationsAccountId: String(accounts.operationsAccountId ?? "").trim(),
    payoutAccountId: String(accounts.payoutAccountId ?? "").trim(),
  };
}

/** The stored holding account wins. A blank snapshot can still use the current account. */
export function holdingAccountForCollection(input: {
  frozenHoldingAccountId?: string | null;
  liveHoldingAccountId?: string | null;
}): { ok: true; holdingAccountId: string } | { ok: false; error: string } {
  const frozen = (input.frozenHoldingAccountId ?? "").trim();
  if (frozen) return { ok: true, holdingAccountId: frozen };
  const live = (input.liveHoldingAccountId ?? "").trim();
  if (live) return { ok: true, holdingAccountId: live };
  return { ok: false, error: "Save the holding account id before opening checkout. Nothing was charged." };
}

/** A suspended route stops a new checkout. Servicing of money already held stays on the stored route. */
export function newCheckoutAllowed(input: { corridorActive: boolean | null; fundingStatus: string }) {
  if (input.fundingStatus !== "awaiting_provider") {
    return { ok: false as const, error: "This funding is not waiting for a provider." };
  }
  if (input.corridorActive === false) {
    return { ok: false as const, error: "This country route is suspended. Nothing was charged." };
  }
  return { ok: true as const };
}
