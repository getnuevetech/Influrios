import { createHmac, timingSafeEqual } from "crypto";

export const LEDGER_KINDS = ["hold", "release", "refund", "fee"] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

export type MilestoneWorkflowStatus = "pending" | "submitted" | "approved" | "released" | "refunded";

export type LedgerMovement = { kind: LedgerKind; amountCents: number };

/** The word escrow is allowed only when that jurisdiction says so. */
export function fundingTerm(escrowTermAllowed: boolean) {
  return escrowTermAllowed ? "Escrow" : "Protected Payment";
}

/** Zero means the admin has not set a cap. The check uses the USD amount, before conversion. */
export function grossWithinCap(input: { grossCents: number; maxGrossCents: number }) {
  if (!Number.isInteger(input.maxGrossCents) || input.maxGrossCents < 0) {
    return { ok: false as const, error: "That gross is above the admin cap. Nothing was funded." };
  }
  if (input.maxGrossCents === 0) return { ok: true as const };
  if (!Number.isInteger(input.grossCents) || input.grossCents > input.maxGrossCents) {
    return { ok: false as const, error: "That gross is above the admin cap. Nothing was funded." };
  }
  return { ok: true as const };
}

export function canRequestPrefund(input: { jurisdictionEnabled: boolean; providerReady: boolean }) {
  if (!input.jurisdictionEnabled) {
    return { ok: false as const, error: "Protected payments are off for this jurisdiction." };
  }
  if (!input.providerReady) {
    return { ok: false as const, error: "The marketplace provider is not ready. Nothing was funded." };
  }
  return { ok: true as const };
}

/** Last share absorbs rounding so the parts still add up to the gross. */
export function splitGross(grossCents: number, sharesBps: number[]): number[] | null {
  if (!Number.isInteger(grossCents) || grossCents <= 0) return null;
  if (sharesBps.length === 0) return null;
  if (sharesBps.some((share) => !Number.isInteger(share) || share < 0)) return null;
  if (sharesBps.reduce((sum, share) => sum + share, 0) !== 10_000) return null;
  const amounts: number[] = [];
  let used = 0;
  for (let index = 0; index < sharesBps.length; index += 1) {
    if (index === sharesBps.length - 1) {
      amounts.push(grossCents - used);
      continue;
    }
    const part = Math.floor((grossCents * sharesBps[index]) / 10_000);
    amounts.push(part);
    used += part;
  }
  if (amounts.some((amount) => amount <= 0)) return null;
  return amounts;
}

export function autoApproveDeadline(submittedAt: Date, reviewWindowHours: number) {
  const hours = Number.isFinite(reviewWindowHours) && reviewWindowHours > 0 ? reviewWindowHours : 0;
  return new Date(submittedAt.getTime() + hours * 60 * 60 * 1000);
}

export function shouldAutoApprove(status: string, autoApproveAt: Date | null, now: Date) {
  return status === "submitted" && autoApproveAt != null && now.getTime() >= autoApproveAt.getTime();
}

/** A revision sends submitted work back. It does not approve, release, or refund. */
export function requestRevision(input: {
  fundingStatus: string;
  milestoneStatus: string;
  revisionCount: number;
  revisionLimit: number;
  disputeOpen: boolean;
}): { ok: true; revisionCount: number } | { ok: false; error: string } {
  if (input.fundingStatus !== "held") {
    return { ok: false, error: "Ask for a revision after the provider confirms the prefund." };
  }
  if (input.disputeOpen) {
    return { ok: false, error: "A dispute is open on this milestone." };
  }
  if (input.milestoneStatus !== "submitted") {
    return { ok: false, error: "A revision applies to submitted work." };
  }
  if (!Number.isInteger(input.revisionCount) || input.revisionCount < 0) {
    return { ok: false, error: "That milestone cannot take this step." };
  }
  if (!Number.isInteger(input.revisionLimit) || input.revisionLimit < 0) {
    return { ok: false, error: "That milestone cannot take this step." };
  }
  if (input.revisionCount >= input.revisionLimit) {
    return { ok: false, error: "This milestone has used its revision limit." };
  }
  return { ok: true, revisionCount: input.revisionCount + 1 };
}

export function advanceMilestone(
  status: MilestoneWorkflowStatus,
  action: "submit" | "approve" | "auto_approve",
): { ok: true; status: MilestoneWorkflowStatus } | { ok: false; error: string } {
  if (action === "submit" && status === "pending") return { ok: true, status: "submitted" };
  if ((action === "approve" || action === "auto_approve") && status === "submitted") {
    return { ok: true, status: "approved" };
  }
  return { ok: false, error: "That milestone cannot take this step." };
}

