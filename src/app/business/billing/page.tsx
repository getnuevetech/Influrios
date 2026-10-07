import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberPlanPage } from "@/components/plans/member-plan-page";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { prisma } from "@/lib/db";
import { loadPlanMatrix } from "@/lib/plan-matrix";
import { productSwitch } from "@/lib/product-switches";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business billing & plans" };

type Props = { searchParams: Promise<{ error?: string }> };

export default async function BusinessBillingPage({ searchParams }: Props) {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/business/billing");
  const params = await searchParams;
  const [matrix, workspace, portalOn, user, attempts, subscription] = await Promise.all([
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
  ]);
  const currentCode = workspace?.plan ?? null;
  const names = new Map(matrix.plans.flatMap((plan) => [[plan.sku, plan.name], [plan.code, plan.name]] as const));
  return (
    <MemberPlanPage
      audience="business"
      eyebrow="Business workspace"
      title="Business billing & plans"
      currentCode={currentCode}
      currentAmountCents={matrix.plans.find((plan) => plan.code === currentCode)?.amountCents ?? null}
      matrix={matrix}
      history={attempts.map((row) => ({
        id: row.id,
        when: (row.completedAt ?? row.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        name: names.get(row.sku) ?? row.sku,
        status: row.status,
      }))}
      portalOn={portalOn}
      hasCustomer={Boolean(user?.stripeCustomerId)}
      subscriptionStatus={subscription?.status ?? null}
      error={params.error}
      payout={
        <Link href="/collaboration/business" className="mt-3 inline-block text-sm font-semibold underline">
          Open collaboration payments
        </Link>
      }
    />
  );
}
