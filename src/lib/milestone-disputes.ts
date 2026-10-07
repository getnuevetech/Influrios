import { prisma } from "@/lib/db";
import {
  canAddEvidence,
  canCancelUnconfirmed,
  canOpenMilestoneDispute,
  decideDispute,
  DISPUTE_REASON_CATALOG,
  disputeStatusAfterRefund,
  evidenceLink,
  type DisputeDecision,
} from "@/lib/disputes";

export type { DisputeDecision };
export {
  DISPUTE_REASON_CATALOG,
  DISPUTE_RESOLUTION_OUTCOME_LABELS,
  DISPUTE_RESOLUTION_OUTCOMES,
  outcomeForDecision,
} from "@/lib/disputes";
import { ledgerMovements, reconcileLedger, releasableCents } from "@/lib/ledger";

const OPEN = ["open", "under_review", "refund_requested", "escalated_provider", "escalated_legal"];

function fireCollabNotify(run: () => Promise<unknown>) {
  void run().catch(() => undefined);
}

let partialRefundsForTests: boolean | null = null;

/** Pins the partial-refund switch for one test without writing the shared settings row. */
export function setPartialRefundsForTests(enabled: boolean | null) {
  partialRefundsForTests = enabled;
}

/** Sync Dev §13 reason catalog by code; keep any admin custom reasons without codes. */
export async function ensureDisputeReasons() {
  await prisma.marketplaceSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", reviewWindowHours: 72 },
  });
  for (const row of DISPUTE_REASON_CATALOG) {
    const existing = await prisma.disputeReason.findUnique({ where: { code: row.code } });
    if (existing) {
      await prisma.disputeReason.update({
        where: { id: existing.id },
        data: { label: row.label, sortOrder: row.sortOrder, active: true },
      });
    } else {
      await prisma.disputeReason.create({
        data: {
          code: row.code,
          label: row.label,
          sortOrder: row.sortOrder,
          active: true,
        },
      });
    }
  }
  await prisma.marketplaceSettings.update({
    where: { id: "default" },
    data: { reasonsSeeded: true },
  });
}

