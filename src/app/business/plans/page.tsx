import { PublicPlanPage } from "@/components/plans/public-plan-page";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { listPublishedFaq } from "@/lib/faq";
import { loadPlanMatrix } from "@/lib/plan-matrix";
import { corridorCountries } from "@/lib/corridor-countries";
import { notifyTaxGap, subscriptionTaxGates } from "@/lib/tax-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business plans" };

export default async function BusinessPlansPage() {
  const [account, matrix] = await Promise.all([
    getAccountSession().catch(() => null),
    loadPlanMatrix("business"),
  ]);
  const workspace = account ? await getWorkspace(account.id).catch(() => null) : null;
  const currentCode = workspace?.plan ?? null;
  const primary = await listPublishedFaq("business").catch(() => []);
  const extra = primary.length >= 4 ? [] : await listPublishedFaq("general").catch(() => []);
  const taxByCode = await subscriptionTaxGates(matrix.plans).catch(() => ({} as Record<string, import("@/lib/tax-configuration").PlanTaxGate>));
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
      faqs={[...primary, ...extra].slice(0, 4).map((entry) => ({
        id: entry.id,
        question: entry.question,
        answer: entry.answer,
      }))}
      taxByCode={taxByCode}
      countries={corridorCountries().map((country) => ({ code: country.code, name: country.name }))}
    />
  );
}
