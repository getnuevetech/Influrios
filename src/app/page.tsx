import Link from "next/link";
import { CreatorCard } from "@/components/creator-card";
import { SEED_CREATORS, SPECIALTY_TAXONOMY } from "@/lib/seed-data";

export default function HomePage() {
  const featured = SEED_CREATORS.slice(0, 4);

  return (
    <>
      <section className="hero-atmosphere relative overflow-hidden text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
          <div className="animate-rise">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-lavender/80">
              Influrios
            </p>
            <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              Find the right influence.
              <span className="mt-2 block text-lavender">Build the right collaboration.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-white/75 sm:text-lg">
              Search creators by specialty, audience, and geography — then share one professional
              Influencer Card that brings all their social presence into one place.
            </p>
            <form action="/discover" className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
              <input
                name="q"
                placeholder="Search specialty, location, or creator…"
                className="w-full flex-1 rounded-full border-0 px-5 py-3.5 text-indigo shadow-lg outline-none ring-2 ring-transparent focus:ring-violet"
              />
              <button type="submit" className="btn-primary whitespace-nowrap">
                Search →
              </button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              {SPECIALTY_TAXONOMY.slice(0, 6).map((s) => (
                <Link
                  key={s.slug}
                  href={`/discover?specialty=${s.slug}`}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 hover:bg-white/20"
                >
                  {s.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="animate-rise-delay relative hidden justify-center lg:flex">
            <div className="absolute -inset-8 rounded-full bg-violet/30 blur-3xl" />
            <div className="relative w-72 rounded-[2rem] border border-white/20 bg-white/10 p-6 backdrop-blur">
              <p className="text-sm font-semibold text-lavender">Create Your Free Influencer Card</p>
              <p className="mt-2 text-2xl font-bold">One Card. All Your Influence.</p>
              <p className="mt-3 text-sm text-white/70">
                Starter ships with a shareable profile link. QR and shortlinks unlock on Plus/Pro.
              </p>
              <Link href="/claim" className="btn-primary mt-6 w-full">
                Create Your Card →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-indigo sm:text-3xl">
              Explore influence by specialty
            </h2>
            <p className="mt-2 text-muted">Not just follower counts — what creators actually influence.</p>
          </div>
          <Link href="/discover" className="text-sm font-semibold text-violet hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {SPECIALTY_TAXONOMY.map((s) => (
            <Link
              key={s.slug}
              href={`/discover?specialty=${s.slug}`}
              className="card-surface flex flex-col items-start gap-2 p-4 transition hover:-translate-y-0.5"
            >
              <span className="text-lg font-bold text-indigo">{s.name}</span>
              <span className="text-xs text-muted">
                {s.children?.length ? `${s.children.length} sub-specialties` : "Browse creators"}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <h2 className="mb-6 font-display text-2xl font-bold text-indigo sm:text-3xl">
          Featured creators
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((c) => (
            <CreatorCard key={c.slug} creator={c} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="overflow-hidden rounded-[1.75rem] brand-gradient p-8 text-white sm:p-10">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold">Join as a creator or a business</h2>
            <p className="mt-3 text-white/80">
              Free discovery builds network density. Premium intelligence, matching, and managed
              introductions create the revenue layers.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/claim" className="rounded-full bg-white px-5 py-3 text-sm font-bold text-violet">
                Join as a Creator
              </Link>
              <Link
                href="/discover"
                className="rounded-full border border-white/40 px-5 py-3 text-sm font-bold text-white"
              >
                Join as a Business
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
