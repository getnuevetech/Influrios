"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { saveBillingPriceIds, type BillingSku } from "@/lib/billing";
import { setProductSwitch } from "@/lib/product-switches";
import { probeStripeSandbox } from "@/lib/stripe-admin";

const SKUS: BillingSku[] = ["creator_plus", "creator_pro", "business_pro", "agency"];

export async function actionCheckStripeSandbox() {
  await requireAdminAction("gateways.edit");
  const result = await probeStripeSandbox();
  if (!result.ok) redirect(`/admin/billing?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/admin/billing");
  revalidatePath("/billing");
  redirect("/admin/billing?saved=sandbox");
}

export async function actionSaveBillingSwitches(formData: FormData) {
  await requireAdminAction("gateways.edit");
  await setProductSwitch("customer_portal", formData.get("customer_portal") === "on");
  await setProductSwitch("paid_mentoring", formData.get("paid_mentoring") === "on");
  revalidatePath("/admin/billing");
  revalidatePath("/billing");
  redirect("/admin/billing?saved=switches");
}

export async function actionSaveBillingPrices(formData: FormData) {
  await requireAdminAction("gateways.edit");
  const prices: Partial<Record<BillingSku, string>> = {};
  for (const sku of SKUS) prices[sku] = String(formData.get(sku) ?? "");
  try {
    await saveBillingPriceIds(prices);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save price ids.";
    redirect(`/admin/billing?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/billing");
  revalidatePath("/billing");
  redirect("/admin/billing?saved=prices");
}
