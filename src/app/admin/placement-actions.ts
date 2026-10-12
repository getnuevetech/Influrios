"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { addSponsoredPlacement, removeSponsoredPlacement } from "@/lib/sponsored-placement";

export async function actionAddSponsoredPlacement(formData: FormData) {
  await requireAdminAction("cards.edit");
  const result = await addSponsoredPlacement(String(formData.get("creatorSlug") ?? ""));
  revalidatePath("/discover");
  revalidatePath("/admin/cards");
  if (!result.ok) redirect(`/admin/cards?error=${encodeURIComponent(result.error)}`);
  redirect("/admin/cards?saved=placement");
}

export async function actionRemoveSponsoredPlacement(formData: FormData) {
  await requireAdminAction("cards.edit");
  await removeSponsoredPlacement(String(formData.get("id") ?? ""));
  revalidatePath("/discover");
  revalidatePath("/admin/cards");
  redirect("/admin/cards?saved=placement");
}
