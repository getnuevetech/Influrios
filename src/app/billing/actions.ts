"use server";

import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { getAppOrigin, startCheckout, type BillingSku } from "@/lib/billing";
import { openConnectLink, openCustomerPortal } from "@/lib/stripe-admin";

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
  const result = await startCheckout({
    sku,
    customerEmail: email || account.email,
    creatorSlug,
    userId: account.id,
  });
  if (!result.ok) {
    redirect(`/billing?error=${encodeURIComponent(result.error)}`);
  }
  redirect(result.url);
}

export async function actionOpenPortal(formData: FormData) {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/billing&gate=portal");
  const origin = getAppOrigin();
  const result = await openCustomerPortal({
    customerId: String(formData.get("customerId") ?? ""),
    returnUrl: `${origin}/billing`,
  });
  if (!result.ok) redirect(`/billing?error=${encodeURIComponent(result.error)}`);
  redirect(result.url);
}

export async function actionOpenConnect(formData: FormData) {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/billing&gate=connect");
  const origin = getAppOrigin();
  const result = await openConnectLink({
    accountId: String(formData.get("accountId") ?? ""),
    refreshUrl: `${origin}/billing`,
    returnUrl: `${origin}/billing`,
  });
  if (!result.ok) redirect(`/billing?error=${encodeURIComponent(result.error)}`);
  redirect(result.url);
}
