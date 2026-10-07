import Link from "next/link";
import { actionOpenPortal } from "@/app/billing/actions";
import { ComparisonTable, PlanAction } from "@/components/plans/public-plan-page";
import type { PlanMatrix } from "@/lib/plan-matrix";
import { displayPrice, planActionLabel } from "@/lib/plan-presentation";

export type BillingHistoryRow = {
  id: string;
  when: string;
  name: string;
  status: string;
};

export function MemberPlanPage({
  audience,
  eyebrow,
  title,
  currentCode,
  currentAmountCents,
  matrix,
  history,
  portalOn,
  hasCustomer,
  subscriptionStatus,
  error,
  notice,
  payout,
}: {
  audience: "creator" | "business";
  eyebrow: string;
  title: string;
  currentCode: string | null;
  currentAmountCents: number | null;
  matrix: PlanMatrix;
  history: BillingHistoryRow[];
  portalOn: boolean;
  hasCustomer: boolean;
  subscriptionStatus: string | null;
  error?: string;
  notice?: string;
  payout?: React.ReactNode;
}) {
  const current = matrix.plans.find((plan) => plan.code === currentCode) ?? null;
  const returnTo = audience === "business" ? "/business/billing" : "/billing";
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet">{eyebrow}</p>
      <h1 className="mt-1 font-display text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted">
        {audience === "creator"
          ? "Choose the influencer plan for this account. A paid plan changes after Stripe confirms checkout."
          : "Choose the plan for this business workspace. Collaboration payments are separate from this subscription."}
      </p>
      {error ? <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</p> : null}
      {notice ? <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p> : null}

      <section className="mt-6 flex flex-col gap-4 rounded-3xl border border-[#E6ECF7] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1ECFF] text-xl text-violet">★</span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Current plan</p>
            <p className="font-display text-xl font-bold">{current?.name ?? currentCode ?? "Starter"}</p>
            <p className="text-sm text-muted">{current?.description || "This is the plan saved on the account."}</p>
            {subscriptionStatus ? <p className="mt-1 text-xs font-semibold text-emerald-700">Subscription {subscriptionStatus}.</p> : null}
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-display text-2xl font-bold">
            {current ? displayPrice(current.amountCents, current.priceLabel) : "$0"}
            <span className="text-sm font-semibold text-muted"> / month</span>
          </p>
          <Link href={audience === "business" ? "/business/plans" : "/pricing"} className="mt-1 inline-block text-sm font-semibold text-violet hover:underline">
            View public plans
          </Link>
        </div>
      </section>

      <section className={`mt-6 grid gap-5 ${matrix.plans.length > 2 ? "xl:grid-cols-3" : "md:grid-cols-2"}`}>
        {matrix.plans.map((plan, index) => {
          const isCurrent = plan.code === currentCode;
          const label = planActionLabel({
            name: plan.name,
            amountCents: plan.amountCents,
            current: isCurrent,
            currentAmountCents,
          });
          const emphasized = plan.recommended && !isCurrent;
          return (
            <article
              key={plan.code}
              className={`relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm ${emphasized ? "border-violet shadow-[0_16px_40px_rgba(99,60,255,0.15)]" : "border-[#E6ECF7]"}`}
            >
              {plan.recommended ? (
                <span className="absolute -top-3 right-5 rounded-full bg-violet px-3 py-1 text-[11px] font-bold text-white">Recommended</span>
              ) : null}
              <div className="flex items-start justify-between">
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-lg ${emphasized ? "bg-violet text-white" : "bg-[#F1ECFF] text-violet"}`}>
                  {index === 0 ? "★" : plan.recommended ? "♛" : "◆"}
                </span>
                {isCurrent ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">Current plan</span> : null}
              </div>
              <h2 className="mt-4 font-display text-xl font-bold">{plan.name}</h2>
              <p className="mt-2 font-display text-4xl font-bold">
                {displayPrice(plan.amountCents, plan.priceLabel)}
                <span className="text-sm font-semibold text-muted"> / month</span>
              </p>
              <p className="mt-2 text-sm text-muted">{plan.description}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {plan.highlights.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-violet">✓</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <PlanAction
                plan={plan}
                audience={audience}
                returnTo={returnTo}
                current={isCurrent}
                label={label}
                emphasized={emphasized}
              />
            </article>
          );
        })}
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <ComparisonTable title={audience === "creator" ? "Compare influencer plan features" : "Compare plan features"} matrix={matrix} />
        <div className="space-y-4">
          <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5 shadow-sm">
            <h2 className="font-display text-base font-bold">Payment method</h2>
            <p className="mt-1 text-sm text-muted">
              {hasCustomer
                ? "The card Stripe saved for this account opens in the billing portal. Influrios does not store the card number."
                : "No card is saved yet. Finish a paid checkout and Stripe stores the customer on this account."}
            </p>
            {portalOn && hasCustomer ? (
              <form action={actionOpenPortal} className="mt-4">
                <input type="hidden" name="returnTo" value={returnTo} />
                <button type="submit" className="text-sm font-semibold text-violet hover:underline">
                  Manage billing
                </button>
              </form>
            ) : null}
          </div>
          <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5 shadow-sm">
            <h2 className="font-display text-base font-bold">Billing history</h2>
            {history.length === 0 ? <p className="mt-2 text-sm text-muted">No completed checkout on this account yet.</p> : null}
            <ul className="mt-3 space-y-2 text-sm">
              {history.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 border-t border-[#F0F3FA] pt-2">
                  <span>
                    <span className="font-semibold">{row.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">{row.when}</span>
                  </span>
                  <span className="text-xs font-semibold uppercase text-emerald-700">{row.status}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
            <p className="font-bold">{audience === "creator" ? "Payouts are managed separately" : "Collaboration payments are separate"}</p>
            <p className="mt-1 text-amber-900/80">
              {audience === "creator"
                ? "Brand deals and milestone releases are not part of this subscription."
                : "Payments to creators for collaborations are not part of this workspace subscription."}
            </p>
            {payout}
          </div>
        </div>
      </section>
    </div>
  );
}
