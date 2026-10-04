"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { setCorridorActive, updateCorridor } from "@/lib/collab-control-plane";
import { PAYOUT_METHODS } from "@/lib/payout-readiness";

function bool(formData: FormData, key: string) {
  return String(formData.get(key) ?? "") === "1" || String(formData.get(key) ?? "") === "on";
}

export async function actionToggleCorridor(formData: FormData) {
  const session = await requireAdminAction("marketplace.manage");
  const countryCode = String(formData.get("countryCode") ?? "").trim().toUpperCase();
  const active = String(formData.get("active") ?? "") === "1";
  try {
    await setCorridorActive({ countryCode, active, actor: session.email });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update corridor.";
    redirect(`/admin/corridors?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/corridors");
  revalidatePath("/admin/collaboration-ops");
  redirect(`/admin/corridors?saved=${active ? "activated" : "suspended"}`);
}

export async function actionUpdateCorridor(formData: FormData) {
  const session = await requireAdminAction("marketplace.manage");
  const countryCode = String(formData.get("countryCode") ?? "").trim().toUpperCase();
  const methods = formData
    .getAll("payoutMethod")
    .map((value) => String(value))
    .filter((value) => (PAYOUT_METHODS as readonly string[]).includes(value));
  try {
    await updateCorridor({
      countryCode,
      actor: session.email,
      currency: String(formData.get("currency") ?? "USD"),
      collectionProviderCode: String(formData.get("collectionProviderCode") ?? "") || null,
      holdingEnabled: bool(formData, "holdingEnabled"),
      fxEnabled: bool(formData, "fxEnabled"),
      kycModel: String(formData.get("kycModel") ?? "identity_light"),
      notes: String(formData.get("notes") ?? ""),
      payoutMethods: methods,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update corridor.";
    redirect(`/admin/corridors?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/corridors");
  redirect("/admin/corridors?saved=updated");
}
