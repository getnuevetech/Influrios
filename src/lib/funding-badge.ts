/**
 * Product Addendum §16 funding badge labels driven by ledger + jurisdiction + funding mode (W3.4).
 */

export type FundingBadge =
  | "Fully Funded"
  | "Partially Funded"
  | "Awaiting Funding"
  | "Payment Risk"
  | "Protected Payment Unavailable"
  | "Outside Protected Coverage";

export type FundingBadgeInput = {
  status: string;
  heldCents?: number;
  releasedCents?: number;
  fundedCents?: number;
  protectedPaymentsEnabled?: boolean;
  /** Product funding mode FULL | STAGED | NONE — NONE never shows Fully Funded. */
  fundingMode?: string;
  /** For STAGED: true when later sibling stages in the schedule are still unfunded. */
  schedulePartiallyFunded?: boolean;
};

export function fundingBadge(input: FundingBadgeInput): FundingBadge {
  const mode = String(input.fundingMode ?? "").trim().toUpperCase();
  if (mode === "NONE") return "Outside Protected Coverage";
  if (input.protectedPaymentsEnabled === false) return "Protected Payment Unavailable";
  const status = input.status.toLowerCase();
  if (status === "payment_risk") return "Payment Risk";
  if (status === "awaiting_provider" || status === "draft" || status === "pending") {
    return "Awaiting Funding";
  }
  if (status === "completed" || status === "released") {
    if (input.schedulePartiallyFunded) return "Partially Funded";
    return "Fully Funded";
  }
  if (status === "held" || status === "active" || status === "partially_funded") {
    if (input.schedulePartiallyFunded) return "Partially Funded";
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
  "Payment Risk": "bg-rose-100 text-rose-800",
  "Protected Payment Unavailable": "bg-slate-100 text-slate-700",
  "Outside Protected Coverage": "bg-slate-100 text-slate-700",
};
