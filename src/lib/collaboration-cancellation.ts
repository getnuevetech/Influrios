/**
 * W3.6 — Provider-safe held-funding cancellation + chargeback → payment_risk.
 * calculateCancellation stays pure; this module records intent and queues provider rails.
 * Money still moves only via signed payout.refunded / provider webhooks.
 */

import { prisma } from "@/lib/db";
import {
  calculateCancellation,
  cancellationAllowedForJurisdiction,
  CANCELLATION_REASON_LABELS,
  type CancellationReason,
} from "@/lib/cancellation-matrix";
import {
  buildChargebackEvidencePack,
  parseChargebackEvidence,
  type ChargebackEvidencePack,
} from "@/lib/chargeback-evidence";
import { ledgerMovements, reconcileLedger } from "@/lib/ledger";
import { createMarketplaceSignedWebhookAdapter } from "@/lib/payment-provider-adapter";
import { verifyMarketplaceSignature } from "@/lib/ledger";

const CHARGEBACK_REASONS = new Set<CancellationReason>(["chargeback"]);

export function isCancellationReason(value: string): value is CancellationReason {
  return value in CANCELLATION_REASON_LABELS;
}

/** Pure gate used by executeHeldCancellation and tests. */
export function canExecuteHeldCancellation(input: {
  fundingStatus: string;
  protectedPaymentsEnabled: boolean;
  reason: CancellationReason;
}): { ok: true } | { ok: false; error: string } {
  if (input.fundingStatus === "payment_risk" && !CHARGEBACK_REASONS.has(input.reason)) {
    return {
      ok: false,
      error: "Payment-risk fundings stay paused until the provider refunds or ops records a chargeback decision.",
    };
  }
  if (input.fundingStatus !== "held" && input.fundingStatus !== "payment_risk") {
    return { ok: false, error: "Held cancellation applies after the provider confirms the prefund." };
  }
  return cancellationAllowedForJurisdiction({
    protectedPaymentsEnabled: input.protectedPaymentsEnabled,
    fundingStatus: input.fundingStatus === "payment_risk" ? "payment_risk" : "held",
  });
}

