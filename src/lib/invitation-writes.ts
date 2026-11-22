import { prisma } from "@/lib/db";
import {
  invitationState,
  NOT_ALLOWED_NOW,
  planBusinessAnswer,
  planInviteeResponse,
  type InvitationState,
  type InviteeIntent,
  type PlannedChange,
} from "@/lib/invitation-turn";

export class InvitationRejected extends Error {
  constructor(message = NOT_ALLOWED_NOW) {
    super(message);
    this.name = "InvitationRejected";
  }
}

/**
 * Persist a planned §2.2b change. The write is conditional on the state we planned from, so a
 * concurrent withdrawal, expiry or second submission is rejected instead of overwritten.
 */
async function persist(
  id: string,
  from: InvitationState,
  plan: PlannedChange,
  actorUserId: string,
  eventNote: string,
) {
  return prisma.$transaction(async (tx) => {
    const changed = await tx.marketplaceApplication.updateMany({
      where: {
        id,
        status: from.status,
        turn: from.turn,
        interestRecorded: from.interestRecorded,
        openQuestion: from.openQuestion,
      },
      data: {
        status: plan.next.status,
        turn: plan.next.turn,
        interestRecorded: plan.next.interestRecorded,
        openQuestion: plan.next.openQuestion,
      },
    });
    if (changed.count !== 1) throw new InvitationRejected();
    let previous = from.status;
    const steps = plan.steps.length ? plan.steps : [from.status];
    for (const [index, step] of steps.entries()) {
      const last = index === steps.length - 1;
      await tx.marketplaceApplicationEvent.create({
        data: {
          applicationId: id,
          fromStatus: previous,
          toStatus: step,
          actorUserId,
          note: last ? eventNote : "Opened from the invitation",
        },
      });
      previous = step;
    }
    return tx.marketplaceApplication.findUniqueOrThrow({ where: { id } });
  });
}

const INTENT_NOTE: Record<InviteeIntent, string> = {
  interested: "Interested",
  question: "Question",
  decline: "Declined",
};

/** Invitee response (popup and detail page share this). Never accepts work. */
export async function recordInviteeResponse(input: {
  id: string;
  actorUserId: string;
  intent: InviteeIntent;
  note?: string | null;
  now?: Date;
}) {
  const row = await prisma.marketplaceApplication.findUnique({ where: { id: input.id } });
  if (!row) throw new InvitationRejected("Invitation not found.");
  const from = invitationState(row);
  const plan = planInviteeResponse(from, input.intent, { responseDeadline: row.responseDeadline, now: input.now });
  if (!plan) throw new InvitationRejected();
  if (plan.steps.some((step) => step === "ACCEPTED" || step === "COLLABORATION_DRAFTED")) {
    throw new InvitationRejected("A response cannot accept this invitation.");
  }
  const text = (input.note ?? "").trim().slice(0, 500);
  if (input.intent === "question" && text.length < 8) {
    throw new InvitationRejected("Write the question you want the business to see.");
  }
  const label = input.intent === "question" && from.interestRecorded ? "Follow-up question" : INTENT_NOTE[input.intent];
  return persist(input.id, from, plan, input.actorUserId, text ? `${label}: ${text}` : label);
}

/** Business answers the open question (§2.2b: case 2 → 3, case 5 → 6). */
export async function recordBusinessAnswer(input: { id: string; actorUserId: string; answer: string; now?: Date }) {
  const row = await prisma.marketplaceApplication.findUnique({ where: { id: input.id } });
  if (!row) throw new InvitationRejected("Invitation not found.");
  const from = invitationState(row);
  const plan = planBusinessAnswer(from, { responseDeadline: row.responseDeadline, now: input.now });
  if (!plan) throw new InvitationRejected("There's no open question to answer on this invitation.");
  const text = input.answer.trim().slice(0, 1000);
  if (text.length < 2) throw new InvitationRejected("Write your answer.");
  return persist(input.id, from, plan, input.actorUserId, `Answer: ${text}`);
}