export async function listDisputeReasons() {
  await ensureDisputeReasons();
  return prisma.disputeReason.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function saveDisputeReasons(rows: { id?: string; label: string; active: boolean; code?: string | null }[]) {
  await ensureDisputeReasons();
  const cleaned = rows
    .map((row, index) => ({
      id: row.id,
      code: row.code?.trim() || null,
      label: row.label.trim().slice(0, 120),
      active: row.active,
      sortOrder: index + 1,
    }))
    .filter((row) => row.label);
  if (cleaned.length === 0) throw new Error("Keep at least one dispute reason.");
  await prisma.$transaction(async (tx) => {
    const keep = new Set<string>();
    for (const row of cleaned) {
      if (row.id) {
        await tx.disputeReason.update({
          where: { id: row.id },
          data: {
            label: row.label,
            active: row.active,
            sortOrder: row.sortOrder,
            ...(row.code ? { code: row.code } : {}),
          },
        });
        keep.add(row.id);
      } else {
        const created = await tx.disputeReason.create({
          data: {
            label: row.label,
            active: row.active,
            sortOrder: row.sortOrder,
            code: row.code,
          },
        });
        keep.add(created.id);
      }
    }
    // Never delete catalog-coded reasons; deactivate instead if dropped from form.
    const coded = await tx.disputeReason.findMany({ where: { code: { not: null } } });
    for (const row of coded) {
      if (!keep.has(row.id)) {
        await tx.disputeReason.update({ where: { id: row.id }, data: { active: false } });
        keep.add(row.id);
      }
    }
    await tx.disputeReason.deleteMany({ where: { id: { notIn: [...keep] }, code: null } });
  });
}

export async function saveCancelPolicy(cancelUnconfirmed: boolean) {
  await prisma.marketplaceSettings.upsert({
    where: { id: "default" },
    update: { cancelUnconfirmed },
    create: { id: "default", reviewWindowHours: 72, cancelUnconfirmed },
  });
}

async function openDisputeOnMilestone(input: { fundingId: string; milestoneId: string; openedBy: string; reasonId: string; details: string }) {
  await ensureDisputeReasons();
  const [funding, reason, existing] = await Promise.all([
    prisma.collaborationFunding.findUnique({
      where: { id: input.fundingId },
      include: { milestones: true },
    }),
    prisma.disputeReason.findUnique({ where: { id: input.reasonId } }),
    prisma.milestoneDispute.findFirst({
      where: { fundingId: input.fundingId, milestoneId: input.milestoneId, status: { in: OPEN } },
    }),
  ]);
  const milestone = funding?.milestones.find((row) => row.id === input.milestoneId);
  const gate = canOpenMilestoneDispute({
    fundingStatus: funding?.status ?? "",
    milestoneStatus: milestone?.status ?? "",
    alreadyOpen: Boolean(existing),
    hasReason: Boolean(reason?.active),
  });
  if (!gate.ok) return gate;
  const details = input.details.trim().slice(0, 2000);
  if (details.length < 8) return { ok: false as const, error: "Describe the dispute in a sentence." };
  const settings = await prisma.marketplaceSettings.findUnique({ where: { id: "default" } });
  const dispute = await prisma.milestoneDispute.create({
    data: {
      fundingId: funding!.id,
      milestoneId: milestone!.id,
      openedBy: input.openedBy,
      reasonLabel: reason!.label,
      reasonCode: reason!.code ?? null,
      details,
      status: "open",
      evidenceLimit: settings?.maxEvidence ?? 5,
    },
  });
  await prisma.auditLog.create({
    data: {
      actor: input.openedBy,
      action: "dispute_opened",
      objectType: "MilestoneDispute",
      objectId: dispute.id,
      after: {
        fundingId: funding!.id,
        milestoneId: milestone!.id,
        reason: reason!.label,
        reasonCode: reason!.code ?? null,
      },
    },
  }).catch(() => undefined);
  fireCollabNotify(async () => {
    const { notifyCollabFundingEvent } = await import("@/lib/jobs");
    await notifyCollabFundingEvent({
      fundingId: funding!.id,
      kind: "dispute_opened",
      milestone: milestone!.title,
      detail: reason!.label,
    });
  });
  return { ok: true as const, id: dispute.id };
}

export function openMilestoneDispute(input: {
  fundingId: string;
  milestoneId: string;
  openedBy: "business" | "creator" | "ops";
  reasonId: string;
  details: string;
}) {
  return openDisputeOnMilestone(input);
}

export async function cancelUnconfirmedFunding(fundingId: string) {
  const [settings, funding] = await Promise.all([
    prisma.marketplaceSettings.findUnique({ where: { id: "default" } }),
    prisma.collaborationFunding.findUnique({ where: { id: fundingId } }),
  ]);
  const gate = canCancelUnconfirmed({
    fundingStatus: funding?.status ?? "",
    cancelUnconfirmed: settings?.cancelUnconfirmed ?? true,
  });
  if (!gate.ok) return gate;
  const updated = await prisma.collaborationFunding.updateMany({
    where: { id: fundingId, status: "awaiting_provider" },
    data: { status: "cancelled" },
  });
  if (updated.count !== 1) return { ok: false as const, error: "This prefund can no longer be cancelled." };
  await prisma.auditLog.create({
    data: {
      actor: "payments",
      action: "prefund_cancelled",
      objectType: "CollaborationFunding",
      objectId: fundingId,
      after: { status: "cancelled" },
    },
  }).catch(() => undefined);
  fireCollabNotify(async () => {
    const { notifyCollabFundingEvent } = await import("@/lib/jobs");
    await notifyCollabFundingEvent({
      fundingId,
      kind: "collaboration_cancelled",
      detail: "Unconfirmed prefund cancelled before provider hold.",
    });
  });
  return { ok: true as const };
}

export async function listMilestoneDisputes() {
  await ensureDisputeReasons();
  return prisma.milestoneDispute.findMany({
    orderBy: { createdAt: "desc" },
    include: { funding: true, milestone: true, notes: { orderBy: { createdAt: "asc" } } },
    take: 50,
  });
}

export async function milestoneHasOpenDispute(fundingId: string, milestoneId: string) {
  const row = await prisma.milestoneDispute.findFirst({
    where: {
      fundingId,
      status: { in: OPEN },
      OR: [{ milestoneId }, { milestoneId: null }],
    },
  });
  return Boolean(row);
}

export async function decideMilestoneDispute(input: {
  disputeId: string;
  action: DisputeDecision;
  requestedCents?: number;
  note?: string;
  actor: string;
}) {
  const dispute = await prisma.milestoneDispute.findUnique({
    where: { id: input.disputeId },
    include: { funding: { include: { entries: true } }, milestone: true },
  });
  if (!dispute || !dispute.milestone) return { ok: false as const, error: "Dispute not found." };
  const settings = await prisma.marketplaceSettings.findUnique({ where: { id: "default" } });
  const held = reconcileLedger(ledgerMovements(dispute.funding.entries), dispute.funding.grossCents);
  const decision = decideDispute({
    status: dispute.status,
    action: input.action,
    requestedCents: input.requestedCents ?? 0,
    heldCents: held.heldCents,
    milestoneCents: releasableCents(dispute.milestone.amountCents, dispute.milestone.refundedCents),
    partialAllowed: partialRefundsForTests ?? settings?.partialRefundsEnabled ?? true,
  });
  if (!decision.ok) return decision;
  await prisma.milestoneDispute.update({
    where: { id: dispute.id },
    data: {
      status: decision.status,
      requestedRefundCents: decision.requestedRefundCents,
      resolutionNote: input.note?.trim().slice(0, 500) || dispute.resolutionNote,
      resolutionOutcome: decision.outcome ?? dispute.resolutionOutcome,
    },
  });
  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: `dispute_${input.action}`,
      objectType: "MilestoneDispute",
      objectId: dispute.id,
      after: {
        status: decision.status,
        requestedRefundCents: decision.requestedRefundCents,
        resolutionOutcome: decision.outcome,
      },
    },
  }).catch(() => undefined);
  if (
    decision.status === "resolved_release" ||
    decision.status === "resolved_settlement" ||
    decision.status === "withdrawn"
  ) {
    fireCollabNotify(async () => {
      const { notifyCollabFundingEvent } = await import("@/lib/jobs");
      await notifyCollabFundingEvent({
        fundingId: dispute.fundingId,
        kind: "dispute_resolved",
        milestone: dispute.milestone?.title ?? "Milestone",
        detail: input.note?.trim() || decision.outcome || decision.status,
      });
    });
  }
  // Queue provider refund instruction after refund/partial decisions — cash still waits for payout.refunded.
  if (input.action === "refund" || input.action === "partial") {
    const { adapterForProvider } = await import("@/lib/payment-provider-adapter");
    const { verifyMarketplaceSignature } = await import("@/lib/ledger");
    const adapter = await adapterForProvider(dispute.funding.providerCode, {
      verifySignature: verifyMarketplaceSignature,
    });
    const amount =
      input.action === "partial"
        ? (decision.requestedRefundCents ?? input.requestedCents ?? 0)
        : releasableCents(dispute.milestone.amountCents, dispute.milestone.refundedCents);
    const instruction =
      input.action === "partial"
        ? await adapter.createPartialRefund({
            fundingId: dispute.fundingId,
            amountCents: amount,
            milestoneId: dispute.milestoneId ?? undefined,
          })
        : amount >= held.heldCents && held.heldCents > 0
          ? await adapter.createFullRefund({ fundingId: dispute.fundingId })
          : await adapter.createPartialRefund({
              fundingId: dispute.fundingId,
              amountCents: amount,
              milestoneId: dispute.milestoneId ?? undefined,
            });
    await prisma.auditLog
      .create({
        data: {
          actor: input.actor,
          action: "dispute_provider_refund_instruction",
          objectType: "MilestoneDispute",
          objectId: dispute.id,
          after: { instruction, amountCents: amount },
        },
      })
      .catch(() => undefined);
  }
  return { ok: true as const, status: decision.status, outcome: decision.outcome };
}

