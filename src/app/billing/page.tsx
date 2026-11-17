import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberPlanPage } from "@/components/plans/member-plan-page";
import { getAccountSession } from "@/lib/accounts";
import { listAnnualOffers } from "@/lib/billing";
import { annualOfferViews, formatRenewalDate, parseBillingInterval } from "@/lib/billing-interval";
import { prisma } from "@/lib/db";
import { loadPlanMatrix } from "@/lib/plan-matrix";
import { productSwitch } from "@/lib/product-switches";
import { corridorCountries } from "@/lib/corridor-countries";
import { loadSubscriptionTaxInputs, memberBillingCountry, notifyTaxGap, subscriptionTaxGates } from "@/lib/tax-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing & plan" };

type Props = { searchParams: Promise<{ error?: string; connected?: string; interval?: string; notice?: string }> };

/** Plan/checkout errors only — payout setup lives on Earnings. */
function memberFacingBillingError(raw: string | undefined) {
  const message = raw?.trim() ?? "";
  if (!message) return undefined;
  if (/^</.test(message) || /<!DOCTYPE/i.test(message) || /<html[\s>]/i.test(message)) {
    return undefined;
  }
  if (/^Airwallex[:\s]/i.test(message) || /Airwallex rejected/i.test(message)) return undefined;
  if (/hosted onboarding is not configured/i.test(message) || /hosted flow template/i.test(message)) return undefined;
  if (/HTML instead of JSON/i.test(message) || /Check the base URL/i.test(message)) return undefined;
  if (/Stripe Connect is not ready/i.test(message)) return undefined;
  if (/Nothing was opened/i.test(message) && /Stripe|Connect|portal/i.test(message)) return undefined;
  return message;
}

export default async function BillingPage({ searchParams }: Props) {
  const params = await searchParams;
  const interval = parseBillingInterval(params.interval);
  const account = await getAccountSession();
  if (!account) {
    const next = interval === "year" ? "/billing?interval=year" : "/billing";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const [matrix, identity, portalOn, attempts, subscription, annual, taxInputs] = await Promise.all([
    loadPlanMatrix("creator"),
    prisma.user
      .findUnique({
        where: { id: account.id },
        select: {
          planTier: true,
          stripeCustomerId: true,
          creator: {
            select: {
              planTier: true,
              locationCountry: true,
            },
          },
        },
      })
      .catch(() => null),
    productSwitch("customer_portal").catch(() => false),
    prisma.checkoutAttempt
      .findMany({
        where: { userId: account.id, status: "completed" },
        orderBy: { completedAt: "desc" },
        take: 8,
      })
      .catch(() => []),
    prisma.subscriptionState.findFirst({ where: { userId: account.id }, orderBy: { updatedAt: "desc" } }).catch(() => null),
    listAnnualOffers().catch(() => ({})),
    loadSubscriptionTaxInputs(),
  ]);
  const currentCode = identity?.creator?.planTier || identity?.planTier || null;
  const billingCountry = memberBillingCountry({ location: identity?.creator?.locationCountry });
  const views = annualOfferViews(annual);
  const taxByCode = await subscriptionTaxGates(matrix.plans, billingCountry || "US").catch(() => ({} as Record<string, import("@/lib/tax-configuration").PlanTaxGate>));
  await Promise.all(
    matrix.plans.map((plan) => {
      const gate = taxByCode[plan.code];
      return gate?.kind === "unavailable" ? notifyTaxGap({ planCode: plan.code, missing: gate.missing }) : null;
    }),
  );
  const names = new Map(matrix.plans.flatMap((plan) => [[plan.sku, plan.name], [plan.code, plan.name]] as const));

  return (
    <MemberPlanPage
      audience="creator"
      eyebrow="Influencer"
      title="Billing & plan"
      currentCode={currentCode}
      currentAmountCents={matrix.plans.find((plan) => plan.code === currentCode)?.amountCents ?? null}
      currentInterval={subscription?.billingInterval === "year" ? "year" : subscription ? "month" : null}
      renewalLabel={subscription?.currentPeriodEnd ? formatRenewalDate(subscription.currentPeriodEnd.toISOString()) : null}
      pendingLabel={subscription?.pendingInterval === "year" && subscription.pendingEffectiveAt ? `Annual starts ${formatRenewalDate(subscription.pendingEffectiveAt.toISOString())}` : null}
      subscriptionSku={subscription?.sku ?? null}
      hasSubscriptionReference={Boolean(subscription?.externalId)}
      interval={interval}
      annualBySku={views.amounts}
      annualCheckoutBySku={views.checkout}
      matrix={matrix}
      history={attempts.map((row) => ({
        id: row.id,
        when: (row.completedAt ?? row.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        name: names.get(row.sku) ?? row.sku,
        status: row.status,
      }))}
      portalOn={portalOn}
      hasCustomer={Boolean(identity?.stripeCustomerId)}
      subscriptionStatus={subscription?.status ?? null}
      taxByCode={taxByCode}
      billingCountry={billingCountry}
      taxRules={taxInputs.rules}
      taxKeysByCode={taxInputs.keysByCode}
      countries={corridorCountries().map((country) => ({ code: country.code, name: country.name }))}
      error={memberFacingBillingError(params.error)}
      notice={params.notice || (params.connected ? "Payout setup moved to Earnings." : undefined)}
      payout={
        <div id="payouts" className="mt-3 rounded-2xl border border-[#E4EBFF] bg-[#F8F6FF] px-4 py-3">
          <p className="text-sm font-semibold text-indigo">Collaboration payouts</p>
          <p className="mt-1 text-sm text-muted">
            Stripe Connect and corridor payout setup live on Earnings. This page is only for your Influrios plan subscription.
          </p>
          <Link href="/creator/earnings#payouts" className="mt-2 inline-block text-sm font-semibold text-violet hover:underline">
            Open Earnings → Payout methods
          </Link>
        </div>
      }
    />
  );
}
