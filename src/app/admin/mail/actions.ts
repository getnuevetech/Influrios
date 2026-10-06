"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import {
  deleteCommTemplate,
  saveCommChannelSettings,
  saveCommTemplate,
  sendCommTemplateTest,
} from "@/lib/comm-templates";
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
  if (!to.includes("@")) {
    redirect(`/admin/mail?error=${encodeURIComponent("Enter a valid test recipient email.")}`);
  }
  const result = await sendInvitationTest(to);
  revalidatePath("/admin/mail");
  revalidatePath("/admin/jobs");
  if (!result.ok) redirect(`/admin/mail?error=${encodeURIComponent(result.message)}`);
  redirect("/admin/mail?sent=1");
}

export async function actionSaveCommChannels(formData: FormData) {
  await requireAdminAction("mail.edit");
  await saveCommChannelSettings({
    emailEnabled: formData.get("emailEnabled") === "on",
    smsEnabled: formData.get("smsEnabled") === "on",
    smsProviderNote: clean(formData.get("smsProviderNote"), 400),
  });
  revalidatePath("/admin/mail");
  redirect("/admin/mail?saved=channels");
}

export async function actionSaveCommTemplate(formData: FormData) {
  await requireAdminAction("mail.edit");
  try {
    await saveCommTemplate({
      id: clean(formData.get("id"), 60) || undefined,
      key: clean(formData.get("key"), 60),
      name: clean(formData.get("name"), 120),
      audience: clean(formData.get("audience"), 40),
      mode: clean(formData.get("mode"), 20),
      triggerKey: clean(formData.get("triggerKey"), 60),
      subject: clean(formData.get("subject"), 200),
      bodyEmail: String(formData.get("bodyEmail") ?? ""),
      bodySms: String(formData.get("bodySms") ?? ""),
      active: formData.get("active") === "on",
      sortOrder: Number(formData.get("sortOrder") || 100),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the template.";
    redirect(`/admin/mail?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/mail");
  redirect("/admin/mail?saved=template");
}

export async function actionDeleteCommTemplate(formData: FormData) {
  await requireAdminAction("mail.edit");
  try {
    await deleteCommTemplate(clean(formData.get("id"), 60));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove the template.";
    redirect(`/admin/mail?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/mail");
  redirect("/admin/mail?removed=template");
}

export async function actionSendCommTemplate(formData: FormData) {
  await requireAdminAction("mail.edit");
  const channel = clean(formData.get("channel"), 10) === "sms" ? "sms" : "email";
  const result = await sendCommTemplateTest({
    templateId: clean(formData.get("templateId"), 60),
    toEmail: clean(formData.get("to"), 200),
    channel,
  });
  revalidatePath("/admin/mail");
  revalidatePath("/admin/jobs");
  if (!result.ok) redirect(`/admin/mail?error=${encodeURIComponent(result.message)}`);
  redirect("/admin/mail?sent=template");
}
