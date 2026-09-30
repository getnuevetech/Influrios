"use server";

import { redirect } from "next/navigation";
import { getCreatorSessionDraft } from "@/lib/claim";
import { changeCreatorSlug } from "@/lib/short-link";

export async function actionChangeShortSlug(formData: FormData) {
  const draft = await getCreatorSessionDraft();
  if (!draft) redirect("/claim");
  const result = await changeCreatorSlug(draft.slug, String(formData.get("slug") ?? ""));
  if (!result.ok) redirect(`/dashboard?error=${encodeURIComponent(result.error)}`);
  redirect("/dashboard?saved=1");
}
