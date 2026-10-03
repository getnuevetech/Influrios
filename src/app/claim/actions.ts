"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/account-policy";
import {
  AUTH_LOCKOUT_GENERIC_MESSAGE,
  lockoutMessage,
  recordAuthFailure,
  recordAuthSuccess,
} from "@/lib/auth-lockout";
import {
  addDraftSocial,
  claimDraft,
  createDraftFromHandle,
  publishDraft,
  setCreatorSession,
  updateDraftProfile,
  verifyDraft,
} from "@/lib/claim";
import { normalizeProfileGender } from "@/lib/profile-media";

function clientIp(headerStore: Headers) {
  return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function actionCreateDraft(formData: FormData) {
  const handle = String(formData.get("handle") ?? "").trim();
  const platformHint = String(formData.get("platform") ?? "").trim();
  if (!handle) redirect("/claim?error=Enter+a+social+URL+or+handle");

  let draftId = "";
  try {
    const draft = await createDraftFromHandle(handle, "ORGANIC_SIGNUP", platformHint || undefined);
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
      gender: String(formData.get("gender") ?? ""),
      title: String(formData.get("title") ?? ""),
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
  const headerStore = await headers();
  const ip = clientIp(headerStore);
  const locked = lockoutMessage("claim-verify", ip, draftId);
  if (locked) {
    redirect(`/claim/verify/${draftId}?error=${encodeURIComponent(AUTH_LOCKOUT_GENERIC_MESSAGE)}`);
  }
  try {
    await verifyDraft(draftId, String(formData.get("code") ?? ""));
    await setCreatorSession(draftId);
    recordAuthSuccess("claim-verify", ip, draftId);
  } catch (err) {
    recordAuthFailure("claim-verify", ip, draftId);
    const message = err instanceof Error ? err.message : "Verification failed";
    redirect(`/claim/verify/${draftId}?error=${encodeURIComponent(message)}`);
  }
  redirect(`/claim/publish/${draftId}`);
}

export async function actionPublishDraft(formData: FormData) {
  const draftId = String(formData.get("draftId") ?? "");
  if (formData.get("creatorTerms") !== "on") {
    redirect(
      `/claim/publish/${draftId}?error=${encodeURIComponent("Agree to the Influencer Terms and Social Platform Integration Terms before publishing.")}`,
    );
  }
  try {
    const draft = await publishDraft(draftId);
    await setCreatorSession(draft.id);
    const { getAccountSession } = await import("@/lib/accounts");
    const { recordLegalEvent } = await import("@/lib/legal");
    const { prisma } = await import("@/lib/db");
    const account = await getAccountSession().catch(() => null);
    const byEmail = draft.email
      ? await prisma.user.findUnique({ where: { email: draft.email.trim().toLowerCase() } })
      : null;
    await recordLegalEvent({
      trigger: "creator_claim",
      context: "creator_claim",
      userId: account?.id ?? byEmail?.id ?? null,
      subjectKey: `creator:${draft.slug}`,
      userRole: "CREATOR",
      extraKeys: ["terms-of-service", "privacy-policy"],
    });
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
      followers: 0,
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
      gender: (() => {
        const raw = String(formData.get("gender") ?? "").trim();
        return raw ? normalizeProfileGender(raw) : undefined;
      })(),
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

export async function actionUpdateProfileMedia(formData: FormData) {
  const draftId = String(formData.get("draftId") ?? "");
  const intent = String(formData.get("intent") ?? "");
  try {
    const { nextBrandBanner, defaultAvatarForGender, normalizeProfileGender } = await import(
      "@/lib/profile-media"
    );
    const { saveAvatarUpload, saveCoverUpload } = await import("@/lib/profile-uploads");
    const { getDraft } = await import("@/lib/claim");
    const draft = await getDraft(draftId);
    if (!draft) throw new Error("Draft not found");

    if (intent === "avatar") {
      const file = formData.get("avatar");
      if (!(file instanceof File) || file.size <= 0) throw new Error("Choose a profile photo.");
      const image = await saveAvatarUpload(file);
      await updateDraftProfile(draftId, { image });
    } else if (intent === "cover") {
      const file = formData.get("cover");
      if (!(file instanceof File) || file.size <= 0) throw new Error("Choose a banner image.");
      const coverImage = await saveCoverUpload(file);
      await updateDraftProfile(draftId, { coverImage });
    } else if (intent === "avatar-default") {
      const gender = normalizeProfileGender(String(formData.get("gender") ?? draft.gender));
      await updateDraftProfile(draftId, {
        gender,
        image: defaultAvatarForGender(gender),
      });
    } else if (intent === "cover-next") {
      await updateDraftProfile(draftId, {
        coverImage: nextBrandBanner(draft.coverImage, draft.slug),
      });
    } else {
      throw new Error("Unknown media action.");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update images";
    redirect(`/dashboard?error=${encodeURIComponent(message)}`);
  }
  redirect("/dashboard?saved=1");
}
