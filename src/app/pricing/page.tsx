import Link from "next/link";
import { actionStartCheckout } from "@/app/billing/actions";
import { BILLING_CATALOG, type BillingProduct } from "@/lib/billing";
import { stripeBillingMode } from "@/lib/stripe-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing" };

const STARTER = {
  sku: "creator_starter",
  name: "Influencer Starter",
  priceLabel: "Free",
  amountCents: 0,
  description: "Claim your Influencer Card and get discovered.",
  highlights: ["Public profile", "Basic specialties", "Discover listing"],
};

export default async function PricingPage() {
  const stripeMode = await stripeBillingMode();
  const creatorPaid = BILLING_CATALOG.filter((p) => p.audience === "creator");
  const businessPlans = BILLING_CATALOG.filter((p) => p.audience === "business");

  return (
    <div className="bg-[#F7FAFF]">
      <section className="hero-atmosphere text-white">
        <div className="mx-auto max-w-[90rem] px-4 py-14 text-center sm:px-6 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender/80">
            Simple, transparent plans
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">Pricing</h1>
          <p className="mx-auto mt-3 max-w-2xl text-white/75">
            Choose an influencer or business plan. Upgrade anytime — Stripe Checkout when keys are
            configured, demo flow otherwise.
          </p>
          <p className="mt-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            Mode: {stripeMode === "sandbox" ? "Stripe sandbox" : stripeMode === "live" ? "Stripe live" : stripeMode === "rejected" ? "Stripe sandbox key required" : "Stripe key not saved"}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[90rem] space-y-10 px-4 py-10 sm:px-6 lg:px-10">
        <section>
          <h2 className="font-display text-2xl font-bold text-indigo">Influencer plans</h2>
          <p className="mt-1 text-sm text-muted">
            Starter free · Plus & Pro unlock QR, shortlinks, and collaboration tools.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <PlanCard plan={STARTER} />
            {creatorPaid.map((plan) => (
              <PlanCard key={plan.sku} plan={plan} checkout />
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-indigo">Business plans</h2>
          <p className="mt-1 text-sm text-muted">
            Shortlists, briefs, intelligence, and agency tooling for brands.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {businessPlans.map((plan) => (
              <PlanCard key={plan.sku} plan={plan} checkout />
            ))}
          </div>
        </section>

        <p className="text-center text-sm text-muted">
          Need invoices or seat management?{" "}
          <Link href="/billing" className="font-semibold text-violet hover:underline">
            Open billing workspace →
          </Link>
        </p>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  checkout = false,
}: {
  plan: Pick<BillingProduct, "sku" | "name" | "priceLabel" | "amountCents" | "description" | "highlights"> | typeof STARTER;
  checkout?: boolean;
}) {
  return (
    <div className="card-surface flex flex-col p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-violet">{plan.name}</p>
      <p className="mt-2 font-display text-3xl font-bold text-indigo">
        {plan.amountCents === 0 ? "Free" : plan.priceLabel.replace("/mo", "")}
        {plan.amountCents > 0 ? (
          <span className="text-sm font-semibold text-muted"> / mo</span>
        ) : null}
      </p>
      <p className="mt-2 text-sm text-muted">{plan.description}</p>
      <ul className="mt-4 flex-1 space-y-1.5 text-[13px] text-indigo/80">
        {plan.highlights.map((b) => (
          <li key={b}>• {b}</li>
        ))}
      </ul>
      {checkout ? (
        <form action={actionStartCheckout} className="mt-6">
          <input type="hidden" name="sku" value={plan.sku} />
          <button type="submit" className="btn-primary w-full !py-2.5 text-sm">
            Choose {plan.name}
          </button>
        </form>
      ) : (
        <Link href="/claim" className="btn-primary mt-6 w-full !py-2.5 text-center text-sm">
          Get started
        </Link>
      )}
    </div>
  );
}
