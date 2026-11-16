import { PublicPlanPage } from "@/components/plans/public-plan-page";
import { getAccountSession } from "@/lib/accounts";
import { listAnnualOffers } from "@/lib/billing";
import { parseBillingInterval } from "@/lib/billing-interval";
import { prisma } from "@/lib/db";
import { loadPlanMatrix } from "@/lib/plan-matrix";
import { notifyTaxGap, subscriptionTaxGates } from "@/lib/tax-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Influencer plans" };

type Props = { searchParams: Promise<{ interval?: string }> };

export default async function PricingPage({ searchParams }: Props) {
  const params = await searchParams;
  const [account, matrix, annual] = await Promise.all([
    getAccountSession().catch(() => null),
    loadPlanMatrix("creator"),
    listAnnualOffers().catch(() => ({})),
  ]);
  const identity = account
    ? await prisma.user
        .findUnique({
          where: { id: account.id },
          select: { planTier: true, creator: { select: { planTier: true } } },
        })
        .catch(() => null)
    : null;
  const currentCode = identity?.creator?.planTier || identity?.planTier || null;
  const taxByCode = await subscriptionTaxGates(matrix.plans).catch(() => ({} as Record<string, import("@/lib/tax-configuration").PlanTaxGate>));
  await Promise.all(
    matrix.plans.map((plan) => {
      const gate = taxByCode[plan.code];
      return gate?.kind === "unavailable" ? notifyTaxGap({ planCode: plan.code, missing: gate.missing }) : null;
    }),
  );
  return (
    <PublicPlanPage
      audience="creator"
      signedIn={Boolean(account)}
      accountRole={account?.role}
      currentCode={currentCode}
      currentAmountCents={matrix.plans.find((plan) => plan.code === currentCode)?.amountCents ?? null}
      matrix={matrix}
      interval={parseBillingInterval(params.interval)}
      annualBySku={Object.fromEntries(Object.entries(annual).flatMap(([sku, offer]) => offer ? [[sku, offer.amountCents]] : []))}
      taxByCode={taxByCode}
    />
  );
}
