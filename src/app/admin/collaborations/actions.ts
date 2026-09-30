"use server";

import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import {
  advanceCollaboration,
  clampWindowDays,
  getCollaborationSettings,
  isCollaborationStatus,
  normalizeCommercialOptions,
} from "@/lib/collaborations";
import { prisma } from "@/lib/db";

export async function actionSaveCollaborationSettings(formData: FormData) {
  await requireAdminAction("collaborations.edit");
  const windowDays = clampWindowDays(Number(formData.get("windowDays")));
  const commercialOptions = normalizeCommercialOptions(String(formData.get("commercialOptions") ?? ""));
  if (!commercialOptions) {
    redirect("/admin/collaborations?error=Add at least one commercial option, each under 80 characters.");
  }
  const existing = await getCollaborationSettings().catch(() => null);
  if (!existing) redirect("/admin/collaborations?error=The database is unavailable.");
  await prisma.collaborationSettings.update({
    where: { id: "default" },
    data: { windowDays, commercialOptions },
  });
  redirect("/admin/collaborations?saved=settings");
}

export async function actionSetCollaborationStatus(formData: FormData) {
  const session = await requireAdminAction("collaborations.edit");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!isCollaborationStatus(status)) {
    redirect("/admin/collaborations?error=Unknown status.");
  }
  const current = await prisma.collaboration.findUnique({ where: { id }, select: { status: true } });
  if (!current) redirect("/admin/collaborations?error=That proposal was not found.");
  if (current.status === status) redirect("/admin/collaborations?saved=status");
  const result = await advanceCollaboration({
    id,
    to: status,
    actorUserId: null,
    note: `admin:${session.email}`,
    enforceLimit: false,
  });
  if (!result.ok) redirect(`/admin/collaborations?error=${encodeURIComponent(result.error)}`);
  redirect("/admin/collaborations?saved=status");
}
