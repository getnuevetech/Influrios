import Image from "next/image";
import Link from "next/link";
import { CreatorCard, InfluencerCardView } from "@/components/creator-card";
import {
  CategoryGlyph,
  IconArrowRight,
  IconBuilding,
  IconCheck,
  IconGrid,
  IconHandshake,
  IconHeart,
  IconInstagram,
  IconPlus,
  IconSearch,
  IconTikTok,
  IconUsers,
  IconYouTube,
  SocialIcon,
} from "@/components/icons";
import {
  CATEGORY_IMAGES,
  COLLAB_MATCH_PRESETS,
  SEED_CREATORS,
  SPECIALTY_TAXONOMY,
  getCreatorBySlug,
} from "@/lib/seed-data";

const TRENDING = ["Beauty", "Travel", "Fitness", "Home & Interior", "Tech", "Food", "Fashion"];

const HERO_FLOATS = [
  {
    creator: SEED_CREATORS[0],
    label: "Beauty",
    followers: "2.4M",
    platform: "INSTAGRAM" as const,
    className: "left-[2%] top-[8%] hidden w-36 rotate-[-8deg] lg:block xl:w-40",
  },
  {
    creator: SEED_CREATORS[2],
    label: "Tech",
    followers: "3.1M",
    platform: "YOUTUBE" as const,
    className: "right-[0%] top-[4%] hidden w-36 rotate-[7deg] md:block xl:w-40",
  },
  {
    creator: SEED_CREATORS[5],
    label: "Travel",
    followers: "1.6M",
    platform: "TIKTOK" as const,
    className: "bottom-[6%] left-[8%] hidden w-32 rotate-[4deg] lg:block",
  },
  {
    creator: SEED_CREATORS[3],
    label: "Lifestyle",
    followers: "980K",
    platform: "INSTAGRAM" as const,
    className: "bottom-[10%] right-[6%] hidden w-32 rotate-[-5deg] md:block",
  },
  {
    creator: SEED_CREATORS[4],
    label: "Fashion",
    followers: "1.2M",
    platform: "TIKTOK" as const,
    className: "right-[18%] top-[42%] hidden w-28 rotate-[10deg] xl:block",
  },
  {
    creator: SEED_CREATORS[1],
    label: "Home & DIY",
    followers: "740K",
    platform: "YOUTUBE" as const,
    className: "left-[16%] top-[48%] hidden w-28 rotate-[-12deg] xl:block",
  },
];

