import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { actionSendInquiry } from "@/app/business/actions";
import { InfluencerCardView } from "@/components/creator-card";
import {
  IconCake,
  IconGlobe,
  IconLang,
  IconMail,
  IconMapPin,
  IconPlay,
  IconShare,
  IconUserPlus,
  IconVerified,
  SocialIcon,
} from "@/components/icons";
import { getPublishedCreatorBySlug } from "@/lib/claim";
import {
  formatFollowers,
  getCreatorBySlug,
  SEED_CREATORS,
  specialtyLabel,
} from "@/lib/seed-data";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const creator = getCreatorBySlug(slug) ?? (await getPublishedCreatorBySlug(slug));
  if (!creator) return { title: "Creator not found" };
  return { title: creator.displayName, description: creator.bio };
}

function socialLabel(platform: string) {
  if (platform === "WEBSITE") return "Website";
  if (platform === "X") return "X";
  return platform.charAt(0) + platform.slice(1).toLowerCase();
}

export default async function CreatorProfilePage({ params }: Props) {
  const { slug } = await params;
  const creator = getCreatorBySlug(slug) ?? (await getPublishedCreatorBySlug(slug));
  if (!creator) notFound();

  const related = SEED_CREATORS.filter((c) => c.slug !== creator.slug).slice(0, 4);
  const content = creator.featuredContent ?? [];
  const stats = creator.stats;
  const demo = creator.demographics;
  const firstName = creator.displayName.split(" ")[0];
  const tagline = creator.bannerTagline ?? creator.title;
  const scriptTags =
    creator.bannerScriptTags ??
    creator.specialties
      .slice(0, 4)
      .map((s) => specialtyLabel(s))
      .join(" / ");

  return (
    <div className="bg-[#F7FAFF]">
      {/* —— Hero banner (full-bleed template) —— */}
      <section className="relative overflow-hidden">
        <div className="relative h-[220px] sm:h-[280px] lg:h-[320px]">
          <Image
            src={creator.coverImage ?? creator.image}
            alt=""
            fill
            className="object-cover object-[center_30%]"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#2a1458]/55 via-[#4a2a8a]/25 to-transparent" />

          {/* Vertical script tags (left) */}
          <p className="font-script pointer-events-none absolute left-[-4.5rem] top-1/2 hidden w-[280px] -translate-y-1/2 -rotate-90 text-center text-[14px] font-semibold tracking-wide text-white/85 xl:left-[-3.5rem] xl:block xl:text-[15px]">
            {scriptTags}
          </p>

          {/* Center script name + tagline */}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center sm:items-start sm:pl-[16%] lg:pl-[20%]">
            <h1 className="font-script text-[2.5rem] font-semibold leading-none text-[#EED9FF] drop-shadow-[0_2px_12px_rgba(60,20,100,0.45)] sm:text-[3.1rem] lg:text-[3.55rem]">
              {creator.displayName}
              <span className="ml-1.5 align-middle text-[1.25rem] text-[#FF8EC8]" aria-hidden>
                ♡
              </span>
            </h1>
            <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/95 sm:text-[11px]">
              {tagline}
            </p>
          </div>

          {/* Polaroids */}
          {creator.polaroids ? (
            <div className="absolute bottom-4 right-3 hidden items-end gap-2 md:flex lg:right-8 lg:gap-3">
              {creator.polaroids.map((p, i) => (
                <div
                  key={p.caption}
                  className={`w-[72px] overflow-hidden rounded-[4px] bg-white p-1 shadow-xl lg:w-[88px] ${
                    i === 0 ? "-rotate-6" : i === 1 ? "rotate-2 translate-y-1" : "rotate-6"
                  }`}
                >
                  <div className="relative aspect-[3/4]">
                    <Image src={p.image} alt={p.caption} fill className="object-cover" sizes="88px" />
                  </div>
                  <p className="font-script mt-0.5 truncate px-0.5 text-center text-[9px] font-semibold text-indigo lg:text-[10px]">
                    {p.caption}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* —— Identity strip —— */}
        <div className="relative mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10">
          <div className="relative -mt-12 flex flex-col gap-4 pb-5 sm:-mt-14 lg:flex-row lg:items-end lg:gap-6">
            {/* Avatar */}
            <div className="relative mx-auto h-[108px] w-[108px] shrink-0 sm:mx-0 sm:h-[124px] sm:w-[124px]">
              <div className="relative h-full w-full overflow-hidden rounded-full ring-[5px] ring-white shadow-lg">
                <Image
                  src={creator.image}
                  alt={creator.displayName}
                  fill
                  className="object-cover"
                  sizes="124px"
                  priority
                />
              </div>
              {creator.verified ? (
                <span className="absolute bottom-1 right-1 rounded-full bg-white p-0.5 shadow">
                  <IconVerified size={22} />
                </span>
              ) : null}
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                <h2 className="font-display text-[1.55rem] font-bold leading-tight text-indigo sm:text-[1.75rem]">
                  {creator.displayName}
                </h2>
                {creator.verified ? <IconVerified size={18} /> : null}
              </div>
              <p className="mt-0.5 text-[13px] font-medium text-muted">{creator.title}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-muted">
                <IconMapPin size={13} className="text-[#E11D48]" />
                {creator.locationCity}, {creator.locationCountry}
              </p>
              <p className="mx-auto mt-2 max-w-xl text-[13px] leading-snug text-muted sm:mx-0">
                {creator.bio}
              </p>
              <div className="mt-2.5 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {creator.specialties.map((s) => (
                  <span key={s} className="profile-tag">
                    {specialtyLabel(s)}
                  </span>
                ))}
              </div>
            </div>

            {/* Social stats + CTAs */}
            <div className="flex w-full flex-col items-center gap-3 lg:w-auto lg:items-end">
              <div className="flex flex-wrap justify-center gap-2 lg:justify-end">
                {creator.socials.map((s) => (
                  <a
                    key={s.platform}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1.5 shadow-sm"
                  >
                    <SocialIcon platform={s.platform} size={14} className="text-indigo" />
                    <span className="text-[11px] font-bold text-indigo">
                      {formatFollowers(s.followers)}
                    </span>
                    <span className="sr-only">{socialLabel(s.platform)}</span>
                  </a>
                ))}
              </div>
              <div className="flex flex-wrap justify-center gap-2 lg:justify-end">
                <a href="#contact" className="btn-primary !gap-1.5 !px-4 !py-2 text-[13px]">
                  <IconMail size={15} />
                  Contact
                </a>
                <Link
                  href={`/collaboration?from=${creator.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-violet/40 bg-white px-4 py-2 text-[13px] font-semibold text-violet"
                >
                  <IconUserPlus size={15} />
                  Invite to Collaborate
                </Link>
                <Link
                  href={`/c/${creator.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-violet/40 bg-white px-4 py-2 text-[13px] font-semibold text-violet"
                >
                  <IconShare size={15} />
                  Share Card
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* —— Main two-column body —— */}
      <div className="mx-auto grid max-w-[90rem] gap-6 px-4 pb-8 pt-2 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8 lg:px-10">
        {/* Left: Influencer Card + Key Stats */}
        <aside className="space-y-5">
          <div className="overflow-hidden rounded-[1.35rem] bg-gradient-to-b from-[#EAE4FF] via-[#F3EEFF] to-white p-3 shadow-md ring-1 ring-[#D9D0FF]">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-violet">
                Influencer Card
              </p>
              <Link
                href={`/c/${creator.slug}`}
                className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-violet shadow-sm ring-1 ring-border"
              >
                Preview
              </Link>
            </div>
            <InfluencerCardView creator={creator} />
            <p className="mt-2 text-center text-[11px] font-semibold text-violet/80">
              One Card. Endless Opportunities.
            </p>
          </div>

          {stats ? (
            <div className="card-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-[15px] font-bold text-indigo">Key Stats</h3>
                <span className="rounded-full bg-[#F0F4FF] px-2.5 py-1 text-[10px] font-semibold text-muted">
                  Last 30 Days ▾
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {[
                  ["Engagement Rate", stats.engagementRate, stats.engagementDelta],
                  ["Total Reach", stats.totalReach, stats.reachDelta],
                  ["Average Views", stats.avgViews, stats.viewsDelta],
                  ["Collaborations", stats.collaborations, stats.collabDelta],
                ].map(([label, value, delta]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-border bg-[#FBFBFF] px-2.5 py-2.5"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {label}
                    </p>
                    <p className="mt-0.5 font-display text-[1.15rem] font-bold leading-none text-indigo">
                      {value}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold text-emerald-600">{delta}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        {/* Right column */}
        <div className="space-y-6">
          {/* About + personal details */}
          <section id="contact" className="card-surface p-5 sm:p-6">
            <h3 className="font-display text-[1.15rem] font-bold text-indigo">
              About {firstName}
            </h3>
            <div className="mt-3 grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
              <div>
                <p className="text-[13px] leading-relaxed text-muted">{creator.bio}</p>
                {(creator.offer || creator.need) && (
                  <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                    {creator.offer ? (
                      <div className="rounded-xl bg-[#F0F4FF] px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                          I can offer
                        </p>
                        <p className="mt-0.5 text-[12px] font-semibold text-indigo">{creator.offer}</p>
                      </div>
                    ) : null}
                    {creator.need ? (
                      <div className="rounded-xl bg-lavender/60 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                          Looking for
                        </p>
                        <p className="mt-0.5 text-[12px] font-semibold text-indigo">{creator.need}</p>
                      </div>
                    ) : null}
                  </div>
                )}
                <button
                  type="button"
                  className="mt-3 text-[12px] font-semibold text-blue hover:underline"
                >
                  Read More →
                </button>
              </div>

              <ul className="space-y-2.5 text-[12px] text-muted">
                {creator.age ? (
                  <li className="flex items-center gap-2">
                    <IconCake size={15} className="text-violet" />
                    <span className="font-semibold text-indigo">{creator.age} years old</span>
                  </li>
                ) : null}
                <li className="flex items-center gap-2">
                  <IconMapPin size={15} className="text-[#E11D48]" />
                  <span className="font-semibold text-indigo">
                    {creator.locationCity}, {creator.locationCountry}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <IconLang size={15} className="text-blue" />
                  <span className="font-semibold text-indigo">{creator.languages.join(", ")}</span>
                </li>
                {creator.email ? (
                  <li className="flex items-center gap-2">
                    <IconMail size={15} className="text-violet" />
                    <a href={`mailto:${creator.email}`} className="font-semibold text-indigo hover:underline">
                      {creator.email}
                    </a>
                  </li>
                ) : null}
                {creator.linktree ? (
                  <li className="flex items-center gap-2">
                    <IconGlobe size={15} className="text-blue" />
                    <a
                      href={`https://${creator.linktree}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-indigo hover:underline"
                    >
                      {creator.linktree}
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>

            <form action={actionSendInquiry} className="mt-5 space-y-2.5 border-t border-border pt-4">
              <p className="text-[12px] font-semibold text-indigo">Send a business inquiry</p>
              <input type="hidden" name="creatorSlug" value={creator.slug} />
              <textarea
                name="message"
                required
                rows={2}
                defaultValue={`Hi ${firstName} — we'd love to explore a collaboration.`}
                className="w-full rounded-xl border border-border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-violet"
              />
              <button type="submit" className="btn-primary !py-2 text-[13px]">
                Send inquiry →
              </button>
            </form>
          </section>

          {/* Featured content */}
          {content.length > 0 ? (
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-[1.15rem] font-bold text-indigo">
                  Featured Content
                </h3>
                <span className="text-[12px] font-semibold text-violet hover:underline">
                  View All Content →
                </span>
              </div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {["All", "Beauty", "Lifestyle", "Travel", "Fashion", "Brand Collaborations"].map(
                  (t) => (
                    <span
                      key={t}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        t === "All"
                          ? "bg-violet text-white"
                          : "bg-white text-muted ring-1 ring-border"
                      }`}
                    >
                      {t}
                    </span>
                  ),
                )}
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {content.map((item) => (
                  <article
                    key={item.id}
                    className="group relative aspect-[4/5] overflow-hidden rounded-2xl"
                  >
                    <Image
                      src={item.image}
                      alt={item.category}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-105"
                      sizes="33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-90">
                      <IconPlay size={36} />
                    </span>
                    <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-1 text-white">
                      <div className="flex items-center gap-1">
                        <span className="rounded bg-black/40 p-0.5">
                          <SocialIcon
                            platform={item.platform.toUpperCase()}
                            size={12}
                            className="text-white"
                          />
                        </span>
                        <p className="text-[10px] font-semibold">{item.views}</p>
                      </div>
                      <p className="text-[10px] font-semibold">♥ {item.likes}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {/* Demographics + collab prefs */}
          {demo ? (
            <section className="grid gap-5 lg:grid-cols-2">
              <div className="card-surface p-5">
                <h3 className="font-display text-[1.05rem] font-bold text-indigo">
                  Audience Demographics
                </h3>
                <div className="mt-4 flex flex-wrap items-center gap-5">
                  <div className="relative h-[100px] w-[100px] shrink-0">
                    <div
                      className="h-full w-full rounded-full"
                      style={{
                        background: `conic-gradient(#633CFF 0 ${demo.female}%, #9EC5FF ${demo.female}% 100%)`,
                      }}
                      aria-hidden
                    />
                    <div className="absolute inset-[18px] rounded-full bg-white" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <p className="text-[11px] font-bold text-violet">{demo.female}%</p>
                      <p className="text-[9px] text-muted">Female</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-[12px]">
                    <p>
                      <span className="inline-block h-2 w-2 rounded-full bg-violet" />{" "}
                      <span className="font-bold text-violet">{demo.female}%</span> Female
                    </p>
                    <p>
                      <span className="inline-block h-2 w-2 rounded-full bg-[#9EC5FF]" />{" "}
                      <span className="font-bold text-blue">{demo.male}%</span> Male
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                    Top Locations
                  </p>
                  {demo.locations.map((loc) => (
                    <div key={loc.name}>
                      <div className="mb-0.5 flex justify-between text-[11px]">
                        <span>{loc.name}</span>
                        <span className="font-semibold">{loc.pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-lavender">
                        <div
                          className="h-full rounded-full bg-violet"
                          style={{ width: `${Math.min(100, loc.pct * 3.2)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                    Audience Age Range
                  </p>
                  {demo.ages.map((a) => (
                    <div key={a.range} className="flex items-center gap-2 text-[11px]">
                      <span className="w-10 shrink-0 text-muted">{a.range}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-lavender">
                        <div
                          className="h-full rounded-full bg-blue"
                          style={{ width: `${Math.min(100, a.pct * 2.4)}%` }}
                        />
                      </div>
                      <span className="w-7 text-right font-semibold">{a.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {creator.collabPrefs ? (
                <div className="card-surface p-5">
                  <h3 className="font-display text-[1.05rem] font-bold text-indigo">
                    Collaboration Preferences
                  </h3>
                  <div className="mt-4 grid grid-cols-2 gap-2.5">
                    {creator.collabPrefs.map((p) => (
                      <div
                        key={p}
                        className="flex min-h-[72px] flex-col items-center justify-center rounded-xl border border-border bg-[#FBFBFF] px-2 py-3 text-center"
                      >
                        <span className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-lavender text-violet">
                          <IconUserPlus size={15} />
                        </span>
                        <p className="text-[11px] font-semibold leading-snug text-indigo">{p}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>

      {/* Brands */}
      {creator.brands && creator.brands.length > 0 ? (
        <section className="border-y border-border bg-white py-8">
          <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10">
            <h3 className="text-center font-display text-[1.15rem] font-bold text-indigo">
              Trusted by Amazing Brands
            </h3>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 opacity-80 grayscale">
              {creator.brands.map((b) => (
                <Image
                  key={b.name}
                  src={b.logo}
                  alt={b.name}
                  width={120}
                  height={36}
                  className="h-7 w-auto object-contain"
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Related creators */}
      <section className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6 lg:px-10">
        <div className="mb-5 flex items-end justify-between gap-3">
          <h3 className="font-display text-[1.25rem] font-bold text-indigo">
            You Might Also Like
          </h3>
          <Link href="/discover" className="text-[12px] font-semibold text-violet hover:underline">
            View More Creators →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((c) => (
            <article
              key={c.slug}
              className="card-surface flex flex-col items-center p-4 text-center transition hover:-translate-y-0.5"
            >
              <Link href={`/creators/${c.slug}`} className="relative h-16 w-16 overflow-hidden rounded-full">
                <Image src={c.image} alt={c.displayName} fill className="object-cover" sizes="64px" />
              </Link>
              <p className="mt-2.5 flex items-center gap-1 text-[13px] font-bold text-indigo">
                {c.displayName}
                {c.verified ? <IconVerified size={14} /> : null}
              </p>
              <p className="text-[11px] text-muted">{c.title}</p>
              <p className="text-[11px] text-muted">
                {c.locationCity}, {c.locationCountry}
              </p>
              <Link
                href={`/creators/${c.slug}`}
                className="mt-3 inline-flex rounded-full border border-violet/35 px-3.5 py-1.5 text-[11px] font-semibold text-violet"
              >
                Follow
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Join CTA */}
      <section className="mx-auto max-w-[90rem] px-4 pb-12 sm:px-6 lg:px-10">
        <div className="overflow-hidden rounded-[1.5rem] bg-gradient-to-r from-[#2979FF] to-[#633CFF] px-6 py-8 text-center text-white sm:px-10 sm:py-10">
          <h3 className="font-display text-[1.45rem] font-bold sm:text-[1.7rem]">
            Join Influrios
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-[13px] text-white/80">
            Create your free Influencer Card or find creators for your next campaign.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/claim"
              className="rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-violet shadow"
            >
              Join as a Creator
            </Link>
            <Link
              href="/business"
              className="rounded-full border border-white/50 bg-white/10 px-5 py-2.5 text-[13px] font-semibold text-white backdrop-blur"
            >
              Join as a Business
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