export async function executeHeldCancellation(input: {
  fundingId: string;
  reason: CancellationReason;
  currentMilestoneId?: string | null;
  acceptedPartialCents?: number | null;
  actor: string;
  note?: string;
  evidence?: {
    providerCaseId?: string | null;
    providerReference?: string | null;
    amountCents?: number | null;
    currency?: string | null;
    reasonCode?: string | null;
    receivedAt?: string | null;
    attachmentUrls?: string[] | null;
  };
}) {
  const funding = await prisma.collaborationFunding.findUnique({
    where: { id: input.fundingId },
    include: {
      milestones: { orderBy: { sortOrder: "asc" } },
      entries: true,
    },
  });
  if (!funding) return { ok: false as const, error: "Prefund not found." };

  const [settings, jurisdiction] = await Promise.all([
    prisma.marketplaceSettings.findUnique({ where: { id: "default" } }),
    prisma.collaborationJurisdiction.findUnique({ where: { code: funding.jurisdictionCode } }),
  ]);

  const gate = canExecuteHeldCancellation({
    fundingStatus: funding.status,
    protectedPaymentsEnabled: jurisdiction?.protectedPaymentsEnabled ?? false,
    reason: input.reason,
  });
  if (!gate.ok) return gate;

  const reconciled = reconcileLedger(ledgerMovements(funding.entries), funding.grossCents);
  const calc = calculateCancellation({
    milestones: funding.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      amountCents: m.amountCents,
      status: m.status,
      workBegan: m.status === "submitted" || m.status === "approved" || m.revisionCount > 0,
    })),
    currentMilestoneId: input.currentMilestoneId ?? null,
    reason: input.reason,
    fundedCents: funding.grossCents,
    alreadyReleasedCents: reconciled.releasedCents,
    killFeeRule: {
      killFeeBps: settings?.killFeeBps ?? 2500,
      killFeeFixedCents: settings?.killFeeFixedCents ?? 0,
    },
    acceptedPartialCents: input.acceptedPartialCents ?? null,
    earnedFeeCents: reconciled.feeCents,
  });
  if (!calc.ok) return calc;

  const providerAdapter = createMarketplaceSignedWebhookAdapter({
    verifySignature: verifyMarketplaceSignature,
  });

  if (calc.paymentRisk || CHARGEBACK_REASONS.has(input.reason)) {
    const evidence = buildChargebackEvidencePack({
      providerCaseId: input.evidence?.providerCaseId,
      providerReference: input.evidence?.providerReference,
      amountCents: input.evidence?.amountCents ?? reconciled.heldCents,
      currency: input.evidence?.currency ?? funding.currency,
      reasonCode: input.evidence?.reasonCode ?? input.reason,
      receivedAt: input.evidence?.receivedAt,
      notes: input.note,
      attachmentUrls: input.evidence?.attachmentUrls,
      recordedBy: input.actor,
    });
    const updated = await prisma.collaborationFunding.updateMany({
      where: { id: funding.id, status: { in: ["held", "payment_risk"] } },
      data: {
        status: "payment_risk",
        chargebackEvidenceJson: evidence,
      },
    });
    if (updated.count !== 1 && funding.status !== "payment_risk") {
      return { ok: false as const, error: "Could not mark this prefund as payment-risk." };
    }
    // If already payment_risk, still refresh evidence pack when ops re-records.
    if (updated.count !== 1 && funding.status === "payment_risk") {
      await prisma.collaborationFunding.update({
        where: { id: funding.id },
        data: { chargebackEvidenceJson: evidence },
      });
    }
    await prisma.auditLog
      .create({
        data: {
          actor: input.actor,
          action: "funding_chargeback_payment_risk",
          objectType: "CollaborationFunding",
          objectId: funding.id,
          after: {
            reason: input.reason,
            explanation: calc.explanation,
            lines: calc.lines,
            note: input.note?.trim().slice(0, 500) || null,
            heldCents: reconciled.heldCents,
            evidence,
          },
        },
      })
      .catch(() => undefined);

    const { notifyCollabFundingEvent } = await import("@/lib/jobs");
    await notifyCollabFundingEvent({
      fundingId: funding.id,
      kind: "payment_risk",
      detail: `${CANCELLATION_REASON_LABELS[input.reason]} — held funds paused; no automatic refund.`,
      processNow: false,
    });

    return {
      ok: true as const,
      paymentRisk: true as const,
      calculation: calc,
      providerRefund: null as null,
      evidence,
    };
  }

  // Non-chargeback cancel: record matrix snapshot; queue provider refund for refundable remainder.
  let providerRefund: { ok: true; reference: string } | { ok: false; error: string } | null = null;
  if (calc.refundableFutureCents > 0) {
    providerRefund =
      calc.refundableFutureCents >= reconciled.heldCents && reconciled.heldCents > 0
        ? await providerAdapter.createFullRefund({ fundingId: funding.id })
        : await providerAdapter.createPartialRefund({
            fundingId: funding.id,
            amountCents: calc.refundableFutureCents,
            milestoneId: input.currentMilestoneId ?? undefined,
          });
  } else {
    providerRefund = await providerAdapter.cancelFunding(funding.id);
  }

  await prisma.auditLog
    .create({
      data: {
        actor: input.actor,
        action: "funding_cancellation_queued",
        objectType: "CollaborationFunding",
        objectId: funding.id,
        after: {
          reason: input.reason,
          explanation: calc.explanation,
          lines: calc.lines,
          payableCompletedCents: calc.payableCompletedCents,
          currentAdjustmentCents: calc.currentAdjustmentCents,
          refundableFutureCents: calc.refundableFutureCents,
          earnedFeeCents: calc.earnedFeeCents,
          providerRefund,
          note: input.note?.trim().slice(0, 500) || null,
        },
      },
    })
    .catch(() => undefined);

  const { notifyCollabFundingEvent } = await import("@/lib/jobs");
  await notifyCollabFundingEvent({
    fundingId: funding.id,
    kind: "collaboration_cancelled",
    detail: `${CANCELLATION_REASON_LABELS[input.reason]}. Refundable held remainder ${calc.refundableFutureCents}¢ queued with provider${
      providerRefund && "ok" in providerRefund && providerRefund.ok === false ? ` (${providerRefund.error})` : ""
    }. Ledger moves only on signed payout.refunded.`,
    processNow: false,
  });

  return {
    ok: true as const,
    paymentRisk: false as const,
    calculation: calc,
    providerRefund,
    evidence: null as ChargebackEvidencePack | null,
  };
}

export async function listPaymentRiskFundings(limit = 50) {
  const rows = await prisma.collaborationFunding.findMany({
    where: { status: "payment_risk" },
    orderBy: { updatedAt: "desc" },
    include: {
      milestones: { orderBy: { sortOrder: "asc" } },
      entries: true,
    },
    take: limit,
  });
  return rows.map((funding) => ({
    ...funding,
    ledger: reconcileLedger(ledgerMovements(funding.entries), funding.grossCents),
    evidence: parseChargebackEvidence(funding.chargebackEvidenceJson),
  }));
}
