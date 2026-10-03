/**
 * Collab OS P4 — logical financial domains.
 * Collaboration-funded money must not sit in Influrios Operations until the fee is earned.
 */

export const ACCOUNT_PURPOSES = [
  "OPERATIONS",
  "COLLABORATION_HOLDING",
  "PLATFORM_FEE_CLEARING",
  "REFUND_RESERVE",
  "REGIONAL_SETTLEMENT",
] as const;

export type AccountPurpose = (typeof ACCOUNT_PURPOSES)[number];

export function asAccountPurpose(value: string | null | undefined): AccountPurpose | null {
  if (!value) return null;
  return (ACCOUNT_PURPOSES as readonly string[]).includes(value) ? (value as AccountPurpose) : null;
}

/** Sum of fee entries credited to Operations (earned platform fee). */
export function operationsEarnedCents(
  entries: { kind: string; amountCents: number; accountPurpose?: string | null }[],
) {
  return entries
    .filter(
      (entry) =>
        entry.kind === "fee" &&
        (entry.accountPurpose === "OPERATIONS" || entry.accountPurpose == null || entry.accountPurpose === ""),
    )
    .reduce((sum, entry) => sum + entry.amountCents, 0);
}

/**
 * Split a milestone release into creator payout + earned platform fee.
 * Prefers immutable financialPlan milestone rows when present.
 */
export function splitMilestoneRelease(input: {
  releasableCents: number;
  fundingGrossCents: number;
  fundingFeeCents: number;
  financialPlanJson?: unknown;
  milestoneTitle?: string | null;
  milestoneIndex?: number;
}): { creatorCents: number; feeCents: number } {
  const left = Math.max(0, input.releasableCents);
  if (left <= 0) return { creatorCents: 0, feeCents: 0 };

  const plan = input.financialPlanJson as
    | { milestones?: { title?: string; creatorCents?: number; platformFeeCents?: number; grossCents?: number }[] }
    | null
    | undefined;
  const rows = plan?.milestones ?? [];
  let row =
    input.milestoneTitle != null
      ? rows.find((item) => item.title === input.milestoneTitle)
      : undefined;
  if (!row && input.milestoneIndex != null && input.milestoneIndex >= 0) {
    row = rows[input.milestoneIndex];
  }
  if (row && Number.isInteger(row.creatorCents) && Number.isInteger(row.platformFeeCents)) {
    const creator = Math.max(0, Number(row.creatorCents));
    const fee = Math.max(0, Number(row.platformFeeCents));
    const total = creator + fee;
    if (total === left) return { creatorCents: creator, feeCents: fee };
    if (total > 0 && total === Number(row.grossCents)) {
      // Scale if releasable shrank after partial refund.
      const feeShare = Math.min(left, Math.round((left * fee) / total));
      return { creatorCents: left - feeShare, feeCents: feeShare };
    }
  }

  const gross = input.fundingGrossCents > 0 ? input.fundingGrossCents : 0;
  const feeTotal = Math.max(0, input.fundingFeeCents);
  if (gross <= 0 || feeTotal <= 0) return { creatorCents: left, feeCents: 0 };
  const feeShare = Math.min(left, Math.round((left * feeTotal) / gross));
  return { creatorCents: left - feeShare, feeCents: feeShare };
}