export default function HomePage() {
  // Prefer Plus/Pro so featured cards show live QR like the design template
  const featured = [
    ...SEED_CREATORS.filter((c) => c.planTier === "PLUS" || c.planTier === "PRO"),
    ...SEED_CREATORS.filter((c) => c.planTier === "STARTER"),
  ].slice(0, 5);
  const proofAvatars = SEED_CREATORS.slice(0, 5);

  return (
    <>
      {/* —— Hero —— */}
      <section className="hero-atmosphere relative overflow-hidden text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-violet/40 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue/30 blur-3xl" />
          <div className="absolute left-1/2 top-1/3 h-40 w-[120%] -translate-x-1/2 rotate-[-8deg] bg-gradient-to-r from-transparent via-pink/20 to-transparent blur-2xl" />
          {/* Decorative floating social icons */}
          <IconInstagram className="absolute left-[12%] top-[22%] opacity-25" size={28} />
          <IconTikTok className="absolute right-[22%] top-[18%] opacity-20" size={26} />
          <IconYouTube className="absolute bottom-[28%] left-[28%] opacity-20" size={30} />
        </div>

        {/* Floating creator cards */}
        {HERO_FLOATS.map((item) => (
          <Link
            key={item.label + item.creator.slug}
            href={`/creators/${item.creator.slug}`}
            className={`absolute z-[1] overflow-hidden rounded-2xl shadow-2xl ring-2 ring-white/25 transition hover:z-20 hover:scale-105 ${item.className}`}
          >
            <div className="relative aspect-[3/4] w-full">
              <Image
                src={item.creator.image}
                alt={item.creator.displayName}
                fill
                className="object-cover"
                sizes="160px"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2.5 pt-8">
                <div className="mb-1 flex items-center gap-1 text-white/90">
                  <SocialIcon platform={item.platform} size={12} />
                  <span className="text-[10px] font-semibold uppercase tracking-wide">{item.label}</span>
                </div>
                <p className="text-[11px] font-bold text-white">{item.followers} followers</p>
              </div>
            </div>
          </Link>
        ))}

        <div className="relative z-10 mx-auto max-w-4xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-20 lg:pb-24">
          <p className="mb-4 font-display text-xs font-bold uppercase tracking-[0.28em] text-lavender/90 animate-rise">
            Influrios
          </p>
          <h1 className="animate-rise font-display text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-[3.6rem]">
            Find the Right Influencers.
            <span className="mt-2 block bg-gradient-to-r from-[#C4B5FD] via-[#E879F9] to-[#F0ABFC] bg-clip-text text-transparent">
              Build Powerful Collaborations.
            </span>
          </h1>
          <p className="animate-rise-delay mx-auto mt-5 max-w-2xl text-base text-white/75 sm:text-lg">
            Discover creators by specialty, match with collaborators, and connect businesses to the
            right influence.
          </p>

          <div className="animate-rise-delay mt-7 flex items-center justify-center gap-3">
            <div className="flex -space-x-3">
              {proofAvatars.map((c) => (
                <span
                  key={c.slug}
                  className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-[#0B123F]"
                >
                  <Image src={c.image} alt="" fill className="object-cover" sizes="40px" />
                </span>
              ))}
            </div>
            <p className="text-left text-sm text-white/75">
              Join thousands of creators
              <br className="hidden sm:block" /> and businesses worldwide.
            </p>
          </div>

          <form
            action="/discover"
            className="animate-rise-delay mx-auto mt-8 flex max-w-2xl items-center gap-2 rounded-full bg-white p-1.5 shadow-2xl shadow-violet/30"
          >
            <span className="pl-3 text-muted">
              <IconSearch size={18} />
            </span>
            <input
              name="q"
              placeholder="Search influencers by specialty, location, platform, or niche..."
              className="w-full flex-1 border-0 bg-transparent py-3 text-sm text-indigo outline-none placeholder:text-muted/70 sm:text-base"
            />
            <button type="submit" className="btn-primary shrink-0 !px-6 !py-2.5">
              Search
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-semibold text-white/55">Trending:</span>
            {TRENDING.map((name) => {
              const slug =
                SPECIALTY_TAXONOMY.find((s) => s.name === name)?.slug ??
                name.toLowerCase().replace(/\s+&\s+/g, "-").replace(/\s+/g, "-");
              return (
                <Link
                  key={name}
                  href={`/discover?specialty=${slug}`}
                  className="rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white/90 backdrop-blur transition hover:bg-white/20"
                >
                  {name}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* —— Categories —— */}
      <section id="categories" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-bold text-indigo sm:text-3xl">
            Explore Influencer Categories
          </h2>
          <Link
            href="/discover"
            className="inline-flex items-center gap-1 text-sm font-semibold text-violet hover:underline"
          >
            View all categories <IconArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {SPECIALTY_TAXONOMY.map((s) => (
            <Link
              key={s.slug}
              href={`/discover?specialty=${s.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_rgba(17,26,90,0.08)] ring-1 ring-border transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="relative aspect-square overflow-hidden">
                <Image
                  src={CATEGORY_IMAGES[s.slug] ?? CATEGORY_IMAGES.lifestyle}
                  alt={s.name}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-110"
                  sizes="20vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-indigo/80 via-indigo/25 to-transparent" />
                <span className="absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-violet shadow">
                  <IconHeart size={13} />
                </span>
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/40 backdrop-blur-sm">
                    <CategoryGlyph slug={s.slug} size={22} />
                  </span>
                </span>
              </div>
              <div className="px-2 py-3 text-center">
                <span className="font-display text-sm font-bold text-indigo">{s.name}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* —— Featured —— */}
      <section className="bg-gradient-to-b from-[#F7FAFF] to-lavender/40 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8 flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-bold text-indigo sm:text-3xl">
              Featured Influencers
            </h2>
            <Link
              href="/discover"
              className="inline-flex items-center gap-1 text-sm font-semibold text-violet hover:underline"
            >
              View all influencers <IconArrowRight size={14} />
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {featured.map((c) => (
              <CreatorCard key={c.slug} creator={c} />
            ))}
          </div>
        </div>
      </section>

      {/* —— Sponsored Opportunity ad banner —— */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-r from-[#0B123F] via-[#1a1460] to-[#633CFF] shadow-xl">
          <div className="pointer-events-none absolute -right-10 top-0 h-56 w-56 rounded-full bg-pink/30 blur-3xl" />
          <div className="pointer-events-none absolute -left-8 bottom-0 h-40 w-40 rounded-full bg-blue/40 blur-3xl" />

          <div className="relative grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-[auto_1fr_auto] lg:gap-10 lg:p-10">
            <div className="relative mx-auto hidden h-36 w-36 overflow-hidden rounded-2xl ring-2 ring-white/20 sm:block lg:h-40 lg:w-40">
              <Image
                src="/demo/content/content-collab-1.jpg"
                alt="Creator with camera"
                fill
                className="object-cover"
                sizes="160px"
              />
            </div>

            <div className="text-center text-white lg:text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-lavender/90">
                Sponsored Opportunity
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold leading-tight sm:text-3xl">
                Partner with Innovative Brands That Value{" "}
                <span className="bg-gradient-to-r from-[#E879F9] to-white bg-clip-text text-transparent">
                  Creators.
                </span>
              </h2>
              <p className="mt-2 text-sm text-white/70">
                Exclusive collaboration opportunities with leading global brands.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 lg:justify-start">
                {/* Demo brand wordmarks — white monochrome style as in template */}
                <svg viewBox="0 0 120 24" className="h-5 w-auto text-white" aria-label="Samsung" role="img">
                  <text x="0" y="18" fill="currentColor" fontFamily="Arial,sans-serif" fontSize="16" fontWeight="700" letterSpacing="1">
                    Samsung
                  </text>
                </svg>
                <svg viewBox="0 0 90 24" className="h-5 w-auto text-white" aria-label="L'Oréal" role="img">
                  <text x="0" y="18" fill="currentColor" fontFamily="Georgia,serif" fontSize="15" fontWeight="600" letterSpacing="2">
                    L&apos;ORÉAL
                  </text>
                </svg>
                <svg viewBox="0 0 90 24" className="h-5 w-auto text-white" aria-label="Airbnb" role="img">
                  <text x="0" y="18" fill="currentColor" fontFamily="Arial,sans-serif" fontSize="16" fontWeight="700">
                    airbnb
                  </text>
                </svg>
                <svg viewBox="0 0 60 24" className="h-5 w-auto text-white" aria-label="Nike" role="img">
                  <path fill="currentColor" d="M2 16c8-3 18-8 28-11 2-.5 3 1 1 2C21 12 12 16 2 19v-3z" />
                  <text x="32" y="18" fill="currentColor" fontFamily="Arial,sans-serif" fontSize="14" fontWeight="700">
                    Nike
                  </text>
                </svg>
                <svg viewBox="0 0 80 24" className="h-5 w-auto text-white" aria-label="Adobe" role="img">
                  <text x="0" y="18" fill="currentColor" fontFamily="Arial,sans-serif" fontSize="16" fontWeight="700">
                    Adobe
                  </text>
                </svg>
              </div>
              <Link
                href="/collaboration"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-violet shadow-lg transition hover:scale-[1.02]"
              >
                View Opportunities <IconArrowRight size={14} />
              </Link>
            </div>

            <div className="relative mx-auto hidden h-40 w-32 overflow-hidden rounded-2xl ring-2 ring-white/20 xl:block">
              <Image
                src="/demo/creators/creator-sofia.jpg"
                alt="Featured creator"
                fill
                className="object-cover"
                sizes="128px"
              />
            </div>
          </div>
        </div>
      </section>

      {/* —— Stats —— */}
      <section className="border-y border-border bg-white py-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 grid-cols-2 gap-8 sm:grid-cols-4">
            {[
              { n: "50K+", l: "Influencers Worldwide", Icon: IconUsers, color: "text-violet bg-lavender" },
              { n: "100+", l: "Categories & Niches", Icon: IconGrid, color: "text-blue bg-[#D9E8FF]" },
              {
                n: "12K+",
                l: "Active Collaborations",
                Icon: IconHandshake,
                color: "text-violet bg-lavender",
              },
              { n: "5K+", l: "Business Matches", Icon: IconBuilding, color: "text-blue bg-[#D9E8FF]" },
            ].map(({ n, l, Icon, color }) => (
              <div key={l} className="flex flex-col items-center text-center">
                <span className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${color}`}>
                  <Icon size={22} />
                </span>
                <p className="font-display text-3xl font-bold text-indigo">{n}</p>
                <p className="mt-1 text-sm text-muted">{l}</p>
              </div>
            ))}
          </div>
          <p className="shrink-0 text-center font-display text-sm italic text-violet/80 lg:max-w-[9rem] lg:text-right">
            A growing creator economy together.{" "}
            <IconHeart size={12} className="inline text-pink" />
          </p>
        </div>
      </section>

      {/* —— Collaboration Matches —— */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-indigo sm:text-3xl">
              Collaboration Matches
            </h2>
            <p className="mt-2 text-muted">Complementary creators who unlock stronger campaigns.</p>
          </div>
          <Link
            href="/collaboration"
            className="inline-flex items-center gap-1 text-sm font-semibold text-violet hover:underline"
          >
            View more matches <IconArrowRight size={14} />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {COLLAB_MATCH_PRESETS.map((m) => {
            const left = getCreatorBySlug(m.leftSlug);
            const right = getCreatorBySlug(m.rightSlug);
            return (
              <Link
                key={m.title}
                href="/collaboration"
                className="group rounded-2xl border border-border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center">
                    <span className="relative z-[1] h-12 w-12 overflow-hidden rounded-full ring-2 ring-white shadow">
                      {left ? (
                        <Image src={left.image} alt={left.displayName} fill className="object-cover" sizes="48px" />
                      ) : null}
                    </span>
                    <span className="relative -ml-3 flex h-7 w-7 items-center justify-center rounded-full brand-gradient text-white shadow">
                      <IconPlus size={12} />
                    </span>
                    <span className="relative -ml-3 h-12 w-12 overflow-hidden rounded-full ring-2 ring-white shadow">
                      {right ? (
                        <Image
                          src={right.image}
                          alt={right.displayName}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      ) : null}
                    </span>
                  </div>
                  <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-lavender text-violet transition group-hover:brand-gradient group-hover:text-white">
                    <IconArrowRight size={14} />
                  </span>
                </div>
                <p className="mt-3 font-semibold leading-snug text-indigo">{m.title}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.tags.map((t) => (
                    <span key={t} className="rounded-full bg-lavender/70 px-2 py-0.5 text-[10px] font-semibold text-violet">
                      {t}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* —— Influencer Card promo —— */}
      <section className="bg-gradient-to-br from-[#EEF2FF] via-[#F7FAFF] to-lavender/70 py-16">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <h2 className="font-display text-3xl font-bold text-indigo sm:text-4xl">
              Your Influencer Card,{" "}
              <span className="brand-gradient-text">Everywhere.</span>
            </h2>
            <ul className="mt-6 space-y-3.5">
              {[
                "All your social media in one place",
                "Showcase your specialties and stats",
                "Share via QR code or link",
                "Make it easy for brands to connect",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-muted">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet text-white">
                    <IconCheck size={14} />
                  </span>
                  <span className="font-medium text-indigo/80">{item}</span>
                </li>
              ))}
            </ul>
            <Link href="/claim" className="btn-primary mt-8 inline-flex">
              Create Your Influencer Card <IconArrowRight size={16} />
            </Link>
          </div>

          <div className="relative mx-auto flex w-full max-w-lg items-end justify-center gap-4">
            <div className="relative z-10 w-[min(100%,280px)] scale-[0.92] sm:scale-100">
              <InfluencerCardView creator={SEED_CREATORS[0]} />
            </div>
            {/* Phone mockup */}
            <div className="absolute -right-2 bottom-0 z-20 hidden w-[160px] sm:block md:right-0 md:w-[180px]">
              <div className="rounded-[1.75rem] border-[6px] border-[#1a1a2e] bg-[#1a1a2e] p-1.5 shadow-2xl">
                <div className="overflow-hidden rounded-[1.25rem] bg-white">
                  <div className="relative h-28">
                    <Image
                      src={SEED_CREATORS[0].image}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="180px"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
                  </div>
                  <div className="-mt-6 space-y-2 px-3 pb-4 text-center">
                    <p className="font-display text-sm font-bold text-indigo">
                      {SEED_CREATORS[0].displayName}
                    </p>
                    <p className="text-[10px] text-muted">{SEED_CREATORS[0].title}</p>
                    <div className="space-y-1.5 pt-1">
                      {SEED_CREATORS[0].socials.slice(0, 2).map((s) => (
                        <div
                          key={s.platform}
                          className="flex items-center justify-center gap-1.5 rounded-full bg-lavender/60 py-1.5 text-[10px] font-semibold text-violet"
                        >
                          <SocialIcon platform={s.platform} size={11} />
                          Follow on {s.platform === "INSTAGRAM" ? "Instagram" : "TikTok"}
                        </div>
                      ))}
                      <div className="rounded-full brand-gradient py-1.5 text-[10px] font-bold text-white">
                        Portfolio
                      </div>
                    </div>
                    <div className="mx-auto mt-2 h-12 w-12 overflow-hidden rounded border border-border bg-white p-0.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/qr/${SEED_CREATORS[0].slug}`}
                        alt="QR"
                        width={48}
                        height={48}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <p className="text-[8px] text-muted">Scan to view my full profile</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* —— Bottom CTA —— */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/demo/cta-community.jpg" alt="" fill className="object-cover" sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B123F]/95 via-[#111A5A]/90 to-[#633CFF]/85" />
        </div>
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 py-16 sm:px-6 lg:flex-row lg:justify-between">
          <div className="hidden shrink-0 lg:block">
            <div className="flex -space-x-4">
              {SEED_CREATORS.slice(0, 3).map((c, i) => (
                <span
                  key={c.slug}
                  className={`relative h-24 w-24 overflow-hidden rounded-2xl ring-4 ring-white/20 ${
                    i === 1 ? "mt-6" : i === 2 ? "-mt-2" : ""
                  }`}
                >
                  <Image src={c.image} alt="" fill className="object-cover" sizes="96px" />
                </span>
              ))}
            </div>
          </div>
          <div className="max-w-xl text-center text-white lg:text-left">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              Join a Global Community of Creators and Businesses
            </h2>
            <p className="mt-3 text-white/75">
              Whether you&apos;re an influencer looking for opportunities or a business ready to
              collaborate, Influrios is your hub.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link
                href="/claim"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-violet"
              >
                Join as a Creator <IconArrowRight size={14} />
              </Link>
              <Link
                href="/business"
                className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur"
              >
                Join as a Business <IconArrowRight size={14} />
              </Link>
            </div>
          </div>
          <div className="hidden shrink-0 lg:block">
            <div className="flex -space-x-4">
              {SEED_CREATORS.slice(3, 6).map((c, i) => (
                <span
                  key={c.slug}
                  className={`relative h-24 w-24 overflow-hidden rounded-2xl ring-4 ring-white/20 ${
                    i === 1 ? "mt-6" : i === 0 ? "-mt-2" : ""
                  }`}
                >
                  <Image src={c.image} alt="" fill className="object-cover" sizes="96px" />
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
