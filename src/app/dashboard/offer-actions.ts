"use server";

import { redirect } from "next/navigation";
import { profileNotePair } from "@/lib/profile-notes";

export async function actionSaveProfileNotes(formData: FormData) {
  const draftId = String(formData.get("draftId") ?? "");
  try {
    const { getCreatorSessionDraft, updateDraftProfile } = await import("@/lib/claim");
    const draft = await getCreatorSessionDraft();
    if (!draft || draft.id !== draftId) throw new Error("Draft not found");
    const offer = profileNotePair(formData.get("offer"), formData.get("offerDetails"), "Enter what you offer.");
    const need = profileNotePair(formData.get("need"), formData.get("needDetails"), "Enter what you need.");
    await updateDraftProfile(draftId, {
      offer: offer.summary,
      offerDetails: offer.details,
      need: need.summary,
      needDetails: need.details,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the offer and need";
    redirect(`/dashboard?error=${encodeURIComponent(message)}`);
  }
  redirect("/dashboard?saved=notes");
}
