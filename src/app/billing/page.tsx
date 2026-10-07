import Link from "next/link";
import { actionOpenConnect, actionOpenConnectedAccount, actionOpenPortal, actionStartCheckout } from "@/app/billing/actions";
import { BILLING_CATALOG } from "@/lib/billing";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { listPublicPlanOffers, type PublicPlanOffer } from "@/lib/entitlements-db";
import { productSwitch } from "@/lib/product-switches";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing" };

type Props = {
  searchParams: Promise<{ error?: string; connected?: string }>;
};

type Offer = PublicPlanOffer;

function catalogOffers(): Offer[] {
  const paid = BILLING_CATALOG.map((plan) => ({
    code: plan.sku,
    sku: plan.sku,
    name: plan.name,
    priceLabel: plan.priceLabel,
    amountCents: plan.amountCents,
    description: plan.description,
    audience: plan.audience,
    checkout: plan.amountCents > 0,
    highlights: plan.highlights,
  }));
  return [
    {
      code: "STARTER",
      sku: "creator_starter",
      name: "Influencer Starter",
      priceLabel: "Free",
      amountCents: 0,
      description: "Claim your Influencer Card and get discovered.",
      audience: "creator",
      checkout: false,
      highlights: ["Public profile", "Basic specialties", "Discover listing"],
    },
    ...paid,
  ];
}

function labelFor(code: string | null | undefined, offers: Offer[]) {
  if (!code) return "Starter";
  return offers.find((plan) => plan.code === code || plan.sku === code)?.name ?? code;
}

export default async function BillingPage({ searchParams }: Props) {
  const params = await searchParams;
  const account = await getAccountSession();
  const offers = (await listPublicPlanOffers().catch(() => null)) ?? catalogOffers();
  const creatorPlans = offers.filter((plan) => plan.audience === "creator");
  const businessPlans = offers.filter((plan) => plan.audience === "business");
  const identity = account
    ? await prisma.user
        .findUnique({
          where: { id: account.id },
          select: {
            planTier: true,
            stripeCustomerId: true,
            creator: {
              select: {
                planTier: true,
                payoutProfile: {
                  select: { stripeConnectAccountId: true, providerConnectedAccountId: true },
                },
              },
            },
          },
        })
        .catch(() => null)
    : null;
  const workspace = account ? await getWorkspace(account.id).catch(() => null) : null;
  const [portalOn, connectOn] = account
    ? await Promise.all([
        productSwitch("customer_portal").catch(() => false),
        productSwitch("stripe_connect").catch(() => false),
      ])
    : [false, false];
  const creatorPlan = identity?.creator?.planTier || identity?.planTier;

  return (
    <div className="bg-[#F7FAFF]">
      <section className="hero-atmosphere text-white">
        <div className="mx-auto max-w-[90rem] px-4 py-14 sm:px-6 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender/80">Account</p>
          <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">Billing</h1>
          <p className="mt-3 max-w-2xl text-white/75">
            Your plan, invoices, and payout setup. A paid plan changes after Stripe confirms checkout.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[90rem] space-y-10 px-4 py-10 sm:px-6 lg:px-10">
        {params.error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{params.error}</div>
        ) : null}
        {params.connected ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Connected account saved on your payout profile.
          </div>
        ) : null}

        <section className="card-surface p-6 sm:p-8">
          {account && !identity ? (
            <div>
              <h2 className="font-display text-xl font-bold text-indigo">Your plan</h2>
              <p className="mt-1 text-sm text-muted">{account.email}</p>
              <p className="mt-3 text-sm text-muted">Plan details are unavailable right now. You can still choose a plan below.</p>
            </div>
          ) : account && identity ? (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,16rem)_1fr] lg:items-start">
              <div>
                <h2 className="font-display text-xl font-bold text-indigo">Your plan</h2>
                <p className="mt-1 text-sm text-muted">{account.email}</p>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Influencer</dt>
                    <dd className="mt-0.5 font-display text-lg font-bold text-indigo">{labelFor(creatorPlan, offers)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Business</dt>
                    <dd className="mt-0.5 font-display text-lg font-bold text-indigo">
                      {labelFor(workspace?.plan, offers)}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {!identity.creator && !portalOn ? (
                  <p className="text-sm text-muted sm:col-span-2">
                    Choose a plan below. It applies to this account after Stripe confirms payment.
                  </p>
                ) : null}
                {portalOn ? (
                  <form action={actionOpenPortal} className="rounded-2xl border border-border bg-white p-4">
                    <h3 className="font-display text-base font-bold text-indigo">Invoices and card</h3>
                    <p className="mt-1 text-sm text-muted">
                      {identity.stripeCustomerId
                        ? "Open Stripe to update the card, download invoices, or cancel."
                        : "Finish a checkout first. The billing portal opens for the customer Stripe saves on your account."}
                    </p>
                    <button type="submit" className="btn-secondary mt-4 !py-2 text-sm">
                      Open billing portal
                    </button>
                  </form>
                ) : null}
                {identity.creator && connectOn ? (
                  <form action={actionOpenConnect} className="rounded-2xl border border-border bg-white p-4">
                    <h3 className="font-display text-base font-bold text-indigo">Payout account</h3>
                    <p className="mt-1 text-sm text-muted">
                      {identity.creator.payoutProfile?.stripeConnectAccountId
                        ? "Stripe Connect is saved on your payout profile. Opening it does not send a payout."
                        : "Create the Stripe Connect account for your Influencer Card. This does not send a payout."}
                    </p>
                    <button type="submit" className="btn-secondary mt-4 !py-2 text-sm">
                      {identity.creator.payoutProfile?.stripeConnectAccountId ? "Open payout account" : "Set up payouts"}
                    </button>
                  </form>
                ) : null}
                {identity.creator ? (
                  <form action={actionOpenConnectedAccount} className="rounded-2xl border border-border bg-white p-4">
                    <h3 className="font-display text-base font-bold text-indigo">Collaboration payouts</h3>
                    <p className="mt-1 text-sm text-muted">
                      {identity.creator.payoutProfile?.providerConnectedAccountId
                        ? `Connected account ${identity.creator.payoutProfile.providerConnectedAccountId} is saved. Milestone splits pay this account.`
                        : "Create the connected account that receives milestone splits. This does not send a payout."}
                    </p>
                    <button type="submit" className="btn-secondary mt-4 !py-2 text-sm">
                      {identity.creator.payoutProfile?.providerConnectedAccountId
                        ? "Confirm connected account"
                        : "Create connected account"}
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-indigo">Your plan</h2>
                <p className="mt-1 max-w-xl text-sm text-muted">
                  Sign in to see the plan on your account, open invoices, or set up payouts.
                </p>
              </div>
              <Link href="/login?next=/billing" className="btn-primary !py-2.5 text-center text-sm">
                Log in
              </Link>
            </div>
          )}
        </section>

        <PlanSection
          title="Influencer plans"
          copy="Starter is free when you create your card. Paid plans check out with Stripe."
          plans={creatorPlans}
        />
        <PlanSection
          title="Business plans"
          copy="The plan applies to the business workspace on the signed-in account."
          plans={businessPlans}
        />

        <p className="text-center text-sm text-muted">
          Comparing plans?{" "}
          <Link href="/pricing" className="font-semibold text-violet hover:underline">
            View pricing
          </Link>
        </p>
      </div>
    </div>
  );
}

