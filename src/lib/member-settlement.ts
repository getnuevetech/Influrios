/**
 * Member cancellation review. Parties can request, accept, question, or dispute a
 * proposal version. None of these actions send a refund or call a payment provider.
 * Finance still executes an accepted version through the existing held-cancellation path.
 */

import { prisma } from "@/lib/db";
import { CANCELLATION_REASON_LABELS, type CancellationReason } from "@/lib/cancellation-matrix";
import { cancellationPayoutBlock, isCancellationReason } from "@/lib/collaboration-cancellation";
import {
  activationExceptionForReason,
  readSettlementProposal,
  settlementFromSnapshot,
  settlementVersionDecision,
  type SettlementProposal,
} from "@/lib/cancellation-settlement";

export type SettlementParty = "business" | "influencer";

export type PartyAcceptances = { business?: string; influencer?: string };

export type SettlementQuestion = { party: SettlementParty; body: string };

const MEMBER_REASONS: Record<SettlementParty, CancellationReason[]> = {
  business: ["brand_before_start", "brand_after_start", "partial_delivery_accepted"],
  influencer: ["creator_without_cause", "partial_delivery_accepted"],
};

export function memberCancellationReasons(party: SettlementParty) {
  return MEMBER_REASONS[party].map((id) => ({ id, label: CANCELLATION_REASON_LABELS[id] }));
}

function proposalRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

export function readPartyAcceptances(value: unknown): PartyAcceptances {
  const row = proposalRecord(value).acceptances;
  if (!row || typeof row !== "object" || Array.isArray(row)) return {};
  const record = row as Record<string, unknown>;
  return {
    business: typeof record.business === "string" && record.business.trim() ? record.business.trim() : undefined,
    influencer: typeof record.influencer === "string" && record.influencer.trim() ? record.influencer.trim() : undefined,
  };
}

export function readSettlementDisputed(value: unknown) {
  return proposalRecord(value).disputed === true;
}

export function readSettlementDisputeNote(value: unknown) {
  const note = proposalRecord(value).disputeNote;
  return typeof note === "string" && note.trim() ? note.trim() : null;
}

export function readSettlementQuestions(value: unknown): SettlementQuestion[] {
  const rows = proposalRecord(value).questions;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if ((row.party !== "business" && row.party !== "influencer") || typeof row.body !== "string" || !row.body.trim()) return [];
    return [{ party: row.party, body: row.body.trim() }];
  });
}

/** A member request is always a proposal, including when the matrix would auto-settle. */
export function memberSettlementProposal(proposal: SettlementProposal): SettlementProposal {
  return { ...proposal, automatic: false };
}

export function memberProposalDecision(input: {
  latest: { versionNumber: number; status: string; proposal: SettlementProposal } | null;
  proposal: SettlementProposal;
}) {
  const decision = settlementVersionDecision({
    latest: input.latest,
    proposal: memberSettlementProposal(input.proposal),
  });
  if (decision.kind === "executed") return decision;
  return {
    kind: "propose" as const,
    versionNumber: decision.versionNumber,
    supersede: decision.supersede,
    create: decision.create,
    proposal: memberSettlementProposal(decision.proposal),
  };
}

export function applyPartyAcceptance(input: {
  status: string;
  versionNumber: number;
  requestedVersion: number;
  party: SettlementParty;
  actor: string;
  acceptances: PartyAcceptances;
  disputed: boolean;
}):
  | { ok: true; status: "proposed" | "accepted"; acceptances: PartyAcceptances; both: boolean }
  | { ok: false; error: string } {
  if (input.status === "executed") {
    return { ok: false, error: "This settlement was already sent. Nothing was refunded again." };
  }
  if (input.status === "superseded" || input.versionNumber !== input.requestedVersion) {
    return { ok: false, error: "This proposal version is no longer current. Nothing was refunded." };
  }
  if (input.status !== "proposed" && input.status !== "accepted") {
    return { ok: false, error: "This proposal is not open for acceptance. Nothing was refunded." };
  }
  if (input.disputed) {
    return { ok: false, error: "This proposal is disputed. A new version is required before anyone can accept it. Nothing was refunded." };
  }
  const actor = input.actor.trim();
  if (!actor) return { ok: false, error: "Your account could not be recorded. Nothing was refunded." };
  const acceptances: PartyAcceptances = { ...input.acceptances, [input.party]: actor };
  const both = Boolean(acceptances.business && acceptances.influencer);
  return { ok: true, status: both ? "accepted" : "proposed", acceptances, both };
}

