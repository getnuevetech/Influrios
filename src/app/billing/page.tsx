import Link from "next/link";
import { redirect } from "next/navigation";
import { actionOpenConnect, actionOpenConnectedAccount } from "@/app/billing/actions";
import { MemberPlanPage } from "@/components/plans/member-plan-page";
import { getAccountSession } from "@/lib/accounts";
import { prisma } from "@/lib/db";
import { loadPlanMatrix } from "@/lib/plan-matrix";
import { productSwitch } from "@/lib/product-switches";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing & plan" };

type Props = { searchParams: Promise<{ error?: string; connected?: string }> };

export default async function BillingPage({ searchParams }: Props) {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/billing");
  const params = await searchParams;
  const [matrix, identity, portalOn, connectOn, attempts, subscription] = await Promise.all([
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
              payoutProfile: { select: { stripeConnectAccountId: true, providerConnectedAccountId: true } },
            },
          },
        },
      })
      .catch(() => null),
    productSwitch("customer_portal").catch(() => false),
    productSwitch("stripe_connect").catch(() => false),
    prisma.checkoutAttempt
      .findMany({
        where: { userId: account.id, status: "completed" },
        orderBy: { completedAt: "desc" },
        take: 8,
      })
      .catch(() => []),
    prisma.subscriptionState.findFirst({ where: { userId: account.id }, orderBy: { updatedAt: "desc" } }).catch(() => null),
  ]);
  const currentCode = identity?.creator?.planTier || identity?.planTier || null;
  const names = new Map(matrix.plans.flatMap((plan) => [[plan.sku, plan.name], [plan.code, plan.name]] as const));

  return (
    <MemberPlanPage
      audience="creator"
      eyebrow="Influencer"
      title="Billing & plan"
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
      hasCustomer={Boolean(identity?.stripeCustomerId)}
      subscriptionStatus={subscription?.status ?? null}
      error={params.error}
      notice={params.connected ? "Connected account saved on your payout profile." : undefined}
      payout={
        <div id="payouts" className="mt-3 space-y-3">
          {identity?.creator && connectOn ? (
            <form action={actionOpenConnect}>
              <p className="text-xs text-amber-900/80">
                {identity.creator.payoutProfile?.stripeConnectAccountId
                  ? "Stripe Connect is saved. Opening it does not send a payout."
                  : "Create the Stripe Connect account for this card. This does not send a payout."}
              </p>
              <button type="submit" className="mt-2 text-sm font-semibold underline">
                {identity.creator.payoutProfile?.stripeConnectAccountId ? "Open payout account" : "Set up payouts"}
              </button>
            </form>
          ) : null}
          {identity?.creator ? (
            <form action={actionOpenConnectedAccount}>
              <p className="text-xs text-amber-900/80">
                {identity.creator.payoutProfile?.providerConnectedAccountId
                  ? "A collaboration connected account is saved. Milestone splits pay that account."
                  : "Create the connected account that receives milestone splits. This does not send a payout."}
              </p>
              <button type="submit" className="mt-2 text-sm font-semibold underline">
                {identity.creator.payoutProfile?.providerConnectedAccountId ? "Confirm connected account" : "Create connected account"}
              </button>
            </form>
          ) : (
            <Link href="/claim" className="mt-2 inline-block text-sm font-semibold underline">
              Create your card
            </Link>
          )}
        </div>
      }
    />
  );
}
