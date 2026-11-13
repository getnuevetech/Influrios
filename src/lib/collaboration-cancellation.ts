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
import { ledgerMovements, reconcileLedger, verifyMarketplaceSignature } from "@/lib/ledger";
import { activationExceptionForReason, memberReviewBlocksExecution, readSettlementProposal, settlementFromSnapshot, settlementVersionDecision } from "@/lib/cancellation-settlement";
import { adapterForProvider } from "@/lib/payment-provider-adapter";

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

/** A payout instruction that the provider has not finished. Settlement waits instead of refunding that money. */
export function cancellationPayoutBlock(milestones: { status: string }[]): { ok: true } | { ok: false; error: string } {
  const pending = milestones.some((milestone) => milestone.status === "release_scheduled" || milestone.status === "release_requested");
  if (!pending) return { ok: true };
  return {
    ok: false,
    error: "A payout is still with the provider. The settlement waits until that result is known. Nothing was refunded.",
  };
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

  const providerAdapter = await adapterForProvider(funding.providerCode, {
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
  const settlement = settlementFromSnapshot({
    feeSnapshot: funding.feeSnapshotJson,
    milestones: funding.milestones,
    activationEligible: funding.entries.some((entry) => entry.kind === "fee_eligible" && entry.milestoneId == null),
    activationException: activationExceptionForReason(input.reason),
    activationSettled: funding.entries.some((entry) => entry.kind === "fee_settled"),
    currentMilestoneId: input.currentMilestoneId,
    acceptedPartialCents: input.acceptedPartialCents,
  });
  if (settlement && !settlement.ok) return settlement;
  let proposal = settlement && settlement.ok ? settlement.proposal : null;
  if (proposal) {
    const latestRow = await prisma.fundingSettlement.findFirst({
      where: { fundingId: funding.id },
      orderBy: { versionNumber: "desc" },
    });
    const latestProposal = latestRow ? readSettlementProposal(latestRow.proposalJson) : null;
    const decision = settlementVersionDecision({
      latest: latestRow && latestProposal ? { versionNumber: latestRow.versionNumber, status: latestRow.status, proposal: latestProposal } : null,
      proposal,
    });
    if (decision.kind === "executed") {
      return { ok: false as const, error: "This settlement was already sent. Nothing was refunded again." };
    }
    if (
      latestRow &&
      memberReviewBlocksExecution({
        status: latestRow.status,
        proposalJson: latestRow.proposalJson,
        decisionKind: decision.kind,
        sameVersion: !decision.create,
      })
    ) {
      await prisma.auditLog
        .create({
          data: {
            actor: input.actor,
            action: "funding_settlement_review",
            objectType: "CollaborationFunding",
            objectId: funding.id,
            after: {
              reason: input.reason,
              versionNumber: latestRow.versionNumber,
              memberReview: true,
              refunded: false,
              note: input.note?.trim().slice(0, 500) || null,
            },
          },
        })
        .catch(() => undefined);
      return {
        ok: true as const,
        paymentRisk: false as const,
        calculation: calc,
        providerRefund: null,
        settlement: latestProposal ?? proposal,
        evidence: null as ChargebackEvidencePack | null,
      };
    }
    if (decision.supersede) {
      await prisma.fundingSettlement.updateMany({
        where: { fundingId: funding.id, status: { in: ["proposed", "accepted"] } },
        data: { status: "superseded" },
      });
    }
    if (decision.create) {
      await prisma.fundingSettlement.create({
        data: {
          fundingId: funding.id,
          versionNumber: decision.versionNumber,
          status: decision.kind === "execute" ? "accepted" : "proposed",
          proposalJson: decision.proposal,
          reason: input.reason,
          acceptedBy: decision.kind === "execute" ? input.actor : null,
        },
      });
    } else if (decision.kind === "execute" && latestRow && latestRow.status === "proposed") {
      await prisma.fundingSettlement.update({
        where: { id: latestRow.id },
        data: { status: "accepted", acceptedBy: input.actor },
      });
    }
    proposal = decision.proposal;
    if (decision.kind === "propose") {
      await prisma.auditLog
        .create({
          data: {
            actor: input.actor,
            action: "funding_settlement_review",
            objectType: "CollaborationFunding",
            objectId: funding.id,
            after: { reason: input.reason, proposal, versionNumber: decision.versionNumber, note: input.note?.trim().slice(0, 500) || null },
          },
        })
        .catch(() => undefined);
      return {
        ok: true as const,
        paymentRisk: false as const,
        calculation: calc,
        providerRefund: null,
        settlement: proposal,
        evidence: null as ChargebackEvidencePack | null,
      };
    }
  }
  const payoutBlock = cancellationPayoutBlock(funding.milestones);
  if (!payoutBlock.ok) {
    await prisma.auditLog
      .create({
        data: {
          actor: input.actor,
          action: "funding_settlement_review",
          objectType: "CollaborationFunding",
          objectId: funding.id,
          after: {
            reason: input.reason,
            proposal,
            payoutPending: true,
            note: input.note?.trim().slice(0, 500) || null,
          },
        },
      })
      .catch(() => undefined);
    return payoutBlock;
  }
  const refundCents = proposal ? proposal.businessRefundCents : calc.refundableFutureCents;
  if (refundCents > 0) {
    const { paymentChargeBlock } = await import("@/lib/payment-charge-switches");
    const charge = await paymentChargeBlock("cancellation_refund");
    if (!charge.ok) return charge;
  }
  if (proposal && refundCents > reconciled.heldCents) {
    return { ok: false as const, error: "The settlement refund is larger than the held amount. Nothing was refunded." };
  }
  let providerRefund: { ok: true; reference: string } | { ok: false; error: string } | null = null;
  if (refundCents > 0) {
    const { readSignedDealMoney, signedDealMoneyEvents, platformFeeEarningState } = await import("@/lib/payment-engine");
    const plan = (funding.feeSnapshotJson as { financialPlan?: unknown } | null)?.financialPlan;
    const signed = readSignedDealMoney(plan);
    if (signed) {
      const { getLaunchGate } = await import("@/lib/launch-gate");
      const launch = await getLaunchGate().catch(() => null);
      const posted = signedDealMoneyEvents({
        deal: signed,
        eventType: "payout.refunded",
        amountCents: refundCents,
        operationRefundCents: refundCents,
        alreadyRefundedCents: funding.entries
          .filter((entry) => entry.kind === "refund")
          .reduce((sum, entry) => sum + entry.amountCents, 0),
        policyApproved: Boolean(launch?.earningRefundPolicyApproved),
        finalPayout: false,
        alreadyEarned: platformFeeEarningState(funding.entries).earned,
        alreadyReturned: false,
        releasedCents: reconciled.releasedCents,
        payoutReturned: funding.entries.some((entry) => entry.kind === "return"),
      });
      if (!posted.ok) return { ok: false as const, error: posted.error };
    }
    providerRefund =
      refundCents >= reconciled.heldCents && reconciled.heldCents > 0
        ? await providerAdapter.createFullRefund({ fundingId: funding.id })
        : await providerAdapter.createPartialRefund({
            fundingId: funding.id,
            amountCents: refundCents,
            milestoneId: input.currentMilestoneId ?? undefined,
          });
  } else {
    providerRefund = await providerAdapter.cancelFunding(funding.id);
  }

  if (proposal && !(providerRefund && "ok" in providerRefund && providerRefund.ok === false)) {
    await prisma.fundingSettlement.updateMany({
      where: { fundingId: funding.id, status: "accepted" },
      data: { status: "executed" },
    });
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
          refundableFutureCents: refundCents,
          settlement: proposal,
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
    detail: `${CANCELLATION_REASON_LABELS[input.reason]}. Refundable held remainder ${refundCents}¢ queued with provider${
      providerRefund && "ok" in providerRefund && providerRefund.ok === false ? ` (${providerRefund.error})` : ""
    }. Ledger moves only on signed payout.refunded.`,
    processNow: false,
  });

  return {
    ok: true as const,
    paymentRisk: false as const,
    calculation: calc,
    providerRefund,
    settlement: proposal,
    evidence: null as ChargebackEvidencePack | null,
  };
}

/** Freezes the open proposal. The provider refund waits for a later execution of that version. */
export async function acceptFundingSettlement(input: { fundingId: string; actor: string }) {
  const fundingId = input.fundingId.trim();
  const row = await prisma.fundingSettlement.findFirst({
    where: { fundingId, status: "proposed" },
    orderBy: { versionNumber: "desc" },
  });
  if (!row) return { ok: false as const, error: "There is no settlement proposal to accept." };
  await prisma.fundingSettlement.update({
    where: { id: row.id },
    data: { status: "accepted", acceptedBy: input.actor },
  });
  await prisma.auditLog
    .create({
      data: {
        actor: input.actor,
        action: "funding_settlement_accepted",
        objectType: "CollaborationFunding",
        objectId: fundingId,
        after: { versionNumber: row.versionNumber },
      },
    })
    .catch(() => undefined);
  return { ok: true as const, versionNumber: row.versionNumber };
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
