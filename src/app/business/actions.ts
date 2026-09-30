"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { hasCurrentLegalRecord, recordLegalEvent } from "@/lib/legal";
import {
  addToShortlist,
  createBrief,
  removeFromShortlist,
  requestManagedMatch,
  sendInquiry,
  setBusinessPlan,
} from "@/lib/business";
import type { BusinessPlanCode } from "@/lib/business-entitlements";

async function requireBusinessTerms() {
  const account = await getAccountSession().catch(() => null);
  if (!account) return;
  const accepted = await hasCurrentLegalRecord({
    documentKey: "business-terms",
    userId: account.id,
  }).catch(() => true);
  if (!accepted) {
    redirect("/business?error=" + encodeURIComponent("Agree to the Business / Brand Terms before using the workspace."));
  }
}

export async function actionAcceptBusinessTerms(formData: FormData) {
  if (formData.get("acceptBusiness") !== "on") {
    redirect("/business?error=" + encodeURIComponent("Agree to the Business / Brand Terms to continue."));
  }
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/business");
  if (await hasCurrentLegalRecord({ documentKey: "business-terms", userId: account.id })) {
    redirect("/business?terms=1");
  }
  await recordLegalEvent({
    trigger: "business_registration",
    context: "business_registration",
    userId: account.id,
    userRole: "BUSINESS",
    extraKeys: ["terms-of-service", "privacy-policy"],
  });
  redirect("/business?terms=1");
}

export async function actionAddShortlist(formData: FormData) {
  await requireBusinessTerms();
  const slug = String(formData.get("slug") ?? "");
  const note = String(formData.get("note") ?? "") || undefined;
  const result = await addToShortlist(slug, note);
  revalidatePath("/business");
  revalidatePath(`/creators/${slug}`);
  if (!result.ok) {
    redirect(`/business?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/business?added=${encodeURIComponent(slug)}`);
}

export async function actionRemoveShortlist(formData: FormData) {
  await requireBusinessTerms();
  const slug = String(formData.get("slug") ?? "");
  await removeFromShortlist(slug);
  revalidatePath("/business");
  redirect("/business");
}

export async function actionCreateBrief(formData: FormData) {
  await requireBusinessTerms();
  await createBrief({
    title: String(formData.get("title") ?? "Untitled brief"),
    goal: String(formData.get("goal") ?? "Brand Awareness"),
    specialty: String(formData.get("specialty") ?? "beauty"),
    budget: String(formData.get("budget") ?? "$1K – $5K"),
    location: String(formData.get("location") ?? "USA"),
    platform: String(formData.get("platform") ?? "INSTAGRAM"),
    summary: String(formData.get("summary") ?? ""),
  });
  revalidatePath("/business");
  redirect("/business?brief=1");
}

export async function actionSendInquiry(formData: FormData) {
  await requireBusinessTerms();
  const creatorSlug = String(formData.get("creatorSlug") ?? "");
  const message = String(formData.get("message") ?? "");
  const briefId = String(formData.get("briefId") ?? "") || undefined;
  const result = await sendInquiry({ creatorSlug, message, briefId });
  revalidatePath("/business");
  if (!result.ok) {
    redirect(`/business?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/business?inquiry=1`);
}

export async function actionSetPlan(formData: FormData) {
  await requireBusinessTerms();
  const plan = String(formData.get("plan") ?? "BUSINESS_FREE") as BusinessPlanCode;
  try {
    await setBusinessPlan(plan);
  } catch {
    redirect("/business?error=" + encodeURIComponent("The business workspace is unavailable. Nothing was saved."));
  }
  revalidatePath("/business");
  redirect(`/business?plan=${plan}`);
}

export async function actionRequestManagedMatch(formData: FormData) {
  await requireBusinessTerms();
  const briefId = String(formData.get("briefId") ?? "");
  let result: Awaited<ReturnType<typeof requestManagedMatch>>;
  try {
    result = await requestManagedMatch(briefId);
  } catch {
    redirect("/business?error=" + encodeURIComponent("The business workspace is unavailable. Nothing was saved."));
  }
  revalidatePath("/business");
  revalidatePath("/admin/matching");
  if (!result.ok) {
    redirect(`/business?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/business?queued=1");
}
