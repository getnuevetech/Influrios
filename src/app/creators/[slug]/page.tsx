import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GuestGateBanner } from "@/components/guest-gate-banner";
import { consumeGuestQuota } from "@/lib/guest-usage";
import {
  IconBag,
  IconCake,
  IconCalendar,
  IconCamera,
  IconEye,
  IconGlobe,
  IconHandshake,
  IconHeart,
  IconLang,
  IconMail,
  IconMapPin,
  IconMegaphone,
  IconPlane,
  IconPlayBadge,
  IconPlaySolid,
  IconShare,
  IconUserPlus,
  IconUsers,
  IconVerified,
  SocialIcon,
} from "@/components/icons";
import {
  formatFollowers,
  specialtyLabel,
} from "@/lib/seed-data";
import { getDirectory, getDirectoryCreator, recordDirectoryEvent } from "@/lib/directory";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const creator = await getDirectoryCreator(slug);
  if (!creator) return { title: "Influencer not found" };
  return { title: creator.displayName, description: creator.bio };
}

function socialMetricLabel(platform: string) {
  if (platform === "WEBSITE") return "Monthly Visits";
  if (platform === "YOUTUBE") return "Subscribers";
  return "Followers";
}

const COLLAB_ICON_MAP: Record<string, typeof IconCamera> = {
  "Sponsored Content": IconCamera,
  "Events & Experiences": IconCalendar,
  "Product Reviews": IconBag,
  "Travel Partnerships": IconPlane,
  "Brand Campaigns": IconMegaphone,
  "Long-term Ambassadorships": IconHeart,
};

