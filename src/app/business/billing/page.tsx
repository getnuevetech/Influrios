import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberPlanPage } from "@/components/plans/member-plan-page";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { listAnnualOffers } from "@/lib/billing";
import { formatRenewalDate, parseBillingInterval } from "@/lib/billing-interval";
import { prisma } from "@/lib/db";
import { loadPlanMatrix } from "@/lib/plan-matrix";
import { productSwitch } from "@/lib/product-switches";
import { corridorCountries } from "@/lib/corridor-countries";
import { notifyTaxGap, subscriptionTaxGates } from "@/lib/tax-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business billing & plans" };

type Props = { searchParams: Promise<{ error?: string; interval?: string; notice?: string }> };

export default async function BusinessBillingPage({ searchParams }: Props) {
  const params = await searchParams;
  const interval = parseBillingInterval(params.interval);
  const account = await getAccountSession();
  if (!account) {
    const next = interval === "year" ? "/business/billing?interval=year" : "/business/billing";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const [matrix, workspace, portalOn, user, attempts, subscription, annual] = await Promise.all([
    loadPlanMatrix("business"),
    getWorkspace(account.id).catch(() => null),
    productSwitch("customer_portal").catch(() => false),
    prisma.user.findUnique({ where: { id: account.id }, select: { stripeCustomerId: true } }).catch(() => null),
    prisma.checkoutAttempt
      .findMany({
        where: { userId: account.id, status: "completed" },
        orderBy: { completedAt: "desc" },
        take: 8,
      })
      .catch(() => []),
    prisma.subscriptionState.findFirst({ where: { userId: account.id }, orderBy: { updatedAt: "desc" } }).catch(() => null),
    listAnnualOffers().catch(() => ({})),
  ]);
  const currentCode = workspace?.plan ?? null;
  const taxByCode = await subscriptionTaxGates(matrix.plans).catch(() => ({} as Record<string, import("@/lib/tax-configuration").PlanTaxGate>));
  await Promise.all(
    matrix.plans.map((plan) => {
      const gate = taxByCode[plan.code];
      return gate?.kind === "unavailable" ? notifyTaxGap({ planCode: plan.code, missing: gate.missing }) : null;
    }),
  );
  const names = new Map(matrix.plans.flatMap((plan) => [[plan.sku, plan.name], [plan.code, plan.name]] as const));
  return (
    <MemberPlanPage
      audience="business"
      eyebrow="Business workspace"
      title="Business billing & plans"
      currentCode={currentCode}
      currentAmountCents={matrix.plans.find((plan) => plan.code === currentCode)?.amountCents ?? null}
      currentInterval={subscription?.billingInterval === "year" ? "year" : subscription ? "month" : null}
      renewalLabel={subscription?.currentPeriodEnd ? formatRenewalDate(subscription.currentPeriodEnd.toISOString()) : null}
      pendingLabel={subscription?.pendingInterval === "year" && subscription.pendingEffectiveAt ? `Annual starts ${formatRenewalDate(subscription.pendingEffectiveAt.toISOString())}` : null}
      subscriptionSku={subscription?.sku ?? null}
      hasSubscriptionReference={Boolean(subscription?.externalId)}
      interval={interval}
      annualBySku={Object.fromEntries(Object.entries(annual).flatMap(([sku, offer]) => offer ? [[sku, offer.amountCents]] : []))}
      matrix={matrix}
      history={attempts.map((row) => ({
        id: row.id,
        when: (row.completedAt ?? row.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        name: names.get(row.sku) ?? row.sku,
        status: row.status,
      }))}
      portalOn={portalOn}
      hasCustomer={Boolean(user?.stripeCustomerId)}
      taxByCode={taxByCode}
      countries={corridorCountries().map((country) => ({ code: country.code, name: country.name }))}
      subscriptionStatus={subscription?.status ?? null}
      error={params.error}
      notice={params.notice}
      payout={
        <Link href="/collaboration/business" className="mt-3 inline-block text-sm font-semibold underline">
          Open collaboration payments
        </Link>
      }
    />
  );
}