function PlanSection({ title, copy, plans }: { title: string; copy: string; plans: Offer[] }) {
  return (
    <section>
      <h2 className="font-display text-2xl font-bold text-indigo">{title}</h2>
      <p className="mt-1 text-sm text-muted">{copy}</p>
      <div className={`mt-5 grid gap-4 ${plans.length > 2 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {plans.map((plan) => (
          <article key={plan.code} className="card-surface flex flex-col p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-violet">{plan.name}</p>
            <p className="mt-2 font-display text-3xl font-bold text-indigo">
              {plan.amountCents === 0 ? "Free" : plan.priceLabel.replace("/mo", "")}
              {plan.amountCents > 0 ? <span className="text-sm font-semibold text-muted"> / mo</span> : null}
            </p>
            <p className="mt-2 text-sm text-muted">{plan.description}</p>
            <ul className="mt-4 flex-1 space-y-1.5 text-[13px] text-indigo/80">
              {plan.highlights.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
            {plan.checkout ? (
              <form action={actionStartCheckout} className="mt-6 space-y-3">
                <input type="hidden" name="sku" value={plan.sku} />
                <label className="flex items-start gap-2 text-xs text-indigo">
                  <input type="checkbox" name="acceptSubscription" required className="mt-0.5 accent-violet" />
                  <span>
                    I agree to the{" "}
                    <Link href="/legal/subscription-terms" className="font-semibold underline" target="_blank">
                      subscription terms
                    </Link>
                    . {plan.priceLabel} renews until cancelled.
                  </span>
                </label>
                <button type="submit" className="btn-primary w-full !py-2.5 text-sm">
                  Choose {plan.name}
                </button>
              </form>
            ) : (
              <Link href="/claim" className="btn-primary mt-6 w-full !py-2.5 text-center text-sm">
                Create your card
              </Link>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
