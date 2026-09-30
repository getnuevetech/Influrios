"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/account-policy";
import {
  addDraftSocial,
  claimDraft,
  createDraftFromHandle,
  publishDraft,
  setCreatorSession,
  updateDraftProfile,
  verifyDraft,
} from "@/lib/claim";

export async function actionCreateDraft(formData: FormData) {
  const handle = String(formData.get("handle") ?? "").trim();
  if (!handle) redirect("/claim?error=Enter+a+social+URL+or+handle");

  let draftId = "";
  try {
    const draft = await createDraftFromHandle(handle, "ORGANIC_SIGNUP");
    draftId = draft.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create draft";
    redirect(`/claim?error=${encodeURIComponent(message)}`);
  }
  redirect(`/claim/preview/${draftId}`);
}

export async function actionClaimDraft(formData: FormData) {
  const draftId = String(formData.get("draftId") ?? "");
  const nextRaw = String(formData.get("next") ?? "");
  const next = nextRaw.startsWith("/invite/") ? safeNextPath(nextRaw) : "";
  try {
    const draft = await claimDraft({
      draftId,
      email: String(formData.get("email") ?? ""),
      name: String(formData.get("name") ?? ""),
    });
    await setCreatorSession(draft.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Claim failed";
    redirect(`${next || `/claim/preview/${draftId}`}?error=${encodeURIComponent(message)}`);
  }
  redirect(`/claim/verify/${draftId}`);
}

export async function actionVerifyDraft(formData: FormData) {
  const draftId = String(formData.get("draftId") ?? "");
  try {
    await verifyDraft(draftId, String(formData.get("code") ?? ""));
    await setCreatorSession(draftId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    redirect(`/claim/verify/${draftId}?error=${encodeURIComponent(message)}`);
  }
  redirect(`/claim/publish/${draftId}`);
}

export async function actionPublishDraft(formData: FormData) {
  const draftId = String(formData.get("draftId") ?? "");
  try {
    const draft = await publishDraft(draftId);
    await setCreatorSession(draft.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";
    redirect(`/claim/publish/${draftId}?error=${encodeURIComponent(message)}`);
  }
  redirect(`/dashboard?published=1`);
}

export async function actionAddDraftSocial(formData: FormData) {
  const draftId = String(formData.get("draftId") ?? "");
  const handle = String(formData.get("handle") ?? "").trim().replace(/^@/, "");
  if (!handle) redirect(`/claim/publish/${draftId}?error=${encodeURIComponent("Enter a handle")}`);
  try {
    await addDraftSocial(draftId, {
      platform: "TIKTOK",
      handle: `@${handle}`,
      url: `https://tiktok.com/@${handle}`,
      followers: 1000,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not add social";
    redirect(`/claim/publish/${draftId}?error=${encodeURIComponent(message)}`);
  }
  redirect(`/claim/publish/${draftId}?added=1`);
}

export async function actionUpdateDashboardProfile(formData: FormData) {
  const draftId = String(formData.get("draftId") ?? "");
  try {
    await updateDraftProfile(draftId, {
      displayName: String(formData.get("displayName") ?? "").trim() || undefined,
      title: String(formData.get("title") ?? "").trim() || undefined,
      bio: String(formData.get("bio") ?? "").trim() || undefined,
      locationCity: String(formData.get("locationCity") ?? "").trim() || undefined,
      locationCountry: String(formData.get("locationCountry") ?? "").trim() || undefined,
      specialties: String(formData.get("specialty") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    redirect(`/dashboard?error=${encodeURIComponent(message)}`);
  }
  redirect("/dashboard?saved=1");
}
