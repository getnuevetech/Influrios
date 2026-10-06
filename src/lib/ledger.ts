import { createHmac, timingSafeEqual } from "crypto";

export const LEDGER_KINDS = ["hold", "release", "refund", "fee"] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

export type MilestoneWorkflowStatus = "pending" | "submitted" | "approved" | "released" | "refunded";

export type LedgerMovement = { kind: LedgerKind; amountCents: number };

/** The word escrow is allowed only when that jurisdiction says so. */
export function fundingTerm(escrowTermAllowed: boolean) {
  return escrowTermAllowed ? "Escrow" : "Protected Payment";
}

/** Zero means no extra dispute limit. The gross cap is a separate check. */
export function disputeLoadAllowsPrefund(input: {
  enabled: boolean;
  openDisputes: number;
  maxOpenDisputes: number;
}): { ok: true } | { ok: false; error: string } {
  if (!input.enabled) return { ok: true };
  if (!Number.isInteger(input.maxOpenDisputes) || input.maxOpenDisputes <= 0) return { ok: true };
  if (!Number.isInteger(input.openDisputes) || input.openDisputes >= input.maxOpenDisputes) {
    return { ok: false, error: "This business is over the open-dispute limit. Nothing was funded." };
  }
  return { ok: true };
}

/** Product Addendum §5 — fee amounts stay distinct by type in financial reports. */
export type FeeTypeAmount = { feeType: string; amountCents: number };

export type LedgerMonthTotal = {
  currency: string;
  month: string;
  heldCents: number;
  releasedCents: number;
  refundedCents: number;
  feeCents: number;
  /** Fee legs broken out by frozen feeType (defaults to collaboration when missing). */
  feesByType: FeeTypeAmount[];
};

function bumpFeeType(bucket: Map<string, number>, feeType: string | undefined, amountCents: number) {
  const key = (feeType && feeType.trim()) || "collaboration";
  bucket.set(key, (bucket.get(key) ?? 0) + amountCents);
}

function feeTypeAmounts(bucket: Map<string, number>): FeeTypeAmount[] {
  return [...bucket.entries()]
    .map(([feeType, amountCents]) => ({ feeType, amountCents }))
    .sort((a, b) => a.feeType.localeCompare(b.feeType));
}

