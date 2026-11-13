"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { EMAIL_CATEGORY_KEYS, saveEmailCategorySwitch } from "@/lib/email-live";

export async function actionSaveEmailCategorySwitches(formData: FormData) {
  const session = await requireAdminAction("mail.edit");
  for (const key of EMAIL_CATEGORY_KEYS) {
    await saveEmailCategorySwitch(key, formData.get(key) === "on", session.email);
  }
  revalidatePath("/admin/mail/health");
  redirect("/admin/mail/health?saved=1");
}
