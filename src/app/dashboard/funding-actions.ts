"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCreatorSessionDraft } from "@/lib/claim";
import { prisma } from "@/lib/db";
import { submitFundingMilestone } from "@/lib/marketplace-ledger";
import { addDisputeEvidence, openMilestoneDispute } from "@/lib/milestone-disputes";

export async function actionSubmitOwnMilestone(formData: FormData) {
  const draft = await getCreatorSessionDraft();
  if (!draft) redirect("/claim");
  const fundingId = String(formData.get("fundingId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const funding = await prisma.collaborationFunding.findUnique({ where: { id: fundingId } });
  if (!funding || funding.creatorSlug !== draft.slug) {
    redirect("/dashboard?error=That milestone is not on your card.");
  }
  const result = await submitFundingMilestone(fundingId, milestoneId);
  if (!result.ok) redirect(`/dashboard?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/dashboard");
  revalidatePath("/payments");
  redirect("/dashboard?saved=milestone");
}

export async function actionAddOwnEvidence(formData: FormData) {
  const draft = await getCreatorSessionDraft();
  if (!draft) redirect("/claim");
  const fundingId = String(formData.get("fundingId") ?? "");
  const funding = await prisma.collaborationFunding.findUnique({ where: { id: fundingId } });
  if (!funding || funding.creatorSlug !== draft.slug) {
    redirect("/dashboard?error=That dispute is not on your card.");
  }
  const result = await addDisputeEvidence({
    disputeId: String(formData.get("disputeId") ?? ""),
    fundingId,
    author: "creator",
    body: String(formData.get("body") ?? ""),
    url: String(formData.get("url") ?? ""),
  });
  if (!result.ok) redirect(`/dashboard?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/dashboard");
  revalidatePath("/payments");
  revalidatePath("/admin/trust");
  redirect("/dashboard?saved=evidence");
}

export async function actionOpenOwnDispute(formData: FormData) {
  const draft = await getCreatorSessionDraft();
  if (!draft) redirect("/claim");
  const fundingId = String(formData.get("fundingId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const funding = await prisma.collaborationFunding.findUnique({ where: { id: fundingId } });
  if (!funding || funding.creatorSlug !== draft.slug) {
    redirect("/dashboard?error=That milestone is not on your card.");
  }
  const result = await openMilestoneDispute({
    fundingId,
    milestoneId,
    openedBy: "creator",
    reasonId: String(formData.get("reasonId") ?? ""),
    details: String(formData.get("details") ?? ""),
  });
  if (!result.ok) redirect(`/dashboard?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/dashboard");
  revalidatePath("/payments");
  revalidatePath("/admin/trust");
  redirect("/dashboard?saved=dispute");
}
