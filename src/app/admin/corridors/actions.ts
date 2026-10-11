"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import {
  createCorridor,
  deleteCorridorGroup,
  saveCorridorGroup,
  setCorridorActive,
  updateCorridor,
} from "@/lib/collab-control-plane";
import { PAYOUT_METHODS, savePayoutFallbackCurrency } from "@/lib/payout-readiness";

function bool(formData: FormData, key: string) {
  return String(formData.get(key) ?? "") === "1" || String(formData.get(key) ?? "") === "on";
}

export async function actionToggleCorridor(formData: FormData) {
  const session = await requireAdminAction("collab_finance.manage");
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

export async function actionCreateCorridor(formData: FormData) {
  const session = await requireAdminAction("collab_finance.manage");
  const methods = formData
    .getAll("payoutMethod")
    .map((value) => String(value))
    .filter((value) => (PAYOUT_METHODS as readonly string[]).includes(value));
  try {
    await createCorridor({
      countryCode: String(formData.get("countryCode") ?? ""),
      actor: session.email,
      collectionProviderCode: String(formData.get("collectionProviderCode") ?? "") || null,
      payoutMethods: methods,
      kycModel: String(formData.get("kycModel") ?? ""),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add that country.";
    redirect(`/admin/corridors?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/corridors");
  redirect("/admin/corridors?saved=country");
}

export async function actionSaveCorridorGroup(formData: FormData) {
  const session = await requireAdminAction("collab_finance.manage");
  try {
    await saveCorridorGroup({
      id: String(formData.get("id") ?? "") || undefined,
      name: String(formData.get("name") ?? ""),
      countryCodes: formData.getAll("countryCode").map((value) => String(value)),
      kycModel: String(formData.get("kycModel") ?? ""),
      actor: session.email,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save that country group.";
    redirect(`/admin/corridors?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/corridors");
  redirect("/admin/corridors?saved=group");
}

export async function actionDeleteCorridorGroup(formData: FormData) {
  const session = await requireAdminAction("collab_finance.manage");
  try {
    await deleteCorridorGroup({ id: String(formData.get("id") ?? ""), actor: session.email });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove that country group.";
    redirect(`/admin/corridors?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/corridors");
  redirect("/admin/corridors?saved=group-removed");
}

export async function actionSavePayoutFallback(formData: FormData) {
  await requireAdminAction("collab_finance.manage");
  try {
    await savePayoutFallbackCurrency(String(formData.get("payoutFallbackCurrency") ?? ""));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the backup currency.";
    redirect(`/admin/corridors?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/corridors");
  redirect("/admin/corridors?saved=backup");
}

export async function actionUpdateCorridor(formData: FormData) {
  const session = await requireAdminAction("collab_finance.manage");
  const countryCode = String(formData.get("countryCode") ?? "").trim().toUpperCase();
  const currencyField = formData.get("currency");
  const methods = formData
    .getAll("payoutMethod")
    .map((value) => String(value))
    .filter((value) => (PAYOUT_METHODS as readonly string[]).includes(value));
  try {
    await updateCorridor({
      countryCode,
      actor: session.email,
      currency: currencyField == null ? undefined : String(currencyField),
      collectionProviderCode: String(formData.get("collectionProviderCode") ?? "") || null,
      holdingEnabled: bool(formData, "holdingEnabled"),
      fxEnabled: bool(formData, "fxEnabled"),
      kycModel: String(formData.get("kycModel") ?? ""),
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
