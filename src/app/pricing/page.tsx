import { PublicPlanPage } from "@/components/plans/public-plan-page";
import { getAccountSession } from "@/lib/accounts";
import { prisma } from "@/lib/db";
import { listPublishedFaq } from "@/lib/faq";
import { loadPlanMatrix } from "@/lib/plan-matrix";

export const dynamic = "force-dynamic";
export const metadata = { title: "Influencer plans" };

export default async function PricingPage() {
  const [account, matrix] = await Promise.all([
    getAccountSession().catch(() => null),
    loadPlanMatrix("creator"),
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
  const faqs = await publishedFaqs("creator");
  return (
    <PublicPlanPage
      audience="creator"
      signedIn={Boolean(account)}
      currentCode={currentCode}
      currentAmountCents={matrix.plans.find((plan) => plan.code === currentCode)?.amountCents ?? null}
      matrix={matrix}
      faqs={faqs}
    />
  );
}

async function publishedFaqs(audience: "creator" | "business") {
  const primary = await listPublishedFaq(audience).catch(() => []);
  const extra = primary.length >= 4 ? [] : await listPublishedFaq("general").catch(() => []);
  return [...primary, ...extra].slice(0, 4).map((entry) => ({
    id: entry.id,
    question: entry.question,
    answer: entry.answer,
  }));
}
