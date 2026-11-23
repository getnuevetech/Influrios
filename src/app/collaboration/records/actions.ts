"use server";

import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";
import { advanceCollaboration, isCollaborationStatus } from "@/lib/collaborations";
import { prisma } from "@/lib/db";

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

