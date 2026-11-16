import Link from "next/link";
import { MarketingHeader } from "@/components/marketing-header";
import { CompareFeatures } from "@/components/plans/compare-features";
import { PlanCheckout } from "@/components/plans/plan-checkout";
import { carryPlanSelection, type BillingInterval } from "@/lib/billing-interval";
import type { PlanMatrix } from "@/lib/plan-matrix";
import { annualSavingsCents, CHECKOUT_TAX_NOTE, displayedPriceBreakdown, formatOfferAmount } from "@/lib/billing-interval";
import { displayPrice, planActionLabel } from "@/lib/plan-presentation";
import { formatUsd, quotedPlanTax, type PlanTaxGate } from "@/lib/tax-configuration";

export function PublicPlanPage({
  audience,
  signedIn,
  accountRole,
  currentCode,
  currentAmountCents,
  matrix,
  interval = "month",
  annualBySku = {},
  annualCheckoutBySku,
  taxByCode = {},
}: {
  audience: "creator" | "business";
  signedIn: boolean;
  accountRole?: string | null;
  currentCode: string | null;
  currentAmountCents: number | null;
  matrix: PlanMatrix;
  interval?: BillingInterval;
  annualBySku?: Record<string, number>;
  annualCheckoutBySku?: Record<string, boolean>;
  taxByCode?: Record<string, PlanTaxGate>;
  countries?: { code: string; name: string }[];
}) {
  const creator = audience === "creator";
  const basePath = creator ? "/pricing" : "/business/plans";
  return (
    <div className="bg-[#F6F8FC] text-indigo">
      <MarketingHeader
        active={creator ? "influencer" : "business"}
        signedIn={signedIn}
        accountRole={accountRole}
        planInterval={interval}
      />
      <section className="mx-auto max-w-[90rem] px-4 pb-16 pt-10 sm:px-6 lg:px-10">
        <div className="text-center">
          <h1 className="font-display text-4xl font-bold">{creator ? "Influencer plans" : "Business plans"}</h1>
          <IntervalLinks basePath={basePath} interval={interval} />
        </div>
        <div className={`mt-8 grid gap-5 ${matrix.plans.length > 2 ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
          {matrix.plans.map((plan) => (
            <PlanCard
              key={plan.code}
              plan={plan}
              audience={audience}
              interval={interval}
              annualAmountCents={annualBySku[plan.sku] ?? null}
              annualCheckout={annualCheckoutBySku ? annualCheckoutBySku[plan.sku] === true : undefined}
              signedIn={signedIn}
              current={currentCode === plan.code}
              currentAmountCents={currentAmountCents}
              taxGate={taxByCode[plan.code]}
            />
          ))}
        </div>
        <CompareFeatures plans={matrix.plans.map((plan) => ({ code: plan.code, name: plan.name }))} rows={matrix.rows} />
        <p className="mt-4 text-center text-sm text-muted">{CHECKOUT_TAX_NOTE}</p>
        <p className="mt-2 text-center text-sm">
          <Link href="/faq" className="font-semibold text-violet hover:underline">Resources</Link>
        </p>
      </section>
    </div>
  );
}

function IntervalLinks({ basePath, interval }: { basePath: string; interval: BillingInterval }) {
  const href = (next: BillingInterval) => (next === "year" ? `${basePath}?interval=year` : basePath);
  const item = (next: BillingInterval) =>
    `rounded-full px-4 py-2 text-sm font-semibold ${interval === next ? "bg-violet text-white" : "text-indigo"}`;
  return (
    <div role="group" aria-label="Billing period" className="mx-auto mt-6 inline-flex rounded-full bg-[#F1ECFF] p-1">
      <Link href={href("month")} aria-pressed={interval === "month"} className={item("month")}>Monthly</Link>
      <Link href={href("year")} aria-pressed={interval === "year"} className={item("year")}>Annual</Link>
    </div>
  );
}

function PlanCard({
  plan,
  audience,
  interval,
  annualAmountCents,
  annualCheckout,
  signedIn,
  current,
  currentAmountCents,
  taxGate,
}: {
  plan: PlanMatrix["plans"][number];
  audience: "creator" | "business";
  interval: BillingInterval;
  annualAmountCents: number | null;
  annualCheckout?: boolean;
  signedIn: boolean;
  current: boolean;
  currentAmountCents: number | null;
  taxGate?: PlanTaxGate;
}) {
  const priced = annualAmountCents != null && annualAmountCents > 0;
  const annualReady = annualCheckout ?? priced;
  const label = planActionLabel({
    name: plan.name,
    amountCents: plan.amountCents,
    current: current && interval === "month",
    currentAmountCents,
    viewingInterval: interval,
    currentInterval: current ? "month" : null,
    annualReady,
  });
  const emphasized = plan.recommended && !(current && interval === "month");
  const review = carryPlanSelection({
    returnTo: audience === "business" ? "/business/billing" : "/billing",
    sku: plan.sku,
    planCode: plan.code,
    interval,
  });
  const href = signedIn ? review : `/login?next=${encodeURIComponent(review)}`;
  const unavailable = interval === "year" && plan.amountCents > 0 && !annualReady;
  return (
    <article className={`relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm ${emphasized ? "border-violet shadow-[0_16px_40px_rgba(99,60,255,0.15)]" : "border-[#E6ECF7]"}`}>
      {plan.recommended ? (
        <span className="absolute -top-3 right-5 rounded-full bg-violet px-3 py-1 text-[11px] font-bold text-white">Most popular</span>
      ) : null}
      <h2 className="font-display text-xl font-bold">{plan.name}</h2>
      <PlanPrice
        amountCents={plan.amountCents}
        priceLabel={plan.priceLabel}
        interval={interval}
        annualAmountCents={annualAmountCents}
        locationKnown={false}
        gate={taxGate}
      />
      {unavailable ? (
        <p className="mt-2 text-sm text-amber-900">
          {priced ? "Annual checkout is not available for this plan yet." : "Annual billing is not available for this plan yet."}
        </p>
      ) : null}
      <ul className="mt-4 flex-1 space-y-2 text-sm">
        {plan.highlights.slice(0, 3).map((line) => (
          <li key={line} className="flex gap-2">
            <span className="text-violet">✓</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      {unavailable ? (
        <Link href={audience === "business" ? "/business/plans" : "/pricing"} className="btn-secondary mt-6 w-full !py-2.5 text-sm">View monthly</Link>
      ) : plan.amountCents <= 0 ? (
        <Link href={audience === "creator" ? "/claim" : "/login?next=/business/home"} className="btn-secondary mt-6 w-full !py-2.5 text-sm">{label}</Link>
      ) : taxGate?.kind === "unavailable" ? (
        <p className="mt-6 text-sm text-amber-900">This plan is temporarily unavailable.</p>
      ) : (
        <Link href={href} className={emphasized ? "btn-primary mt-6 w-full !py-2.5 text-sm" : "btn-secondary mt-6 w-full !py-2.5 text-sm"}>{label}</Link>
      )}
    </article>
  );
}

export function PlanAction({
  plan,
  audience,
  returnTo,
  current,
  label,
  emphasized,
  taxGate,
  countries = [],
  currentAmountCents = null,
  signedIn = true,
  interval = "month",
  mode = "checkout",
  annualAmountCents = null,
  renewalLabel = null,
}: {
  plan: { code: string; sku: string; name: string; checkout: boolean; priceLabel: string; amountCents: number };
  audience: "creator" | "business";
  returnTo: string;
  current: boolean;
  label: string;
  emphasized: boolean;
  taxGate?: PlanTaxGate;
  countries?: { code: string; name: string }[];
  currentAmountCents?: number | null;
  signedIn?: boolean;
  quote?: { taxCents: number; totalCents: number; ratePercent: number | null } | null;
  interval?: BillingInterval;
  mode?: "checkout" | "schedule" | "tier";
  annualAmountCents?: number | null;
  renewalLabel?: string | null;
}) {
  const className = emphasized
    ? "btn-primary mt-6 w-full !py-2.5 text-sm"
    : "btn-secondary mt-6 w-full !py-2.5 text-sm";
  if (current) {
    return (
      <Link href={audience === "business" ? "/business/billing" : "/billing"} className={className}>
        Current plan
      </Link>
    );
  }
  if (!plan.checkout || plan.amountCents <= 0) {
    const href = audience === "creator" ? "/claim" : "/login?next=/business/home";
    return (
      <div className="mt-6">
        <Link href={href} className={emphasized ? "btn-primary w-full !py-2.5 text-sm" : "btn-secondary w-full !py-2.5 text-sm"}>
          {label}
        </Link>
        {currentAmountCents != null && currentAmountCents > 0 ? (
          <p className="mt-2 text-xs text-muted">Cancelling a paid subscription stays in billing and is separate from this plan.</p>
        ) : null}
      </div>
    );
  }
  if (taxGate?.kind === "unavailable") {
    return (
      <p data-screen="S01" className="mt-6 text-sm text-amber-900">
        This plan is temporarily unavailable.
      </p>
    );
  }
  if (!signedIn) {
    const next = carryPlanSelection({
      returnTo: audience === "business" ? "/business/billing" : "/billing",
      sku: plan.sku,
      planCode: plan.code,
      interval,
    });
    return (
      <Link href={`/login?next=${encodeURIComponent(next)}`} className={emphasized ? "btn-primary mt-6 w-full !py-2.5 text-sm" : "btn-secondary mt-6 w-full !py-2.5 text-sm"}>
        {label}
      </Link>
    );
  }
  return (
    <PlanCheckout
      plan={plan}
      audience={audience}
      returnTo={returnTo}
      label={label}
      emphasized={emphasized}
      countries={countries}
      interval={interval}
      mode={mode}
      annualAmountCents={annualAmountCents}
      renewalLabel={renewalLabel}
    />
  );
}

export function PlanPrice({
  amountCents,
  gate,
  size = "card",
  interval = "month",
  annualAmountCents = null,
  locationKnown = false,
}: {
  amountCents: number;
  priceLabel: string;
  gate?: PlanTaxGate;
  size?: "card" | "compact";
  interval?: BillingInterval;
  annualAmountCents?: number | null;
  locationKnown?: boolean;
}) {
  const priceClass = size === "card" ? "mt-2 font-display text-4xl font-bold" : "font-display text-2xl font-bold";
  if (amountCents <= 0) {
    return <p className={priceClass}>Free</p>;
  }
  const savings = interval === "year" ? annualSavingsCents({
    monthlyAmountCents: amountCents,
    annualAmountCents,
    monthlyCurrency: "USD",
    annualCurrency: "USD",
  }) : null;
  const quote = quotedPlanTax(gate);
  const breakdown = locationKnown
    ? displayedPriceBreakdown({
        locationKnown: true,
        baseCents: interval === "year" && annualAmountCents != null ? annualAmountCents : amountCents,
        taxCents: quote?.taxCents,
        ratePercent: quote?.ratePercent,
        claimedTotalCents: quote?.totalCents,
      })
    : displayedPriceBreakdown({ locationKnown: false, baseCents: amountCents });
  return (
    <div>
      {interval === "year" && annualAmountCents != null ? (
        <>
          <p className={priceClass}>{formatOfferAmount(annualAmountCents)}<span className="text-sm font-semibold text-muted">/year</span></p>
          <p className="mt-1 text-sm text-muted">
            {formatOfferAmount(amountCents)} monthly
            {savings != null ? <span className="font-semibold text-violet"> · Save {formatOfferAmount(savings)}/year</span> : null}
          </p>
        </>
      ) : (
        <p className={priceClass}>
          {formatOfferAmount(amountCents)}
          <span className="text-sm font-semibold text-muted">/month</span>
        </p>
      )}
      {breakdown.kind === "exclusive" || breakdown.kind === "inclusive" ? (
        <p className="mt-1 text-sm text-muted">
          Tax {formatUsd(breakdown.taxCents)}{breakdown.ratePercent != null ? ` (${breakdown.ratePercent}%)` : ""} · Total {formatUsd(breakdown.totalCents)}
        </p>
      ) : null}
    </div>
  );
}

export function ComparisonTable({ title, matrix }: { title: string; matrix: PlanMatrix }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#E6ECF7] bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#E6ECF7] px-5 py-4">
        <div>
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <p className="text-xs text-muted">Included features are the ones saved on each public plan.</p>
        </div>
        <p className="text-[11px] font-semibold text-muted">
          <span className="text-emerald-600">✓</span> Included <span className="mx-2">—</span> Not included <span className="mx-2">#</span> Limit
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Feature</th>
              {matrix.plans.map((plan) => (
                <th key={plan.code} className="px-4 py-3 font-semibold text-indigo">
                  {plan.name}
                  <span className="mt-1 block text-[11px] font-medium normal-case text-muted">
                    {displayPrice(plan.amountCents, plan.priceLabel)}/mo
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.key} className="border-t border-[#F0F3FA]">
                <td className="px-5 py-3 font-medium">{row.label}</td>
                {row.cells.map((cell) => (
                  <td key={cell.code} className="px-4 py-3">
                    {cell.included && cell.text === "Included" ? (
                      <span className="text-emerald-600">✓</span>
                    ) : cell.included ? (
                      <span className="rounded-full bg-[#F1ECFF] px-2 py-0.5 text-xs font-bold text-violet">{cell.text}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
