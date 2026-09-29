"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addToShortlist,
  createBrief,
  removeFromShortlist,
  sendInquiry,
  setBusinessPlan,
} from "@/lib/business";
import type { BusinessPlanCode } from "@/lib/business-entitlements";

export async function actionAddShortlist(formData: FormData) {
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
  const slug = String(formData.get("slug") ?? "");
  await removeFromShortlist(slug);
  revalidatePath("/business");
  redirect("/business");
}

export async function actionCreateBrief(formData: FormData) {
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
  const plan = String(formData.get("plan") ?? "BUSINESS_FREE") as BusinessPlanCode;
  await setBusinessPlan(plan);
  revalidatePath("/business");
  redirect(`/business?plan=${plan}`);
}
