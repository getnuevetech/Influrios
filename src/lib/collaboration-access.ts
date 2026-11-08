/**
 * Party checks for a collaboration proposal.
 * The actor id is never authority by itself: the caller must match an owning relation.
 */

export type CollaborationParty = {
  initiatorUserId?: string | null;
  initiatorSlug: string;
  recipientSlug: string;
  status: string;
};

export type CollaborationActor = {
  userId: string;
  creatorSlug?: string | null;
};

export type CollaborationRole = "initiator" | "recipient";

export function collaborationRoles(record: CollaborationParty, actor: CollaborationActor): CollaborationRole[] {
  const roles: CollaborationRole[] = [];
  const slug = (actor.creatorSlug ?? "").trim();
  const userId = actor.userId.trim();
  if (userId && record.initiatorUserId && record.initiatorUserId === userId) roles.push("initiator");
  if (slug && slug === record.initiatorSlug.trim()) roles.push("initiator");
  if (slug && slug === record.recipientSlug.trim()) roles.push("recipient");
  return [...new Set(roles)];
}

export function canReadCollaboration(record: CollaborationParty, actor: CollaborationActor): boolean {
  return collaborationRoles(record, actor).length > 0;
}

/** Initiator sends or withdraws. Recipient accepts or declines. The sender cannot accept. */
export function allowedCollaborationMoves(record: CollaborationParty, actor: CollaborationActor): string[] {
  const roles = collaborationRoles(record, actor);
  const moves = new Set<string>();
  if (roles.includes("initiator")) {
    if (record.status === "draft") {
      moves.add("sent");
      moves.add("withdrawn");
    }
    if (record.status === "sent") moves.add("withdrawn");
  }
  if (roles.includes("recipient") && record.status === "sent" && !roles.includes("initiator")) {
    moves.add("accepted");
    moves.add("declined");
  }
  if (roles.includes("recipient") && roles.includes("initiator") && record.status === "sent") {
    // Same account on both sides still cannot accept its own invitation.
    moves.delete("accepted");
    moves.delete("declined");
  }
  return [...moves];
}

export function collaborationMoveAllowed(
  record: CollaborationParty,
  actor: CollaborationActor,
  to: string,
): { ok: true } | { ok: false; error: string } {
  if (!canReadCollaboration(record, actor)) {
    return { ok: false, error: "You cannot update this proposal." };
  }
  if (!allowedCollaborationMoves(record, actor).includes(to)) {
    if (to === "accepted" || to === "declined") {
      return { ok: false, error: "Only the recipient can accept or decline this proposal." };
    }
    return { ok: false, error: "That status is not available for your role." };
  }
  return { ok: true };
}
