"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { saveDisputeReasons } from "@/lib/milestone-disputes";
import {
  saveJurisdiction,
  saveMarketplaceProvider,
  saveMarketplaceSettings,
  saveMilestoneTemplates,
} from "@/lib/marketplace-ledger";

function flag(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

export async function actionSaveMarketplaceSettings(formData: FormData) {
  await requireAdminAction("marketplace.manage");
  try {
    await saveMarketplaceSettings({
      reviewWindowHours: Number(formData.get("reviewWindowHours")),
      cancelUnconfirmed: formData.get("cancelUnconfirmed") === "on",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save settings.";
    redirect(`/admin/marketplace?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/marketplace");
  redirect("/admin/marketplace?saved=settings");
}

export async function actionSaveJurisdiction(formData: FormData) {
  await requireAdminAction("marketplace.manage");
  try {
    await saveJurisdiction({
      code: String(formData.get("code") ?? ""),
      label: String(formData.get("label") ?? ""),
      protectedPaymentsEnabled: flag(formData, "protectedPaymentsEnabled"),
      escrowTermAllowed: flag(formData, "escrowTermAllowed"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the jurisdiction.";
    redirect(`/admin/marketplace?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/marketplace");
  revalidatePath("/payments");
  redirect("/admin/marketplace?saved=jurisdiction");
}

export async function actionSaveTemplates(formData: FormData) {
  await requireAdminAction("marketplace.manage");
  const titles = formData.getAll("title").map((value) => String(value));
  const shares = formData.getAll("sharePercent").map((value) => Number(value));
  const ids = formData.getAll("id").map((value) => String(value));
  const active = formData.getAll("activeIndex").map((value) => String(value));
  const rows = titles.map((title, index) => ({
    id: ids[index] || undefined,
    title,
    sharePercent: shares[index] ?? 0,
    active: active.includes(String(index)),
  }));
  const extraTitle = String(formData.get("newTitle") ?? "").trim();
  const extraShare = Number(formData.get("newSharePercent") ?? 0);
  if (extraTitle) {
    rows.push({ id: undefined, title: extraTitle, sharePercent: extraShare, active: flag(formData, "newActive") });
  }
  try {
    await saveMilestoneTemplates(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save milestone templates.";
    redirect(`/admin/marketplace?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/marketplace");
  revalidatePath("/payments");
  redirect("/admin/marketplace?saved=templates");
}

export async function actionSaveMarketplaceProvider(formData: FormData) {
  await requireAdminAction("marketplace.manage");
  try {
    await saveMarketplaceProvider({
      name: String(formData.get("name") ?? ""),
      enabled: flag(formData, "enabled"),
      webhook: String(formData.get("webhook") ?? ""),
      clearWebhook: flag(formData, "clearWebhook"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the provider.";
    redirect(`/admin/marketplace?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/marketplace");
  redirect("/admin/marketplace?saved=provider");
}

export async function actionSaveDisputeReasons(formData: FormData) {
  await requireAdminAction("marketplace.manage");
  const labels = formData.getAll("label").map((value) => String(value));
  const ids = formData.getAll("id").map((value) => String(value));
  const active = formData.getAll("activeIndex").map((value) => String(value));
  const rows = labels.map((label, index) => ({
    id: ids[index] || undefined,
    label,
    active: active.includes(String(index)),
  }));
  const extra = String(formData.get("newLabel") ?? "").trim();
  if (extra) rows.push({ id: undefined, label: extra, active: formData.get("newActive") === "on" });
  try {
    await saveDisputeReasons(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save dispute reasons.";
    redirect(`/admin/marketplace?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/marketplace");
  revalidatePath("/trust");
  redirect("/admin/marketplace?saved=reasons");
}
