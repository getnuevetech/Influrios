import Link from "next/link";
import { actionCancelScheduledChange, actionOpenPortal } from "@/app/billing/actions";
import { CompareFeatures } from "@/components/plans/compare-features";
import { PlanAction, PlanPrice } from "@/components/plans/public-plan-page";
import { CHECKOUT_TAX_NOTE, formatOfferAmount, type BillingInterval } from "@/lib/billing-interval";
import type { ReactNode } from "react";
import type { PlanMatrix } from "@/lib/plan-matrix";
import { planActionLabel } from "@/lib/plan-presentation";
import type { PlanTaxGate } from "@/lib/tax-configuration";

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
  currentInterval = null,
  renewalLabel = null,
  pendingLabel = null,
  subscriptionSku = null,
  matrix,
  history,
  portalOn,
  hasCustomer,
  subscriptionStatus,
  hasSubscriptionReference = false,
  interval = "month",
  annualBySku = {},
  error,
  notice,
  payout,
  taxByCode = {},
  countries = [],
}: {
  audience: "creator" | "business";
  eyebrow: string;
  title: string;
  currentCode: string | null;
  currentAmountCents: number | null;
  currentInterval?: BillingInterval | null;
  renewalLabel?: string | null;
  pendingLabel?: string | null;
  subscriptionSku?: string | null;
  matrix: PlanMatrix;
  history: BillingHistoryRow[];
  portalOn: boolean;
  hasCustomer: boolean;
  subscriptionStatus: string | null;
  hasSubscriptionReference?: boolean;
  interval?: BillingInterval;
  annualBySku?: Record<string, number>;
  error?: string;
  notice?: string;
  payout?: ReactNode;
  taxByCode?: Record<string, PlanTaxGate>;
  countries?: { code: string; name: string }[];
}) {
  const current = matrix.plans.find((plan) => plan.code === currentCode || plan.sku === subscriptionSku) ?? null;
  const returnTo = audience === "business" ? "/business/billing" : "/billing";
  const active = subscriptionStatus === "active" || subscriptionStatus === "trialing";
  const pastDue = subscriptionStatus === "past_due";
  const subscribedInterval = currentInterval ?? (active ? "month" : null);
  const href = (next: BillingInterval) => (next === "year" ? `${returnTo}?interval=year` : returnTo);

  return (
    <div data-screen="S01">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet">{eyebrow}</p>
      <h1 className="mt-1 font-display text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted">Manage your Influrios plan, billing, and payment details.</p>
      {error ? <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</p> : null}
      {notice ? <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p> : null}
      {pastDue ? (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This subscription is past due. Update the payment method before changing the plan.
        </p>
      ) : null}
      {active && !hasSubscriptionReference ? (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Resolve the subscription reference before starting another subscription. Nothing was changed.
        </p>
      ) : null}

      <section className="mt-6 flex flex-col gap-4 rounded-3xl border border-[#E6ECF7] bg-[#F7F4FF] p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-xl font-bold">
            {current?.name ?? "Starter"}
            {subscribedInterval ? <span> · {subscribedInterval === "year" ? "Annual" : "Monthly"}</span> : null}
          </p>
          <p className="text-sm text-muted">
            {current && current.amountCents > 0
              ? subscribedInterval === "year" && annualBySku[current.sku] != null
                ? `${formatOfferAmount(annualBySku[current.sku])}/year`
                : `${formatOfferAmount(current.amountCents)}/month`
              : "Free"}
          </p>
          {renewalLabel ? <p className="mt-1 text-sm text-muted">Next renewal {renewalLabel}</p> : null}
          {pendingLabel ? <p className="mt-1 text-sm font-semibold text-violet">Scheduled · {pendingLabel}</p> : null}
          {subscriptionStatus ? <p className="mt-1 text-xs font-semibold text-emerald-700">Subscription {subscriptionStatus}.</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {portalOn && hasCustomer ? (
            <form action={actionOpenPortal}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <button type="submit" className="rounded-full border border-violet px-4 py-2 text-sm font-semibold text-violet">Manage billing</button>
            </form>
          ) : null}
          {pendingLabel ? (
            <form action={actionCancelScheduledChange}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <button type="submit" className="rounded-full border px-4 py-2 text-sm font-semibold">Cancel scheduled change</button>
            </form>
          ) : null}
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Change plan</h2>
          <p className="text-sm text-muted">Choose a plan and billing cadence that works for you.</p>
        </div>
        <div role="group" aria-label="Billing period" className="inline-flex rounded-full bg-[#F1ECFF] p-1">
          <Link href={href("month")} aria-pressed={interval === "month"} className={`rounded-full px-4 py-2 text-sm font-semibold ${interval === "month" ? "bg-white text-indigo shadow-sm" : "text-indigo"}`}>Monthly</Link>
          <Link href={href("year")} aria-pressed={interval === "year"} className={`rounded-full px-4 py-2 text-sm font-semibold ${interval === "year" ? "bg-violet text-white" : "text-indigo"}`}>Annual</Link>
        </div>
      </div>

      <section className={`mt-6 grid gap-5 ${matrix.plans.length > 2 ? "xl:grid-cols-3" : "md:grid-cols-2"}`}>
        {matrix.plans.map((plan) => {
          const annualReady = annualBySku[plan.sku] != null && annualBySku[plan.sku] > 0;
          const sameTier = plan.code === currentCode || plan.sku === subscriptionSku;
          const viewingCurrent = sameTier && interval === (subscribedInterval ?? "month");
          const label = sameTier && interval === "year" && subscribedInterval === "month"
            ? annualReady
              ? `Switch ${plan.name} to annual`
              : `${plan.name} annual is not available yet`
            : planActionLabel({
                name: plan.name,
                amountCents: plan.amountCents,
                current: viewingCurrent,
                currentAmountCents,
                viewingInterval: interval,
                currentInterval: subscribedInterval,
                annualReady,
              });
          const mode = active && sameTier && interval === "year" && subscribedInterval === "month"
            ? "schedule"
            : active && !viewingCurrent && plan.amountCents > 0
              ? "tier"
              : "checkout";
          return (
            <article key={plan.code} className={`relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm ${sameTier ? "border-violet" : "border-[#E6ECF7]"}`}>
              {sameTier && subscribedInterval ? (
                <span className="absolute -top-3 right-5 rounded-full bg-[#F1ECFF] px-2.5 py-1 text-[11px] font-bold text-violet">
                  Current plan ({subscribedInterval === "year" ? "annual" : "monthly"})
                </span>
              ) : null}
              <h2 className="font-display text-xl font-bold">{plan.name}</h2>
              <PlanPrice amountCents={plan.amountCents} priceLabel={plan.priceLabel} interval={interval} annualAmountCents={annualBySku[plan.sku] ?? null} locationKnown={false} />
              {interval === "year" && plan.amountCents > 0 && !annualReady ? (
                <p className="mt-2 text-sm text-amber-900">Annual billing is not available for this plan yet.</p>
              ) : null}
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {plan.highlights.slice(0, 3).map((line) => (
                  <li key={line} className="flex gap-2"><span className="text-violet">✓</span><span>{line}</span></li>
                ))}
              </ul>
              {pastDue || (active && !hasSubscriptionReference) ? (
                <p className="mt-6 text-sm text-muted">The current subscription stays in place.</p>
              ) : interval === "year" && plan.amountCents > 0 && !annualReady ? (
                <Link href={href("month")} className="btn-secondary mt-6 w-full !py-2.5 text-sm">View monthly</Link>
              ) : (
                <PlanAction
                  plan={plan}
                  audience={audience}
                  returnTo={returnTo}
                  current={viewingCurrent}
                  label={label}
                  emphasized={mode === "schedule" || Boolean(plan.recommended && !viewingCurrent)}
                  taxGate={taxByCode[plan.code]}
                  countries={countries}
                  currentAmountCents={currentAmountCents}
                  interval={interval}
                  mode={mode}
                  annualAmountCents={annualBySku[plan.sku] ?? null}
                  renewalLabel={renewalLabel}
                />
              )}
            </article>
          );
        })}
      </section>

      <CompareFeatures plans={matrix.plans.map((plan) => ({ code: plan.code, name: plan.name }))} rows={matrix.rows} />
      <p className="mt-3 text-center text-sm text-muted">{CHECKOUT_TAX_NOTE}</p>

      <section id="payment" className="mt-8 space-y-3">
        <div className="flex items-center justify-between rounded-2xl border border-[#E6ECF7] bg-white px-4 py-3">
          <div>
            <p className="font-semibold">Payment method</p>
            <p className="text-sm text-muted">Update your card and payment details.</p>
          </div>
          {portalOn && hasCustomer ? (
            <form action={actionOpenPortal}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <button type="submit" className="text-sm font-semibold text-violet">Manage billing</button>
            </form>
          ) : null}
        </div>
        <div className="rounded-2xl border border-[#E6ECF7] bg-white px-4 py-3">
          <p className="font-semibold">Billing history</p>
          {history.length === 0 ? <p className="mt-1 text-sm text-muted">No completed checkout on this account yet.</p> : null}
          <ul className="mt-2 space-y-2 text-sm">
            {history.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3">
                <span>{row.name}<span className="mt-0.5 block text-xs text-muted">{row.when}</span></span>
                <span className="text-xs font-semibold uppercase text-emerald-700">{row.status}</span>
              </li>
            ))}
          </ul>
        </div>
        {payout ? <div className="text-sm text-muted">{payout}</div> : null}
      </section>
    </div>
  );
}
