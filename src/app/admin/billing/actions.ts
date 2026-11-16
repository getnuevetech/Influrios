"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { saveAnnualOffers, saveBillingPriceIds, type BillingSku } from "@/lib/billing";
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

export async function actionPauseAnnualCode(formData: FormData) {
  const { actionPauseDiscountCode } = await import("@/app/admin/payment-settings/discount-actions");
  const result = await actionPauseDiscountCode(formData);
  if ("error" in result && result.error) redirect(`/admin/billing?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/admin/billing");
  redirect("/admin/billing?saved=pause");
}

export async function actionSaveBillingPrices(formData: FormData) {
  await requireAdminAction("gateways.edit");
  const prices: Partial<Record<BillingSku, string>> = {};
  for (const sku of SKUS) prices[sku] = String(formData.get(sku) ?? "");
  const annual = Object.fromEntries(
    SKUS.map((sku) => [sku, {
      amount: String(formData.get(`${sku}_annual_amount`) ?? ""),
      priceId: String(formData.get(`${sku}_annual_price`) ?? ""),
    }]),
  ) as Partial<Record<BillingSku, { amount: string; priceId: string }>>;
  try {
    await saveBillingPriceIds(prices);
    await saveAnnualOffers(annual, prices);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save price ids.";
    redirect(`/admin/billing?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/billing");
  revalidatePath("/billing");
  redirect("/admin/billing?saved=prices");
}
