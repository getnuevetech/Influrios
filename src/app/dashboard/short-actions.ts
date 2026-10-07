"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCreatorSessionDraft } from "@/lib/claim";
import {
  cancelShortLinkSchedule,
  changeCreatorSlug,
  createCampaignLink,
  ensureCreatorShortLink,
  normalizeSlug,
  rollbackCreatorDynamicDestination,
  scheduleShortLinkDestination,
  setCampaignLinkStatus,
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

function startsAtFromForm(formData: FormData): Date | null {
  const iso = String(formData.get("startsAtIso") ?? "").trim();
  const raw = iso || String(formData.get("startsAt") ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function actionScheduleDestination(formData: FormData) {
  const draft = await getCreatorSessionDraft();
  if (!draft) redirect("/claim");
  const link = await ensureCreatorShortLink(draft.slug);
  if (!link) redirect("/dashboard?error=" + encodeURIComponent("This plan does not include a short link."));
  const startsAt = startsAtFromForm(formData);
  if (!startsAt) {
    redirect("/dashboard?error=" + encodeURIComponent("Choose a start time at least a minute from now."));
  }
  const result = await scheduleShortLinkDestination(
    link.id,
    String(formData.get("destination") ?? "").trim().slice(0, 400),
    startsAt,
  );
  if (!result.ok) redirect(`/dashboard?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/dashboard");
  redirect("/dashboard?saved=schedule");
}

export async function actionCancelSchedule(formData: FormData) {
  const draft = await getCreatorSessionDraft();
  if (!draft) redirect("/claim");
  const link = await ensureCreatorShortLink(draft.slug);
  if (!link) redirect("/dashboard?error=" + encodeURIComponent("This plan does not include a short link."));
  const result = await cancelShortLinkSchedule(link.id, String(formData.get("scheduleId") ?? ""));
  if (!result.ok) redirect(`/dashboard?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/dashboard");
  redirect("/dashboard?saved=schedule");
}

export async function actionCreateCampaignLink(formData: FormData) {
  const draft = await getCreatorSessionDraft();
  if (!draft) redirect("/claim");
  const result = await createCampaignLink({
    creatorSlug: draft.slug,
    code: String(formData.get("code") ?? ""),
    label: String(formData.get("label") ?? ""),
    destination: String(formData.get("destination") ?? "").trim().slice(0, 400),
  });
  if (!result.ok) redirect(`/dashboard?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/dashboard");
  redirect("/dashboard?saved=campaign");
}

export async function actionSetCampaignLinkStatus(formData: FormData) {
  const draft = await getCreatorSessionDraft();
  if (!draft) redirect("/claim");
  const status = String(formData.get("status") ?? "");
  if (status !== "active" && status !== "suspended") {
    redirect("/dashboard?error=" + encodeURIComponent("Campaign status must be active or suspended."));
  }
  const result = await setCampaignLinkStatus(draft.slug, String(formData.get("campaignId") ?? ""), status);
  if (!result.ok) redirect(`/dashboard?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/dashboard");
  redirect("/dashboard?saved=campaign");
}
