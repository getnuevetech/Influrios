import Link from "next/link";
import { PublicInfluencerCard } from "@/components/public-influencer-card";
import { getCreatorBySlug } from "@/lib/seed-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Influencer Card",
};

export default function CardMarketingPage() {
  const demo = getCreatorBySlug("sofia-martinez")!;

  return (
    <>
      <section className="mx-auto grid max-w-[90rem] items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-violet">
            Influrios Card
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold text-indigo sm:text-5xl">
            Your Influencer Card,{" "}
            <span className="brand-gradient-text">everywhere.</span>
          </h1>
          <p className="mt-4 text-lg text-muted">
            One portable commercial identity for social links, specialties, and business reachability.
            Starter is free with a shareable profile link. Plus adds shortlink + QR. Pro adds dynamic QR
            and advanced lead tools.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/claim" className="btn-primary">
              Create Your Card →
            </Link>
            <Link href="/c/sofia-martinez" className="btn-secondary">
              See a live example
            </Link>
          </div>
          <ul className="mt-8 space-y-2 text-sm text-muted">
            <li>✓ Starter: public vertical card + profile URL</li>
            <li>✓ Plus: shortlink + standard QR + up to 4 socials</li>
            <li>✓ Pro: dynamic QR, lead routing, premium theme</li>
          </ul>
        </div>
        <div className="rounded-[2rem] bg-[radial-gradient(circle_at_top,_#EAE4FF,_#D9E8FF)] p-6">
          <PublicInfluencerCard creator={demo} />
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-[90rem] px-4 pb-20 sm:px-6">
        <h2 className="font-display text-2xl font-bold text-indigo sm:text-3xl">
          Plans that unlock collaboration
        </h2>
        <p className="mt-2 text-muted">
          Starter is free. Plus and Pro unlock collaboration requests and richer card tools.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              name: "Starter",
              price: "Free",
              sku: null as string | null,
              points: ["Public card + profile URL", "1 specialty · 1 social", "Browse matches"],
            },
            {
              name: "Plus",
              price: "$19/mo",
              sku: "creator_plus",
              points: ["Shortlink + standard QR", "Request collab matches", "Up to 3 specialties · 4 socials"],
            },
            {
              name: "Pro",
              price: "$29/mo",
              sku: "creator_pro",
              points: ["Dynamic QR + lead routing", "Priority collab tools", "Media kit + advanced analytics"],
            },
          ].map((plan) => (
            <div key={plan.name} className="card-surface p-6">
              <p className="text-sm font-bold uppercase tracking-wide text-violet">{plan.name}</p>
              <p className="mt-2 font-display text-2xl font-bold text-indigo">{plan.price}</p>
              <ul className="mt-4 space-y-2 text-sm text-muted">
                {plan.points.map((p) => (
                  <li key={p}>✓ {p}</li>
                ))}
              </ul>
              {plan.sku ? (
                <Link href={`/billing`} className="btn-primary mt-6 w-full !py-2 text-sm">
                  Upgrade via checkout →
                </Link>
              ) : (
                <Link href="/claim" className="btn-primary mt-6 w-full !py-2 text-sm">
                  Get started
                </Link>
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          Phase 6 monetization — full catalog & demo/Stripe checkout at{" "}
          <Link href="/billing" className="font-semibold text-violet hover:underline">
            /billing
          </Link>
          .
        </p>
      </section>
    </>
  );
}
