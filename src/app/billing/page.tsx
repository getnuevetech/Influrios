import Link from "next/link";
import { actionStartCheckout } from "@/app/billing/actions";
import {
  BILLING_CATALOG,
  getBillingStore,
  isStripeConfigured,
} from "@/lib/billing";
import { getWorkspace } from "@/lib/business";
import { getBusinessEntitlements } from "@/lib/business-entitlements";

export const metadata = { title: "Billing & Plans" };

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function BillingPage({ searchParams }: Props) {
  const params = await searchParams;
  const stripeLive = isStripeConfigured();
  const ws = await getWorkspace();
  const be = getBusinessEntitlements(ws.plan);
  const store = await getBillingStore();
  const creatorPlans = BILLING_CATALOG.filter((p) => p.audience === "creator");
  const businessPlans = BILLING_CATALOG.filter((p) => p.audience === "business");

  return (
    <div className="bg-[#F7FAFF]">
      <section className="hero-atmosphere text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender/80">
            Phase 6 · Monetization
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold">Plans & checkout</h1>
          <p className="mt-3 max-w-2xl text-white/75">
            Creator Plus/Pro and Business Pro/Agency — Stripe Checkout when keys are set, demo
            upgrade flow otherwise.
          </p>
          <p className="mt-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            Mode: {stripeLive ? "Stripe live keys detected" : "Demo checkout (no STRIPE_SECRET_KEY)"}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
        {params.error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Checkout error: {params.error}
          </div>
        ) : null}

        <section className="card-surface p-6">
          <h2 className="font-display text-xl font-bold text-indigo">Current demo entitlements</h2>
          <p className="mt-1 text-sm text-muted">
            Business workspace: <span className="font-semibold text-indigo">{ws.plan}</span> ·
            Intelligence {be.intelligence ? "on" : "off"} · Exports {be.exports ? "on" : "off"}
          </p>
          <p className="mt-1 text-xs text-muted">
            Recent sessions: {store.sessions.length}
            {store.lastWebhookAt
              ? ` · Last webhook ${new Date(store.lastWebhookAt).toLocaleString()}`
              : ""}
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-indigo">Creator plans</h2>
          <p className="mt-1 text-sm text-muted">
            Starter stays free via{" "}
            <Link href="/claim" className="font-semibold text-violet hover:underline">
              Create Your Card
            </Link>
            . Paid tiers unlock QR and collab tools.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {creatorPlans.map((p) => (
              <form key={p.sku} action={actionStartCheckout} className="card-surface flex flex-col p-6">
                <input type="hidden" name="sku" value={p.sku} />
                <input type="hidden" name="creatorSlug" value="sofia-martinez" />
                <p className="text-xs font-bold uppercase tracking-wide text-violet">{p.name}</p>
                <p className="mt-1 font-display text-3xl font-bold text-indigo">{p.priceLabel}</p>
                <p className="mt-2 text-sm text-muted">{p.description}</p>
                <ul className="mt-4 flex-1 space-y-1.5 text-sm text-muted">
                  {p.highlights.map((h) => (
                    <li key={h}>✓ {h}</li>
                  ))}
                </ul>
                <label className="mt-4 block text-xs font-semibold text-muted">
                  Email (optional)
                  <input
                    name="email"
                    type="email"
                    placeholder="you@creator.demo"
                    className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-indigo"
                  />
                </label>
                <button type="submit" className="btn-primary mt-4 w-full !py-2.5 text-sm">
                  {stripeLive ? "Checkout with Stripe →" : "Demo upgrade →"}
                </button>
              </form>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-indigo">Business plans</h2>
          <p className="mt-1 text-sm text-muted">
            Upgrades the demo business workspace plan after successful checkout.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {businessPlans.map((p) => (
              <form key={p.sku} action={actionStartCheckout} className="card-surface flex flex-col p-6">
                <input type="hidden" name="sku" value={p.sku} />
                <p className="text-xs font-bold uppercase tracking-wide text-violet">{p.name}</p>
                <p className="mt-1 font-display text-3xl font-bold text-indigo">{p.priceLabel}</p>
                <p className="mt-2 text-sm text-muted">{p.description}</p>
                <ul className="mt-4 flex-1 space-y-1.5 text-sm text-muted">
                  {p.highlights.map((h) => (
                    <li key={h}>✓ {h}</li>
                  ))}
                </ul>
                <label className="mt-4 block text-xs font-semibold text-muted">
                  Work email (optional)
                  <input
                    name="email"
                    type="email"
                    placeholder="brand@company.demo"
                    className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-indigo"
                  />
                </label>
                <button type="submit" className="btn-primary mt-4 w-full !py-2.5 text-sm">
                  {stripeLive ? "Checkout with Stripe →" : "Demo upgrade →"}
                </button>
              </form>
            ))}
          </div>
        </section>

        <p className="text-center text-sm text-muted">
          Admin ops:{" "}
          <Link href="/admin/billing" className="font-semibold text-violet hover:underline">
            Billing console
          </Link>
        </p>
      </div>
    </div>
  );
}
