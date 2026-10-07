import Link from "next/link";
import { actionStartCheckout } from "@/app/billing/actions";
import { MarketingHeader } from "@/components/marketing-header";
import type { PlanMatrix } from "@/lib/plan-matrix";
import { displayPrice, planActionLabel } from "@/lib/plan-presentation";

type Faq = { id: string; question: string; answer: string };

const WHY = {
  creator: [
    { title: "Get discovered", body: "A public card, specialties, and a short link when the plan includes one." },
    { title: "Show your work", body: "QR, NFC, a media kit, and analytics follow the features saved on the plan." },
    { title: "Take collaborations", body: "Brands reach you through the collaboration tools included on the plan." },
    { title: "Keep payouts separate", body: "The subscription is not a collaboration payout. Payout setup stays on your account." },
  ],
  business: [
    { title: "Find creators", body: "Search the directory and save creators up to the shortlist on the plan." },
    { title: "Run requests", body: "Briefs, inquiries, and fit tools follow the features saved on the plan." },
    { title: "See the work", body: "Intelligence and exports appear when those features are turned on for the plan." },
    { title: "Pay creators separately", body: "Collaboration funding is not the workspace subscription. It is released on the contract." },
  ],
} as const;

export function PublicPlanPage({
  audience,
  signedIn,
  currentCode,
  currentAmountCents,
  matrix,
  faqs,
}: {
  audience: "creator" | "business";
  signedIn: boolean;
  currentCode: string | null;
  currentAmountCents: number | null;
  matrix: PlanMatrix;
  faqs: Faq[];
}) {
  const creator = audience === "creator";
  return (
    <div className="bg-[#F6F8FC] text-indigo">
      <MarketingHeader active={creator ? "influencer" : "business"} signedIn={signedIn} />
      <section className="mx-auto grid max-w-[90rem] items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-16">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet">
            {creator ? "Built for creators" : "Business plans"}
          </p>
          <h1 className="mt-3 max-w-xl font-display text-4xl font-bold leading-tight sm:text-5xl">
            {creator ? (
              <>
                Plans for every <span className="text-violet">creator</span> journey
              </>
            ) : (
              "Plans for brands, teams, and agencies"
            )}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted sm:text-base">
            {creator
              ? "Publish your card, get discovered, and use the collaboration tools included on your plan. The price and the feature list are the ones saved for that plan."
              : "Discover creators, manage collaborations, and scale the workspace. Seats, shortlists, and intelligence are whatever is saved on each plan."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={creator ? "/claim" : "/login?next=/business/home"} className="btn-primary">
              {creator ? "Get started free" : "Start free"}
            </Link>
            <a href="#compare" className="btn-secondary">
              See all features
            </a>
          </div>
        </div>
        <div className="relative hidden min-h-[280px] lg:block">
          <div className="absolute right-6 top-6 h-56 w-56 rounded-full bg-[#E4DBFF] blur-2xl" />
          <div className="absolute bottom-4 left-8 h-40 w-40 rounded-full bg-[#D9E8FF] blur-2xl" />
          <div className="relative ml-auto max-w-sm rounded-3xl border border-white/80 bg-white/80 p-5 shadow-lg">
            <p className="text-xs font-bold uppercase tracking-wide text-violet">{creator ? "On your card" : "On the workspace"}</p>
            <ul className="mt-3 space-y-2 text-sm text-indigo">
              {(creator
                ? ["Public influencer card", "Short link, QR, and NFC when the plan includes them", "Collaborations and payouts stay on the account"]
                : ["Creator search and shortlists", "Briefs and inquiries within the plan limits", "Collaboration payments stay separate from the subscription"]
              ).map((line) => (
                <li key={line} className="rounded-2xl bg-[#F6F8FC] px-3 py-2">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] px-4 pb-6 sm:px-6 lg:px-10">
        <div className={`grid gap-5 ${matrix.plans.length > 2 ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
          {matrix.plans.map((plan, index) => (
            <PlanCard
              key={plan.code}
              plan={plan}
              index={index}
              count={matrix.plans.length}
              audience={audience}
              returnTo={creator ? "/pricing" : "/business/plans"}
              current={currentCode === plan.code}
              currentAmountCents={currentAmountCents}
            />
          ))}
        </div>
      </section>

      <section id="compare" className="mx-auto grid max-w-[90rem] gap-5 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:px-10">
        <ComparisonTable title={creator ? "Compare influencer plan features" : "Compare plan features"} matrix={matrix} />
        <aside className="rounded-3xl border border-[#E6ECF7] bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-bold">{creator ? "Why creators upgrade" : "Why brands and agencies choose Influrios"}</h2>
          <ul className="mt-4 space-y-3">
            {WHY[audience].map((item) => (
              <li key={item.title} className="rounded-2xl bg-[#F6F8FC] p-3">
                <p className="text-sm font-bold">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </aside>
      </section>

      {faqs.length ? (
        <section className="mx-auto max-w-[90rem] px-4 pb-10 sm:px-6 lg:px-10">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold">Frequently asked questions</h2>
              <p className="mt-1 text-sm text-muted">Answers published for this audience.</p>
            </div>
            <Link href={`/faq?audience=${creator ? "creator" : "business"}`} className="text-sm font-semibold text-violet hover:underline">
              View all FAQs
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {faqs.map((entry) => (
              <details key={entry.id} className="rounded-2xl border border-[#E6ECF7] bg-white px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold">{entry.question}</summary>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{entry.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-[90rem] px-4 pb-14 sm:px-6 lg:px-10">
        <div className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-gradient-to-r from-[#EEF2FF] to-[#F3E9FF] px-6 py-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-xl font-bold">
              {creator ? "Ready to publish your card?" : "Ready to open a workspace?"}
            </h2>
            <p className="mt-1 text-sm text-muted">A paid plan changes only after Stripe confirms checkout.</p>
          </div>
          <Link href={creator ? "/claim" : "/login?next=/business/home"} className="btn-primary">
            {creator ? "Get started free" : "Start free"}
          </Link>
        </div>
      </section>
    </div>
  );
}

function PlanCard({
  plan,
  index,
  count,
  audience,
  returnTo,
  current,
  currentAmountCents,
}: {
  plan: PlanMatrix["plans"][number];
  index: number;
  count: number;
  audience: "creator" | "business";
  returnTo: string;
  current: boolean;
  currentAmountCents: number | null;
}) {
  const label = planActionLabel({
    name: plan.name,
    amountCents: plan.amountCents,
    current,
    currentAmountCents,
  });
  const emphasized = plan.recommended && !current;
  const mark = index === 0 ? "★" : plan.recommended ? "♛" : index === count - 1 ? "◆" : "●";
  return (
    <article
      className={`relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm ${
        emphasized ? "border-violet shadow-[0_16px_40px_rgba(99,60,255,0.15)]" : "border-[#E6ECF7]"
      }`}
    >
      {plan.recommended ? (
        <span className="absolute -top-3 right-5 rounded-full bg-violet px-3 py-1 text-[11px] font-bold text-white">
          Recommended
        </span>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-lg ${emphasized ? "bg-violet text-white" : "bg-[#F1ECFF] text-violet"}`}>
          {mark}
        </span>
        {current ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">Current plan</span> : null}
      </div>
      <h2 className="mt-4 font-display text-xl font-bold">{plan.name}</h2>
      <p className="mt-2 font-display text-4xl font-bold">
        {displayPrice(plan.amountCents, plan.priceLabel)}
        <span className="text-sm font-semibold text-muted"> / month</span>
      </p>
      <p className="mt-2 min-h-10 text-sm text-muted">{plan.description}</p>
      <ul className="mt-4 flex-1 space-y-2 text-sm">
        {plan.highlights.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="mt-0.5 text-violet">✓</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <PlanAction
        plan={plan}
        audience={audience}
        returnTo={returnTo}
        current={current}
        label={label}
        emphasized={emphasized}
      />
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
}: {
  plan: { code: string; sku: string; checkout: boolean; priceLabel: string };
  audience: "creator" | "business";
  returnTo: string;
  current: boolean;
  label: string;
  emphasized: boolean;
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
  if (!plan.checkout) {
    const href = audience === "creator" ? "/claim" : "/login?next=/business/home";
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }
  return (
    <form action={actionStartCheckout} className="mt-6 space-y-3">
      <input type="hidden" name="sku" value={plan.sku} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="flex items-start gap-2 text-xs text-indigo">
        <input type="checkbox" name="acceptSubscription" required className="mt-0.5 accent-violet" />
        <span>
          I agree to the{" "}
          <Link href="/legal/subscription-terms" className="font-semibold underline" target="_blank">
            subscription terms
          </Link>
          . {plan.priceLabel || "This plan"} renews until cancelled.
        </span>
      </label>
      <button type="submit" className={emphasized ? "btn-primary w-full !py-2.5 text-sm" : "btn-secondary w-full !py-2.5 text-sm"}>
        {label}
      </button>
    </form>
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
