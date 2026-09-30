"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCreatorSessionDraft } from "@/lib/claim";
import { prisma } from "@/lib/db";
import { submitFundingMilestone } from "@/lib/marketplace-ledger";

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
