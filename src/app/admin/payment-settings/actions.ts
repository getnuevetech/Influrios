"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { saveCanonicalCountryRoute } from "@/lib/canonical-country-route";

export async function actionSaveCanonicalCountryRoute(formData: FormData) {
  const session = await requireAdminAction("collab_finance.manage");
  const countryCode = String(formData.get("countryCode") ?? "");
  try {
    await saveCanonicalCountryRoute({
      countryCode,
      actor: session.email,
      currency: String(formData.get("currency") ?? ""),
      minorDigits: Number(formData.get("minorDigits") ?? ""),
      collectionProviderCode: String(formData.get("collectionProviderCode") ?? ""),
      holdingProviderCode: String(formData.get("holdingProviderCode") ?? ""),
      payoutGatewayCode: String(formData.get("payoutGatewayCode") ?? ""),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the country route.";
    redirect(`/admin/payment-settings?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/payment-settings");
  revalidatePath("/admin/corridors");
  revalidatePath("/admin/gateways");
  revalidatePath("/admin/marketplace/settings");
  redirect(`/admin/payment-settings?saved=${encodeURIComponent(countryCode.trim().toUpperCase())}`);
}
