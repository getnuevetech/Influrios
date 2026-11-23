/**
 * Gateway & bank reconciliation: compares what the ledger says the platform should hold with what the
 * provider (Stripe balance) and the platform bank (Stripe payouts to the bank) report.
 * Bank transfers are internal moves between our own locations, not additional income.
 */
import type { ContractLedgerRow } from "@/lib/contract-ledger";

export type ProviderSnapshot = {
  ok: true;
  availableCents: number;
  pendingCents: number;
  reserveCents: number;
  /** Sum of payouts to the platform bank that Stripe reports as paid. */
  bankCents: number;
  /** Payouts on their way to the bank. */
  inTransitCount: number;
  lastPayout: { id: string; amountCents: number; arrivalDate: Date; status: string } | null;
  fetchedAt: Date;
};

export type ProviderUnavailable = { ok: false; error: string; fetchedAt: Date };

export type ReconciliationLine = {
  location: "Gateway available" | "Gateway pending" | "Gateway reserve" | "Platform bank";
  ledgerCents: number;
  providerCents: number | null;
  differenceCents: number | null;
  matched: boolean | null;
};

export type Reconciliation = {
  collectedCents: number;
  paidCents: number;
  costsCents: number;
  refundedCents: number;
  ledgerCashCents: number;
  heldCents: number;
  awaitingPayoutCents: number;
  taxPayableCents: number;
  platformNetCents: number;
  gatewayCents: number | null;
  bankCents: number | null;
  combinedCents: number | null;
  unexplainedCents: number | null;
  lines: ReconciliationLine[];
  exceptions: { unmatched: number; duplicates: number; pendingSettlement: number };
};

export function reconcile(rows: ContractLedgerRow[], provider: ProviderSnapshot | ProviderUnavailable, unmatched = 0): Reconciliation {
  const add = (pick: (row: ContractLedgerRow) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const collected = add((row) => row.collectedCents);
  const paid = add((row) => row.paidToInfluencerCents);
  const costs = add((row) => row.processingCostsCents);
  const refunded = add((row) => row.refundedCents);
  const ledgerCash = collected - paid - costs - refunded;
  const base = {
    collectedCents: collected,
    paidCents: paid,
    costsCents: costs,
    refundedCents: refunded,
    ledgerCashCents: ledgerCash,
    heldCents: add((row) => row.heldCents),
    awaitingPayoutCents: add((row) => row.releasedAwaitingPayoutCents),
    taxPayableCents: add((row) => row.taxesCents),
    platformNetCents: add((row) => row.netEarningsCents),
  };
  if (!provider.ok) {
    return {
      ...base,
      gatewayCents: null,
      bankCents: null,
      combinedCents: null,
      unexplainedCents: null,
      lines: (["Gateway available", "Gateway pending", "Gateway reserve", "Platform bank"] as const).map((location) => ({
        location,
        ledgerCents: location === "Gateway available" ? ledgerCash : 0,
        providerCents: null,
        differenceCents: null,
        matched: null,
      })),
      exceptions: { unmatched, duplicates: 0, pendingSettlement: 0 },
    };
  }
  // Bank payouts and the pending/reserve split are provider timing, recorded from provider records;
  // whatever the ledger expects beyond them must be available at the gateway.
  const ledgerBank = provider.bankCents;
  const ledgerPending = provider.pendingCents;
  const ledgerReserve = provider.reserveCents;
  const ledgerAvailable = ledgerCash - ledgerBank - ledgerPending - ledgerReserve;
  const line = (location: ReconciliationLine["location"], ledgerCents: number, providerCents: number): ReconciliationLine => ({
    location,
    ledgerCents,
    providerCents,
    differenceCents: providerCents - ledgerCents,
    matched: providerCents === ledgerCents,
  });
  const gateway = provider.availableCents + provider.pendingCents + provider.reserveCents;
  const combined = gateway + provider.bankCents;
  return {
    ...base,
    gatewayCents: gateway,
    bankCents: provider.bankCents,
    combinedCents: combined,
    unexplainedCents: combined - ledgerCash,
    lines: [
      line("Gateway available", ledgerAvailable, provider.availableCents),
      line("Gateway pending", ledgerPending, provider.pendingCents),
      line("Gateway reserve", ledgerReserve, provider.reserveCents),
      line("Platform bank", ledgerBank, provider.bankCents),
    ],
    exceptions: { unmatched, duplicates: 0, pendingSettlement: provider.inTransitCount },
  };
}

type StripeMoney = { amount?: number; currency?: string };
const forCurrency = (list: unknown, currency: string) =>
  (Array.isArray(list) ? (list as StripeMoney[]) : [])
    .filter((row) => (row.currency ?? "").toUpperCase() === currency)
    .reduce((total, row) => total + (Number(row.amount) || 0), 0);

/** Read the Stripe balance and bank payouts for one currency. Read-only. */
export async function loadStripeSnapshot(currency: string): Promise<ProviderSnapshot | ProviderUnavailable> {
  const fetchedAt = new Date();
  const { stripeGet, stripeCredentials } = await import("@/lib/stripe-admin");
  const creds = await stripeCredentials().catch(() => null);
  if (!creds?.ok) return { ok: false, error: "Stripe is not connected, so provider records cannot be read.", fetchedAt };
  const balance = await stripeGet("/v1/balance", creds.secret);
  if (!balance.ok) return { ok: false, error: `Stripe balance could not be read: ${balance.error}`, fetchedAt };
  const payouts = await stripeGet("/v1/payouts?limit=100", creds.secret);
  if (!payouts.ok) return { ok: false, error: `Stripe payouts could not be read: ${payouts.error}`, fetchedAt };
  const code = currency.toLowerCase();
  const rows = (Array.isArray(payouts.payload.data) ? payouts.payload.data : []) as {
    id?: string;
    amount?: number;
    currency?: string;
    status?: string;
    arrival_date?: number;
  }[];
  const mine = rows.filter((row) => (row.currency ?? "") === code);
  const paid = mine.filter((row) => row.status === "paid");
  const last = mine[0];
  return {
    ok: true,
    availableCents: forCurrency(balance.payload.available, currency),
    pendingCents: forCurrency(balance.payload.pending, currency),
    reserveCents: forCurrency(balance.payload.connect_reserved, currency),
    bankCents: paid.reduce((total, row) => total + (Number(row.amount) || 0), 0),
    inTransitCount: mine.filter((row) => row.status === "pending" || row.status === "in_transit").length,
    lastPayout: last?.id
      ? {
          id: last.id,
          amountCents: Number(last.amount) || 0,
          arrivalDate: new Date((Number(last.arrival_date) || 0) * 1000),
          status: last.status ?? "",
        }
      : null,
    fetchedAt,
  };
}
