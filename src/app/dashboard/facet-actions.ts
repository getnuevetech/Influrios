"use server";

import { redirect } from "next/navigation";
import { facetList } from "@/lib/discovery-facets";

export async function actionSaveDiscoveryFacets(formData: FormData) {
  const draftId = String(formData.get("draftId") ?? "");
  try {
    const { getCreatorSessionDraft, updateDraftProfile } = await import("@/lib/claim");
    const draft = await getCreatorSessionDraft();
    if (!draft || draft.id !== draftId) throw new Error("Draft not found");
    await updateDraftProfile(draftId, {
      contentStyles: facetList(formData.getAll("contentStyle")),
      commercialModes: facetList(formData.getAll("commercialMode")),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save those choices";
    redirect(`/dashboard?error=${encodeURIComponent(message)}`);
  }
  redirect("/dashboard?saved=facets");
}
