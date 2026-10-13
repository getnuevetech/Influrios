"use server";

import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { updateOwnedBusinessProfile } from "@/lib/business";

export async function actionSaveBusinessProfile(formData: FormData) {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/business/profile");
  try {
    await updateOwnedBusinessProfile(account.id, {
      name: String(formData.get("name") ?? ""),
      industry: String(formData.get("industry") ?? ""),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save company profile.";
    redirect(`/business/profile?error=${encodeURIComponent(message)}`);
  }
  redirect("/business/profile?saved=1");
}
