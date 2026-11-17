/**
 * One financial summary for the agreement Overview tab (viewer-specific).
 * The shared Document tab keeps Business / Influencer platform fee labels.
 */
import { memberDealView } from "@/lib/member-deal-money";
import { formatStoredMoney } from "@/lib/money";
import { readSignedTermsSnapshot } from "@/lib/signed-funding";

export function overviewAmountLines(input: {
  termsSnapshotJson: unknown;
  role: "business" | "influencer";
}): { label: string; amount: string; emphasis: boolean; negative?: boolean }[] {
  const terms = readSignedTermsSnapshot(input.termsSnapshotJson);
  if (!terms) return [];
  const view = memberDealView({
    role: input.role,
    grossCents: terms.grossCents,
    feeCents: 0,
    plan: terms.financialPlan ? { financialPlan: terms.financialPlan } : null,
  });
  if (view.feeReady && view.lines.length > 0) {
    return view.lines.map((line) => ({
      label:
        line.label === "You pay"
          ? "Total you pay"
          : line.label === "Your platform fee"
            ? input.role === "business"
              ? "Business platform fee"
              : "Influencer fee"
            : line.label === "Net payout" || line.label === "You receive"
              ? "Net compensation"
              : line.label === "Gross compensation" || line.label === "Influencer compensation"
                ? "Gross influencer compensation"
                : line.label,
      amount: formatStoredMoney(line.amountCents, terms.currency),
      emphasis: line.label === "You pay" || line.label === "Net payout" || line.label === "You receive",
      negative: /fee/i.test(line.label) && input.role === "influencer",
    }));
  }
  // Fallback from gross only — never invent fee amounts.
  return [
    {
      label: "Gross influencer compensation",
      amount: formatStoredMoney(terms.grossCents, terms.currency),
      emphasis: false,
    },
  ];
}
