/**
 * W3.4 — Product funding modes FULL / STAGED / NONE (Product Addendum §7).
 * Recurring/ambassador remains deferred (Dev P3); schedule kind still exists but is not a product mode exit.
 */

export const FUNDING_MODES = ["FULL", "STAGED", "NONE"] as const;
export type FundingMode = (typeof FUNDING_MODES)[number];

export const FUNDING_MODE_LABELS: Record<FundingMode, string> = {
  FULL: "Full prefunding",
  STAGED: "Staged prefunding",
  NONE: "Outside protected coverage",
};

export function asFundingMode(value: string | null | undefined): FundingMode {
  const raw = String(value ?? "").trim().toUpperCase();
  if ((FUNDING_MODES as readonly string[]).includes(raw)) return raw as FundingMode;
  return "FULL";
}

/**
 * Map schedule + jurisdiction protection into the product funding mode.
 * Recurring keeps storing scheduleKind=recurring but product mode stays FULL for the cycle amount
 * (ambassador expansion is deferred — do not invent a fourth product mode yet).
 */
export function resolveFundingMode(input: {
  scheduleKind?: string | null;
  protectedPaymentsEnabled?: boolean | null;
  explicitMode?: string | null;
}): FundingMode {
  if (input.explicitMode) {
    const explicit = asFundingMode(input.explicitMode);
    if (input.protectedPaymentsEnabled === false) return "NONE";
    return explicit;
  }
  if (input.protectedPaymentsEnabled === false) return "NONE";
  const kind = String(input.scheduleKind ?? "once").trim().toLowerCase();
  if (kind === "staged") return "STAGED";
  if (kind === "none") return "NONE";
  return "FULL";
}

/**
 * Staged: later phases cannot start unfunded (Product §7).
 * A phase "starts" when work is submitted against that tranche's milestones.
 */
export function stagedPhaseCanStart(input: {
  fundingMode: string;
  fundingStatus: string;
  trancheIndex: number;
  scheduleKind?: string | null;
}): { ok: true } | { ok: false; error: string } {
  const mode = asFundingMode(input.fundingMode);
  const kind = String(input.scheduleKind ?? "").toLowerCase();
  const staged = mode === "STAGED" || kind === "staged";
  if (!staged) {
    if (input.fundingStatus !== "held") {
      return { ok: false, error: "Submit work after the provider confirms the prefund." };
    }
    return { ok: true };
  }
  if (input.fundingStatus !== "held") {
    const phase = Number.isInteger(input.trancheIndex) && input.trancheIndex > 1
      ? `Stage ${input.trancheIndex}`
      : "This stage";
    return {
      ok: false,
      error: `${phase} is not funded yet. Fund this phase before work begins.`,
    };
  }
  return { ok: true };
}

/** NONE never qualifies as Fully Funded — coverage is outside protected payments. */
export function fundingModeBlocksFullyFundedBadge(fundingMode: string | null | undefined) {
  return asFundingMode(fundingMode) === "NONE";
}
