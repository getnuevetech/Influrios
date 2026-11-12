"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { PAYMENT_CHARGE_SWITCHES, savePaymentChargeSwitches, type PaymentChargeKey } from "@/lib/payment-charge-switches";

export async function actionSavePaymentChargeSwitches(formData: FormData) {
  const session = await requireAdminAction("marketplace.manage");
  const enabled: Partial<Record<PaymentChargeKey, boolean>> = {};
  for (const spec of PAYMENT_CHARGE_SWITCHES) enabled[spec.key] = formData.get(spec.key) === "on";
  try {
    await savePaymentChargeSwitches({
      actor: session.email,
      reason: String(formData.get("reason") ?? ""),
      enabled,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the payment switches.";
    redirect(`/admin/payment-switches?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/payment-switches");
  redirect("/admin/payment-switches?saved=switches");
}
