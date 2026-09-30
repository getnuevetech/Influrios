"use server";

import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { isPlanCode } from "@/lib/entitlements";
import { updatePlanFeature } from "@/lib/entitlements-db";

export async function actionUpdatePlanFeature(formData: FormData) {
  const session = await requireAdminAction("plans.edit");
  const planCode = String(formData.get("planCode") ?? "");
  const featureKey = String(formData.get("featureKey") ?? "");
  const kind = String(formData.get("kind") ?? "");
  if (!isPlanCode(planCode)) redirect("/admin/plans?error=Unknown+plan");

  try {
    if (kind === "int") {
      const limitInt = Number(formData.get("limitInt"));
      await updatePlanFeature({
        actor: session.email,
        planCode,
        featureKey,
        enabled: true,
        limitInt,
        valueText: null,
      });
    } else if (kind === "bool") {
      await updatePlanFeature({
        actor: session.email,
        planCode,
        featureKey,
        enabled: formData.get("enabled") === "true",
        limitInt: null,
        valueText: null,
      });
    } else {
      const valueText = String(formData.get("valueText") ?? "").trim();
      await updatePlanFeature({
        actor: session.email,
        planCode,
        featureKey,
        enabled: true,
        limitInt: null,
        valueText,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save";
    redirect(`/admin/plans?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/plans?saved=1");
}
