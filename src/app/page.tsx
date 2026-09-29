import Image from "next/image";
import Link from "next/link";
import { CreatorCard, InfluencerCardView } from "@/components/creator-card";
import {
  CATEGORY_IMAGES,
  COLLAB_MATCH_PRESETS,
  SEED_CREATORS,
  SPECIALTY_TAXONOMY,
  formatFollowers,
  totalFollowers,
} from "@/lib/seed-data";

export default function HomePage() {
  const featured = SEED_CREATORS.slice(0, 5);
  const heroCreators = [
    SEED_CREATORS[0],
    SEED_CREATORS[5],
    SEED_CREATORS[2],
    SEED_CREATORS[3],
  ];

  return (
    <>
      {/* Full-bleed hero */}
      <section className="hero-atmosphere relative overflow-hidden text-white">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute -left-10 top-20 h-64 w-64 rounded-full bg-violet blur-3xl" />
          <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-blue blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1fr] lg:py-20">
          <div className="animate-rise z-10">
            <p className="mb-4 font-display text-sm font-bold uppercase tracking-[0.25em] text-lavender">
              Influrios
            </p>
            <h1 className="font-display text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-[3.4rem]">
              Find the right influencers.
              <span className="mt-2 block bg-gradient-to-r from-lavender to-white bg-clip-text text-transparent">
                Build powerful collaborations.
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-base text-white/75 sm:text-lg">
              Discover creators by specialty, match complementary collaborators, and connect
              businesses to the right influence.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <div className="flex -space-x-3">
                {SEED_CREATORS.slice(0, 4).map((c) => (
                  <span key={c.slug} className="relative h-9 w-9 overflow-hidden rounded-full ring-2 ring-pro">
                    <Image src={c.image} alt="" fill className="object-cover" sizes="36px" />
                  </span>
                ))}
              </div>
              <p className="text-sm text-white/70">Join creators and businesses worldwide</p>
            </div>

            <form
              action="/discover"
              className="mt-8 flex max-w-xl flex-col gap-3 rounded-full bg-white p-1.5 shadow-2xl sm:flex-row sm:items-center"
            >
              <input
                name="q"
                placeholder="Search by specialty, location, platform, or niche…"
                className="w-full flex-1 rounded-full border-0 bg-transparent px-5 py-3 text-indigo outline-none"
              />
              <button type="submit" className="btn-primary whitespace-nowrap !px-6">
                Search
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Trending</span>
              {SPECIALTY_TAXONOMY.slice(0, 7).map((s) => (
                <Link
                  key={s.slug}
                  href={`/discover?specialty=${s.slug}`}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur hover:bg-white/20"
                >
                  {s.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Hero visual collage — edge composition, not inset card stack as primary */}
          <div className="animate-rise-delay relative mx-auto hidden h-[420px] w-full max-w-md lg:block">
            {heroCreators.map((c, i) => {
              const positions = [
                "left-6 top-4 h-56 w-40 rotate-[-6deg]",
                "right-0 top-10 h-52 w-36 rotate-[8deg]",
                "left-16 bottom-6 h-48 w-36 rotate-[3deg]",
                "right-8 bottom-2 h-44 w-32 rotate-[-4deg]",
              ];
              return (
                <Link
                  key={c.slug}
                  href={`/creators/${c.slug}`}
                  className={`absolute overflow-hidden rounded-2xl shadow-2xl ring-2 ring-white/20 transition hover:z-20 hover:scale-105 ${positions[i]}`}
                >
                  <Image src={c.image} alt={c.displayName} fill className="object-cover" sizes="160px" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2.5">
                    <p className="text-[11px] font-bold text-white">
                      {c.specialties[0] ? c.specialties[0].replace("-", " ") : c.title}
                    </p>
                    <p className="text-[10px] text-white/80">
                      {formatFollowers(totalFollowers(c))} followers
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-indigo sm:text-3xl">
              Explore influencer categories
            </h2>
            <p className="mt-2 text-muted">Browse by what creators actually influence.</p>
          </div>
          <Link href="/discover" className="text-sm font-semibold text-violet hover:underline">
            View all categories →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {SPECIALTY_TAXONOMY.map((s) => (
            <Link
              key={s.slug}
              href={`/discover?specialty=${s.slug}`}
              className="group relative aspect-square overflow-hidden rounded-2xl shadow-md"
            >
              <Image
                src={CATEGORY_IMAGES[s.slug] ?? CATEGORY_IMAGES.lifestyle}
                alt={s.name}
                fill
                className="object-cover transition duration-500 group-hover:scale-110"
                sizes="20vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-indigo/85 via-indigo/20 to-transparent" />
              <span className="absolute bottom-3 left-3 font-display text-base font-bold text-white">
                {s.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="bg-gradient-to-b from-transparent to-lavender/30 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-indigo sm:text-3xl">
                Featured influencers
              </h2>
              <p className="mt-2 text-muted">Verified creators open to meaningful collaborations.</p>
            </div>
            <Link href="/discover" className="text-sm font-semibold text-violet hover:underline">
              View all influencers →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {featured.map((c) => (
              <CreatorCard key={c.slug} creator={c} />
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-white py-10">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 sm:grid-cols-4 sm:px-6">
          {[
            ["50K+", "Influencers Worldwide"],
            ["100+", "Categories & Niches"],
            ["12K+", "Active Collaborations"],
            ["5K+", "Business Matches"],
          ].map(([n, l]) => (
            <div key={l} className="text-center">
              <p className="font-display text-3xl font-bold text-violet">{n}</p>
              <p className="mt-1 text-sm text-muted">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Collaboration matches teaser */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-indigo sm:text-3xl">
              Collaboration matches
            </h2>
            <p className="mt-2 text-muted">Complementary creators who unlock stronger campaigns.</p>
          </div>
          <Link href="/collaboration" className="text-sm font-semibold text-violet hover:underline">
            Explore matches →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {COLLAB_MATCH_PRESETS.map((m) => (
            <Link
              key={m.title}
              href="/collaboration"
              className="group overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="relative h-32">
                <Image src={m.image} alt={m.title} fill className="object-cover" sizes="25vw" />
              </div>
              <div className="p-4">
                <p className="font-semibold text-indigo">{m.title}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.tags.map((t) => (
                    <span key={t} className="chip !text-[10px]">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Influencer Card promo */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid items-center gap-10 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#EEF2FF] via-white to-lavender/60 p-8 lg:grid-cols-2 lg:p-12">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-violet">Your Influencer Card</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-indigo sm:text-4xl">
              One card. All your influence.
            </h2>
            <ul className="mt-5 space-y-3 text-muted">
              <li>✓ All social channels in one place</li>
              <li>✓ Showcase specialties and commercial fit</li>
              <li>✓ Share via link — QR on Plus/Pro</li>
              <li>✓ Make it easy for brands to reach you</li>
            </ul>
            <Link href="/claim" className="btn-primary mt-8 inline-flex">
              Create Your Influencer Card →
            </Link>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <InfluencerCardView creator={SEED_CREATORS[0]} />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative mx-auto max-w-6xl overflow-hidden px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem]">
          <div className="absolute inset-0">
            <Image src="/demo/cta-community.jpg" alt="" fill className="object-cover" sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-r from-pro/95 via-indigo/90 to-violet/80" />
          </div>
          <div className="relative px-8 py-14 text-white sm:px-12">
            <h2 className="max-w-xl font-display text-3xl font-bold sm:text-4xl">
              Join a global community of creators and businesses
            </h2>
            <p className="mt-3 max-w-lg text-white/80">
              Start free with discovery and your Influencer Card. Upgrade when you need matching,
              analytics, and managed introductions.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/claim" className="rounded-full bg-white px-6 py-3 text-sm font-bold text-violet">
                Join as a Creator →
              </Link>
              <Link
                href="/discover"
                className="rounded-full border border-white/50 px-6 py-3 text-sm font-bold text-white"
              >
                Join as a Business →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
