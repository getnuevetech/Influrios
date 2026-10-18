"use server";

import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { updateOwnedBusinessProfile } from "@/lib/business";

export async function actionSaveBusinessProfile(formData: FormData) {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/business/profile");
  if (account.role !== "BUSINESS" && account.role !== "AGENCY") {
    redirect("/creator");
  }
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const geography = [city, state, country].filter(Boolean).join(", ");
  try {
    await updateOwnedBusinessProfile(account.id, {
      name: String(formData.get("name") ?? ""),
      industry: String(formData.get("industry") ?? ""),
      geography,
      contactName: String(formData.get("contactName") ?? ""),
      contactEmail: String(formData.get("contactEmail") ?? ""),
      contactPhone: String(formData.get("contactPhone") ?? ""),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save company profile.";
    redirect(`/business/profile?error=${encodeURIComponent(message)}`);
  }
  redirect("/business/profile?saved=1");
}
