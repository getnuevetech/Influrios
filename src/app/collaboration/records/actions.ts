"use server";

import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { advanceCollaboration, isCollaborationStatus } from "@/lib/collaborations";

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
