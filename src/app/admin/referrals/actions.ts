"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { saveReferralProgram } from "@/lib/referrals";

export async function actionSaveReferralProgram(formData: FormData) {
  await requireAdminAction("shortlinks.edit");
  try {
    await saveReferralProgram({
      enabled: formData.get("enabled") === "1",
      rewardKind: String(formData.get("rewardKind") ?? ""),
      points: String(formData.get("points") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      currency: String(formData.get("currency") ?? ""),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the referral reward.";
    redirect(`/admin/referrals?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/referrals");
  redirect("/admin/referrals?saved=1");
}
