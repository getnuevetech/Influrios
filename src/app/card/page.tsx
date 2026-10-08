import Link from "next/link";
import { PublicInfluencerCard } from "@/components/public-influencer-card";
import { getDirectory } from "@/lib/directory";
import { rethrowIfNextDynamicError } from "@/lib/next-dynamic";
import { loadPlanMatrix } from "@/lib/plan-matrix";
import { displayPrice } from "@/lib/plan-presentation";
import type { SeedCreator } from "@/lib/seed-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Influencer Card",
};

export default async function CardMarketingPage() {
  let example: SeedCreator | null = null;
  try {
    const directory = await getDirectory();
    example = directory.creators[0] ?? null;
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error("card directory", error);
  }
  const matrix = await loadPlanMatrix("creator");

  return (
    <>
      <section className="mx-auto grid max-w-[90rem] items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-violet">Influrios Card</p>
          <h1 className="mt-2 font-display text-4xl font-bold text-indigo sm:text-5xl">
            Your Influencer Card, <span className="brand-gradient-text">everywhere.</span>
          </h1>
          <p className="mt-4 text-lg text-muted">
            One portable commercial identity for social links, specialties, and business reachability. The
            price and the tools on each plan are the ones saved for that plan.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/claim" className="btn-primary">
              Create Your Card →
            </Link>
            {example ? (
              <Link href={`/creators/${example.slug}`} className="btn-secondary">
                See a live example
              </Link>
            ) : (
              <Link href="/pricing" className="btn-secondary">
                See influencer plans
              </Link>
            )}
          </div>
          <ul className="mt-8 space-y-2 text-sm text-muted">
            <li>A public card and a profile link</li>
            <li>A short link, QR code, and NFC tag when that plan includes them</li>
            <li>Collaboration tools follow the plan you choose</li>
          </ul>
        </div>
        <div className="rounded-[2rem] bg-[radial-gradient(circle_at_top,_#EAE4FF,_#D9E8FF)] p-6">
          {example ? (
            <PublicInfluencerCard creator={example} />
          ) : (
            <div className="flex min-h-80 items-center justify-center text-center text-sm text-muted">
              A published card appears here.
            </div>
          )}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-[90rem] px-4 pb-20 sm:px-6">
        <h2 className="font-display text-2xl font-bold text-indigo sm:text-3xl">Plans that unlock collaboration</h2>
        <p className="mt-2 text-muted">
          Checkout and the full comparison are on{" "}
          <Link href="/pricing" className="font-semibold text-violet hover:underline">
            Influencer plans
          </Link>
          .
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {matrix.plans.map((plan) => (
            <div key={plan.code} className="card-surface p-6">
              <p className="text-sm font-bold uppercase tracking-wide text-violet">{plan.name}</p>
              <p className="mt-2 font-display text-2xl font-bold text-indigo">
                {displayPrice(plan.amountCents, plan.priceLabel)}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted">
                {plan.highlights.slice(0, 4).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <Link href={plan.checkout ? "/pricing" : "/claim"} className="btn-primary mt-6 w-full !py-2 text-sm">
                {plan.checkout ? "View this plan" : "Get started"}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
