"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import {
  advanceIntro,
  createIntro,
  recordIntroFromRequest,
  requestIntroFeeSettlement,
  setCreatorOptIn,
  setManagedPromotionEnabled,
  type IntroStatus,
} from "@/lib/managed-matching";

export async function actionCreateIntro(formData: FormData) {
  await requireAdminAction("matching.create_intros");
  const businessName = String(formData.get("businessName") ?? "").trim();
  const creatorSlug = String(formData.get("creatorSlug") ?? "").trim();
  const briefTitle = String(formData.get("briefTitle") ?? "").trim();
  if (!businessName || !creatorSlug || !briefTitle) {
    redirect("/admin/matching?error=Add%20a%20business%2C%20an%20influencer%2C%20and%20a%20brief%20title.");
  }
  const feeExpected = String(formData.get("feeExpected") ?? "").trim();
  await createIntro({
    businessName,
    creatorSlug,
    briefTitle,
    notes: String(formData.get("notes") ?? ""),
    feeExpected: feeExpected || undefined,
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

export async function actionRequestIntroFeeSettlement(formData: FormData) {
  await requireAdminAction("matching.advance_intros");
  const id = String(formData.get("id") ?? "");
  const jurisdiction = String(formData.get("jurisdiction") ?? "");
  const grossRaw = String(formData.get("grossCents") ?? "").trim();
  const grossValueCents = grossRaw ? Number(grossRaw) : undefined;
  const result = await requestIntroFeeSettlement(id, {
    jurisdiction,
    grossValueCents: Number.isInteger(grossValueCents) ? grossValueCents : undefined,
  });
  revalidatePath("/admin/matching");
  revalidatePath("/business");
  if (!result.ok) redirect(`/admin/matching?error=${encodeURIComponent(result.error)}`);
  redirect(`/admin/matching?feeQuoted=${id}`);
}

export async function actionOpenIntroFeeCheckout(formData: FormData) {
  await requireAdminAction("matching.advance_intros");
  const id = String(formData.get("id") ?? "");
  const { openIntroFeeCheckout } = await import("@/lib/providers/airwallex-runtime");
  const result = await openIntroFeeCheckout(id);
  revalidatePath("/admin/matching");
  if (!result.ok) redirect(`/admin/matching?error=${encodeURIComponent(result.error)}`);
  if (result.url && result.url.startsWith("https://")) redirect(result.url);
  redirect(`/admin/matching?feeOpened=${encodeURIComponent(result.paymentId)}`);
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
