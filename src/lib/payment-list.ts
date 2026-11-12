/** Compact payments-list labels. Opening the list does not move money. */

export function currencyPaymentTotals(
  rows: { currency: string; heldCents: number; releasedCents: number }[],
) {
  const totals = new Map<string, { heldCents: number; releasedCents: number }>();
  for (const row of rows) {
    const code = row.currency.trim().toUpperCase() || "USD";
    const current = totals.get(code) ?? { heldCents: 0, releasedCents: 0 };
    current.heldCents += row.heldCents;
    current.releasedCents += row.releasedCents;
    totals.set(code, current);
  }
  return [...totals.entries()].sort(([left], [right]) => left.localeCompare(right));
}

export function paymentNextAction(input: {
  status: string;
  role: "business" | "influencer";
  payoutPending: boolean;
  payoutReturned: boolean;
}) {
  if (input.status === "payment_risk") return "Review payment risk";
  if (input.status === "awaiting_provider" || input.status === "draft" || input.status === "pending") {
    return input.role === "business" ? "Deposit funds" : "Waiting for funding";
  }
  if (input.payoutReturned) return "Recover the returned payout";
  if (input.payoutPending) return "Track the pending payout";
  if (input.status === "refunded" || input.status === "cancelled") return "Review the record";
  if (input.status === "completed") return "View the completed payout";
  return "Open the collaboration";
}
