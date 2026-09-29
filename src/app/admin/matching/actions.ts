"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  advanceIntro,
  createIntro,
  setCreatorOptIn,
  type IntroStatus,
} from "@/lib/managed-matching";

export async function actionCreateIntro(formData: FormData) {
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
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "outreach") as IntroStatus;
  const note = String(formData.get("note") ?? "") || undefined;
  await advanceIntro(id, status, note);
  revalidatePath("/admin/matching");
  revalidatePath("/business");
  redirect(`/admin/matching?advanced=${id}`);
}

export async function actionSetOptIn(formData: FormData) {
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
