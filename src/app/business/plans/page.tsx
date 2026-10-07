import { PublicPlanPage } from "@/components/plans/public-plan-page";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { listPublishedFaq } from "@/lib/faq";
import { loadPlanMatrix } from "@/lib/plan-matrix";

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
  return (
    <PublicPlanPage
      audience="business"
      signedIn={Boolean(account)}
      currentCode={currentCode}
      currentAmountCents={matrix.plans.find((plan) => plan.code === currentCode)?.amountCents ?? null}
      matrix={matrix}
      faqs={[...primary, ...extra].slice(0, 4).map((entry) => ({
        id: entry.id,
        question: entry.question,
        answer: entry.answer,
      }))}
    />
  );
}
