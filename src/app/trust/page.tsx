import Link from "next/link";

export const metadata = {
  title: "Trust & safety",
  description: "How Influrios protects businesses and influencers: signed agreements, protected milestone payments, verified payouts and fair dispute resolution.",
};

const PAYMENT_STEPS = [
  { title: "Agree", body: "Both sides sign the agreement in Influrios: scope, milestones, amounts and review window." },
  { title: "Fund", body: "The business funds the collaboration by card, ACH or bank transfer through Stripe before work starts." },
  { title: "Deliver", body: "The influencer submits each milestone. The business reviews it, asks for changes or approves." },
  { title: "Get paid", body: "An approved milestone is paid to the influencer's verified payout account. Fees are shown before signing." },
];

const PILLARS = [
  {
    title: "Signed agreements",
    body: "Every collaboration runs on an agreement both parties sign in the app, so scope, deliverables and payment terms are clear from the start.",
  },
  {
    title: "Protected payments",
    body: "Money is collected before work begins and released milestone by milestone. Influencers know it is there; businesses pay only for approved work.",
  },
  {
    title: "Verified payouts",
    body: "Influencers verify their identity with Stripe before receiving payouts, and payouts go only to their own verified account.",
  },
  {
    title: "Fair disputes",
    body: "If something goes wrong, either side can report a problem on a milestone. Its payout is held while our team reviews the evidence from both sides.",
  },
];

/** Public trust & safety explainer. It never shows any member's collaborations or disputes. */
export default function TrustPage() {
  return (
    <div className="bg-[#F7FAFF]">
      <section className="hero-atmosphere text-white">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender/80">Trust &amp; safety</p>
          <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">Collaborate with confidence</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">
            Signed agreements, payments held for each milestone, verified payouts and a fair way to resolve problems, for businesses
            and influencers alike.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-12 px-4 py-12 sm:px-6">
        <section className="grid gap-4 sm:grid-cols-2">
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className="card-surface p-6">
              <h2 className="font-display text-lg font-bold text-indigo">{pillar.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{pillar.body}</p>
            </div>
          ))}
        </section>

        <section id="payments" className="scroll-mt-24">
          <h2 className="font-display text-2xl font-bold text-indigo">How protected payments work</h2>
          <ol className="mt-5 grid gap-4 md:grid-cols-4">
            {PAYMENT_STEPS.map((step, index) => (
              <li key={step.title} className="card-surface p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEE8FF] text-sm font-bold text-violet">{index + 1}</span>
                <p className="mt-3 font-display font-bold text-indigo">{step.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="disputes" className="card-surface scroll-mt-24 p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold text-indigo">If something goes wrong</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-indigo">
            <li>Talk it through in the collaboration&apos;s Messages. Most issues are settled there.</li>
            <li>
              Still stuck? Open the collaboration and choose <span className="font-semibold">Report a problem</span>. That milestone&apos;s
              payout is held.
            </li>
            <li>Both sides add evidence (notes and links). Our team reviews it and records a decision.</li>
            <li>To end the whole collaboration early, either side can request a cancellation from the same page.</li>
          </ol>
          <p className="mt-4 text-sm text-muted">
            Need help now?{" "}
            <Link href="/support" className="font-semibold text-violet hover:underline">
              Contact support
            </Link>{" "}
            or read the{" "}
            <Link href="/faq" className="font-semibold text-violet hover:underline">
              FAQ
            </Link>
            .
          </p>
        </section>

        <section className="text-center">
          <p className="text-sm text-muted">
            Our policies are in the{" "}
            <Link href="/legal" className="font-semibold text-violet hover:underline">
              Legal Center
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