export async function addDisputeEvidence(input: {
  disputeId: string;
  fundingId?: string;
  author: "business" | "creator" | "ops";
  body: string;
  url?: string;
}) {
  const text = input.body.trim().slice(0, 2000);
  if (text.length < 8) return { ok: false as const, error: "Add a sentence of evidence." };
  const link = evidenceLink(input.url ?? "");
  if (!link.ok) return link;
  const stored = await prisma.$transaction(async (tx) => {
    const dispute = await tx.milestoneDispute.findUnique({
      where: { id: input.disputeId },
      include: { _count: { select: { notes: true } }, funding: { select: { id: true } } },
    });
    if (!dispute) return { ok: false as const, error: "Dispute not found." };
    if (input.fundingId && dispute.fundingId !== input.fundingId) {
      return { ok: false as const, error: "That dispute is not on this prefund." };
    }
    const gate = canAddEvidence({
      status: dispute.status,
      evidenceCount: dispute._count.notes,
      evidenceLimit: dispute.evidenceLimit,
    });
    if (!gate.ok) return gate;
    await tx.disputeNote.create({
      data: {
        disputeId: dispute.id,
        author: input.author,
        body: text,
        url: link.url,
      },
    });
    return { ok: true as const, evidenceLimit: dispute.evidenceLimit };
  });
  if (!stored.ok) return stored;
  await prisma.auditLog
    .create({
      data: {
        actor: input.author,
        action: "dispute_evidence",
        objectType: "MilestoneDispute",
        objectId: input.disputeId,
        after: { evidenceLimit: stored.evidenceLimit, hasLink: Boolean(link.url) },
      },
    })
    .catch(() => undefined);
  return { ok: true as const };
}

export async function closeDisputesForRefund(input: {
  fundingId: string;
  milestoneId?: string | null;
  refundedCents: number;
}) {
  const disputes = await prisma.milestoneDispute.findMany({
    where: {
      fundingId: input.fundingId,
      status: "refund_requested",
      ...(input.milestoneId ? { milestoneId: input.milestoneId } : {}),
    },
    include: { milestone: true },
  });
  for (const dispute of disputes) {
    const next = disputeStatusAfterRefund({
      requestedCents: dispute.requestedRefundCents,
      refundedCents: input.refundedCents,
      milestoneCents: dispute.milestone?.amountCents ?? input.refundedCents,
    });
    if (!next) continue;
    await prisma.milestoneDispute.update({ where: { id: dispute.id }, data: { status: next } });
    fireCollabNotify(async () => {
      const { notifyCollabFundingEvent } = await import("@/lib/jobs");
      await notifyCollabFundingEvent({
        fundingId: input.fundingId,
        kind: "dispute_resolved",
        milestone: dispute.milestone?.title,
        detail: next,
      });
    });
  }
}
