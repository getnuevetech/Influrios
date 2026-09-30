"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  clampDays,
  createInvitation,
  DEFAULT_INVITATION_SETTINGS,
  noteLinkCopied,
  queueInvitationEmail,
  suppressionValue,
} from "@/lib/invitations";

function clean(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export async function actionSaveInvitationSettings(formData: FormData) {
  await requireAdminSession("invitations.edit");
  await prisma.invitationSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      defaultExpiryDays: clampDays(Number(formData.get("defaultExpiryDays")), DEFAULT_INVITATION_SETTINGS.defaultExpiryDays),
      defaultFollowUpDays: clampDays(
        Number(formData.get("defaultFollowUpDays")),
        DEFAULT_INVITATION_SETTINGS.defaultFollowUpDays,
      ),
    },
    update: {
      defaultExpiryDays: clampDays(Number(formData.get("defaultExpiryDays")), DEFAULT_INVITATION_SETTINGS.defaultExpiryDays),
      defaultFollowUpDays: clampDays(
        Number(formData.get("defaultFollowUpDays")),
        DEFAULT_INVITATION_SETTINGS.defaultFollowUpDays,
      ),
    },
  });
  redirect("/admin/invitations?saved=settings");
}

export async function actionSaveInvitationTemplate(formData: FormData) {
  await requireAdminSession("invitations.edit");
  const id = clean(formData.get("id"), 80);
  const name = clean(formData.get("name"), 80);
  const subject = clean(formData.get("subject"), 160);
  const body = clean(formData.get("body"), 2000);
  if (!name || !subject || !body) redirect("/admin/invitations?error=template");
  const active = formData.get("active") === "1";
  try {
    if (id) {
      await prisma.invitationTemplate.update({ where: { id }, data: { name, subject, body, active } });
    } else {
      const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || `template-${Date.now()}`;
      await prisma.invitationTemplate.create({ data: { key, name, subject, body, active: true } });
    }
  } catch {
    redirect("/admin/invitations?error=template");
  }
  redirect("/admin/invitations?saved=template");
}

export async function actionSaveCampaign(formData: FormData) {
  await requireAdminSession("invitations.edit");
  const name = clean(formData.get("name"), 80);
  if (!name) redirect("/admin/invitations?error=campaign");
  await prisma.invitationCampaign.create({ data: { name, active: true } });
  redirect("/admin/invitations?saved=campaign");
}

export async function actionCreateInvitation(formData: FormData) {
  const session = await requireAdminSession("invitations.edit");
  try {
    await createInvitation({
      slug: clean(formData.get("slug"), 80),
      templateId: clean(formData.get("templateId"), 80),
      campaignId: clean(formData.get("campaignId"), 80),
      email: clean(formData.get("email"), 160),
      expiryDays: Number(formData.get("expiryDays")),
      followUpDays: Number(formData.get("followUpDays")),
      actor: session.email,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the invitation.";
    redirect(`/admin/invitations?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/invitations?saved=invitation");
}

export async function actionCopyInvitationLink(formData: FormData) {
  const session = await requireAdminSession("invitations.edit");
  const id = clean(formData.get("id"), 80);
  if (id) await noteLinkCopied(id, session.email);
  redirect("/admin/invitations?saved=copied");
}

export async function actionQueueInvitation(formData: FormData) {
  const session = await requireAdminSession("invitations.edit");
  const id = clean(formData.get("id"), 80);
  try {
    await queueInvitationEmail(id, session.email);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send is inactive until SMTP is configured.";
    redirect(`/admin/invitations?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/invitations?saved=queued");
}

export async function actionAddSuppression(formData: FormData) {
  const session = await requireAdminSession("invitations.edit");
  const kind = clean(formData.get("kind"), 20) === "email" ? "email" : "slug";
  const value = suppressionValue(kind, clean(formData.get("value"), 160));
  const reason = clean(formData.get("reason"), 200);
  if (!value) redirect("/admin/invitations?error=suppression");
  await prisma.outreachSuppression.upsert({
    where: { value },
    create: { kind, value, reason: reason || null },
    update: { kind, reason: reason || null },
  });
  await prisma.auditLog.create({
    data: {
      actor: session.email,
      action: "invitation.suppress",
      objectType: "OutreachSuppression",
      objectId: value,
      after: { kind, value },
    },
  });
  redirect("/admin/invitations?saved=suppression");
}

export async function actionRemoveSuppression(formData: FormData) {
  await requireAdminSession("invitations.edit");
  const id = clean(formData.get("id"), 80);
  if (id) await prisma.outreachSuppression.delete({ where: { id } }).catch(() => null);
  redirect("/admin/invitations?saved=suppression");
}