export function settlementQuestionDraft(input: {
  status: string;
  versionNumber: number;
  requestedVersion: number;
  party: SettlementParty;
  body: string;
}): { ok: true; question: SettlementQuestion } | { ok: false; error: string } {
  if (input.status === "executed" || input.status === "superseded" || input.versionNumber !== input.requestedVersion) {
    return { ok: false, error: "This proposal version is no longer current. Nothing was refunded." };
  }
  if (input.status !== "proposed" && input.status !== "accepted") {
    return { ok: false, error: "There is no open proposal to ask about. Nothing was refunded." };
  }
  const body = input.body.trim().slice(0, 500);
  if (body.length < 8) return { ok: false, error: "Write the question you want the other party to see. Nothing was refunded." };
  return { ok: true, question: { party: input.party, body } };
}

export function disputeProposalDraft(input: {
  status: string;
  versionNumber: number;
  requestedVersion: number;
  note: string;
}): { ok: true; note: string } | { ok: false; error: string } {
  if (input.status === "executed") {
    return { ok: false, error: "This settlement was already sent. Nothing was refunded again." };
  }
  if (input.status !== "proposed" || input.versionNumber !== input.requestedVersion) {
    return { ok: false, error: "This proposal version is no longer current. Nothing was refunded." };
  }
  const note = input.note.trim().slice(0, 500);
  if (note.length < 8) return { ok: false, error: "Describe the dispute. Nothing was refunded." };
  return { ok: true, note };
}

function memberReason(party: SettlementParty, reason: string): CancellationReason | null {
  if (!isCancellationReason(reason) || reason === "chargeback") return null;
  return MEMBER_REASONS[party].includes(reason) ? reason : null;
}

async function latestSettlement(fundingId: string) {
  return prisma.fundingSettlement.findFirst({
    where: { fundingId },
    orderBy: { versionNumber: "desc" },
  });
}

export async function requestMemberCancellation(input: {
  fundingId: string;
  party: SettlementParty;
  actor: string;
  reason: string;
  note?: string;
}) {
  const reason = memberReason(input.party, input.reason);
  if (!reason) return { ok: false as const, error: "Choose a cancellation reason for your role. Nothing was refunded." };
  const funding = await prisma.collaborationFunding.findUnique({
    where: { id: input.fundingId },
    include: { milestones: { orderBy: { sortOrder: "asc" } }, entries: true },
  });
  if (!funding) return { ok: false as const, error: "Prefund not found." };
  if (funding.status === "awaiting_provider") {
    return { ok: false as const, error: "This prefund is not confirmed. Cancel the future obligation instead. Nothing was refunded." };
  }
  if (funding.status !== "held") {
    return { ok: false as const, error: "A settlement proposal applies after the provider confirms the hold. Nothing was refunded." };
  }
  const payout = cancellationPayoutBlock(funding.milestones);
  if (!payout.ok) return payout;
  const settlement = settlementFromSnapshot({
    feeSnapshot: funding.feeSnapshotJson,
    milestones: funding.milestones,
    activationEligible: funding.entries.some((entry) => entry.kind === "fee_eligible" && entry.milestoneId == null),
    activationException: activationExceptionForReason(reason),
    activationSettled: funding.entries.some((entry) => entry.kind === "fee_settled"),
  });
  if (!settlement) return { ok: false as const, error: "This agreement has no frozen fee snapshot. Nothing was refunded." };
  if (!settlement.ok) return settlement;

  const latestRow = await latestSettlement(funding.id);
  const latestProposal = latestRow ? readSettlementProposal(latestRow.proposalJson) : null;
  const decision = memberProposalDecision({
    latest:
      latestRow && latestProposal
        ? { versionNumber: latestRow.versionNumber, status: latestRow.status, proposal: latestProposal }
        : null,
    proposal: settlement.proposal,
  });
  if (decision.kind === "executed") {
    return { ok: false as const, error: "This settlement was already sent. Nothing was refunded again." };
  }
  if (!decision.create && latestRow?.status === "accepted") {
    return { ok: true as const, versionNumber: latestRow.versionNumber, status: "accepted" as const, refunded: false as const };
  }
  if (!decision.create && latestRow?.status === "proposed") {
    return { ok: true as const, versionNumber: latestRow.versionNumber, status: "proposed" as const, refunded: false as const };
  }
  if (decision.supersede) {
    await prisma.fundingSettlement.updateMany({
      where: { fundingId: funding.id, status: { in: ["proposed", "accepted"] } },
      data: { status: "superseded" },
    });
  }
  if (!decision.create) {
    return { ok: false as const, error: "This proposal could not be recorded. Nothing was refunded." };
  }
  await prisma.fundingSettlement.create({
    data: {
      fundingId: funding.id,
      versionNumber: decision.versionNumber,
      status: "proposed",
      proposalJson: {
        ...decision.proposal,
        acceptances: {},
        disputed: false,
        memberReview: true,
        reasonNote: input.note?.trim().slice(0, 500) || null,
        questions: [],
      },
      reason,
      acceptedBy: null,
    },
  });
  await prisma.auditLog
    .create({
      data: {
        actor: input.actor,
        action: "funding_settlement_requested",
        objectType: "CollaborationFunding",
        objectId: funding.id,
        after: { reason, versionNumber: decision.versionNumber, refunded: false },
      },
    })
    .catch(() => undefined);
  return { ok: true as const, versionNumber: decision.versionNumber, status: "proposed" as const, refunded: false as const };
}

