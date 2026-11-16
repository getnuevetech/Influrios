"use server";

import { revalidatePath } from "next/cache";
import { getAccountSession } from "@/lib/accounts";
import { replyOnThread } from "@/lib/message-inbox";

export async function actionReplyToThread(formData: FormData) {
  const account = await getAccountSession().catch(() => null);
  if (!account) return { ok: false as const, error: "Sign in to reply." };
  const result = await replyOnThread({
    account,
    threadId: String(formData.get("threadId") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  if (!result.ok) return result;
  revalidatePath("/creator/messages");
  revalidatePath(`/collaboration/contracts/${result.documentId}`);
  if (result.fundingId) revalidatePath(`/collaboration/work/${result.fundingId}`);
  return { ok: true as const };
}
