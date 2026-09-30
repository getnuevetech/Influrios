"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import {
  advanceIntro,
  createIntro,
  recordIntroFromRequest,
  setCreatorOptIn,
  setManagedPromotionEnabled,
  type IntroStatus,
} from "@/lib/managed-matching";

export async function actionCreateIntro(formData: FormData) {
  await requireAdminAction("matching.create_intros");
  await createIntro({
    businessName: String(formData.get("businessName") ?? "Demo Business"),
    creatorSlug: String(formData.get("creatorSlug") ?? ""),
    briefTitle: String(formData.get("briefTitle") ?? "Untitled brief"),
    notes: String(formData.get("notes") ?? ""),
    feeExpected: String(formData.get("feeExpected") ?? "15% success fee"),
  });
  revalidatePath("/admin/matching");
  revalidatePath("/business");
  redirect("/admin/matching?created=1");
}

export async function actionAdvanceIntro(formData: FormData) {
  await requireAdminAction("matching.advance_intros");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "outreach") as IntroStatus;
  const note = String(formData.get("note") ?? "") || undefined;
  await advanceIntro(id, status, note);
  revalidatePath("/admin/matching");
  revalidatePath("/business");
  redirect(`/admin/matching?advanced=${id}`);
}

export async function actionSetManagedPromotion(formData: FormData) {
  await requireAdminAction("matching.manage_optins");
  try {
    await setManagedPromotionEnabled(formData.get("enabled") === "on");
  } catch {
    redirect("/admin/matching?error=" + encodeURIComponent("Matching records are unavailable. Nothing was saved."));
  }
  revalidatePath("/admin/matching");
  revalidatePath("/business");
  redirect("/admin/matching?flag=1");
}

export async function actionRecordIntroduction(formData: FormData) {
  await requireAdminAction("matching.create_intros");
  let result: Awaited<ReturnType<typeof recordIntroFromRequest>>;
  try {
    result = await recordIntroFromRequest({
      requestId: String(formData.get("requestId") ?? ""),
      creatorSlug: String(formData.get("creatorSlug") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      feeExpected: String(formData.get("feeExpected") ?? "") || undefined,
    });
  } catch {
    redirect("/admin/matching?error=" + encodeURIComponent("Matching records are unavailable. Nothing was saved."));
  }
  revalidatePath("/admin/matching");
  revalidatePath("/business");
  if (!result.ok) {
    redirect(`/admin/matching?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/admin/matching?recorded=1");
}

export async function actionSetOptIn(formData: FormData) {
  await requireAdminAction("matching.manage_optins");
  const creatorSlug = String(formData.get("creatorSlug") ?? "");
  await setCreatorOptIn(creatorSlug, {
    openToManaged: formData.get("openToManaged") === "on",
    targetingNotes: String(formData.get("targetingNotes") ?? ""),
    niches: String(formData.get("niches") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  });
  revalidatePath("/admin/matching");
  redirect(`/admin/matching?optin=${creatorSlug}`);
}