export async function acceptMemberSettlement(input: {
  fundingId: string;
  party: SettlementParty;
  actor: string;
  versionNumber: number;
}) {
  const row = await latestSettlement(input.fundingId);
  if (!row) return { ok: false as const, error: "No cancellation proposal is open. Nothing was refunded." };
  const decision = applyPartyAcceptance({
    status: row.status,
    versionNumber: row.versionNumber,
    requestedVersion: input.versionNumber,
    party: input.party,
    actor: input.actor,
    acceptances: readPartyAcceptances(row.proposalJson),
    disputed: readSettlementDisputed(row.proposalJson),
  });
  if (!decision.ok) return decision;
  await prisma.fundingSettlement.update({
    where: { id: row.id },
    data: {
      status: decision.status,
      proposalJson: { ...proposalRecord(row.proposalJson), acceptances: decision.acceptances },
      acceptedBy: decision.both
        ? `${decision.acceptances.business} + ${decision.acceptances.influencer}`
        : (decision.acceptances[input.party] ?? input.actor),
    },
  });
  await prisma.auditLog
    .create({
      data: {
        actor: input.actor,
        action: "funding_settlement_party_accepted",
        objectType: "CollaborationFunding",
        objectId: input.fundingId,
        after: { versionNumber: row.versionNumber, party: input.party, status: decision.status, refunded: false },
      },
    })
    .catch(() => undefined);
  return { ok: true as const, status: decision.status, both: decision.both, refunded: false as const };
}

export async function questionMemberSettlement(input: {
  fundingId: string;
  party: SettlementParty;
  actor: string;
  versionNumber: number;
  body: string;
}) {
  const row = await latestSettlement(input.fundingId);
  if (!row) return { ok: false as const, error: "No cancellation proposal is open. Nothing was refunded." };
  const draft = settlementQuestionDraft({
    status: row.status,
    versionNumber: row.versionNumber,
    requestedVersion: input.versionNumber,
    party: input.party,
    body: input.body,
  });
  if (!draft.ok) return draft;
  const questions = [...readSettlementQuestions(row.proposalJson), draft.question].slice(-12);
  await prisma.fundingSettlement.update({
    where: { id: row.id },
    data: { proposalJson: { ...proposalRecord(row.proposalJson), questions } },
  });
  await prisma.auditLog
    .create({
      data: {
        actor: input.actor,
        action: "funding_settlement_question",
        objectType: "CollaborationFunding",
        objectId: input.fundingId,
        after: { versionNumber: row.versionNumber, party: input.party, refunded: false },
      },
    })
    .catch(() => undefined);
  return { ok: true as const, refunded: false as const };
}

export async function disputeMemberSettlement(input: {
  fundingId: string;
  party: SettlementParty;
  actor: string;
  versionNumber: number;
  note: string;
}) {
  const row = await latestSettlement(input.fundingId);
  if (!row) return { ok: false as const, error: "No cancellation proposal is open. Nothing was refunded." };
  const draft = disputeProposalDraft({
    status: row.status,
    versionNumber: row.versionNumber,
    requestedVersion: input.versionNumber,
    note: input.note,
  });
  if (!draft.ok) return draft;
  await prisma.fundingSettlement.update({
    where: { id: row.id },
    data: {
      status: "proposed",
      proposalJson: {
        ...proposalRecord(row.proposalJson),
        disputed: true,
        disputeNote: draft.note,
        disputedBy: input.party,
      },
    },
  });
  await prisma.auditLog
    .create({
      data: {
        actor: input.actor,
        action: "funding_settlement_disputed",
        objectType: "CollaborationFunding",
        objectId: input.fundingId,
        after: { versionNumber: row.versionNumber, party: input.party, refunded: false },
      },
    })
    .catch(() => undefined);
  return { ok: true as const, status: "proposed" as const, refunded: false as const };
}
