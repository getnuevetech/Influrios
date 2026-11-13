"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { sendMail } from "@/lib/mail";
import { parseEmailBody, previewEmailTemplate, publishEmailTemplate, rollbackEmailTemplate, saveEmailTemplateDraft } from "@/lib/email-templates";

function clean(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function back(formData: FormData, templateKey: string, extra?: { saved?: string; error?: string }) {
  const params = new URLSearchParams();
  const q = clean(formData.get("q"), 80);
  const group = clean(formData.get("group"), 40);
  if (q) params.set("q", q);
  if (group) params.set("group", group);
  if (templateKey) params.set("template", templateKey);
  if (extra?.saved) params.set("saved", extra.saved);
  if (extra?.error) params.set("error", extra.error.slice(0, 300));
  const query = params.toString();
  return `/admin/mail/templates${query ? `?${query}` : ""}`;
}

export async function actionSaveEmailTemplateDraft(formData: FormData) {
  const session = await requireAdminAction("mail.edit");
  const templateKey = clean(formData.get("templateKey"), 80);
  try {
    await saveEmailTemplateDraft({
      templateKey,
      actor: session.email,
      copy: {
        subject: clean(formData.get("subject"), 200),
        preheader: clean(formData.get("preheader"), 180),
        headline: clean(formData.get("headline"), 160),
        body: parseEmailBody(String(formData.get("body") ?? "")),
        cta: clean(formData.get("cta"), 80),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the draft.";
    redirect(back(formData, templateKey, { error: message }));
  }
  revalidatePath("/admin/mail/templates");
  redirect(back(formData, templateKey, { saved: "draft" }));
}

export async function actionPublishEmailTemplate(formData: FormData) {
  const session = await requireAdminAction("mail.edit");
  const templateKey = clean(formData.get("templateKey"), 80);
  try {
    await publishEmailTemplate({ templateKey, actor: session.email });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not publish.";
    redirect(back(formData, templateKey, { error: message }));
  }
  revalidatePath("/admin/mail/templates");
  redirect(back(formData, templateKey, { saved: "published" }));
}

export async function actionRollbackEmailTemplate(formData: FormData) {
  const session = await requireAdminAction("mail.edit");
  const templateKey = clean(formData.get("templateKey"), 80);
  try {
    await rollbackEmailTemplate({
      templateKey,
      recordId: clean(formData.get("recordId"), 80),
      actor: session.email,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not restore that version.";
    redirect(back(formData, templateKey, { error: message }));
  }
  revalidatePath("/admin/mail/templates");
  redirect(back(formData, templateKey, { saved: "restored" }));
}

export async function actionSendEmailTemplateTest(formData: FormData) {
  const session = await requireAdminAction("mail.edit");
  const templateKey = clean(formData.get("templateKey"), 80);
  if (!session.email.includes("@")) {
    redirect(back(formData, templateKey, { error: "Your admin account has no email address." }));
  }
  try {
    const rendered = previewEmailTemplate(templateKey, {
      subject: clean(formData.get("subject"), 200),
      preheader: clean(formData.get("preheader"), 180),
      headline: clean(formData.get("headline"), 160),
      body: parseEmailBody(String(formData.get("body") ?? "")),
      cta: clean(formData.get("cta"), 80),
    });
    const sent = await sendMail({
      to: session.email,
      subject: `[Test] ${rendered.subject}`.slice(0, 180),
      text: rendered.text,
      html: rendered.html,
    });
    if (!sent.ok) throw new Error(sent.error);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send the test.";
    redirect(back(formData, templateKey, { error: message }));
  }
  revalidatePath("/admin/mail/templates");
  redirect(back(formData, templateKey, { saved: "test" }));
}
