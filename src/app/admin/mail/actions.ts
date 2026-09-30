"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { saveMailSettings, sendInvitationTest } from "@/lib/mail";

function clean(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export async function actionSaveMailSettings(formData: FormData) {
  await requireAdminAction("mail.edit");
  try {
    await saveMailSettings({
      host: clean(formData.get("host"), 200),
      port: Number(formData.get("port") ?? 587),
      username: clean(formData.get("username"), 200),
      fromAddress: clean(formData.get("fromAddress"), 200),
      password: String(formData.get("password") ?? ""),
      enabled: formData.get("enabled") === "on",
      clearSecret: formData.get("clearSecret") === "on",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save SMTP settings.";
    redirect(`/admin/mail?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/mail");
  redirect("/admin/mail?saved=1");
}

export async function actionSendMailTest(formData: FormData) {
  await requireAdminAction("mail.edit");
  const to = clean(formData.get("to"), 200);
  const result = await sendInvitationTest(to);
  revalidatePath("/admin/mail");
  revalidatePath("/admin/jobs");
  if (!result.ok) redirect(`/admin/mail?error=${encodeURIComponent(result.message)}`);
  redirect("/admin/mail?sent=1");
}
