"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { prisma } from "@/lib/db";
import { createTeamProposal, respondToTeamProposal } from "@/lib/team-proposal";

function safeReturn(value: string) {
  if (value === "/collaboration/business" || value === "/collaboration/hub") return value;
  return "/collaboration/team";
}

export async function actionSendTeamProposal(formData: FormData) {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/collaboration/team");
  const ws = await getWorkspace(account.id);
  const slugs = formData.getAll("creatorSlug").map((value) => String(value));
  const result = await createTeamProposal({
    workspaceId: ws.businessId,
    title: String(formData.get("title") ?? ""),
    campaignIntent: String(formData.get("campaignIntent") ?? ""),
    creatorSlugs: slugs,
  });
  const returnTo = safeReturn(String(formData.get("returnTo") ?? ""));
  if (!result.ok) redirect(`${returnTo}?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/collaboration/team");
  revalidatePath("/collaboration/business");
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}sent=1`);
}

export async function actionRespondTeamProposal(formData: FormData) {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/collaboration/team");
  const creator = await prisma.creator.findFirst({ where: { userId: account.id }, select: { slug: true } });
  if (!creator) {
    redirect("/collaboration/team?error=Sign in as the invited influencer to respond.");
  }
  const slug = creator.slug;
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "accepted" && decision !== "declined") {
    redirect("/collaboration/team?error=Choose accept or decline.");
  }
  const result = await respondToTeamProposal({
    proposalId: String(formData.get("proposalId") ?? ""),
    creatorSlug: slug,
    decision,
  });
  const returnTo = safeReturn(String(formData.get("returnTo") ?? ""));
  if (!result.ok) redirect(`${returnTo}?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/collaboration/team");
  revalidatePath("/collaboration/hub");
  redirect(`${returnTo}?status=${result.status}`);
}
