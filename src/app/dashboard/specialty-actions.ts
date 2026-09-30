"use server";

import { redirect } from "next/navigation";
import { confirmedSpecialtySlugs } from "@/lib/ai-suggest";
import { getCreatorSessionDraft, updateDraftProfile } from "@/lib/claim";
import { isPlanCode } from "@/lib/entitlements";
import { entitlementsForPlan } from "@/lib/entitlements-db";

export async function actionConfirmSpecialties(formData: FormData) {
  const draft = await getCreatorSessionDraft();
  const draftId = String(formData.get("draftId") ?? "");
  if (!draft || draft.id !== draftId) redirect("/dashboard?error=" + encodeURIComponent("Open your draft before confirming specialties."));
  const plan = draft.planTier && isPlanCode(draft.planTier) ? draft.planTier : "STARTER";
  const limits = await entitlementsForPlan(plan);
  const selected = formData.getAll("specialty").map((value) => String(value));
  const specialties = confirmedSpecialtySlugs(selected, limits.specialtiesMax);
  if (!specialties.length) {
    redirect("/dashboard?error=" + encodeURIComponent("Choose at least one suggested specialty."));
  }
  try {
    await updateDraftProfile(draft.id, { specialties });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save specialties.";
    redirect(`/dashboard?error=${encodeURIComponent(message)}`);
  }
  redirect("/dashboard?saved=1");
}
