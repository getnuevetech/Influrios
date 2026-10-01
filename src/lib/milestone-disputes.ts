import { prisma } from "@/lib/db";
import {
  canAddEvidence,
  canCancelUnconfirmed,
  canOpenMilestoneDispute,
  decideDispute,
  disputeStatusAfterRefund,
  evidenceLink,
  type DisputeDecision,
} from "@/lib/disputes";

export type { DisputeDecision };
import { ledgerMovements, reconcileLedger } from "@/lib/ledger";

const OPEN = ["open", "under_review", "refund_requested"];

export async function ensureDisputeReasons() {
  await prisma.marketplaceSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", reviewWindowHours: 72 },
  });
  const settings = await prisma.marketplaceSettings.findUnique({ where: { id: "default" } });
  if (settings?.reasonsSeeded) return;
  await prisma.$transaction(async (tx) => {
    const current = await tx.marketplaceSettings.findUnique({ where: { id: "default" } });
    if (current?.reasonsSeeded) return;
    const count = await tx.disputeReason.count();
    if (count === 0) {
      await tx.disputeReason.createMany({
        data: [
          { label: "Deliverable does not match the brief", sortOrder: 1, active: true },
          { label: "Work was not delivered", sortOrder: 2, active: true },
          { label: "Cancel the remaining balance", sortOrder: 3, active: true },
        ],
      });
    }
    await tx.marketplaceSettings.update({ where: { id: "default" }, data: { reasonsSeeded: true } });
  });
}

export async function listDisputeReasons() {
  await ensureDisputeReasons();
  return prisma.disputeReason.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function saveDisputeReasons(rows: { id?: string; label: string; active: boolean }[]) {
  await ensureDisputeReasons();
  const cleaned = rows
    .map((row, index) => ({
      id: row.id,
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
          data: { label: row.label, active: row.active, sortOrder: row.sortOrder },
        });
        keep.add(row.id);
      } else {
        const created = await tx.disputeReason.create({
          data: { label: row.label, active: row.active, sortOrder: row.sortOrder },
        });
        keep.add(created.id);
      }
    }
    await tx.disputeReason.deleteMany({ where: { id: { notIn: [...keep] } } });
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
      after: { fundingId: funding!.id, milestoneId: milestone!.id, reason: reason!.label },
    },
  }).catch(() => undefined);
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
  const held = reconcileLedger(ledgerMovements(dispute.funding.entries), dispute.funding.grossCents);
  const decision = decideDispute({
    status: dispute.status,
    action: input.action,
    requestedCents: input.requestedCents ?? 0,
    heldCents: held.heldCents,
    milestoneCents: dispute.milestone.amountCents,
  });
  if (!decision.ok) return decision;
  await prisma.milestoneDispute.update({
    where: { id: dispute.id },
    data: {
      status: decision.status,
      requestedRefundCents: decision.requestedRefundCents,
      resolutionNote: input.note?.trim().slice(0, 500) || dispute.resolutionNote,
    },
  });
  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: `dispute_${input.action}`,
      objectType: "MilestoneDispute",
      objectId: dispute.id,
      after: { status: decision.status, requestedRefundCents: decision.requestedRefundCents },
    },
  }).catch(() => undefined);
  return { ok: true as const, status: decision.status };
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
  }
}
