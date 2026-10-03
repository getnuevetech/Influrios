/**
 * Product Addendum §16 funding badge labels driven by ledger + jurisdiction.
 */

export type FundingBadge =
  | "Fully Funded"
  | "Partially Funded"
  | "Awaiting Funding"
  | "Protected Payment Unavailable";

export type FundingBadgeInput = {
  status: string;
  heldCents?: number;
  releasedCents?: number;
  fundedCents?: number;
  protectedPaymentsEnabled?: boolean;
};

export function fundingBadge(input: FundingBadgeInput): FundingBadge {
  if (input.protectedPaymentsEnabled === false) return "Protected Payment Unavailable";
  const status = input.status.toLowerCase();
  if (status === "awaiting_provider" || status === "draft" || status === "pending") {
    return "Awaiting Funding";
  }
  if (status === "completed" || status === "released") {
    return "Fully Funded";
  }
  if (status === "held" || status === "active" || status === "partially_funded") {
    const funded = input.fundedCents ?? (input.heldCents ?? 0) + (input.releasedCents ?? 0);
    const held = input.heldCents ?? 0;
    if (funded > 0 && held === 0 && (input.releasedCents ?? 0) >= funded) return "Fully Funded";
    if (status === "partially_funded") return "Partially Funded";
    return held > 0 && (input.releasedCents ?? 0) > 0 ? "Partially Funded" : "Fully Funded";
  }
  if (status === "cancelled" || status === "refunded") return "Awaiting Funding";
  return "Awaiting Funding";
}

export const FUNDING_BADGE_CLASS: Record<FundingBadge, string> = {
  "Fully Funded": "bg-emerald-100 text-emerald-800",
  "Partially Funded": "bg-amber-100 text-amber-900",
  "Awaiting Funding": "bg-blue-100 text-blue-800",
  "Protected Payment Unavailable": "bg-slate-100 text-slate-700",
};
