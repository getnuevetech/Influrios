"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { saveContractTemplate } from "@/lib/contract-document";

export async function actionSaveContractTemplate(formData: FormData) {
  await requireAdminAction("contracts.templates");
  const result = await saveContractTemplate(String(formData.get("body") ?? ""));
  if (!result.ok) {
    redirect(`/admin/contracts?error=${encodeURIComponent(result.error)}`);
  }
  revalidatePath("/admin/contracts");
  redirect("/admin/contracts?saved=1");
}
