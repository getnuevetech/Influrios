"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCreatorSessionDraft } from "@/lib/claim";
import {
  changeCreatorSlug,
  ensureCreatorShortLink,
  normalizeSlug,
  rollbackCreatorDynamicDestination,
  setCreatorDynamicDestination,
} from "@/lib/short-link";

export async function actionChangeShortSlug(formData: FormData) {
  const draft = await getCreatorSessionDraft();
  if (!draft) redirect("/claim");
  const nextSlug = String(formData.get("slug") ?? "");
  const acknowledged = String(formData.get("acknowledged") ?? "") === "1";
  // Spec §13 — warn before slug change; require explicit acknowledgement.
  if (!acknowledged) {
    const link = await ensureCreatorShortLink(draft.slug);
    const normalized = normalizeSlug(nextSlug);
    if (link && normalized && link.slug === normalized) {
      redirect("/dashboard?saved=1");
    }
    redirect(`/dashboard?confirmSlug=${encodeURIComponent(normalized || nextSlug.trim().toLowerCase())}`);
  }
  const result = await changeCreatorSlug(draft.slug, nextSlug);
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
