/**
 * Product funding modes (Product Addendum §7): FULL prefunding, or NONE when the corridor is outside
 * protected payments. Staged and recurring funding were removed; older rows stored as STAGED read as FULL.
 */

export const FUNDING_MODES = ["FULL", "NONE"] as const;
export type FundingMode = (typeof FUNDING_MODES)[number];

export const FUNDING_MODE_LABELS: Record<FundingMode, string> = {
  FULL: "Full prefunding",
  NONE: "Outside protected coverage",
};

export function asFundingMode(value: string | null | undefined): FundingMode {
  const raw = String(value ?? "").trim().toUpperCase();
  return raw === "NONE" ? "NONE" : "FULL";
}

/** Jurisdiction protection decides the product funding mode. */
export function resolveFundingMode(input: {
  protectedPaymentsEnabled?: boolean | null;
  explicitMode?: string | null;
}): FundingMode {
  if (input.protectedPaymentsEnabled === false) return "NONE";
  if (input.explicitMode) return asFundingMode(input.explicitMode);
  return "FULL";
}

/** Work is submitted only after the provider confirms the prefund. */
export function fundedWorkCanStart(input: { fundingStatus: string }): { ok: true } | { ok: false; error: string } {
  if (input.fundingStatus !== "held") {
    return { ok: false, error: "Submit work after the provider confirms the prefund." };
  }
  return { ok: true };
}

/** NONE never qualifies as Fully Funded — coverage is outside protected payments. */
export function fundingModeBlocksFullyFundedBadge(fundingMode: string | null | undefined) {
  return asFundingMode(fundingMode) === "NONE";
}