export function ledgerMovements(entries: { kind: string; amountCents: number }[]): LedgerMovement[] {
  return entries.flatMap((entry) =>
    entry.kind === "hold" || entry.kind === "release" || entry.kind === "refund" || entry.kind === "fee"
      ? [{ kind: entry.kind, amountCents: entry.amountCents }]
      : [],
  );
}

export type LedgerCurrencyTotal = {
  currency: string;
  heldCents: number;
  releasedCents: number;
  refundedCents: number;
  feeCents: number;
  unbalanced: number;
};

/** Fees and share lines are not added into the held amount. Currencies stay separate. */
export function summarizeLedger(
  fundings: { currency: string; grossCents: number; entries: { kind: string; amountCents: number }[] }[],
): LedgerCurrencyTotal[] {
  const totals = new Map<string, LedgerCurrencyTotal>();
  for (const funding of fundings) {
    const currency = (funding.currency || "USD").toUpperCase();
    const row = totals.get(currency) ?? {
      currency,
      heldCents: 0,
      releasedCents: 0,
      refundedCents: 0,
      feeCents: 0,
      unbalanced: 0,
    };
    const reconciled = reconcileLedger(ledgerMovements(funding.entries), funding.grossCents);
    row.heldCents += reconciled.heldCents;
    row.releasedCents += reconciled.releasedCents;
    row.refundedCents += reconciled.refundedCents;
    row.feeCents += funding.entries
      .filter((entry) => entry.kind === "fee")
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    if (!reconciled.balanced) row.unbalanced += 1;
    totals.set(currency, row);
  }
  return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

export function reconcileLedger(entries: LedgerMovement[], grossCents: number) {
  const sum = (kind: LedgerKind) =>
    entries.filter((entry) => entry.kind === kind).reduce((total, entry) => total + entry.amountCents, 0);
  const heldIn = sum("hold");
  const released = sum("release");
  const refunded = sum("refund");
  const held = heldIn - released - refunded;
  const balanced = held >= 0 && heldIn <= grossCents && released + refunded <= heldIn;
  return { heldCents: held, releasedCents: released, refundedCents: refunded, heldInCents: heldIn, balanced };
}

/** What is still owed on a milestone after signed refunds. The original amount stays. */
export function releasableCents(amountCents: number, refundedCents: number) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return 0;
  const refunded = Number.isInteger(refundedCents) && refundedCents > 0 ? refundedCents : 0;
  return Math.max(amountCents - refunded, 0);
}

export type MarketplaceDisposition = "apply" | "ignore" | "reject";

export function marketplaceDisposition(input: {
  eventType: string;
  fundingStatus: string;
  amountCents: number;
  expectedCents: number;
  heldCents: number;
  milestoneStatus?: string | null;
  disputeOpen?: boolean;
  /** Set when this milestone has a refund request. The webhook must match it. */
  requestedRefundCents?: number | null;
  /** Set for a milestone refund. The webhook cannot exceed what that milestone has left. */
  milestoneRemainingCents?: number | null;
}): MarketplaceDisposition {
  if (input.eventType === "funding.held") {
    if (input.fundingStatus === "awaiting_provider" && input.amountCents === input.expectedCents) return "apply";
    return "reject";
  }
  if (input.eventType === "funding.failed") {
    return input.fundingStatus === "awaiting_provider" ? "apply" : "reject";
  }
  if (input.eventType === "payout.released") {
    if (input.disputeOpen) return "reject";
    if (
      input.milestoneStatus === "approved" &&
      input.amountCents === input.expectedCents &&
      input.heldCents >= input.amountCents
    ) {
      return "apply";
    }
    return "reject";
  }
  if (input.eventType === "payout.refunded") {
    if (!(input.amountCents > 0 && input.amountCents <= input.heldCents && input.heldCents > 0)) return "reject";
    if (input.milestoneRemainingCents != null && input.amountCents > input.milestoneRemainingCents) return "reject";
    if (input.requestedRefundCents != null && input.amountCents !== input.requestedRefundCents) return "reject";
    return "apply";
  }
  return "ignore";
}

export function marketplaceSignature(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function verifyMarketplaceSignature(body: string, secret: string, signature: string | null | undefined) {
  if (!signature || !secret) return false;
  const expected = marketplaceSignature(body, secret);
  const given = signature.trim().toLowerCase();
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
