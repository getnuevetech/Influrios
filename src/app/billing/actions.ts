"use server";

import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { prisma } from "@/lib/db";
import { getAppOrigin, isBillingSku, startCheckout } from "@/lib/billing";
import { findActivePlan } from "@/lib/entitlements-db";
import { planPageReturn } from "@/lib/plan-presentation";
import { openCreatorConnectOnboarding, openCustomerPortal } from "@/lib/stripe-admin";

export async function actionStartCheckout(formData: FormData) {
  const sku = String(formData.get("sku") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || undefined;
  const returnTo = planPageReturn(formData.get("returnTo"));

  if (!isBillingSku(sku)) {
    const plan = await findActivePlan(sku);
    if (!plan) redirect(`${returnTo}?error=${encodeURIComponent("That plan is not available. Nothing was charged.")}`);
  }
  if (formData.get("acceptSubscription") !== "on") {
    redirect(`${returnTo}?error=` + encodeURIComponent("Agree to the subscription terms at checkout."));
  }
  const account = await getAccountSession();
  if (!account) redirect(`/login?next=${encodeURIComponent(returnTo)}&gate=checkout`);

  const { recordLegalEvent } = await import("@/lib/legal");
  await recordLegalEvent({
    trigger: "subscription_checkout",
    context: `subscription_checkout:${sku}`,
    userId: account.id,
    userRole: "CREATOR",
  });
  const creator = await prisma.creator.findUnique({ where: { userId: account.id }, select: { slug: true } }).catch(() => null);
  const result = await startCheckout({
    sku,
    customerEmail: email || account.email,
    creatorSlug: creator?.slug,
    userId: account.id,
  });
  if (!result.ok) {
    redirect(`${returnTo}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(result.url);
}

export async function actionOpenPortal(formData?: FormData) {
  const returnTo = planPageReturn(formData?.get("returnTo"));
  const account = await getAccountSession();
  if (!account) redirect(`/login?next=${encodeURIComponent(returnTo)}&gate=portal`);
  const user = await prisma.user.findUnique({ where: { id: account.id }, select: { stripeCustomerId: true } });
  if (!user?.stripeCustomerId) {
    redirect(`${returnTo}?error=${encodeURIComponent("Complete a Stripe checkout first. Nothing was opened.")}`);
  }
  const origin = getAppOrigin();
  const result = await openCustomerPortal({
    customerId: user.stripeCustomerId,
    returnUrl: `${origin}${returnTo}`,
  });
  if (!result.ok) redirect(`${returnTo}?error=${encodeURIComponent(result.error)}`);
  redirect(result.url);
}

export async function actionOpenConnectedAccount() {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/billing&gate=connect");
  const { openCreatorConnectedAccount } = await import("@/lib/providers/airwallex-runtime");
  const result = await openCreatorConnectedAccount({ userId: account.id, email: account.email });
  if (!result.ok) redirect(`/billing?error=${encodeURIComponent(result.error)}`);
  if (result.url && result.url.startsWith("https://")) redirect(result.url);
  redirect("/billing?connected=1");
}

export async function actionOpenConnect() {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/billing&gate=connect");
  const origin = getAppOrigin();
  const result = await openCreatorConnectOnboarding({
    userId: account.id,
    email: account.email,
    refreshUrl: `${origin}/billing`,
    returnUrl: `${origin}/billing`,
  });
  if (!result.ok) redirect(`/billing?error=${encodeURIComponent(result.error)}`);
  redirect(result.url);
}
