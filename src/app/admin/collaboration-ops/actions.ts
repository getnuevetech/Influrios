"use server";

import { requireAdminAction } from "@/app/admin/guard";
import { requireCollabFinanceHighRisk } from "@/lib/admin-auth";
import { saveCollabControlPlane } from "@/lib/collab-control-plane";
import { enqueueMarketplaceApplicationExpireSweep } from "@/lib/jobs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function num(formData: FormData, key: string, fallback: number) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? Math.floor(value) : fallback;
}

function bool(formData: FormData, key: string) {
  return String(formData.get(key) ?? "") === "1" || String(formData.get(key) ?? "") === "on";
}

export async function actionSaveCollabControlPlane(formData: FormData) {
  const session = await requireAdminAction("collab_finance.manage");
  const dualUsd = Number(formData.get("dualApprovalUsd"));
  const dualApprovalThresholdCents =
    Number.isFinite(dualUsd) && dualUsd >= 0 ? Math.round(dualUsd * 100) : 500_00;

  // Changing the dual-approval money threshold is high-risk — require step-up.
  const stepUp = await requireCollabFinanceHighRisk(
    session,
    String(formData.get("stepUpPassword") ?? ""),
  );
  if (!stepUp.ok) {
    redirect(`/admin/collaboration-ops?error=${encodeURIComponent(stepUp.error)}`);
  }

  await saveCollabControlPlane({
    actor: session.email,
    dualApprovalThresholdCents,
    mentorship: {
      enabled: bool(formData, "mentorshipEnabled"),
      minFollowers: num(formData, "minFollowers", 1_000),
      requireIdentityVerified: bool(formData, "requireIdentityVerified"),
      requireGlobalPayoutReady: bool(formData, "requireGlobalPayoutReady"),
      notes: String(formData.get("mentorshipNotes") ?? ""),
    },
    guestCollab: {
      proposeSoft: num(formData, "proposeSoft", 1),
      proposeHard: num(formData, "proposeHard", 2),
      applySoft: num(formData, "applySoft", 2),
      applyHard: num(formData, "applyHard", 3),
    },
    applicationExpire: {
      mode: String(formData.get("applicationExpireMode") ?? "manual") === "auto" ? "auto" : "manual",
      afterDays: num(formData, "applicationExpireAfterDays", 14),
    },
  });
  revalidatePath("/admin/collaboration-ops");
  revalidatePath("/admin/corridors");
  redirect("/admin/collaboration-ops?saved=1");
}

export async function actionQueueApplicationExpireSweep() {
  await requireAdminAction("collab_finance.manage");
  await enqueueMarketplaceApplicationExpireSweep();
  revalidatePath("/admin/collaboration-ops");
  redirect("/admin/collaboration-ops?swept=1");
}
