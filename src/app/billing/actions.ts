"use server";

import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { startCheckout, type BillingSku } from "@/lib/billing";

const SKUS: BillingSku[] = ["creator_plus", "creator_pro", "business_pro", "agency"];

export async function actionStartCheckout(formData: FormData) {
  const sku = String(formData.get("sku") ?? "") as BillingSku;
  const email = String(formData.get("email") ?? "").trim() || undefined;
  const creatorSlug = String(formData.get("creatorSlug") ?? "").trim() || undefined;

  if (!SKUS.includes(sku)) {
    redirect("/billing?error=invalid_sku");
  }
  if (formData.get("acceptSubscription") !== "on") {
    redirect("/billing?error=" + encodeURIComponent("Agree to the subscription terms at checkout."));
  }
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/billing&gate=checkout");

  const { recordLegalEvent } = await import("@/lib/legal");
  await recordLegalEvent({
    trigger: "subscription_checkout",
    context: `subscription_checkout:${sku}`,
    userId: account.id,
    userRole: "CREATOR",
  });
  const result = await startCheckout({ sku, customerEmail: email, creatorSlug });
  if (!result.ok) {
    redirect(`/billing?error=${encodeURIComponent(result.error)}`);
  }
  redirect(result.url);
}
