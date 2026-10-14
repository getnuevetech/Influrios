import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberPlanPage } from "@/components/plans/member-plan-page";
import { getAccountSession } from "@/lib/accounts";
import { prisma } from "@/lib/db";
import { loadPlanMatrix } from "@/lib/plan-matrix";
import { productSwitch } from "@/lib/product-switches";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing & plan" };

type Props = { searchParams: Promise<{ error?: string; connected?: string }> };

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
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/billing");
  const params = await searchParams;
  const [matrix, identity, portalOn, attempts, subscription] = await Promise.all([
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
      error={memberFacingBillingError(params.error)}
      notice={params.connected ? "Payout setup moved to Earnings." : undefined}
      payout={
        <div id="payouts" className="mt-3">
          <p className="text-xs text-amber-900/80">
            Set up Stripe Connect or your corridor connected account under Earnings — not on this plan page.
          </p>
          <Link href="/creator/earnings#payouts" className="mt-2 inline-block text-sm font-semibold underline">
            Open Earnings → Payout methods
          </Link>
        </div>
      }
    />
  );
}