/** Monthly sums of recorded movements. A share line is not included. */
export function summarizeLedgerReport(
  rows: { currency: string; kind: string; amountCents: number; createdAt: Date; feeType?: string | null }[],
): LedgerMonthTotal[] {
  const map = new Map<string, LedgerMonthTotal & { _fees: Map<string, number> }>();
  for (const row of rows) {
    if (row.kind !== "hold" && row.kind !== "release" && row.kind !== "refund" && row.kind !== "fee") continue;
    const month = row.createdAt.toISOString().slice(0, 7);
    const currency = (row.currency || "USD").toUpperCase();
    const key = `${currency}|${month}`;
    const current =
      map.get(key) ??
      ({
        currency,
        month,
        heldCents: 0,
        releasedCents: 0,
        refundedCents: 0,
        feeCents: 0,
        feesByType: [],
        _fees: new Map<string, number>(),
      } as LedgerMonthTotal & { _fees: Map<string, number> });
    if (row.kind === "hold") current.heldCents += row.amountCents;
    if (row.kind === "release") current.releasedCents += row.amountCents;
    if (row.kind === "refund") current.refundedCents += row.amountCents;
    if (row.kind === "fee") {
      current.feeCents += row.amountCents;
      bumpFeeType(current._fees, row.feeType ?? undefined, row.amountCents);
    }
    map.set(key, current);
  }
  return [...map.values()]
    .map(({ _fees, ...row }) => ({ ...row, feesByType: feeTypeAmounts(_fees) }))
    .sort((a, b) => b.month.localeCompare(a.month) || a.currency.localeCompare(b.currency));
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

/** Basis points from the amounts already on a prefund. The last share absorbs rounding. */
export function sharesFromAmounts(amounts: number[]): number[] | null {
  if (amounts.length === 0) return null;
  if (amounts.some((amount) => !Number.isInteger(amount) || amount <= 0)) return null;
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  if (total <= 0) return null;
  const shares: number[] = [];
  let used = 0;
  for (let index = 0; index < amounts.length; index += 1) {
    if (index === amounts.length - 1) {
      shares.push(10_000 - used);
      continue;
    }
    const share = Math.floor((amounts[index] * 10_000) / total);
    shares.push(share);
    used += share;
  }
  if (shares.some((share) => share <= 0)) return null;
  if (shares.reduce((sum, share) => sum + share, 0) !== 10_000) return null;
  return shares;
}

/** A change order amends an unconfirmed prefund. It does not hold, release, or refund. */
export function canRequestChangeOrder(input: {
  enabled: boolean;
  fundingStatus: string;
  changeOrderCount: number;
  changeOrderLimit: number;
  hasHold: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (!input.enabled) {
    return { ok: false, error: "Change orders are turned off. Nothing was changed." };
  }
  if (input.hasHold || input.fundingStatus !== "awaiting_provider") {
    return { ok: false, error: "This prefund is already with the provider. Nothing was changed." };
  }
  if (
    !Number.isInteger(input.changeOrderCount) ||
    input.changeOrderCount < 0 ||
    !Number.isInteger(input.changeOrderLimit) ||
    input.changeOrderLimit < 0 ||
    input.changeOrderCount >= input.changeOrderLimit
  ) {
    return { ok: false, error: "This prefund has used its change orders. Nothing was changed." };
  }
  return { ok: true };
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
    return {
      ok: false,
      error:
        "This milestone has used its revision limit. Open a dispute or request a change order — revisions cannot silently expand scope.",
    };
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
  feesByType: FeeTypeAmount[];
  unbalanced: number;
};

/** Fees and share lines are not added into the held amount. Currencies stay separate. */
export function summarizeLedger(
  fundings: {
    currency: string;
    grossCents: number;
    feeType?: string | null;
    entries: { kind: string; amountCents: number }[];
  }[],
): LedgerCurrencyTotal[] {
  const totals = new Map<string, LedgerCurrencyTotal & { _fees: Map<string, number> }>();
  for (const funding of fundings) {
    const currency = (funding.currency || "USD").toUpperCase();
    const row =
      totals.get(currency) ??
      ({
        currency,
        heldCents: 0,
        releasedCents: 0,
        refundedCents: 0,
        feeCents: 0,
        feesByType: [],
        unbalanced: 0,
        _fees: new Map<string, number>(),
      } as LedgerCurrencyTotal & { _fees: Map<string, number> });
    const reconciled = reconcileLedger(ledgerMovements(funding.entries), funding.grossCents);
    row.heldCents += reconciled.heldCents;
    row.releasedCents += reconciled.releasedCents;
    row.refundedCents += reconciled.refundedCents;
    const feeSum = funding.entries
      .filter((entry) => entry.kind === "fee")
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    row.feeCents += feeSum;
    if (feeSum > 0) bumpFeeType(row._fees, funding.feeType ?? undefined, feeSum);
    if (!reconciled.balanced) row.unbalanced += 1;
    totals.set(currency, row);
  }
  return [...totals.values()]
    .map(({ _fees, ...row }) => ({ ...row, feesByType: feeTypeAmounts(_fees) }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

/** Read feeType from a frozen funding snapshot (legacy rows default to collaboration). */
export function feeTypeFromFundingSnapshot(snapshot: unknown, serviceLevel?: string | null): string {
  if (snapshot && typeof snapshot === "object" && "feeType" in snapshot) {
    const raw = (snapshot as { feeType?: unknown }).feeType;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  if (serviceLevel === "discovery") return "platform_service";
  if (serviceLevel === "managed_intro") return "managed_intro";
  if (serviceLevel === "managed_campaign") return "managed_campaign";
  return "collaboration";
}

export function reconcileLedger(entries: LedgerMovement[], grossCents: number) {
  const sum = (kind: LedgerKind) =>
    entries.filter((entry) => entry.kind === kind).reduce((total, entry) => total + entry.amountCents, 0);
  const heldIn = sum("hold");
  const released = sum("release");
  const refunded = sum("refund");
  // P4: earned platform fee legs leave Collaboration Holding (fee booked on release, not on hold).
  const fees = sum("fee");
  const held = heldIn - released - refunded - fees;
  const balanced = held >= 0 && heldIn <= grossCents && released + refunded + fees <= heldIn;
  return {
    heldCents: held,
    releasedCents: released,
    refundedCents: refunded,
    feeCents: fees,
    heldInCents: heldIn,
    balanced,
  };
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
  if (input.eventType === "funding.chargeback") {
    // Chargeback freezes held funds into payment-risk; no automatic refund/ledger move.
    if (input.fundingStatus === "held" && input.heldCents > 0) return "apply";
    if (input.fundingStatus === "payment_risk") return "ignore";
    return "reject";
  }
  if (input.eventType === "payout.released") {
    if (input.disputeOpen) return "reject";
    if (input.fundingStatus === "payment_risk") return "reject";
    if (
      (input.milestoneStatus === "approved" ||
        input.milestoneStatus === "release_scheduled" ||
        input.milestoneStatus === "release_requested" ||
        input.milestoneStatus === "payout_failed") &&
      input.amountCents === input.expectedCents &&
      input.heldCents >= input.amountCents
    ) {
      return "apply";
    }
    return "reject";
  }
  if (input.eventType === "payout.failed") {
    if (input.disputeOpen) return "reject";
    if (
      (input.milestoneStatus === "approved" ||
        input.milestoneStatus === "release_scheduled" ||
        input.milestoneStatus === "release_requested") &&
      input.amountCents === input.expectedCents
    ) {
      return "apply";
    }
    return "reject";
  }
  if (input.eventType === "payout.refunded") {
    if (input.fundingStatus !== "held" && input.fundingStatus !== "payment_risk") return "reject";
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
