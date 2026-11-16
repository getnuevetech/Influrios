import { PublicPlanPage } from "@/components/plans/public-plan-page";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { listAnnualOffers } from "@/lib/billing";
import { annualOfferViews, parseBillingInterval } from "@/lib/billing-interval";
import { loadPlanMatrix } from "@/lib/plan-matrix";
import { prisma } from "@/lib/db";
import { loadSubscriptionTaxInputs, memberBillingCountry, notifyTaxGap, subscriptionTaxGates } from "@/lib/tax-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business plans" };

type Props = { searchParams: Promise<{ interval?: string }> };

export default async function BusinessPlansPage({ searchParams }: Props) {
  const params = await searchParams;
  const [account, matrix, annual, taxInputs] = await Promise.all([
    getAccountSession().catch(() => null),
    loadPlanMatrix("business"),
    listAnnualOffers().catch(() => ({})),
    loadSubscriptionTaxInputs(),
  ]);
  const workspace = account ? await getWorkspace(account.id).catch(() => null) : null;
  const profile = account
    ? await prisma.businessProfile.findUnique({
        where: { userId: account.id },
        select: { verifiedCountryCode: true, geography: true },
      }).catch(() => null)
    : null;
  const currentCode = workspace?.plan ?? null;
  const billingCountry = memberBillingCountry({
    location: profile?.geography,
    verifiedCountryCode: profile?.verifiedCountryCode,
  });
  const views = annualOfferViews(annual);
  const taxByCode = await subscriptionTaxGates(matrix.plans, billingCountry || "US").catch(() => ({} as Record<string, import("@/lib/tax-configuration").PlanTaxGate>));
  await Promise.all(
    matrix.plans.map((plan) => {
      const gate = taxByCode[plan.code];
      return gate?.kind === "unavailable" ? notifyTaxGap({ planCode: plan.code, missing: gate.missing }) : null;
    }),
  );
  return (
    <PublicPlanPage
      audience="business"
      signedIn={Boolean(account)}
      accountRole={account?.role}
      currentCode={currentCode}
      currentAmountCents={matrix.plans.find((plan) => plan.code === currentCode)?.amountCents ?? null}
      matrix={matrix}
      interval={parseBillingInterval(params.interval)}
      annualBySku={views.amounts}
      annualCheckoutBySku={views.checkout}
      taxByCode={taxByCode}
      billingCountry={billingCountry}
      taxRules={taxInputs.rules}
      taxKeysByCode={taxInputs.keysByCode}
    />
  );
}
