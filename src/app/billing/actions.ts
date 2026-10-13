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

function payoutSetupErrorRedirect(error: string): never {
  const trimmed = error.trim();
  const safe =
    /^</.test(trimmed) || /<!DOCTYPE/i.test(trimmed) || /<html[\s>]/i.test(trimmed)
      ? "Payout setup could not reach the payment provider. Check Airwallex credentials and base URL on Payment gateways."
      : trimmed.slice(0, 300);

  // Actionable provider/config problems — show on billing so the operator can fix them.
  if (
    /^Airwallex[:\s]/i.test(safe) ||
    /Airwallex rejected/i.test(safe) ||
    /HTML instead of JSON/i.test(safe) ||
    /hosted onboarding is not configured/i.test(safe) ||
    /hosted flow template/i.test(safe) ||
    /Check the base URL/i.test(safe) ||
    /Check Airwallex credentials/i.test(safe)
  ) {
    redirect(`/billing?error=${encodeURIComponent(safe)}#payouts`);
  }

  // Quiet readiness failures stay on #payouts without flashing operator copy.
  if (
    /Stripe Connect is not ready/i.test(safe) ||
    /Stripe is not ready/i.test(safe) ||
    /turned off/i.test(safe) ||
    /does not list Airwallex/i.test(safe) ||
    /is not set to Airwallex/i.test(safe) ||
    /Save and enable the Airwallex/i.test(safe) ||
    /corridor collection route/i.test(safe) ||
    /payout setup is not available for this corridor/i.test(safe) ||
    (/Nothing was opened/i.test(safe) && /Stripe|Connect|portal|jurisdiction|corridor/i.test(safe))
  ) {
    redirect("/billing#payouts");
  }
  redirect(`/billing?error=${encodeURIComponent(safe)}#payouts`);
}

async function creatorPayoutRailGuard(userId: string) {
  const { resolvePayoutOnboardingRail } = await import("@/lib/payout-readiness");
  const { loadAirwallexConfig } = await import("@/lib/providers/airwallex-config");
  const { stripeConnectReady } = await import("@/lib/stripe-admin");
  const creator = await prisma.creator.findUnique({
    where: { userId },
    select: {
      locationCountry: true,
      payoutProfile: {
        select: {
          stripeConnectAccountId: true,
          providerConnectedAccountId: true,
          primaryCountryCode: true,
        },
      },
    },
  });
  if (!creator) {
    return { ok: false as const, error: "Create your Influencer Card before opening payout setup. Nothing was opened." };
  }
  const rail = await resolvePayoutOnboardingRail({
    locationCountry: creator.locationCountry,
    fallbackCountryCode: creator.payoutProfile?.primaryCountryCode,
    stripeConnectReady: await stripeConnectReady().catch(() => false),
    providerReady: Boolean(await loadAirwallexConfig().catch(() => null)),
    hasStripeConnectAccount: Boolean(creator.payoutProfile?.stripeConnectAccountId),
    hasProviderAccount: Boolean(creator.payoutProfile?.providerConnectedAccountId),
  });
  return { ok: true as const, rail };
}

export async function actionOpenConnectedAccount() {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/billing&gate=connect");
  const guard = await creatorPayoutRailGuard(account.id);
  if (!guard.ok) payoutSetupErrorRedirect(guard.error);
  if (!guard.rail.showProvider) {
    payoutSetupErrorRedirect(
      guard.rail.collectionProviderCode
        ? `This corridor collection route is ${guard.rail.collectionProviderCode}. Nothing was opened.`
        : "Connected-account payout setup is not available for this corridor. Nothing was opened.",
    );
  }
  const { openCreatorConnectedAccount } = await import("@/lib/providers/airwallex-runtime");
  const result = await openCreatorConnectedAccount({ userId: account.id, email: account.email });
  if (!result.ok) payoutSetupErrorRedirect(result.error);
  if (result.url && result.url.startsWith("https://")) redirect(result.url);
  redirect("/billing?connected=1#payouts");
}

export async function actionOpenConnect() {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/billing&gate=connect");
  const guard = await creatorPayoutRailGuard(account.id);
  if (!guard.ok) payoutSetupErrorRedirect(guard.error);
  if (!guard.rail.showStripe) {
    payoutSetupErrorRedirect(
      guard.rail.collectionProviderCode === "airwallex"
        ? "This corridor collection route is Airwallex. Nothing was opened."
        : "Stripe Connect payout setup is not available for this corridor. Nothing was opened.",
    );
  }
  const origin = getAppOrigin();
  const result = await openCreatorConnectOnboarding({
    userId: account.id,
    email: account.email,
    refreshUrl: `${origin}/billing#payouts`,
    returnUrl: `${origin}/billing?connected=1#payouts`,
  });
  if (!result.ok) payoutSetupErrorRedirect(result.error);
  redirect(result.url);
}
