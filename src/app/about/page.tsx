import Link from "next/link";
import { getCms } from "@/lib/cms";

export const metadata = {
  title: "About Influrios",
  description: "Influrios helps businesses find the right influencers and run collaborations with signed agreements and protected milestone payments.",
};

const STEPS = {
  influencers: [
    "Claim your free Influrios Card: one professional page for your socials, specialty and contact details.",
    "Get discovered by businesses searching for what you actually influence, and apply to open requests.",
    "Sign the agreement in the app. The business funds it before you start, so the money is set aside.",
    "Deliver each milestone. When it is approved, your payout is sent to your verified payout account.",
  ],
  businesses: [
    "Search influencers by specialty, audience and location, or publish a request and review applications.",
    "Agree the scope and milestones, and sign the agreement in the app.",
    "Fund the collaboration by card, ACH or bank transfer. Influrios holds it for the agreed milestones.",
    "Review each delivery. Approving a milestone releases that part of the payment to the influencer.",
  ],
};

/** About Influrios: what it is, how it works for each side, and how to reach the team. */
export default async function AboutPage() {
  const cms = await getCms().catch(() => null);
  const pillars = (cms?.valueProposition.items ?? []).filter((item) => item.enabled).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="bg-[#F7FAFF]">
      <section className="hero-atmosphere text-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender/80">About</p>
          <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">More than a directory. An ecosystem for influence.</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">
            Influrios connects businesses with the right influencers and gives both sides one place to agree the work, fund it safely and
            get paid as milestones are delivered.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-4xl gap-10 px-4 py-12 sm:px-6">
        {pillars.length > 0 ? (
          <section>
            <h2 className="font-display text-2xl font-bold text-indigo">What Influrios does</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {pillars.map((item) => (
                <Link key={item.key} href={item.linkUrl || "/"} className="card-surface block p-5 transition hover:shadow-md">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet">{item.microLabel}</p>
                  <p className="mt-1 font-display text-lg font-bold text-indigo">{item.title}</p>
                  <p className="mt-2 text-sm text-muted">{item.description}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 md:grid-cols-2">
          {(
            [
              ["For influencers", STEPS.influencers, "/claim", "Create your Influrios Card"],
              ["For businesses", STEPS.businesses, "/business", "See how it works for businesses"],
            ] as const
          ).map(([title, steps, href, cta]) => (
            <div key={title} className="card-surface p-6">
              <h2 className="font-display text-xl font-bold text-indigo">{title}</h2>
              <ol className="mt-4 space-y-3 text-sm text-indigo">
                {steps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#EEE8FF] text-xs font-bold text-violet">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <Link href={href} className="mt-5 inline-flex text-sm font-semibold text-violet hover:underline">
                {cta} →
              </Link>
            </div>
          ))}
        </section>

        <section className="card-surface p-6">
          <h2 className="font-display text-xl font-bold text-indigo">Trust and safety</h2>
          <p className="mt-2 text-sm text-muted">
            Every collaboration runs on a signed agreement. Payments are collected through Stripe before the work starts and paid out per
            milestone, influencers verify their identity before receiving payouts, and either side can raise a dispute that our team
            reviews. Read more in{" "}
            <Link href="/trust" className="font-semibold text-violet hover:underline">Trust &amp; disputes</Link> and the{" "}
            <Link href="/legal" className="font-semibold text-violet hover:underline">Legal Center</Link>.
          </p>
        </section>

        <section className="text-center">
          <h2 className="font-display text-xl font-bold text-indigo">Talk to us</h2>
          <p className="mt-2 text-sm text-muted">Questions, partnerships or press: send us a message and our team will reply.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link href="/support" className="inline-flex h-11 items-center rounded-full bg-violet px-5 text-sm font-semibold text-white">
              Contact us
            </Link>
            <Link href="/faq" className="inline-flex h-11 items-center rounded-full border border-border bg-white px-5 text-sm font-semibold text-indigo">
              Read the FAQ
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
