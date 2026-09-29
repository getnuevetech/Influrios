import Link from "next/link";
import { InfluencerCardView } from "@/components/creator-card";
import { getCreatorBySlug } from "@/lib/seed-data";

export const metadata = {
  title: "Influencer Card",
};

export default function CardMarketingPage() {
  const demo = getCreatorBySlug("sofia-martinez")!;

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
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
          <InfluencerCardView creator={demo} />
        </div>
      </section>
    </>
  );
}
