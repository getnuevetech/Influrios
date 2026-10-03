import Image from "next/image";
import Link from "next/link";
import {
  CategoryGlyph,
  IconArrowRight,
  IconBuilding,
  IconCheck,
  IconSearch,
  IconUsers,
} from "@/components/icons";
import { SPECIALTY_TAXONOMY } from "@/lib/seed-data";

const CAPABILITIES = [
  {
    title: "Discover Influencers",
    copy: "Search and filter by specialty, location, audience, platform, and collaboration fit.",
  },
  {
    title: "Get Smart Suggestions",
    copy: "Tell us your goals and get influencer recommendations matched to your brief.",
  },
  {
    title: "Post Collaboration Requests",
    copy: "Share campaign needs and invite influencers who are open to partner.",
  },
  {
    title: "Invite & Contract",
    copy: "Review profiles, discuss terms, and move into structured collaboration agreements.",
  },
  {
    title: "Fund by Milestones",
    copy: "Protect spend with milestone-based funding and release when work is approved.",
  },
  {
    title: "Track Campaign Performance",
    copy: "Keep briefs, shortlists, inquiries, and progress in one business workspace.",
  },
  {
    title: "Work with Multiple Influencers",
    copy: "Run multi-influencer campaigns from a single business account.",
  },
  {
    title: "Global Reach",
    copy: "Coordinate cross-border collaborations with clear commercial workflows.",
  },
] as const;

const STEPS = [
  ["Create Business Profile", "Tell us about your brand and markets."],
  ["Tell Us What You Need", "Post a request or get influencer suggestions."],
  ["Match & Collaborate", "Review influencers and start a collaboration."],
  ["Fund, Track & Complete", "Protect payments and measure results."],
] as const;

const PLANS = [
  {
    code: "STARTER",
    name: "Starter",
    price: "$0",
    detail: "/month",
    points: ["Post collaboration requests", "3 active collaborations", "Basic shortlist"],
    cta: "Get Started",
    href: "/register?next=%2Fcollaboration%2Fbusiness",
  },
  {
    code: "GROWTH",
    name: "Growth",
    price: "$49",
    detail: "/month",
    points: ["Influencer suggestions", "10 active collaborations", "Fit insights"],
    cta: "Get Started",
    href: "/register?next=%2Fcollaboration%2Fbusiness%3Fplan%3DGROWTH",
    popular: true,
  },
  {
    code: "PRO",
    name: "Pro",
    price: "$149",
    detail: "/month",
    points: ["Multi-influencer campaigns", "Priority listing", "Larger shortlists"],
    cta: "Get Started",
    href: "/register?next=%2Fcollaboration%2Fbusiness%3Fplan%3DPRO",
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    price: "Custom",
    detail: "pricing",
    points: ["Unlimited collaborations", "Agency seats", "Tailored solutions"],
    cta: "Contact Sales",
    href: "/register?next=%2Fcollaboration%2Fbusiness",
  },
] as const;

const CATEGORY_CHIPS = ["beauty", "travel", "tech", "food", "fitness", "finance", "home-interior"];

