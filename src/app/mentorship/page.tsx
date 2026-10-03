import Link from "next/link";
import { IconArrowRight, IconCheck, IconUsers } from "@/components/icons";

export const metadata = {
  title: "Influencer Mentorship",
};

/**
 * Mentorship acquisition stub (Collaboration OS P1 / P7 prelude).
 * Full Mentor–Mentee hub ships in a later phase — money stays out of collab balances.
 */
export default function MentorshipPage() {
  return (
    <div className="bg-[#F4F7FF]">
      <section className="border-b border-[#E4E9F5] bg-gradient-to-br from-[#F7F4FF] via-white to-[#EEF5FF]">
        <div className="mx-auto max-w-[90rem] px-4 py-14 sm:px-6 lg:px-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet">Mentor–Mentee Network</p>
          <h1 className="mt-2 font-display text-4xl font-bold text-indigo sm:text-5xl">
            Become an Influrios Influencer Mentor
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-muted sm:text-base">
            Mentorship is how experienced influencers help the next wave grow — and how Influrios
            welcomes new talent into the collaboration marketplace. Community mentoring launches
            first; paid mentoring stays behind a separate feature flag and never mixes into
            collaboration holding funds.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/claim" className="btn-primary">
              Join as an Influencer <IconArrowRight size={14} />
            </Link>
            <Link href="/collaboration" className="btn-secondary">
              Back to Collaborations
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[90rem] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-10">
        {[
          ["Share knowledge", "Guide rising influencers in your niche with structured advice and reviews."],
          ["Build your network", "Meet mentees and complementary specialists across markets."],
          ["Make an impact", "Strengthen the Influrios collaboration ecosystem from day one."],
        ].map(([title, detail]) => (
          <article key={title} className="rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lavender text-violet">
              <IconUsers size={18} />
            </span>
            <h2 className="mt-3 font-display text-lg font-bold text-indigo">{title}</h2>
            <p className="mt-1 text-sm text-muted">{detail}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-[90rem] px-4 pb-14 sm:px-6 lg:px-10">
        <div className="rounded-2xl border border-[#E4E9F5] bg-white p-6 shadow-sm">
          <h2 className="font-display text-xl font-bold text-indigo">What ships next</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {[
              "Find an Influencer Mentor / Become an Influrios Influencer Mentor hub with niche and country filters",
              "Admin-configurable eligibility (verified identity, history, standing)",
              "Request / accept / decline flows with availability boundaries",
              "Optional paid mentoring (feature-flagged) with separate terms",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <IconCheck size={14} className="mt-0.5 shrink-0 text-violet" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
