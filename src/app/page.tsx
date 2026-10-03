import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CompactInfluencerCard, CreatorCard } from "@/components/creator-card";
import { FeaturedCarousel } from "@/components/featured-carousel";
import { HomepageValuePropositionStrip } from "@/components/homepage-value-proposition-strip";
import {
  IconArrowRight,
  IconCheck,
  IconInstagram,
  IconPlus,
  IconSearch,
  IconTikTok,
  IconYouTube,
  SocialIcon,
} from "@/components/icons";
import { getCms } from "@/lib/cms";
import { getDirectory } from "@/lib/directory";
import { categoryImageFor, type SeedCreator } from "@/lib/seed-data";

export const dynamic = "force-dynamic";

const TRENDING = ["Beauty", "Travel", "Fitness", "Home & Interior", "Tech", "Food", "Fashion"];

const HERO_FLOATS = [
  {
    slug: "sofia-martinez",
    label: "Beauty",
    followers: "2.4M",
    platform: "INSTAGRAM" as const,
    className: "left-[2%] top-[6%] hidden w-36 rotate-[-8deg] lg:block xl:w-40",
  },
  {
    slug: "priya-sharma",
    label: "Tech",
    followers: "3.1M",
    platform: "YOUTUBE" as const,
    className: "right-[0%] top-[2%] hidden w-36 rotate-[7deg] md:block xl:w-40",
  },
  {
    slug: "jordan-blake",
    label: "Travel",
    followers: "1.6M",
    platform: "TIKTOK" as const,
    className: "bottom-[4%] left-[8%] hidden w-32 rotate-[4deg] lg:block",
  },
  {
    slug: "marcus-lee",
    label: "Lifestyle",
    followers: "980K",
    platform: "INSTAGRAM" as const,
    className: "bottom-[8%] right-[6%] hidden w-32 rotate-[-5deg] md:block",
  },
  {
    slug: "amara-okonkwo",
    label: "Fashion",
    followers: "1.2M",
    platform: "TIKTOK" as const,
    className: "right-[18%] top-[38%] hidden w-28 rotate-[10deg] xl:block",
  },
  {
    slug: "daniel-kim",
    label: "Home & DIY",
    followers: "740K",
    platform: "YOUTUBE" as const,
    className: "left-[16%] top-[42%] hidden w-28 rotate-[-12deg] xl:block",
  },
];