export default async function CreatorProfilePage({ params }: Props) {
  const { slug } = await params;
  const creator = await getDirectoryCreator(slug);
  if (!creator) notFound();
  const gate = await consumeGuestQuota("profile");
  if (gate.decision === "hard") {
    redirect(`/login?next=${encodeURIComponent(`/creators/${slug}`)}&gate=profile`);
  }
  await recordDirectoryEvent("profile_viewed", { slug, surface: "profile" });

  const directory = await getDirectory();
  const related = directory.creators.filter((c) => c.slug !== creator.slug).slice(0, 4);
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

  const cardBio =
    creator.offer || creator.bio
      ? `Creating a brighter, more confident you through real stories and beautiful places. ✨`
      : creator.bio;

  const aboutBio = `I'm ${firstName}, a ${creator.title.toLowerCase()} based in ${creator.locationCity}. ${creator.bio}`;

  const statTiles = stats
    ? [
        {
          label: "Engagement Rate",
          value: stats.engagementRate,
          delta: stats.engagementDelta,
          Icon: IconHeart,
          tone: "text-blue",
        },
        {
          label: "Total Reach",
          value: stats.totalReach,
          delta: stats.reachDelta,
          Icon: IconUsers,
          tone: "text-blue",
        },
        {
          label: "Average Views",
          value: stats.avgViews,
          delta: stats.viewsDelta,
          Icon: IconPlaySolid,
          tone: "text-violet",
        },
        {
          label: "Collaborations",
          value: stats.collaborations,
          delta: stats.collabDelta,
          Icon: IconHandshake,
          tone: "text-violet",
        },
      ]
    : [];

  return (
    <div className="bg-[#F5F8FF]">
      <GuestGateBanner copy={gate.decision === "soft" ? gate.copy : ""} next={`/creators/${slug}`} />
      {/* —— Hero banner —— */}
      <section className="relative">
        <div className="relative h-[220px] overflow-hidden sm:h-[280px] lg:h-[340px]">
          <Image
            src={creator.coverImage ?? creator.image}
            alt=""
            fill
            className="object-cover object-[center_35%]"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1a0b3a]/65 via-[#3a1a6a]/30 to-[#1a0b3a]/15" />

          <div className="pointer-events-none absolute bottom-0 left-[2%] z-[1] hidden h-[108%] w-[250px] sm:block lg:left-[5%] lg:w-[300px]">
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
                className="object-cover object-[center_12%]"
                sizes="300px"
                priority
              />
            </div>
          </div>

          <div className="pointer-events-none absolute left-3 top-1/2 hidden -translate-y-1/2 flex-col gap-0.5 xl:left-5 xl:flex">
            {scriptLines.map((line) => (
              <p key={line} className="font-script text-[14px] font-semibold leading-tight text-white/90">
                {line}
              </p>
            ))}
          </div>

          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center sm:items-start sm:pl-[38%] lg:pl-[40%]">
            <h1 className="font-script text-[2.4rem] font-semibold leading-[0.95] text-[#F4E9FF] drop-shadow-[0_3px_14px_rgba(40,10,80,0.55)] sm:text-[3rem] lg:text-[3.4rem]">
              {creator.displayName}
              <span className="ml-1.5 align-middle text-[1.2rem] text-[#FF8EC8]" aria-hidden>
                ♡
              </span>
            </h1>
            <span className="mt-2 inline-flex rounded-full bg-gradient-to-r from-[#633CFF] to-[#8B5CFF] px-3 py-1 text-[10px] font-semibold tracking-wide text-white shadow-lg sm:text-[11px]">
              {tagline}
            </span>
          </div>

          {creator.polaroids ? (
            <div className="absolute bottom-3 right-2 hidden items-end gap-1.5 md:flex lg:right-8 lg:gap-2">
              {creator.polaroids.map((p, i) => (
                <div
                  key={p.caption}
                  className={`w-[66px] overflow-hidden rounded-[3px] bg-white p-1 shadow-xl lg:w-[84px] ${
                    i === 0
                      ? "-rotate-6 translate-y-1"
                      : i === 1
                        ? "rotate-1 -translate-y-1"
                        : "rotate-6 translate-y-2"
                  }`}
                >
                  <div className="relative aspect-[3/4]">
                    <Image src={p.image} alt={p.caption} fill className="object-cover" sizes="84px" />
                  </div>
                  <p className="font-script mt-0.5 truncate px-0.5 text-center text-[8px] font-semibold text-indigo lg:text-[9px]">
                    {p.caption}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* —— Identity strip (template) —— */}
        <div className="relative z-10 mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10">
          <div className="relative -mt-8 rounded-[1.35rem] border border-[#E6ECFF] bg-white px-4 py-4 shadow-[0_14px_40px_rgba(17,26,90,0.08)] sm:-mt-12 sm:px-5 sm:py-5 lg:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
              <div className="relative mx-auto -mt-12 h-[96px] w-[96px] shrink-0 sm:mx-0 sm:-mt-14 sm:h-[108px] sm:w-[108px]">
                <div className="relative h-full w-full overflow-hidden rounded-full shadow-md ring-[4px] ring-white">
                  <Image
                    src={creator.image}
                    alt={creator.displayName}
                    fill
                    className="object-cover"
                    sizes="108px"
                    priority
                  />
                </div>
                {creator.verified ? (
                  <span className="absolute bottom-1 right-1 rounded-full bg-white p-0.5 shadow">
                    <IconVerified size={18} />
                  </span>
                ) : null}
              </div>

              <div className="min-w-0 flex-1 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center gap-1 sm:justify-start">
                  <h2 className="font-display text-[1.35rem] font-bold leading-tight text-indigo sm:text-[1.5rem]">
                    {creator.displayName}
                  </h2>
                  {creator.verified ? <IconVerified size={15} /> : null}
                </div>
                <p className="mt-0.5 text-[12px] font-medium text-indigo/80">{creator.title}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted">
                  <IconMapPin size={11} className="text-[#F97316]" />
                  {creator.locationCity}, {creator.locationCountry}
                </p>
                <p className="mx-auto mt-2 max-w-xl text-[12px] leading-relaxed text-muted sm:mx-0">
                  {creator.bio} ✨ Let&apos;s create a kinder, more colorful world together! 💜
                </p>
                <div className="mt-2.5 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                  {creator.specialties.map((s) => (
                    <span key={s} className="profile-tag !text-[10px] !px-2.5 !py-0.5">
                      {specialtyLabel(s)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex w-full shrink-0 flex-col items-center gap-2.5 lg:w-auto lg:items-end">
                <div className="flex flex-wrap justify-center gap-3 sm:gap-4 lg:justify-end">
                  {creator.socials.map((s) => (
                    <a
                      key={s.platform}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5"
                    >
                      <SocialIcon platform={s.platform} size={14} className="text-indigo" />
                      <span className="leading-tight">
                        <span className="block text-[12px] font-bold text-indigo">
                          {formatFollowers(s.followers)}
                        </span>
                        <span className="block text-[9px] font-medium text-muted">
                          {socialMetricLabel(s.platform)}
                        </span>
                      </span>
                    </a>
                  ))}
                </div>
                <div className="flex flex-wrap justify-center gap-1.5 lg:justify-end">
                  <a
                    href="#about"
                    className="btn-primary !gap-1 !px-3.5 !py-1.5 text-[12px]"
                  >
                    <IconMail size={13} />
                    Contact
                  </a>
                  <Link
                    href={`/collaboration?from=${creator.slug}`}
                    className="inline-flex items-center gap-1 rounded-full border border-[#D8E0F5] bg-white px-3 py-1.5 text-[12px] font-semibold text-indigo"
                  >
                    <IconUserPlus size={13} className="text-violet" />
                    Invite to Collaborate
                  </Link>
                  <Link
                    href={`/c/${creator.slug}`}
                    className="inline-flex items-center gap-1 rounded-full border border-[#D8E0F5] bg-white px-3 py-1.5 text-[12px] font-semibold text-indigo"
                  >
                    <IconShare size={13} className="text-blue" />
                    Share Card
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* —— Influencer Card | Key Stats + About —— */}
      <div className="mx-auto mt-5 grid max-w-[90rem] gap-5 px-4 sm:px-6 lg:mt-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-6 lg:px-10">
        {/* Horizontal glass Influencer Card */}
        <aside>
          <div className="overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-[#FFE4F1] via-[#E8F0FF] to-[#DCE8FF] p-4 shadow-[0_16px_40px_rgba(99,60,255,0.12)] ring-1 ring-[#E8D4FF] sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-[1rem] font-bold text-indigo">Influencer Card</h3>
                <p className="mt-0.5 max-w-[260px] text-[10px] leading-snug text-muted">
                  A powerful, shareable card with all her info, social links and more.
                </p>
              </div>
              <Link
                href={`/c/${creator.slug}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/80 bg-white/70 px-2.5 py-1 text-[10px] font-semibold text-violet backdrop-blur"
              >
                <IconEye size={12} />
                Preview
              </Link>
            </div>

            <div className="rounded-[1.1rem] bg-white p-3 shadow-sm sm:p-3.5">
              <div className="flex gap-3">
                <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl sm:h-[100px] sm:w-[100px]">
                  <Image
                    src={creator.image}
                    alt={creator.displayName}
                    fill
                    className="object-cover"
                    sizes="100px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1">
                    <p className="text-[13px] font-bold text-indigo sm:text-[14px]">
                      {creator.displayName}
                    </p>
                    {creator.verified ? <IconVerified size={13} /> : null}
                  </div>
                  <p className="text-[10px] text-muted sm:text-[11px]">{creator.title}</p>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted">
                    <IconMapPin size={10} className="text-[#F97316]" />
                    {creator.locationCity}, {creator.locationCountry}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {creator.specialties.slice(0, 4).map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-[#EAE4FF] px-2 py-0.5 text-[9px] font-semibold text-violet"
                      >
                        {specialtyLabel(s)}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-muted sm:text-[11px]">
                    {cardBio}
                  </p>
                </div>
                <div className="hidden shrink-0 flex-col items-center sm:flex">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/qr/${creator.slug}?size=160&logo=1&v=2`}
                    alt={`${creator.displayName} QR`}
                    width={72}
                    height={72}
                    className="rounded-md border border-[#E6ECFF] bg-white p-1"
                  />
                  <p className="mt-1 max-w-[76px] text-center text-[8px] font-medium leading-tight text-muted">
                    Scan to view my full card
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-muted">
                  Connect with me
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {creator.socials.slice(0, 5).map((s) => (
                    <a
                      key={s.platform}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/80 text-indigo shadow-sm ring-1 ring-white"
                    >
                      <SocialIcon platform={s.platform} size={13} />
                    </a>
                  ))}
                </div>
              </div>
              <p className="font-script max-w-[130px] text-right text-[15px] font-semibold leading-tight text-violet sm:text-[17px]">
                One Card
                <br />
                Endless Opportunities
                <span className="mt-0.5 block text-[12px] text-[#E879F9]" aria-hidden>
                  ♡
                </span>
              </p>
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          {stats ? (
            <section className="rounded-[1.2rem] border border-[#E6ECFF] bg-white p-3.5 shadow-sm sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-[1rem] font-bold text-indigo">Key Stats</h3>
                <span className="rounded-full border border-[#E6ECFF] bg-[#F8FAFF] px-2.5 py-1 text-[10px] font-semibold text-muted">
                  Last 30 Days ▾
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
                {statTiles.map(({ label, value, delta, Icon, tone }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-[#E8EEFF] bg-[#FBFCFF] px-2.5 py-2.5"
                  >
                    <Icon size={14} className={tone} />
                    <p className="mt-1.5 font-display text-[1.15rem] font-bold leading-none text-indigo sm:text-[1.25rem]">
                      {value}
                    </p>
                    <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-muted">
                      {label}
                    </p>
                    <p className="mt-1 text-[9px] font-semibold text-emerald-600">{delta}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section
            id="about"
            className="rounded-[1.2rem] border border-[#E6ECFF] bg-[#F7F9FF] p-4 sm:p-5"
          >
            <h3 className="font-display text-[1rem] font-bold text-indigo">About {firstName}</h3>
            <div className="mt-2.5 grid gap-4 sm:grid-cols-[1.35fr_0.9fr]">
              <div>
                <p className="text-[12px] leading-relaxed text-muted">{aboutBio}</p>
                <button type="button" className="mt-2 text-[11px] font-semibold text-blue hover:underline">
                  Read More →
                </button>
              </div>
              <ul className="space-y-2 text-[11px] text-muted">
                {creator.age ? (
                  <li className="flex items-center gap-2">
                    <IconCake size={13} className="text-violet" />
                    <span className="font-semibold text-indigo">{creator.age} years old</span>
                  </li>
                ) : null}
                <li className="flex items-center gap-2">
                  <IconMapPin size={13} className="text-[#F97316]" />
                  <span className="font-semibold text-indigo">
                    {creator.locationCity}, {creator.locationCountry}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <IconLang size={13} className="text-blue" />
                  <span className="font-semibold text-indigo">{creator.languages.join(", ")}</span>
                </li>
                {creator.linktree ? (
                  <li className="flex items-center gap-2">
                    <IconGlobe size={13} className="text-blue" />
                    <a
                      href={`https://${creator.linktree}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-blue hover:underline"
                    >
                      {creator.linktree}
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
          </section>
        </div>
      </div>

      {/* —— Featured Content horizontal strip —— */}
      {content.length > 0 ? (
        <section className="w-full py-7">
          <div className="mx-auto mb-3 flex max-w-[90rem] flex-wrap items-end justify-between gap-2 px-4 sm:px-6 lg:px-10">
            <div>
              <h3 className="font-display text-[1.1rem] font-bold text-indigo">Featured Content</h3>
              <p className="mt-0.5 text-[11px] text-muted">
                A glimpse of {firstName}&apos;s recent content across platforms. Scroll sideways to explore.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {["All", "Beauty", "Lifestyle", "Travel", "Fashion", "Brand Collaborations"].map(
                (t) => (
                  <span
                    key={t}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                      t === "All"
                        ? "bg-gradient-to-r from-[#633CFF] to-[#2979FF] text-white"
                        : "bg-white text-muted ring-1 ring-[#E0E7FF]"
                    }`}
                  >
                    {t}
                  </span>
                ),
              )}
              <span className="ml-1 text-[11px] font-semibold text-blue">View All Content →</span>
            </div>
          </div>

          <div className="no-scrollbar flex w-full gap-3 overflow-x-auto px-4 pb-2 sm:px-6 lg:px-10">
            {content.map((item) => (
              <article
                key={item.id}
                className="w-[148px] shrink-0 overflow-hidden rounded-2xl border border-[#E6ECFF] bg-white shadow-sm sm:w-[160px]"
              >
                {/* Height reduced ~20% vs prior 4/5 aspect (now square) */}
                <div className="relative aspect-square">
                  <Image
                    src={item.image}
                    alt={item.category}
                    fill
                    className="object-cover"
                    sizes="160px"
                  />
                  <span className="absolute right-2 top-2">
                    <IconPlayBadge size={30} />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1.5 px-2.5 py-2">
                  <SocialIcon
                    platform={item.platform.toUpperCase()}
                    size={15}
                    className="text-indigo"
                  />
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted">
                    <IconEye size={11} />
                    {item.views}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted">
                    <IconHeart size={11} className="text-[#E11D48]" />
                    {item.likes}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* —— Demographics + Collab prefs —— */}
      {demo ? (
        <section className="mx-auto max-w-[90rem] px-4 pb-5 sm:px-6 lg:px-10">
          <div className="grid gap-4 rounded-[1.25rem] border border-[#E6ECFF] bg-white p-4 shadow-sm sm:p-5 lg:grid-cols-[1.35fr_0.9fr]">
            <div>
              <h3 className="font-display text-[1.05rem] font-bold text-indigo">
                Audience Demographics
              </h3>
              <p className="mt-0.5 text-[11px] text-muted">
                Where {firstName}&apos;s followers are from.
              </p>

              <div className="mt-4 grid gap-5 sm:grid-cols-[auto_1fr_1.1fr] sm:items-start">
                <div className="flex items-center gap-3">
                  <div className="relative h-[92px] w-[92px] shrink-0">
                    <div
                      className="h-full w-full rounded-full"
                      style={{
                        background: `conic-gradient(#633CFF 0 ${demo.female}%, #9EC5FF ${demo.female}% 100%)`,
                      }}
                      aria-hidden
                    />
                    <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-white text-center">
                      <p className="text-[12px] font-bold text-violet">{demo.female}%</p>
                      <p className="text-[8px] text-muted">Female</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <p className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-violet" />
                      Female
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#9EC5FF]" />
                      Male
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-bold text-indigo">Top Locations</p>
                  <ul className="mt-2 space-y-1.5">
                    {demo.locations.map((loc, i) => (
                      <li key={loc.name} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="flex items-center gap-1.5 text-muted">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-violet" : "bg-[#C7D2FE]"}`}
                          />
                          {loc.name}
                        </span>
                        <span className="font-semibold text-indigo">{loc.pct}%</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-[11px] font-bold text-indigo">Audience Age Range</p>
                  <div className="mt-2 space-y-1.5">
                    {demo.ages.map((a) => (
                      <div key={a.range} className="flex items-center gap-2 text-[10px]">
                        <span className="w-9 shrink-0 text-muted">{a.range}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EEF2FF]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#633CFF] to-[#2979FF]"
                            style={{ width: `${Math.min(100, a.pct * 2.4)}%` }}
                          />
                        </div>
                        <span className="w-7 text-right font-semibold text-indigo">{a.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {creator.collabPrefs ? (
              <div className="rounded-2xl border border-[#E6ECFF] bg-[#FAFBFF] p-3.5 sm:p-4">
                <h3 className="font-display text-[1.05rem] font-bold text-indigo">
                  Collaboration Preferences
                </h3>
                <p className="mt-0.5 text-[11px] text-muted">
                  Open to exciting brand partnerships!
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {creator.collabPrefs.map((p) => {
                    const Icon = COLLAB_ICON_MAP[p] ?? IconHeart;
                    return (
                      <div
                        key={p}
                        className="flex items-center gap-2 rounded-full border border-[#E0E7FF] bg-white px-2.5 py-2"
                      >
                        <Icon size={13} className="shrink-0 text-violet" />
                        <span className="h-3 w-px bg-[#E0E7FF]" aria-hidden />
                        <p className="text-[10px] font-semibold leading-snug text-indigo">{p}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* —— Brands thin strip —— */}
      {creator.brands && creator.brands.length > 0 ? (
        <section className="mx-auto max-w-[90rem] px-4 pb-5 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-center gap-4 rounded-[1.1rem] border border-[#E6ECFF] bg-white px-4 py-3.5 shadow-sm sm:px-5">
            <div className="min-w-[160px] shrink-0">
              <h3 className="font-display text-[0.95rem] font-bold text-indigo">
                Trusted by Amazing Brands
              </h3>
              <p className="mt-0.5 text-[10px] text-muted">
                {firstName} has collaborated with leading global brands.
              </p>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-6 gap-y-2 opacity-80 grayscale">
              {creator.brands.map((b) => (
                <Image
                  key={b.name}
                  src={b.logo}
                  alt={b.name}
                  width={90}
                  height={28}
                  className="h-5 w-auto object-contain"
                />
              ))}
            </div>
            <span className="shrink-0 text-[11px] font-semibold text-blue">
              View All Collaborations →
            </span>
          </div>
        </section>
      ) : null}

      {/* —— You Might Also Like strip —— */}
      <section className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 lg:px-10">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-[1.15rem] font-bold text-indigo">
              You Might Also Like
            </h3>
            <p className="mt-0.5 text-[11px] text-muted">Discover more amazing influencers.</p>
          </div>
          <Link href="/discover" className="text-[11px] font-semibold text-blue hover:underline">
            View More Influencers →
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:thin]">
          {related.map((c) => (
            <article
              key={c.slug}
              className="flex w-[260px] shrink-0 gap-2.5 rounded-2xl border border-[#E6ECFF] bg-white p-2.5 shadow-sm sm:w-[280px]"
            >
              <Link
                href={`/creators/${c.slug}`}
                className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-xl"
              >
                <Image src={c.image} alt={c.displayName} fill className="object-cover" sizes="84px" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="flex items-center gap-1 text-[12px] font-bold text-indigo">
                  {c.displayName}
                  {c.verified ? <IconVerified size={12} /> : null}
                </p>
                <p className="text-[10px] text-muted">{c.title}</p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted">
                  <IconMapPin size={10} className="text-[#E11D48]" />
                  {c.locationCity}, {c.locationCountry}
                </p>
                <Link
                  href={`/creators/${c.slug}`}
                  className="mt-auto inline-flex justify-center rounded-full bg-[#EAE4FF] px-3 py-1 text-[11px] font-semibold text-violet"
                >
                  Follow
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Join CTA */}
      <section className="mx-auto max-w-[90rem] px-4 pb-12 sm:px-6 lg:px-10">
        <div className="overflow-hidden rounded-[1.4rem] bg-gradient-to-r from-[#1B1464] via-[#3B2B9A] to-[#2979FF] px-6 py-8 text-center text-white sm:px-10 sm:py-9">
          <h3 className="font-display text-[1.35rem] font-bold sm:text-[1.55rem]">Join Influrios</h3>
          <p className="mx-auto mt-1.5 max-w-lg text-[12px] text-white/80">
            Create your free Influencer Card or find influencers for your next campaign.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <Link
              href="/claim"
              className="ink-on-light rounded-full bg-white px-5 py-2 text-[12px] font-semibold shadow"
            >
              Join as an Influencer
            </Link>
            <Link
              href="/business"
              className="rounded-full border border-white/55 bg-white/10 px-5 py-2 text-[12px] font-semibold text-white backdrop-blur"
            >
              Join as a Business
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