/** Public For Businesses marketing + signup surface (approved design). */
export function BusinessMarketingPage({
  recommended,
}: {
  recommended: {
    slug: string;
    displayName: string;
    title: string;
    image: string;
    locationCity: string;
    locationCountry: string;
    specialty: string;
    followers: string;
    engagement: string;
    why: string;
  }[];
}) {
  return (
    <div className="bg-[#F7FAFF]">
      <section className="border-b border-[#E4EBFF] bg-gradient-to-br from-[#F4F0FF] via-white to-[#E8F4FF]">
        <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">For Businesses & Brands</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold text-indigo sm:text-5xl">
            Find the Right Influencers. Build Better Collaborations.
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-muted sm:text-base">
            Discover influencers by specialty and audience, get suggestions, post requests, and run
            protected collaborations — without treating Influrios like another social network.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="#create-profile" className="btn-primary">
              Create Business Profile <IconArrowRight size={14} />
            </Link>
            <Link href="/collaboration?goal=awareness" className="btn-secondary">
              Get Influencer Suggestions
            </Link>
          </div>
          <form action="/discover" className="mt-8 flex max-w-3xl items-center gap-2 rounded-full bg-white p-1.5 shadow-lg ring-1 ring-[#E4E9F5]">
            <span className="pl-3 text-muted">
              <IconSearch size={16} />
            </span>
            <input
              name="q"
              placeholder="Search influencers by specialty, country, platform or audience…"
              className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-sm outline-none"
            />
            <button type="submit" className="btn-primary shrink-0 !px-5 !py-2.5 text-sm">
              Search
            </button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORY_CHIPS.map((slug) => {
              const name = SPECIALTY_TAXONOMY.find((item) => item.slug === slug)?.name ?? slug;
              return (
                <Link
                  key={slug}
                  href={`/discover?specialty=${encodeURIComponent(slug)}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-indigo ring-1 ring-[#E4E9F5]"
                >
                  <CategoryGlyph slug={slug} size={14} />
                  {name}
                </Link>
              );
            })}
            <Link href="/categories" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-violet ring-1 ring-[#E4E9F5]">
              More
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6 lg:px-10">
        <h2 className="font-display text-2xl font-bold text-indigo">What Your Business Can Do on Influrios</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((item) => (
            <article key={item.title} className="rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAE4FF] text-violet">
                <IconBuilding size={18} />
              </span>
              <h3 className="mt-3 font-display text-lg font-bold text-indigo">{item.title}</h3>
              <p className="mt-1 text-sm text-muted">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[#E4EBFF] bg-white">
        <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6 lg:px-10">
          <div className="mb-6 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-indigo">Recommended Influencers for Your Business</h2>
              <p className="mt-1 text-sm text-muted">Example matches from the Influrios directory — open a profile when you are ready.</p>
            </div>
            <Link href="/discover" className="text-sm font-bold text-violet hover:underline">
              Find Influencers →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {recommended.map((item) => (
              <article key={item.slug} className="overflow-hidden rounded-2xl border border-[#E4E9F5] bg-white shadow-sm">
                <div className="relative h-36">
                  <Image src={item.image} alt="" fill className="object-cover" sizes="280px" />
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-violet">
                    {item.specialty}
                  </span>
                </div>
                <div className="p-4">
                  <p className="font-display text-lg font-bold text-indigo">{item.displayName}</p>
                  <p className="text-xs text-muted">{item.title}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {item.locationCity}, {item.locationCountry}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-indigo">
                    {item.followers} followers · {item.engagement} eng.
                  </p>
                  <p className="mt-2 rounded-xl bg-[#F4F0FF] p-2 text-[11px] text-muted">{item.why}</p>
                  <Link href={`/creators/${item.slug}`} className="mt-3 inline-flex text-xs font-bold text-violet">
                    View Influencer Profile →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6 lg:px-10">
        <h2 className="font-display text-2xl font-bold text-indigo">How It Works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([title, copy], index) => (
            <li key={title} className="rounded-2xl border border-[#E4E9F5] bg-white p-5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet text-sm font-bold text-white">
                {index + 1}
              </span>
              <h3 className="mt-3 font-display text-lg font-bold text-indigo">{title}</h3>
              <p className="mt-1 text-sm text-muted">{copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-[#E4EBFF] bg-white">
        <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6 lg:px-10">
          <h2 className="font-display text-2xl font-bold text-indigo">Business Account Plans</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PLANS.map((plan) => (
              <article
                key={plan.code}
                className={`rounded-2xl border p-5 shadow-sm ${
                  "popular" in plan && plan.popular ? "border-violet bg-[#F7F4FF]" : "border-[#E4E9F5] bg-white"
                }`}
              >
                {"popular" in plan && plan.popular ? (
                  <p className="text-[10px] font-bold uppercase tracking-wide text-violet">Most Popular</p>
                ) : null}
                <h3 className="mt-1 font-display text-xl font-bold text-indigo">{plan.name}</h3>
                <p className="mt-2 font-display text-3xl font-bold text-indigo">
                  {plan.price}
                  <span className="text-sm font-medium text-muted"> {plan.detail}</span>
                </p>
                <ul className="mt-4 space-y-1.5 text-sm text-muted">
                  {plan.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <IconCheck size={14} className="mt-0.5 shrink-0 text-violet" />
                      {point}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href} className="btn-primary mt-5 w-full !py-2 text-center text-sm">
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="create-profile" className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form action="/register" method="get" className="rounded-2xl border border-[#E4E9F5] bg-white p-6 shadow-sm">
            <input type="hidden" name="next" value="/collaboration/business" />
            <h2 className="font-display text-2xl font-bold text-indigo">Create Your Business Profile</h2>
            <p className="mt-1 text-sm text-muted">
              Start free. Create your Influrios account, then finish your business workspace setup.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-indigo sm:col-span-2">
                Business Name
                <input name="name" required placeholder="Your brand or company" className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal" />
              </label>
              <label className="block text-xs font-bold text-indigo sm:col-span-2">
                Work Email
                <input name="email" type="email" required className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal" />
              </label>
              <label className="block text-xs font-bold text-indigo">
                Country
                <input name="country" placeholder="United States" className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal" />
              </label>
              <label className="block text-xs font-bold text-indigo">
                Business Type
                <select name="businessType" className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal">
                  <option>Brand</option>
                  <option>Agency</option>
                  <option>Marketplace</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-indigo sm:col-span-2">
                Website (optional)
                <input name="website" className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal" />
              </label>
            </div>
            <label className="mt-4 flex items-start gap-2 text-sm text-muted">
              <input type="checkbox" name="wantSuggestions" defaultChecked className="mt-1 accent-[#633CFF]" />
              I want personalized influencer suggestions based on my business goals.
            </label>
            <Link href="/register?next=%2Fcollaboration%2Fbusiness" className="btn-primary mt-5 flex w-full justify-center">
              Create My Business Profile <IconArrowRight size={14} />
            </Link>
            <p className="mt-3 text-center text-sm text-muted">
              Already have an account?{" "}
              <Link href="/login?next=%2Fcollaboration%2Fbusiness&gate=business" className="font-semibold text-violet">
                Log in
              </Link>
            </p>
          </form>

          <aside className="rounded-2xl bg-gradient-to-br from-[#633CFF] to-[#2979FF] p-6 text-white shadow-sm">
            <IconUsers size={22} />
            <h3 className="mt-3 font-display text-2xl font-bold">Not sure who to work with?</h3>
            <p className="mt-2 text-sm text-white/85">
              Get influencer suggestions from your goals, category, and market — then invite the right partners.
            </p>
            <Link href="/collaboration?goal=awareness" className="ink-on-light mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-bold">
              Get Influencer Suggestions <IconArrowRight size={14} />
            </Link>
          </aside>
        </div>
      </section>
    </div>
  );
}
