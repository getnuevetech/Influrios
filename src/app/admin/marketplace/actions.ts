"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { saveAttributionPolicy, saveAttributionSources } from "@/lib/deal-attribution";
import { saveDisputeReasons } from "@/lib/milestone-disputes";
import {
  saveFundingSchedule,
  saveJurisdiction,
  saveMarketplaceProvider,
  saveMarketplaceSettings,
  saveMilestoneTemplates,
} from "@/lib/marketplace-ledger";
import { saveFxRates, saveRevenueParties } from "@/lib/settlement";

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
      currency: String(formData.get("currency") ?? "USD"),
      providerCode: String(formData.get("providerCode") ?? "primary"),
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
      code: String(formData.get("code") ?? ""),
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

export async function actionSaveFxRates(formData: FormData) {
  await requireAdminAction("marketplace.manage");
  const currencies = formData.getAll("currency").map((value) => String(value));
  const minors = formData.getAll("minorPerUsd").map((value) => Number(value));
  const active = formData.getAll("activeIndex").map((value) => String(value));
  const rows = currencies.map((currency, index) => ({
    currency,
    minorPerUsd: minors[index] ?? 0,
    active: active.includes(String(index)),
  }));
  const extra = String(formData.get("newCurrency") ?? "").trim();
  if (extra) {
    rows.push({
      currency: extra,
      minorPerUsd: Number(formData.get("newMinorPerUsd") ?? 0),
      active: flag(formData, "newActive"),
    });
  }
  try {
    await saveFxRates(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save FX rates.";
    redirect(`/admin/marketplace?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/marketplace");
  revalidatePath("/payments");
  redirect("/admin/marketplace?saved=fx");
}

export async function actionSaveRevenueParties(formData: FormData) {
  await requireAdminAction("marketplace.manage");
  const labels = formData.getAll("label").map((value) => String(value));
  const shares = formData.getAll("sharePercent").map((value) => Number(value));
  const ids = formData.getAll("id").map((value) => String(value));
  const active = formData.getAll("activeIndex").map((value) => String(value));
  const rows = labels.map((label, index) => ({
    id: ids[index] || undefined,
    label,
    sharePercent: shares[index] ?? 0,
    active: active.includes(String(index)),
  }));
  const extra = String(formData.get("newLabel") ?? "").trim();
  if (extra) {
    rows.push({
      id: undefined,
      label: extra,
      sharePercent: Number(formData.get("newSharePercent") ?? 0),
      active: flag(formData, "newActive"),
    });
  }
  try {
    await saveRevenueParties(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save revenue shares.";
    redirect(`/admin/marketplace?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/marketplace");
  redirect("/admin/marketplace?saved=shares");
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

export async function actionSaveFundingSchedule(formData: FormData) {
  await requireAdminAction("marketplace.manage");
  try {
    await saveFundingSchedule({
      stagedFundingEnabled: formData.get("stagedFundingEnabled") === "on",
      recurringFundingEnabled: formData.get("recurringFundingEnabled") === "on",
      maxStages: Number(formData.get("maxStages")),
      recurringIntervalDays: Number(formData.get("recurringIntervalDays")),
      maxRecurrences: Number(formData.get("maxRecurrences")),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the funding schedule.";
    redirect(`/admin/marketplace?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/marketplace");
  revalidatePath("/payments");
  redirect("/admin/marketplace?saved=schedule");
}

export async function actionSaveAttributionPolicy(formData: FormData) {
  await requireAdminAction("marketplace.manage");
  try {
    await saveAttributionPolicy({
      windowDays: Number(formData.get("attributionWindowDays")),
      minGrossCents: Math.round(Number(formData.get("repeatMinUsd") ?? 0) * 100),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save attribution settings.";
    redirect(`/admin/marketplace?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/marketplace");
  revalidatePath("/payments");
  redirect("/admin/marketplace?saved=attribution");
}

export async function actionSaveAttributionSources(formData: FormData) {
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
    await saveAttributionSources(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save attribution sources.";
    redirect(`/admin/marketplace?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/marketplace");
  revalidatePath("/payments");
  redirect("/admin/marketplace?saved=sources");
}