/** Full-bleed content shell */
function Shell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-10 ${className}`}>{children}</div>;
}

export default async function HomePage() {
  const [cms, directory] = await Promise.all([getCms(), getDirectory()]);
  const taxonomy = directory.taxonomy
    .filter((node) => node.active)
    .map((node) => ({ ...node, children: node.children.filter((child) => child.active) }));
  const bySlug = new Map(directory.creators.map((creator) => [creator.slug, creator]));
  const creatorBySlug = (slug: string) => bySlug.get(slug);
  const heroFloats = HERO_FLOATS.flatMap((item) => {
    const creator = creatorBySlug(item.slug);
    return creator ? [{ ...item, creator }] : [];
  });
  const sections = [...directory.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const sectionOn = (key: string) => {
    const section = sections.find((item) => item.key === key);
    if (!section) return true;
    return section.enabled && section.status === "published";
  };
  const sectionRank = (key: string) => sections.find((item) => item.key === key)?.sortOrder ?? 50;
  const hero = cms.banners.hero;
  const sponsored = cms.banners.sponsored;
  const cardPromo = cms.banners.cardPromo;
  const cta = cms.banners.cta;
  const valueProposition = cms.valueProposition;

  const baseCardWidth = 220;
  const widthPx = Math.round(baseCardWidth * cms.featuredCards.widthScale);

  const featuredItems = [...cms.featuredCards.cards]
    .filter((c) => c.visible)
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const creator = creatorBySlug(c.slug);
      return creator ? { creator, features: c.features } : null;
    })
    .filter(Boolean) as { creator: SeedCreator; features: (typeof cms.featuredCards.cards)[0]["features"] }[];

  // Prefer Plus/Pro first if CMS hasn't ordered yet
  const featured =
    featuredItems.length > 0
      ? featuredItems
      : directory.creators.filter((c) => c.planTier !== "STARTER")
          .slice(0, 5)
          .map((creator) => ({
            creator,
            features: {
              showBadge: true,
              showHeart: true,
              showVerified: true,
              showLocation: true,
              showSpecialties: true,
              showSocials: true,
              showFollowerCounts: true,
              showQr: true,
              showStatus: true,
              visiblePlatforms: [] as string[],
            },
          }));

  const proofAvatars = directory.creators.slice(0, 5);
  const featuredCreator = creatorBySlug("sofia-martinez") ?? directory.creators[0];
  const heroPadY = `${Math.round(4 * hero.heightScale)}rem`;
  const ctaPadY = `${Math.round(4 * cta.heightScale)}rem`;

  return (
    <div className="flex flex-col">
      <div style={{ order: sectionRank("hero") }} className={sectionOn("hero") ? undefined : "hidden"}>
      {hero.enabled ? (
        <section className="hero-atmosphere relative w-full overflow-hidden text-white">
          {hero.images[0] ? (
            <div className="absolute inset-0">
              <Image src={hero.images[0]} alt="" fill className="object-cover opacity-35" sizes="100vw" />
              <div className="absolute inset-0 bg-gradient-to-b from-[#0B123F]/80 via-[#111A5A]/85 to-[#1a1460]/95" />
            </div>
          ) : null}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-violet/40 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue/30 blur-3xl" />
            <IconInstagram className="absolute left-[12%] top-[22%] opacity-25" size={28} />
            <IconTikTok className="absolute right-[22%] top-[18%] opacity-20" size={26} />
            <IconYouTube className="absolute bottom-[28%] left-[28%] opacity-20" size={30} />
          </div>

          {heroFloats.map((item) => (
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
                    <SocialIcon platform={item.platform} size={14} />
                    <span className="text-[10px] font-semibold uppercase tracking-wide">{item.label}</span>
                  </div>
                  <p className="text-[11px] font-bold text-white">{item.followers} followers</p>
                </div>
              </div>
            </Link>
          ))}

          <div
            className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6"
            style={{ paddingTop: heroPadY, paddingBottom: heroPadY }}
          >
            <p className="mb-3 font-display text-xs font-bold uppercase tracking-[0.28em] text-lavender/90">
              Influrios
            </p>
            <h1 className="font-display text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-[3.4rem]">
              {hero.title.split(". ").length > 1 ? (
                <>
                  {hero.title.split(". ")[0]}.
                  <span className="mt-2 block bg-gradient-to-r from-[#C4B5FD] via-[#E879F9] to-[#F0ABFC] bg-clip-text text-transparent">
                    {hero.title.split(". ").slice(1).join(". ")}
                  </span>
                </>
              ) : (
                hero.title
              )}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-white/75 sm:text-lg">{hero.subtitle}</p>

            <div className="mt-5 flex items-center justify-center gap-3">
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
                Join thousands of influencers and businesses worldwide.
              </p>
            </div>

            <form
              action={hero.ctaHref}
              className="mx-auto mt-6 flex max-w-2xl items-center gap-2 rounded-full bg-white p-1.5 shadow-2xl shadow-violet/30"
            >
              <span className="pl-3 text-muted">
                <IconSearch size={18} />
              </span>
              <input
                name="q"
                placeholder="Search influencers by specialty, location, platform, or niche..."
                className="w-full flex-1 border-0 bg-transparent py-2.5 text-sm text-indigo outline-none placeholder:text-muted/70 sm:text-base"
              />
              <button type="submit" className="btn-primary shrink-0 !px-6 !py-2.5">
                {hero.ctaLabel}
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-semibold text-white/55">Trending:</span>
              {TRENDING.map((name) => {
                const slug =
                  taxonomy.find((s) => s.name === name)?.slug ??
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
      ) : null}
      </div>

      <div style={{ order: sectionRank("categories") }} className={sectionOn("categories") ? undefined : "hidden"}>
      {/* —— Categories (single-row manual horizontal scroll) —— */}
      <section id="categories" className="w-full py-12">
        <Shell>
          <div className="mb-8 flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-bold text-indigo sm:text-3xl">
              {cms.categories.title}
            </h2>
            <Link
              href={cms.categories.ctaHref || "/categories"}
              className="inline-flex items-center gap-1 text-sm font-semibold text-violet hover:underline"
            >
              {cms.categories.ctaLabel || "View all categories"} <IconArrowRight size={14} />
            </Link>
          </div>
          <FeaturedCarousel stepPx={168}>
            {(
              cms.categories.items.length > 0
                ? cms.categories.items.flatMap((item) => {
                    const node = taxonomy.find((s) => s.slug === item.slug);
                    if (!node) return [];
                    return [
                      {
                        slug: node.slug,
                        name: node.name,
                        image: item.image || categoryImageFor(node.slug, taxonomy),
                      },
                    ];
                  })
                : taxonomy.map((s) => ({
                    slug: s.slug,
                    name: s.name,
                    image: categoryImageFor(s.slug, taxonomy),
                  }))
            ).map((s) => (
              <Link
                key={s.slug}
                href={`/discover?specialty=${s.slug}`}
                className="group flex w-[148px] shrink-0 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_rgba(17,26,90,0.08)] ring-1 ring-border transition hover:-translate-y-0.5 hover:shadow-lg sm:w-[160px]"
              >
                <div className="relative aspect-square overflow-hidden">
                  <Image
                    src={s.image}
                    alt={s.name}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-110"
                    sizes="160px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-indigo/70 via-transparent to-transparent" />
                  <span className="absolute bottom-2 left-2 right-2 text-center font-display text-sm font-bold text-white drop-shadow">
                    {s.name}
                  </span>
                </div>
              </Link>
            ))}
          </FeaturedCarousel>
        </Shell>
      </section>
      </div>

      <div style={{ order: sectionRank("featured") }} className={sectionOn("featured") ? undefined : "hidden"}>
      {/* —— Featured (manual horizontal scroll) —— */}
      <section className="w-full bg-gradient-to-b from-[#F7FAFF] to-lavender/40 py-12">
        <Shell>
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
          <FeaturedCarousel stepPx={widthPx + 20}>
            {featured.map(({ creator, features }) => (
              <CreatorCard
                key={creator.slug}
                creator={creator}
                widthPx={widthPx}
                socialIconSize={cms.featuredCards.socialIconSize}
                qrSize={cms.featuredCards.qrSize}
                features={features}
              />
            ))}
          </FeaturedCarousel>
        </Shell>
      </section>
      </div>

      <div style={{ order: sectionRank("sponsored") }} className={sectionOn("sponsored") ? undefined : "hidden"}>
      {/* —— Sponsored —— */}
      {sponsored.enabled ? (
        <section className="w-full py-8">
          <Shell>
            <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-r from-[#0B123F] via-[#1a1460] to-[#633CFF] shadow-xl">
              <div className="pointer-events-none absolute -right-10 top-0 h-56 w-56 rounded-full bg-pink/30 blur-3xl" />
              <div className="relative grid items-center gap-6 p-5 sm:p-7 lg:grid-cols-[auto_1fr_auto] lg:gap-10">
                {sponsored.images[0] ? (
                  <div className="relative mx-auto hidden h-32 w-32 overflow-hidden rounded-2xl ring-2 ring-white/20 sm:block lg:h-36 lg:w-36">
                    <Image src={sponsored.images[0]} alt="" fill className="object-cover" sizes="144px" />
                  </div>
                ) : null}
                <div className="text-center text-white lg:text-left">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-lavender/90">
                    Sponsored Opportunity
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-bold leading-tight sm:text-3xl">
                    {sponsored.title}
                  </h2>
                  <p className="mt-2 text-sm text-white/70">{sponsored.subtitle}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
                    {["Samsung", "L'ORÉAL", "airbnb", "Nike", "Adobe"].map((brand) => (
                      <span key={brand} className="font-display text-sm font-bold text-white/90">
                        {brand}
                      </span>
                    ))}
                  </div>
                  <Link
                    href={sponsored.ctaHref || "/collaboration"}
                    className="ink-on-light mt-5 inline-flex min-h-[42px] min-w-[160px] items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold shadow-lg"
                  >
                    {sponsored.ctaLabel?.trim() || "View Opportunities"}{" "}
                    <IconArrowRight size={14} />
                  </Link>
                </div>
                {sponsored.images[1] ? (
                  <div className="relative mx-auto hidden h-36 w-28 overflow-hidden rounded-2xl ring-2 ring-white/20 xl:block">
                    <Image src={sponsored.images[1]} alt="" fill className="object-cover" sizes="112px" />
                  </div>
                ) : null}
              </div>
            </div>
          </Shell>
        </section>
      ) : null}
      </div>

      <div style={{ order: sectionRank("value_proposition") }} className={sectionOn("value_proposition") ? undefined : "hidden"}>
      <HomepageValuePropositionStrip strip={valueProposition} />
      </div>

      <div style={{ order: sectionRank("collaboration") }} className={sectionOn("collaboration") ? undefined : "hidden"}>
      {/* —— Collaboration Matches (manual horizontal scroll) —— */}
      <section className="w-full py-12">
        <Shell>
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-indigo sm:text-3xl">
                {cms.collaborationMatches.title}
              </h2>
              <p className="mt-2 text-muted">
                {cms.collaborationMatches.subtitle}
              </p>
            </div>
            <Link
              href={cms.collaborationMatches.ctaHref || "/collaboration"}
              className="inline-flex items-center gap-1 text-sm font-semibold text-violet hover:underline"
            >
              {cms.collaborationMatches.ctaLabel || "View more matches"} <IconArrowRight size={14} />
            </Link>
          </div>
          <FeaturedCarousel stepPx={300}>
            {cms.collaborationMatches.matches.map((m) => {
              const left = creatorBySlug(m.leftSlug);
              const right = creatorBySlug(m.rightSlug);
              return (
                <Link
                  key={m.title}
                  href="/collaboration"
                  className="group w-[280px] shrink-0 rounded-2xl border border-border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
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
                    <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-lavender text-violet">
                      <IconArrowRight size={14} />
                    </span>
                  </div>
                  <p className="mt-3 font-semibold leading-snug text-indigo">{m.title}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-lavender/70 px-2 py-0.5 text-[10px] font-semibold text-violet"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </Link>
              );
            })}
          </FeaturedCarousel>
        </Shell>
      </section>
      </div>

      <div style={{ order: sectionRank("card_promo") }} className={sectionOn("card_promo") ? undefined : "hidden"}>
      {/* —— Influencer Card promo (template horizontal card) —— */}
      {cardPromo.enabled ? (
        <section className="w-full bg-gradient-to-br from-[#EEF2FF] via-[#F7FAFF] to-lavender/70 py-10">
          <Shell className="grid items-center gap-8 lg:grid-cols-[0.95fr_1.15fr_0.85fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Influencer Card</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-indigo sm:text-[2.15rem]">
                Your Influencer{" "}
                <span className="brand-gradient-text">Card</span>, Everywhere
              </h2>
              <p className="mt-3 max-w-md text-sm text-muted sm:text-base">
                {cardPromo.subtitle ||
                  "A powerful digital profile that contains all your influencer information, social links, and collaboration details."}
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  "All your social media in one place",
                  "Showcase your specialties and stats",
                  "Share via QR code or link",
                  "Make it easy for brands to connect",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue text-white">
                      <IconCheck size={14} />
                    </span>
                    <span className="text-sm font-medium text-indigo/80">{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={cardPromo.ctaHref || "/claim"}
                className="btn-primary mt-7 inline-flex min-h-[42px] min-w-[180px] items-center justify-center"
              >
                {cardPromo.ctaLabel?.trim() || "Create Your Influencer Card"}{" "}
                <IconArrowRight size={16} />
              </Link>
            </div>

            <div className="flex justify-center">
              {featuredCreator ? <CompactInfluencerCard creator={featuredCreator} /> : null}
            </div>

            <div className="relative mx-auto hidden max-w-[200px] lg:block">
              <div className="rounded-[1.6rem] border-[5px] border-[#1a1a2e] bg-[#1a1a2e] p-1 shadow-2xl">
                <div className="overflow-hidden rounded-[1.15rem] bg-white">
                  <div className="relative h-28">
                    <Image
                      src={featuredCreator?.image ?? "/demo/creators/creator-sofia.jpg"}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="200px"
                    />
                  </div>
                  <div className="space-y-1.5 px-3 py-3 text-center">
                    <p className="font-display text-sm font-bold text-indigo">
                      {featuredCreator?.displayName ?? "Influencer"}
                    </p>
                    {(featuredCreator?.socials ?? []).slice(0, 2).map((s) => (
                      <div
                        key={s.platform}
                        className="flex items-center justify-center gap-1.5 rounded-full bg-lavender/70 py-1.5 text-[10px] font-semibold text-violet"
                      >
                        <SocialIcon platform={s.platform} size={12} />
                        Follow on {s.platform === "INSTAGRAM" ? "Instagram" : "TikTok"}
                      </div>
                    ))}
                    <div className="rounded-full brand-gradient py-1.5 text-[10px] font-bold text-white">
                      Work With Me
                    </div>
                  </div>
                </div>
              </div>
              <p
                className="mt-4 text-center font-display text-sm font-bold italic leading-snug text-violet"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                One Card
                <br />
                Endless Opportunities
                <span className="mt-1 block text-pink">♡</span>
              </p>
            </div>
          </Shell>
        </section>
      ) : null}
      </div>

      <div style={{ order: sectionRank("cta") }} className={sectionOn("cta") ? undefined : "hidden"}>
      {/* —— Bottom CTA (−20% height via CMS) —— */}
      {cta.enabled ? (
        <section className="relative w-full overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src={cta.images[0] ?? "/demo/cta-community.jpg"}
              alt=""
              fill
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B123F]/95 via-[#111A5A]/90 to-[#633CFF]/85" />
          </div>
          <div
            className="relative mx-auto flex w-full max-w-[90rem] flex-col items-center gap-6 px-4 sm:px-6 lg:flex-row lg:justify-between lg:px-10"
            style={{ paddingTop: ctaPadY, paddingBottom: ctaPadY }}
          >
            <div className="hidden shrink-0 lg:block">
              <div className="flex -space-x-4">
                {directory.creators.slice(0, 3).map((c, i) => (
                  <span
                    key={c.slug}
                    className={`relative h-20 w-20 overflow-hidden rounded-2xl ring-4 ring-white/20 ${
                      i === 1 ? "mt-4" : ""
                    }`}
                  >
                    <Image src={c.image} alt="" fill className="object-cover" sizes="80px" />
                  </span>
                ))}
              </div>
            </div>
            <div className="max-w-xl text-center text-white lg:text-left">
              <h2 className="font-display text-3xl font-bold sm:text-[2rem]">{cta.title}</h2>
              <p className="mt-2 text-sm text-white/75 sm:text-base">{cta.subtitle}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
                <Link
                  href={cta.ctaHref || "/claim"}
                  className="ink-on-light inline-flex min-h-[42px] min-w-[160px] items-center justify-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold"
                >
                  {cta.ctaLabel?.trim() || "Join as an Influencer"} <IconArrowRight size={14} />
                </Link>
                <Link
                  href="/business"
                  className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-white/50 bg-white/10 px-6 py-2.5 text-sm font-bold text-white backdrop-blur"
                >
                  Join as a Business <IconArrowRight size={14} />
                </Link>
              </div>
            </div>
            <div className="hidden shrink-0 lg:block">
              <div className="flex -space-x-4">
                {directory.creators.slice(3, 6).map((c, i) => (
                  <span
                    key={c.slug}
                    className={`relative h-20 w-20 overflow-hidden rounded-2xl ring-4 ring-white/20 ${
                      i === 1 ? "mt-4" : ""
                    }`}
                  >
                    <Image src={c.image} alt="" fill className="object-cover" sizes="80px" />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}
      </div>
    </div>
  );
}
