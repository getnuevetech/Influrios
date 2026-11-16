"use server";

import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { prisma } from "@/lib/db";
import { clearScheduledInterval, getAppOrigin, isBillingSku, recordScheduledInterval, recurringOfferFor, startCheckout } from "@/lib/billing";
import { findActivePlan } from "@/lib/entitlements-db";
import { planPageReturn } from "@/lib/plan-presentation";
import { openCreatorConnectOnboarding, openCustomerPortal } from "@/lib/stripe-admin";
import { billingAddressReady } from "@/lib/tax-configuration";
import { annualCodeOnMonthly, displayedPriceBreakdown, formatOfferAmount, formatRenewalDate, parseBillingInterval, samePlan, type BillingInterval } from "@/lib/billing-interval";
import { discountCents, ineligibilityReason, normalizeDiscountCode, renewalOn, type DiscountOffer } from "@/lib/discount-codes";
import { customerUseCount, findDiscountOffer } from "@/lib/discount-store";
import { countryRegions, notifyTaxGap, previewConfiguredTax, subscriptionCheckoutContext } from "@/lib/tax-settings";

function subscriptionCodeQuote(input: {
  typedCode: string;
  offer: DiscountOffer | null;
  planCode: string;
  planName: string;
  amountCents: number;
  interval: BillingInterval;
  countryCode: string;
  accountId: string;
  priorUses: number;
  now: string;
}) {
  if (!input.offer || input.offer.normalizedCode !== normalizeDiscountCode(input.typedCode)) {
    return { ok: false as const, reason: "This code is not valid." };
  }
  const reason = ineligibilityReason(input.offer, {
    charge: "subscription",
    countryCode: input.countryCode,
    currency: "USD",
    planCode: input.planCode,
    planName: input.planName,
    billingInterval: input.interval,
    accountId: input.accountId,
    now: input.now,
    priorUses: input.priorUses,
  });
  if (reason) return { ok: false as const, reason };
  const discount = discountCents({
    kind: input.offer.kind,
    percentBps: input.offer.percentBps,
    fixedCents: input.offer.fixedCents,
    baseCents: input.amountCents,
  });
  if (!discount.ok) return { ok: false as const, reason: discount.error };
  return {
    ok: true as const,
    code: input.offer.normalizedCode,
    discountCents: discount.discountCents,
    subtotalCents: input.amountCents - discount.discountCents,
    renewalOn: renewalOn(input.now, input.interval),
    renewalPriceCents: input.amountCents,
  };
}

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
  const tax = await subscriptionCheckoutContext(sku, address.country);
  if (tax.gate.kind === "free") {
    redirect(`${returnTo}?error=` + encodeURIComponent("This plan has no charge. Cancelling a paid subscription is a separate billing step. Nothing was charged."));
  }
  if (tax.gate.kind === "unavailable") {
    await notifyTaxGap({ planCode: tax.plan?.code || sku, missing: tax.gate.missing });
    redirect(`${returnTo}?error=` + encodeURIComponent(tax.gate.message));
  }
  const account = await getAccountSession();
  if (!account) redirect(`/login?next=${encodeURIComponent(returnTo)}&gate=checkout`);
  const policy = tax.policy;
  if (!policy) {
    await notifyTaxGap({ planCode: tax.plan?.code || sku, missing: "Tax configuration for this plan" });
    redirect(`${returnTo}?error=` + encodeURIComponent("This plan is temporarily unavailable."));
  }
  const interval = parseBillingInterval(formData.get("interval"));
  const offerForInterval = await recurringOfferFor(sku, interval);
  if (!offerForInterval.ok) {
    redirect(`${returnTo}?interval=${interval}&error=${encodeURIComponent(`${offerForInterval.reason} Nothing was charged.`)}&discount=${encodeURIComponent(String(formData.get("discountCode") ?? ""))}`);
  }
  const subscription = await prisma.subscriptionState.findFirst({ where: { userId: account.id }, orderBy: { updatedAt: "desc" } });
  if (subscription && (subscription.status === "active" || subscription.status === "trialing" || subscription.status === "past_due")) {
    const message = subscription.status === "past_due"
      ? "Update the payment method before changing this plan. Nothing was charged."
      : subscription.externalId
        ? "This account already has a subscription. Confirm the change on Billing & plan. Nothing was charged."
        : "Resolve the subscription reference before starting another subscription. Nothing was changed.";
    redirect(`${returnTo}?interval=${interval}&error=${encodeURIComponent(message)}`);
  }
  const typedDiscount = String(formData.get("discountCode") ?? "");
  const discountCode = normalizeDiscountCode(typedDiscount);
  let chargeCents = offerForInterval.offer.amountCents;
  let checkoutDiscount: {
    code: string;
    discountCents: number;
    baseCents: number;
    countryCode: string;
    planCode: string;
    billingInterval: BillingInterval;
    percentBps: number | null;
    amountOffCents: number | null;
    version: number;
  } | null = null;
  if (discountCode) {
    const offer = await findDiscountOffer(discountCode);
    const planCode = tax.plan?.code || sku;
    const planName = tax.plan?.name || sku;
    if (offer && offer.billingInterval === "year" && interval === "month" && samePlan(offer.planCode, planCode)) {
      redirect(`${returnTo}?interval=month&discount=${encodeURIComponent(typedDiscount)}&error=${encodeURIComponent(`${typedDiscount.trim()} is valid for ${planName} annual. Review annual billing or continue monthly without the code. Nothing was charged.`)}`);
    }
    const prior = offer ? await customerUseCount(offer.id, account.id) : 0;
    const quoted = subscriptionCodeQuote({
      typedCode: typedDiscount,
      offer,
      planCode: offer && samePlan(offer.planCode, planCode) ? offer.planCode : planCode,
      planName,
      amountCents: offerForInterval.offer.amountCents,
      interval,
      countryCode: address.country,
      accountId: account.id,
      priorUses: prior,
      now: new Date().toISOString(),
    });
    if (!quoted.ok || !offer) {
      redirect(`${returnTo}?error=${encodeURIComponent(quoted.ok ? "This code is not valid." : quoted.reason)}&discount=${encodeURIComponent(typedDiscount)}`);
    }
    chargeCents = quoted.subtotalCents;
    checkoutDiscount = {
      code: quoted.code,
      discountCents: quoted.discountCents,
      baseCents: offerForInterval.offer.amountCents,
      countryCode: address.country,
      planCode: tax.plan?.code || sku,
      billingInterval: interval,
      percentBps: offer.kind === "percentage" ? offer.percentBps : null,
      amountOffCents: offer.kind === "fixed" ? quoted.discountCents : null,
      version: offer.version,
    };
  }
  const preview = await previewConfiguredTax({
    audience: "customer",
    phase: "calculate",
    method: tax.rule?.method ?? policy.calculationMethod,
    amountCents: chargeCents,
    inclusive: tax.rule?.inclusive ?? policy.inclusive,
    taxCategory: policy.taxCategory,
    rateBps: tax.rule?.method === "percentage" && tax.rule.ratePercent != null ? Math.round(tax.rule.ratePercent * 100) : policy.rateBps,
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
    interval,
    automaticTax: (tax.rule?.method ?? policy.calculationMethod) === "location" || (tax.rule?.method ?? policy.calculationMethod) === "automatic",
    taxPercent: (tax.rule?.method ?? policy.calculationMethod) === "percentage" ? tax.rule?.ratePercent ?? null : null,
    discount: checkoutDiscount,
  });
  if (!result.ok) {
    redirect(`${returnTo}?error=${encodeURIComponent(result.error)}&discount=${encodeURIComponent(typedDiscount)}`);
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
  const tax = await subscriptionCheckoutContext(sku, String(formData.get("country") ?? ""));
  if (tax.gate.kind === "free") {
    return { ok: true as const, kind: "free" as const, message: "This plan has no charge.", taxCents: null, totalCents: null, subtotalCents: null, reason: "" };
  }
  if (tax.gate.kind === "unavailable" || !tax.policy) {
    const missing = tax.gate.kind === "unavailable" ? tax.gate.missing : "Tax configuration for this plan";
    await notifyTaxGap({ planCode: tax.plan?.code || sku, missing });
    return { ok: false as const, kind: "configuration" as const, message: "This plan is temporarily unavailable.", taxCents: null, totalCents: null, subtotalCents: null, reason: "" };
  }
  const typedDiscount = String(formData.get("discountCode") ?? "");
  const interval = parseBillingInterval(formData.get("interval"));
  const priced = await recurringOfferFor(sku, interval);
  if (!priced.ok) {
    return { ok: false as const, kind: "configuration" as const, message: `${priced.reason} Nothing was charged.`, taxCents: null, totalCents: null, subtotalCents: null, reason: "", typedDiscount, discountReason: priced.reason, recovery: null };
  }
  let previewAmountCents = priced.offer.amountCents;
  let discountCents: number | null = null;
  let discountReason = "";
  let renewalOnDate = "";
  let renewalPriceCents: number | null = null;
  let recovery: { typedCode: string; message: string; offerReviewAnnual: boolean; offerContinueMonthly: boolean } | null = null;
  const planCode = tax.plan?.code || sku;
  const planName = tax.plan?.name || sku;
  if (normalizeDiscountCode(typedDiscount)) {
    const offer = await findDiscountOffer(typedDiscount);
    const annual = await recurringOfferFor(sku, "year");
    const annualForPlan = Boolean(offer && offer.productCharge === "subscription" && offer.billingInterval === "year" && samePlan(offer.planCode, planCode));
    const annualBlock = annualForPlan && offer
      ? ineligibilityReason(offer, {
          charge: "subscription",
          countryCode: String(formData.get("country") ?? ""),
          currency: "USD",
          planCode: offer.planCode,
          planName: offer.planName || planName,
          billingInterval: "year",
          accountId: account.id,
          now: new Date().toISOString(),
          priorUses: await customerUseCount(offer.id, account.id),
        })
      : null;
    const choice = annualCodeOnMonthly({
      typedCode: typedDiscount,
      planCode,
      planName,
      annualPurchasable: annual.ok,
      offer: offer && offer.productCharge === "subscription"
        ? { planCode: offer.planCode, planName: offer.planName, billingInterval: offer.billingInterval === "year" ? "year" : "month", eligible: annualForPlan ? !annualBlock : true }
        : null,
      choice: null,
    });
    if (annualForPlan && annualBlock && interval === "month") {
      discountReason = annualBlock;
    } else if (interval === "month" && (choice.offerReviewAnnual || choice.offerContinueMonthly)) {
      recovery = {
        typedCode: choice.typedCode,
        message: choice.message,
        offerReviewAnnual: choice.offerReviewAnnual,
        offerContinueMonthly: choice.offerContinueMonthly,
      };
    } else {
      const prior = offer ? await customerUseCount(offer.id, account.id) : 0;
      const quoted = subscriptionCodeQuote({
        typedCode: typedDiscount,
        offer,
        planCode: offer && samePlan(offer.planCode, planCode) ? offer.planCode : planCode,
        planName,
        amountCents: priced.offer.amountCents,
        interval,
        countryCode: String(formData.get("country") ?? ""),
        accountId: account.id,
        priorUses: prior,
        now: new Date().toISOString(),
      });
      if (!quoted.ok) discountReason = quoted.reason;
      else {
        previewAmountCents = quoted.subtotalCents;
        discountCents = quoted.discountCents;
        renewalOnDate = quoted.renewalOn;
        renewalPriceCents = quoted.renewalPriceCents;
      }
    }
  }
  const preview = await previewConfiguredTax({
    audience: "customer",
    phase: "calculate",
    method: tax.rule?.method ?? tax.policy.calculationMethod,
    amountCents: previewAmountCents,
    inclusive: tax.rule?.inclusive ?? tax.policy.inclusive,
    taxCategory: tax.policy.taxCategory,
    rateBps: tax.rule?.method === "percentage" && tax.rule.ratePercent != null ? Math.round(tax.rule.ratePercent * 100) : tax.policy.rateBps,
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
  if (!preview.ok || preview.taxCents == null || preview.kind !== "calculated") {
    return {
      ok: false as const,
      kind: preview.kind,
      message: preview.customerMessage,
      taxCents: null,
      totalCents: null,
      subtotalCents: null,
      reason: "",
    };
  }
  const { determineSaleTax } = await import("@/lib/tax-determination");
  const determined = determineSaleTax({
    event: "subscription_invoice",
    subjectId: sku || tax.plan?.code || "subscription",
    baseCents: preview.subtotalCents ?? previewAmountCents,
    inclusive: tax.policy.inclusive,
    result: { state: "calculated", taxCents: preview.taxCents, reason: preview.reason },
  });
  if (!determined.ok) {
    return {
      ok: false as const,
      kind: "provider" as const,
      message: determined.error,
      taxCents: null,
      totalCents: null,
      subtotalCents: null,
      reason: "",
    };
  }
  const configuredRate = tax.rule && typeof tax.rule.ratePercent === "number" ? tax.rule.ratePercent : null;
  const breakdown = displayedPriceBreakdown({
    locationKnown: true,
    baseCents: preview.subtotalCents ?? previewAmountCents,
    taxCents: determined.line.taxCents,
    ratePercent: configuredRate,
    inclusive: determined.line.collection !== "added",
    inclusiveTotalCents: determined.line.collection === "added" ? undefined : determined.line.collectedCents,
  });
  if (breakdown.kind === "unknown" || breakdown.kind === "unavailable") {
    return { ok: false as const, kind: "provider" as const, message: breakdown.note, taxCents: null, totalCents: null, subtotalCents: null, reason: "", typedDiscount, discountReason, recovery };
  }
  return {
    ok: true as const,
    kind: "calculated" as const,
    message: breakdown.taxCents === 0 ? "Tax $0.00" : preview.customerMessage,
    taxCents: breakdown.taxCents,
    totalCents: breakdown.totalCents,
    subtotalCents: breakdown.baseCents,
    ratePercent: breakdown.ratePercent,
    reason: determined.line.reason,
    typedDiscount,
    discountCents,
    discountReason,
    renewalOn: renewalOnDate,
    renewalPriceCents,
    interval,
    recovery,
  };
}

export async function actionScheduleIntervalChange(formData: FormData) {
  const returnTo = planPageReturn(formData.get("returnTo"));
  const account = await getAccountSession();
  if (!account) redirect(`/login?next=${encodeURIComponent(`${returnTo}?interval=year`)}`);
  if (formData.get("acceptSubscription") !== "on") {
    redirect(`${returnTo}?interval=year&error=${encodeURIComponent("Agree to the subscription terms before scheduling the change. Nothing was changed.")}`);
  }
  const sku = String(formData.get("sku") ?? "").trim();
  const subscription = await prisma.subscriptionState.findFirst({
    where: { userId: account.id, status: { in: ["active", "trialing"] } },
    orderBy: { updatedAt: "desc" },
  });
  if (!subscription?.externalId) {
    redirect(`${returnTo}?interval=year&error=${encodeURIComponent("Resolve the subscription reference before changing it. Nothing was changed.")}`);
  }
  if (subscription.sku !== sku) {
    redirect(`${returnTo}?interval=year&error=${encodeURIComponent("Confirm a same-plan annual switch here. Nothing was changed.")}`);
  }
  if (subscription.billingInterval === "year") {
    redirect(`${returnTo}?interval=year&error=${encodeURIComponent("This subscription is already annual. Nothing was changed.")}`);
  }
  const annual = await recurringOfferFor(sku, "year");
  if (!annual.ok || !annual.offer.priceId) {
    redirect(`${returnTo}?interval=year&error=${encodeURIComponent("Annual billing is not available for this plan. Nothing was changed.")}`);
  }
  const { schedulePriceAtRenewal, stripeCredentials } = await import("@/lib/stripe-admin");
  const creds = await stripeCredentials();
  if (!creds.ok) redirect(`${returnTo}?interval=year&error=${encodeURIComponent("Stripe is not ready. Nothing was changed.")}`);
  const scheduled = await schedulePriceAtRenewal({
    secret: creds.secret,
    subscriptionId: subscription.externalId,
    nextPriceId: annual.offer.priceId,
    idempotencyKey: `interval-switch:${subscription.externalId}:${annual.offer.priceId}`,
  });
  if (!scheduled.ok) redirect(`${returnTo}?interval=year&error=${encodeURIComponent(scheduled.error)}`);
  const recorded = await recordScheduledInterval({
    providerConfirmed: true,
    externalId: subscription.externalId,
    pendingPriceId: annual.offer.priceId,
    pendingEffectiveAt: scheduled.effectiveAt,
    scheduleId: scheduled.scheduleId,
  });
  if (!recorded.recorded) {
    redirect(`${returnTo}?interval=year&error=${encodeURIComponent("Stripe scheduled the change, but it was not recorded. Nothing is marked paid.")}`);
  }
  const when = formatRenewalDate(scheduled.effectiveAt) ?? "the next renewal";
  redirect(`${returnTo}?interval=year&notice=${encodeURIComponent(`Scheduled. Due today is $0. Annual billing starts ${when} at ${formatOfferAmount(annual.offer.amountCents)} plus tax. Nothing is charged today.`)}`);
}

export async function actionCancelScheduledChange(formData: FormData) {
  const returnTo = planPageReturn(formData.get("returnTo"));
  const account = await getAccountSession();
  if (!account) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  const subscription = await prisma.subscriptionState.findFirst({
    where: { userId: account.id },
    orderBy: { updatedAt: "desc" },
  });
  if (!subscription?.externalId || !subscription.scheduleId) {
    redirect(`${returnTo}?error=${encodeURIComponent("There is no scheduled change to cancel. Nothing was changed.")}`);
  }
  const { releaseSubscriptionSchedule, stripeCredentials } = await import("@/lib/stripe-admin");
  const creds = await stripeCredentials();
  if (!creds.ok) redirect(`${returnTo}?error=${encodeURIComponent("Stripe is not ready. Nothing was changed.")}`);
  const released = await releaseSubscriptionSchedule({ secret: creds.secret, scheduleId: subscription.scheduleId });
  if (!released.ok) redirect(`${returnTo}?error=${encodeURIComponent(released.error)}`);
  const cleared = await clearScheduledInterval({ providerConfirmed: true, externalId: subscription.externalId });
  if (!cleared.recorded) redirect(`${returnTo}?error=${encodeURIComponent("Stripe released the schedule, but the account was not updated. Nothing is marked paid.")}`);
  redirect(`${returnTo}?notice=${encodeURIComponent("The scheduled change is cancelled. The current plan stays in place.")}`);
}

export async function actionPreviewTierChange(formData: FormData) {
  const account = await getAccountSession();
  if (!account) return { ok: false as const, message: "Sign in to review this change. Nothing was changed.", amountDueCents: null };
  const sku = String(formData.get("sku") ?? "").trim();
  const interval = parseBillingInterval(formData.get("interval"));
  const subscription = await prisma.subscriptionState.findFirst({
    where: { userId: account.id, status: { in: ["active", "trialing"] } },
    orderBy: { updatedAt: "desc" },
  });
  if (!subscription?.externalId) {
    return { ok: false as const, message: "Resolve the subscription reference before changing it. Nothing was changed.", amountDueCents: null };
  }
  if (subscription.sku === sku && interval === "year" && subscription.billingInterval !== "year") {
    return { ok: false as const, message: "Switching the same plan to annual happens at the next renewal.", amountDueCents: null };
  }
  const target = await recurringOfferFor(sku, interval);
  if (!target.ok || !target.offer.priceId) {
    return { ok: false as const, message: target.ok ? "Save a Stripe price before this change. Nothing was changed." : `${target.reason} Nothing was changed.`, amountDueCents: null };
  }
  const { previewSubscriptionUpdate, readStripeSubscription, stripeCredentials } = await import("@/lib/stripe-admin");
  const creds = await stripeCredentials();
  if (!creds.ok) return { ok: false as const, message: "Stripe is not ready. Nothing was changed.", amountDueCents: null };
  const current = await readStripeSubscription(creds.secret, subscription.externalId);
  if (!current.ok || !current.subscription.itemId) {
    return { ok: false as const, message: current.ok ? "Stripe did not return the subscription item. Nothing was changed." : current.error, amountDueCents: null };
  }
  const preview = await previewSubscriptionUpdate({
    secret: creds.secret,
    subscriptionId: subscription.externalId,
    itemId: current.subscription.itemId,
    priceId: target.offer.priceId,
  });
  if (!preview.ok) return { ok: false as const, message: preview.error, amountDueCents: null };
  return { ok: true as const, message: "", amountDueCents: preview.amountDueCents };
}

export async function actionChangeSubscriptionPrice(formData: FormData) {
  const returnTo = planPageReturn(formData.get("returnTo"));
  const account = await getAccountSession();
  if (!account) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (formData.get("acceptSubscription") !== "on") {
    redirect(`${returnTo}?error=${encodeURIComponent("Agree to the subscription terms before changing the plan. Nothing was changed.")}`);
  }
  const sku = String(formData.get("sku") ?? "").trim();
  const interval = parseBillingInterval(formData.get("interval"));
  const subscription = await prisma.subscriptionState.findFirst({
    where: { userId: account.id, status: { in: ["active", "trialing"] } },
    orderBy: { updatedAt: "desc" },
  });
  if (!subscription?.externalId) {
    redirect(`${returnTo}?error=${encodeURIComponent("Resolve the subscription reference before changing it. Nothing was changed.")}`);
  }
  if (subscription.sku === sku && interval === "year" && subscription.billingInterval !== "year") {
    redirect(`${returnTo}?interval=year&error=${encodeURIComponent("Switching the same plan to annual happens at the next renewal. Nothing was changed.")}`);
  }
  const target = await recurringOfferFor(sku, interval);
  if (!target.ok || !target.offer.priceId) {
    redirect(`${returnTo}?error=${encodeURIComponent("That price is not available. Nothing was changed.")}`);
  }
  const { previewSubscriptionUpdate, readStripeSubscription, stripeCredentials, updateSubscriptionPrice } = await import("@/lib/stripe-admin");
  const creds = await stripeCredentials();
  if (!creds.ok) redirect(`${returnTo}?error=${encodeURIComponent("Stripe is not ready. Nothing was changed.")}`);
  const current = await readStripeSubscription(creds.secret, subscription.externalId);
  if (!current.ok || !current.subscription.itemId) {
    redirect(`${returnTo}?error=${encodeURIComponent("Stripe did not return the subscription item. Nothing was changed.")}`);
  }
  const preview = await previewSubscriptionUpdate({
    secret: creds.secret,
    subscriptionId: subscription.externalId,
    itemId: current.subscription.itemId,
    priceId: target.offer.priceId,
  });
  if (!preview.ok) redirect(`${returnTo}?error=${encodeURIComponent(preview.error)}`);
  const updated = await updateSubscriptionPrice({
    secret: creds.secret,
    subscriptionId: subscription.externalId,
    itemId: current.subscription.itemId,
    priceId: target.offer.priceId,
    quantity: current.subscription.quantity,
    idempotencyKey: `tier-change:${subscription.externalId}:${target.offer.priceId}`,
  });
  if (!updated.ok) redirect(`${returnTo}?error=${encodeURIComponent(updated.error)}`);
  redirect(`${returnTo}?notice=${encodeURIComponent("Stripe accepted the subscription update. The plan changes when Stripe confirms it. Nothing is marked paid here.")}`);
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
