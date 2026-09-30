"use server";

import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { advanceCollaboration, getCollaboration, isCollaborationStatus } from "@/lib/collaborations";
import { queueSignatureRequest } from "@/lib/providers";

export async function actionAdvanceCollaboration(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("to") ?? "");
  const back = `/collaboration/records/${id}`;
  const account = await getAccountSession();
  if (!account) redirect(`/login?next=${encodeURIComponent(back)}&gate=proposal`);
  if (!isCollaborationStatus(to) || to === "draft") {
    redirect(`${back}?error=${encodeURIComponent("That status is not available.")}`);
  }
  const result = await advanceCollaboration({
    id,
    to,
    actorUserId: account.id,
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
  const result = await queueSignatureRequest({
    collaborationId: record.id,
    collaborationStatus: record.status,
    title: record.title,
  });
  if (!result.ok) redirect(`${back}?error=${encodeURIComponent(result.error)}`);
  redirect(back);
}
