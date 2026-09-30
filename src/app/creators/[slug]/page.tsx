import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { actionSendInquiry } from "@/app/business/actions";
import { InfluencerCardView } from "@/components/creator-card";
import {
  IconCake,
  IconEye,
  IconGlobe,
  IconHandshake,
  IconHeart,
  IconLang,
  IconMail,
  IconMapPin,
  IconPlay,
  IconPlaySolid,
  IconShare,
  IconUserPlus,
  IconUsers,
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

function socialMetricLabel(platform: string) {
  if (platform === "WEBSITE") return "Monthly Visits";
  if (platform === "YOUTUBE") return "Subscribers";
  return "Followers";
}

const COLLAB_ICONS = [IconHeart, IconUsers, IconHandshake, IconGlobe, IconMapPin, IconUserPlus];

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
  const scriptLines = (
    creator.bannerScriptTags ??
    creator.specialties
      .slice(0, 4)
      .map((s) => specialtyLabel(s))
      .join(" / ")
  )
    .split(/\s*\/\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  const statTiles = stats
    ? [
        {
          label: "Engagement Rate",
          value: stats.engagementRate,
          delta: stats.engagementDelta,
          Icon: IconHeart,
          tone: "bg-[#EEF0FF] text-violet",
        },
        {
          label: "Total Reach",
          value: stats.totalReach,
          delta: stats.reachDelta,
          Icon: IconUsers,
          tone: "bg-[#E8F1FF] text-blue",
        },
        {
          label: "Average Views",
          value: stats.avgViews,
          delta: stats.viewsDelta,
          Icon: IconPlaySolid,
          tone: "bg-[#F3E8FF] text-violet",
        },
        {
          label: "Collaborations",
          value: stats.collaborations,
          delta: stats.collabDelta,
          Icon: IconHandshake,
          tone: "bg-[#FCE7F6] text-[#C026A4]",
        },
      ]
    : [];

  return (
    <div className="bg-[#F5F8FF]">
      {/* —— Hero banner —— */}
      <section className="relative">
        <div className="relative h-[240px] overflow-hidden sm:h-[300px] lg:h-[360px]">
          <Image
            src={creator.coverImage ?? creator.image}
            alt=""
            fill
            className="object-cover object-[center_35%]"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1a0b3a]/70 via-[#3a1a6a]/35 to-[#1a0b3a]/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b123f]/45 via-transparent to-transparent" />

          {/* Left portrait cutout — template hero subject */}
          <div className="pointer-events-none absolute bottom-0 left-[2%] z-[1] hidden h-[108%] w-[270px] sm:block lg:left-[5%] lg:w-[320px]">
            <div
              className="relative h-full w-full"
              style={{
                WebkitMaskImage:
                  "linear-gradient(90deg, transparent 0%, #000 14%, #000 78%, transparent 100%)",
                maskImage:
                  "linear-gradient(90deg, transparent 0%, #000 14%, #000 78%, transparent 100%)",
              }}
            >
              <Image
                src={creator.image}
                alt=""
                fill
                className="object-cover object-[center_12%] brightness-105 contrast-105"
                sizes="320px"
                priority
              />
            </div>
          </div>

          {/* Vertical / stacked script tags */}
          <div className="pointer-events-none absolute left-3 top-1/2 hidden -translate-y-1/2 flex-col gap-0.5 xl:left-5 xl:flex">
            {scriptLines.map((line) => (
              <p
                key={line}
                className="font-script text-[15px] font-semibold leading-tight text-white/90 drop-shadow"
              >
                {line}
              </p>
            ))}
          </div>
          <p className="font-script pointer-events-none absolute left-3 top-4 max-w-[140px] text-[13px] font-semibold leading-snug text-white/90 drop-shadow xl:hidden">
            {scriptLines.join(" · ")}
          </p>

          {/* Center name + badge */}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center sm:items-start sm:pl-[38%] lg:pl-[40%]">
            <h1 className="font-script text-[2.6rem] font-semibold leading-[0.95] text-[#F4E9FF] drop-shadow-[0_3px_14px_rgba(40,10,80,0.55)] sm:text-[3.25rem] lg:text-[3.7rem]">
              {creator.displayName}
              <span className="ml-1.5 align-middle text-[1.35rem] text-[#FF8EC8]" aria-hidden>
                ♡
              </span>
            </h1>
            <span className="mt-2 inline-flex rounded-full bg-gradient-to-r from-[#633CFF] to-[#8B5CFF] px-3.5 py-1 text-[11px] font-semibold tracking-wide text-white shadow-lg sm:text-[12px]">
              {tagline}
            </span>
          </div>

          {/* Polaroids */}
          {creator.polaroids ? (
            <div className="absolute bottom-3 right-2 hidden items-end gap-1.5 md:flex lg:right-8 lg:gap-2.5">
              {creator.polaroids.map((p, i) => (
                <div
                  key={p.caption}
                  className={`w-[70px] overflow-hidden rounded-[3px] bg-white p-1 shadow-xl lg:w-[92px] ${
                    i === 0
                      ? "-rotate-6 translate-y-1"
                      : i === 1
                        ? "rotate-1 -translate-y-1"
                        : "rotate-6 translate-y-2"
                  }`}
                >
                  <div className="relative aspect-[3/4]">
                    <Image src={p.image} alt={p.caption} fill className="object-cover" sizes="92px" />
                  </div>
                  <p className="font-script mt-0.5 truncate px-0.5 text-center text-[9px] font-semibold leading-tight text-indigo lg:text-[10px]">
                    {p.caption}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* —— Identity / profile summary card —— */}
        <div className="relative z-10 mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10">
          <div className="relative -mt-10 rounded-[1.5rem] border border-[#E4EBFF] bg-white px-4 pb-5 pt-4 shadow-[0_18px_50px_rgba(17,26,90,0.10)] sm:-mt-14 sm:px-6 sm:pb-6 sm:pt-5 lg:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
              {/* Avatar */}
              <div className="relative mx-auto -mt-14 h-[118px] w-[118px] shrink-0 sm:mx-0 sm:-mt-16 sm:h-[136px] sm:w-[136px]">
                <div className="relative h-full w-full overflow-hidden rounded-full shadow-lg ring-[5px] ring-white">
                  <Image
                    src={creator.image}
                    alt={creator.displayName}
                    fill
                    className="object-cover"
                    sizes="136px"
                    priority
                  />
                </div>
                {creator.verified ? (
                  <span className="absolute bottom-1.5 right-1.5 rounded-full bg-white p-0.5 shadow">
                    <IconVerified size={24} />
                  </span>
                ) : null}
              </div>

              {/* Identity + bio + tags */}
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                  <h2 className="font-display text-[1.55rem] font-bold leading-tight text-indigo sm:text-[1.8rem]">
                    {creator.displayName}
                  </h2>
                  {creator.verified ? <IconVerified size={18} /> : null}
                </div>
                <p className="mt-0.5 text-[13px] font-medium text-muted">{creator.title}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-muted">
                  <IconMapPin size={13} className="text-[#E11D48]" />
                  {creator.locationCity}, {creator.locationCountry}
                </p>
                <p className="mx-auto mt-2.5 max-w-2xl text-[13px] leading-relaxed text-muted sm:mx-0">
                  {creator.bio}{" "}
                  <span className="text-[#C026A4]" aria-hidden>
                    ♡
                  </span>
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                  {creator.specialties.map((s) => (
                    <span key={s} className="profile-tag">
                      {specialtyLabel(s)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Socials + CTAs */}
              <div className="flex w-full shrink-0 flex-col items-center gap-3 lg:w-auto lg:max-w-[340px] lg:items-end">
                <div className="flex flex-wrap justify-center gap-1.5 lg:justify-end">
                  {creator.socials.map((s) => (
                    <a
                      key={s.platform}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#E4EBFF] bg-[#F8FAFF] px-2.5 py-1.5 shadow-sm"
                    >
                      <SocialIcon platform={s.platform} size={13} className="text-indigo" />
                      <span className="text-[11px] font-bold text-indigo">
                        {formatFollowers(s.followers)}
                      </span>
                      <span className="hidden text-[9px] font-medium text-muted sm:inline">
                        {socialMetricLabel(s.platform)}
                      </span>
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
                    className="inline-flex items-center gap-1.5 rounded-full border border-violet/45 bg-white px-3.5 py-2 text-[13px] font-semibold text-violet"
                  >
                    <IconUserPlus size={15} />
                    Invite to Collaborate
                  </Link>
                  <Link
                    href={`/c/${creator.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-violet/45 bg-white px-3.5 py-2 text-[13px] font-semibold text-violet"
                  >
                    <IconShare size={15} />
                    Share Card
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* —— Influencer Card | Key Stats —— */}
      <div className="mx-auto mt-6 grid max-w-[90rem] gap-6 px-4 sm:px-6 lg:mt-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-8 lg:px-10">
        <aside>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-[1.05rem] font-bold text-indigo">Influencer Card</h3>
              <p className="mt-0.5 max-w-[220px] text-[11px] leading-snug text-muted">
                A powerful, shareable card with all her info, social links and more.
              </p>
            </div>
            <Link
              href={`/c/${creator.slug}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1.5 text-[11px] font-semibold text-violet shadow-sm"
            >
              <IconEye size={13} />
              Preview
            </Link>
          </div>
          <div className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-b from-[#EAE4FF] via-[#F4F0FF] to-white p-3 shadow-[0_20px_50px_rgba(99,60,255,0.18)] ring-1 ring-[#D9D0FF]">
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#E879F9]/25 blur-2xl"
              aria-hidden
            />
            <InfluencerCardView creator={creator} qrDisplay="large" hideCta />
            <p className="font-script mt-2 text-center text-[1.15rem] font-semibold text-violet">
              One Card. Endless Opportunities.
            </p>
          </div>
        </aside>

        <div className="space-y-6">
          {stats ? (
            <section className="card-surface p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-[1.05rem] font-bold text-indigo">Key Stats</h3>
                <span className="rounded-full bg-[#F0F4FF] px-3 py-1.5 text-[11px] font-semibold text-muted">
                  Last 30 Days ▾
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {statTiles.map(({ label, value, delta, Icon, tone }) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-[#E6ECFF] bg-[#FBFCFF] px-3.5 py-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                        {label}
                      </p>
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${tone}`}
                      >
                        <Icon size={15} />
                      </span>
                    </div>
                    <p className="mt-1.5 font-display text-[1.45rem] font-bold leading-none text-indigo">
                      {value}
                    </p>
                    <p className="mt-1.5 text-[11px] font-semibold text-emerald-600">{delta}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* About */}
          <section id="contact" className="card-surface p-5 sm:p-6">
            <h3 className="font-display text-[1.15rem] font-bold text-indigo">
              About {firstName}
            </h3>
            <div className="mt-3 grid gap-5 lg:grid-cols-[1.45fr_0.9fr]">
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

              <ul className="space-y-3 rounded-2xl border border-[#E6ECFF] bg-[#F8FAFF] p-4 text-[12px] text-muted">
                {creator.age ? (
                  <li className="flex items-center gap-2.5">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-violet shadow-sm">
                      <IconCake size={15} />
                    </span>
                    <span className="font-semibold text-indigo">{creator.age} years old</span>
                  </li>
                ) : null}
                <li className="flex items-center gap-2.5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#E11D48] shadow-sm">
                    <IconMapPin size={15} />
                  </span>
                  <span className="font-semibold text-indigo">
                    {creator.locationCity}, {creator.locationCountry}
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-blue shadow-sm">
                    <IconLang size={15} />
                  </span>
                  <span className="font-semibold text-indigo">{creator.languages.join(", ")}</span>
                </li>
                {creator.email ? (
                  <li className="flex items-center gap-2.5">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-violet shadow-sm">
                      <IconMail size={15} />
                    </span>
                    <a
                      href={`mailto:${creator.email}`}
                      className="font-semibold text-indigo hover:underline"
                    >
                      {creator.email}
                    </a>
                  </li>
                ) : null}
                {creator.linktree ? (
                  <li className="flex items-center gap-2.5">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-blue shadow-sm">
                      <IconGlobe size={15} />
                    </span>
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
        </div>
      </div>

      {/* —— Featured Content —— */}
      {content.length > 0 ? (
        <section className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:px-10">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-display text-[1.2rem] font-bold text-indigo">Featured Content</h3>
              <p className="mt-0.5 text-[12px] text-muted">
                A glimpse of {firstName}&apos;s recent content across platforms.
              </p>
            </div>
            <span className="text-[12px] font-semibold text-violet">View All Content →</span>
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {["All", "Beauty", "Lifestyle", "Travel", "Fashion", "Brand Collaborations"].map(
              (t) => (
                <span
                  key={t}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                    t === "All"
                      ? "bg-violet text-white shadow-sm"
                      : "bg-white text-muted ring-1 ring-border"
                  }`}
                >
                  {t}
                </span>
              ),
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
            {content.map((item) => (
              <article
                key={item.id}
                className="group relative aspect-[4/5] overflow-hidden rounded-[1.15rem] shadow-md"
              >
                <Image
                  src={item.image}
                  alt={item.category}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-105"
                  sizes="33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-95">
                  <IconPlay size={40} />
                </span>
                <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-end justify-between gap-1 text-white">
                  <div className="flex items-center gap-1.5 rounded-full bg-black/45 px-2 py-1 backdrop-blur-sm">
                    <SocialIcon
                      platform={item.platform.toUpperCase()}
                      size={12}
                      className="text-white"
                    />
                    <p className="text-[11px] font-semibold">{item.views}</p>
                  </div>
                  <p className="rounded-full bg-black/45 px-2 py-1 text-[11px] font-semibold backdrop-blur-sm">
                    ♥ {item.likes}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* —— Demographics | Collab prefs —— */}
      {demo ? (
        <section className="mx-auto grid max-w-[90rem] gap-5 px-4 pb-8 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-10">
          <div className="card-surface p-5 sm:p-6">
            <h3 className="font-display text-[1.1rem] font-bold text-indigo">
              Audience Demographics
            </h3>
            <div className="mt-5 flex flex-wrap items-center gap-6">
              <div className="relative h-[112px] w-[112px] shrink-0">
                <div
                  className="h-full w-full rounded-full"
                  style={{
                    background: `conic-gradient(#633CFF 0 ${demo.female}%, #9EC5FF ${demo.female}% 100%)`,
                  }}
                  aria-hidden
                />
                <div className="absolute inset-[20px] rounded-full bg-white shadow-inner" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="text-[13px] font-bold text-violet">{demo.female}%</p>
                  <p className="text-[10px] text-muted">Female</p>
                </div>
              </div>
              <div className="space-y-2 text-[13px]">
                <p className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet" />
                  <span className="font-bold text-violet">{demo.female}%</span> Female
                </p>
                <p className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#9EC5FF]" />
                  <span className="font-bold text-blue">{demo.male}%</span> Male
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                Top Locations
              </p>
              {demo.locations.map((loc) => (
                <div key={loc.name}>
                  <div className="mb-1 flex justify-between text-[12px]">
                    <span>{loc.name}</span>
                    <span className="font-semibold">{loc.pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#EAE4FF]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#633CFF] to-[#2979FF]"
                      style={{ width: `${Math.min(100, loc.pct * 3.2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                Audience Age Range
              </p>
              {demo.ages.map((a) => (
                <div key={a.range} className="flex items-center gap-2.5 text-[12px]">
                  <span className="w-11 shrink-0 text-muted">{a.range}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EAE4FF]">
                    <div
                      className="h-full rounded-full bg-[#2979FF]"
                      style={{ width: `${Math.min(100, a.pct * 2.4)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-semibold">{a.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {creator.collabPrefs ? (
            <div className="card-surface p-5 sm:p-6">
              <h3 className="font-display text-[1.1rem] font-bold text-indigo">
                Collaboration Preferences
              </h3>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {creator.collabPrefs.map((p, i) => {
                  const Icon = COLLAB_ICONS[i % COLLAB_ICONS.length];
                  return (
                    <div
                      key={p}
                      className="flex min-h-[88px] flex-col items-center justify-center rounded-2xl border border-[#E6ECFF] bg-[#FBFCFF] px-3 py-4 text-center"
                    >
                      <span className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-lavender text-violet">
                        <Icon size={16} />
                      </span>
                      <p className="text-[12px] font-semibold leading-snug text-indigo">{p}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Brands */}
      {creator.brands && creator.brands.length > 0 ? (
        <section className="border-y border-border bg-white py-9">
          <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10">
            <h3 className="text-center font-display text-[1.2rem] font-bold text-indigo">
              Trusted by Amazing Brands
            </h3>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-5 opacity-75 grayscale">
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

      {/* Related */}
      <section className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6 lg:px-10">
        <div className="mb-5 flex items-end justify-between gap-3">
          <h3 className="font-display text-[1.25rem] font-bold text-indigo">You Might Also Like</h3>
          <Link href="/discover" className="text-[12px] font-semibold text-violet hover:underline">
            View More Creators →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((c) => (
            <article
              key={c.slug}
              className="card-surface flex flex-col items-center p-5 text-center transition hover:-translate-y-0.5"
            >
              <Link
                href={`/creators/${c.slug}`}
                className="relative h-[72px] w-[72px] overflow-hidden rounded-full ring-2 ring-[#EAE4FF]"
              >
                <Image src={c.image} alt={c.displayName} fill className="object-cover" sizes="72px" />
              </Link>
              <p className="mt-3 flex items-center gap-1 text-[14px] font-bold text-indigo">
                {c.displayName}
                {c.verified ? <IconVerified size={14} /> : null}
              </p>
              <p className="text-[12px] text-muted">{c.title}</p>
              <p className="text-[12px] text-muted">
                {c.locationCity}, {c.locationCountry}
              </p>
              <Link
                href={`/creators/${c.slug}`}
                className="mt-3.5 inline-flex rounded-full border border-violet/40 px-4 py-1.5 text-[12px] font-semibold text-violet"
              >
                Follow
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Join CTA */}
      <section className="mx-auto max-w-[90rem] px-4 pb-12 sm:px-6 lg:px-10">
        <div className="overflow-hidden rounded-[1.6rem] bg-gradient-to-r from-[#1B1464] via-[#3B2B9A] to-[#2979FF] px-6 py-9 text-center text-white sm:px-10 sm:py-11">
          <h3 className="font-display text-[1.5rem] font-bold sm:text-[1.8rem]">Join Influrios</h3>
          <p className="mx-auto mt-2 max-w-lg text-[13px] text-white/80">
            Create your free Influencer Card or find creators for your next campaign.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/claim"
              className="rounded-full bg-white px-6 py-2.5 text-[13px] font-semibold text-violet shadow"
            >
              Join as a Creator
            </Link>
            <Link
              href="/business"
              className="rounded-full border border-white/55 bg-white/10 px-6 py-2.5 text-[13px] font-semibold text-white backdrop-blur"
            >
              Join as a Business
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
