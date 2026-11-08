"use server";

import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { canReadCollaboration } from "@/lib/collaboration-access";
import { getCreatorSessionDraft } from "@/lib/claim";
import { advanceCollaboration, getCollaboration, isCollaborationStatus } from "@/lib/collaborations";
import { prisma } from "@/lib/db";
import { queueSignatureRequest } from "@/lib/providers";

async function actorForAccount(userId: string) {
  const [draft, creator] = await Promise.all([
    getCreatorSessionDraft().catch(() => null),
    prisma.creator.findUnique({ where: { userId }, select: { slug: true } }).catch(() => null),
  ]);
  return { userId, creatorSlug: creator?.slug || draft?.slug || null };
}

export async function actionAdvanceCollaboration(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("to") ?? "");
  const back = `/collaboration/records/${id}`;
  const account = await getAccountSession();
  if (!account) redirect(`/login?next=${encodeURIComponent(back)}&gate=proposal`);
  if (!isCollaborationStatus(to) || to === "draft") {
    redirect(`${back}?error=${encodeURIComponent("That status is not available.")}`);
  }
  const actor = await actorForAccount(account.id);
  const result = await advanceCollaboration({
    id,
    to,
    actorUserId: actor.userId,
    actorSlug: actor.creatorSlug,
    note: "member",
    enforceLimit: true,
  });
  if (!result.ok) redirect(`${back}?error=${encodeURIComponent(result.error)}`);
  redirect(back);
}

export async function actionQueueSignature(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const back = `/collaboration/records/${id}`;
  const account = await getAccountSession();
  if (!account) redirect(`/login?next=${encodeURIComponent(back)}&gate=proposal`);
  const record = await getCollaboration(id).catch(() => null);
  if (!record) redirect(`${back}?error=${encodeURIComponent("That proposal was not found.")}`);
  const actor = await actorForAccount(account.id);
  if (!canReadCollaboration(record, actor)) {
    redirect(`${back}?error=${encodeURIComponent("You cannot update this proposal.")}`);
  }
  const result = await queueSignatureRequest({
    collaborationId: record.id,
    collaborationStatus: record.status,
    title: record.title,
  });
  if (!result.ok) redirect(`${back}?error=${encodeURIComponent(result.error)}`);
  redirect(back);
}
