"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCreatorSessionDraft } from "@/lib/claim";
import {
  changeCreatorSlug,
  rollbackCreatorDynamicDestination,
  setCreatorDynamicDestination,
} from "@/lib/short-link";

export async function actionChangeShortSlug(formData: FormData) {
  const draft = await getCreatorSessionDraft();
  if (!draft) redirect("/claim");
  const result = await changeCreatorSlug(draft.slug, String(formData.get("slug") ?? ""));
  if (!result.ok) redirect(`/dashboard?error=${encodeURIComponent(result.error)}`);
  redirect("/dashboard?saved=1");
}

export async function actionSetDynamicDestination(formData: FormData) {
  const draft = await getCreatorSessionDraft();
  if (!draft) redirect("/claim");
  const result = await setCreatorDynamicDestination(
    draft.slug,
    String(formData.get("destination") ?? "").trim().slice(0, 400),
  );
  if (!result.ok) redirect(`/dashboard?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/dashboard");
  redirect("/dashboard?saved=destination");
}

export async function actionRollbackDynamicDestination() {
  const draft = await getCreatorSessionDraft();
  if (!draft) redirect("/claim");
  const result = await rollbackCreatorDynamicDestination(draft.slug);
  if (!result.ok) redirect(`/dashboard?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/dashboard");
  redirect("/dashboard?saved=destination");
}
