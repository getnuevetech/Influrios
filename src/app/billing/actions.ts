"use server";

import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { prisma } from "@/lib/db";
import { getAppOrigin, isBillingSku, startCheckout } from "@/lib/billing";
import { findActivePlan } from "@/lib/entitlements-db";
import { planPageReturn } from "@/lib/plan-presentation";
import { openCreatorConnectOnboarding, openCustomerPortal } from "@/lib/stripe-admin";
import { billingAddressReady } from "@/lib/tax-configuration";
import { countryRegions, notifyTaxGap, previewConfiguredTax, subscriptionCheckoutContext } from "@/lib/tax-settings";

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
  const tax = await subscriptionCheckoutContext(sku);
  if (tax.gate.kind === "free") {
    redirect(`${returnTo}?error=` + encodeURIComponent("This plan has no charge. Cancelling a paid subscription is a separate billing step. Nothing was charged."));
  }
  if (tax.gate.kind === "unavailable") {
    await notifyTaxGap({ planCode: tax.plan?.code || sku, missing: tax.gate.missing });
    redirect(`${returnTo}?error=` + encodeURIComponent(tax.gate.message));
  }
  const address = {
    country: String(formData.get("country") ?? ""),
    region: String(formData.get("region") ?? ""),
    postalCode: String(formData.get("postalCode") ?? ""),
    line1: String(formData.get("line1") ?? ""),
    city: String(formData.get("city") ?? ""),
    requireStreet: true,
  };
  if (!billingAddressReady(address)) {
    redirect(`${returnTo}?error=` + encodeURIComponent("Add your billing address to calculate tax."));
  }
  const account = await getAccountSession();
  if (!account) redirect(`/login?next=${encodeURIComponent(returnTo)}&gate=checkout`);
  const policy = tax.policy;
  if (!policy) {
    await notifyTaxGap({ planCode: tax.plan?.code || sku, missing: "Tax configuration for this plan" });
    redirect(`${returnTo}?error=` + encodeURIComponent("This plan is temporarily unavailable."));
  }
  const preview = await previewConfiguredTax({
    audience: "customer",
    phase: "calculate",
    method: policy.calculationMethod,
    amountCents: tax.amountCents,
    inclusive: policy.inclusive,
    taxCategory: policy.taxCategory,
    rateBps: policy.rateBps,
    jurisdiction: policy.jurisdiction,
    liableEntity: policy.liableEntity,
    country: address.country,
    region: address.region,
    postalCode: address.postalCode,
    line1: address.line1,
    city: address.city,
    requireStreet: true,
    subjectSelected: true,
  });
  if (!preview.ok || preview.taxCents == null) {
    redirect(`${returnTo}?error=` + encodeURIComponent(preview.customerMessage || "We couldn't calculate tax. Nothing was charged."));
  }

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
    automaticTax: policy.calculationMethod === "automatic",
  });
  if (!result.ok) {
    redirect(`${returnTo}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(result.url);
}

export async function actionCountryRegions(countryCode: string) {
  return countryRegions(countryCode);
}

export async function actionPreviewSubscriptionTax(formData: FormData) {
  const account = await getAccountSession();
  if (!account) {
    return { ok: false as const, kind: "configuration" as const, message: "Sign in to calculate tax. Nothing was charged.", taxCents: null, totalCents: null, subtotalCents: null, reason: "" };
  }
  const sku = String(formData.get("sku") ?? "").trim();
  const tax = await subscriptionCheckoutContext(sku);
  if (tax.gate.kind === "free") {
    return { ok: true as const, kind: "free" as const, message: "This plan has no charge.", taxCents: null, totalCents: null, subtotalCents: null, reason: "" };
  }
  if (tax.gate.kind === "unavailable" || !tax.policy) {
    const missing = tax.gate.kind === "unavailable" ? tax.gate.missing : "Tax configuration for this plan";
    await notifyTaxGap({ planCode: tax.plan?.code || sku, missing });
    return { ok: false as const, kind: "configuration" as const, message: "This plan is temporarily unavailable.", taxCents: null, totalCents: null, subtotalCents: null, reason: "" };
  }
  const preview = await previewConfiguredTax({
    audience: "customer",
    phase: "calculate",
    method: tax.policy.calculationMethod,
    amountCents: tax.amountCents,
    inclusive: tax.policy.inclusive,
    taxCategory: tax.policy.taxCategory,
    rateBps: tax.policy.rateBps,
    jurisdiction: tax.policy.jurisdiction,
    liableEntity: tax.policy.liableEntity,
    country: String(formData.get("country") ?? ""),
    region: String(formData.get("region") ?? ""),
    postalCode: String(formData.get("postalCode") ?? ""),
    line1: String(formData.get("line1") ?? ""),
    city: String(formData.get("city") ?? ""),
    requireStreet: true,
    subjectSelected: true,
  });
  return {
    ok: preview.ok,
    kind: preview.kind,
    message: preview.customerMessage,
    taxCents: preview.taxCents,
    totalCents: preview.totalCents,
    subtotalCents: preview.subtotalCents,
    reason: preview.reason,
  };
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

const PAYOUT_SETUP_PATH = "/creator/earnings";

function payoutSetupErrorRedirect(error: string): never {
  const trimmed = error.trim();
  const safe =
    /^</.test(trimmed) || /<!DOCTYPE/i.test(trimmed) || /<html[\s>]/i.test(trimmed)
      ? "Payout setup could not reach the payment provider. Check Airwallex credentials and base URL on Payment gateways."
      : trimmed.slice(0, 300);

  // Actionable provider/config problems — show on Earnings payout setup.
  if (
    /^Airwallex[:\s]/i.test(safe) ||
    /Airwallex rejected/i.test(safe) ||
    /HTML instead of JSON/i.test(safe) ||
    /hosted onboarding is not configured/i.test(safe) ||
    /hosted flow template/i.test(safe) ||
    /Check the base URL/i.test(safe) ||
    /Check Airwallex credentials/i.test(safe)
  ) {
    redirect(`${PAYOUT_SETUP_PATH}?error=${encodeURIComponent(safe)}#payouts`);
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
    redirect(`${PAYOUT_SETUP_PATH}#payouts`);
  }
  redirect(`${PAYOUT_SETUP_PATH}?error=${encodeURIComponent(safe)}#payouts`);
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
  if (!account) redirect(`/login?next=${encodeURIComponent(PAYOUT_SETUP_PATH)}&gate=connect`);
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
  redirect(`${PAYOUT_SETUP_PATH}?connected=1#payouts`);
}

export async function actionOpenConnect() {
  const account = await getAccountSession();
  if (!account) redirect(`/login?next=${encodeURIComponent(PAYOUT_SETUP_PATH)}&gate=connect`);
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
    refreshUrl: `${origin}${PAYOUT_SETUP_PATH}#payouts`,
    returnUrl: `${origin}${PAYOUT_SETUP_PATH}?connected=1#payouts`,
  });
  if (!result.ok) payoutSetupErrorRedirect(result.error);
  redirect(result.url);
}
