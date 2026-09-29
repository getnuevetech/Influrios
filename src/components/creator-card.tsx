import Image from "next/image";
import Link from "next/link";
import {
  IconCheck,
  IconLink,
  IconMapPin,
  IconVerified,
  SocialIcon,
} from "@/components/icons";
import { ShortlistHeartButton } from "@/components/shortlist-heart-button";
import type { CardFeatureFlags } from "@/lib/cms";
import {
  formatFollowers,
  specialtyLabel,
  type SeedCreator,
} from "@/lib/seed-data";
import { getEntitlements, type PlanCode } from "@/lib/entitlements";

const BADGE_STYLES: Record<string, string> = {
  "Top Creator": "bg-[#2979FF] text-white",
  "Rising Star": "bg-[#E879F9] text-white",
  "Business Friendly": "bg-emerald-500 text-white",
  "Fast Growing": "bg-[#633CFF] text-white",
  "High Engagement": "bg-[#633CFF] text-white",
};

const DEFAULT_FEATURES: CardFeatureFlags = {
  showBadge: true,
  showHeart: true,
  showVerified: true,
  showLocation: true,
  showSpecialties: true,
  showSocials: true,
  showFollowerCounts: true,
  showQr: true,
  showStatus: true,
  visiblePlatforms: [],
};

export type CreatorCardProps = {
  creator: SeedCreator;
  /** Width in px (height unchanged). Omit for fluid grid cards. Default ~264 = +20% over ~220. */
  widthPx?: number;
  socialIconSize?: number;
  qrSize?: number;
  features?: Partial<CardFeatureFlags>;
  /** Show title + short bio (discover template). */
  showTitle?: boolean;
  showBio?: boolean;
  showViewProfile?: boolean;
};

export function CreatorCard({
  creator,
  widthPx,
  socialIconSize = 22,
  qrSize = 22,
  features: featureOverrides,
  showTitle = false,
  showBio = false,
  showViewProfile = false,
}: CreatorCardProps) {
  const features = { ...DEFAULT_FEATURES, ...featureOverrides };
  const entitlements = getEntitlements(creator.planTier as PlanCode);
  const canQr = entitlements.standardQr || entitlements.dynamicQr;
  const showQr = features.showQr && canQr;
  const badgeClass = BADGE_STYLES[creator.badge] ?? "bg-white text-violet";

  const socials = creator.socials.filter((s) =>
    features.visiblePlatforms.length
      ? features.visiblePlatforms.includes(s.platform)
      : true,
  ).slice(0, 4);

  return (
    <article
      style={widthPx ? { width: widthPx, minWidth: widthPx } : undefined}
      className={`group flex ${widthPx ? "shrink-0" : "w-full"} flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-[0_12px_32px_rgba(17,26,90,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-xl`}
    >
      <div className="relative h-52 overflow-hidden">
        <Image
          src={creator.image}
          alt={creator.displayName}
          fill
          className="object-cover transition duration-500 group-hover:scale-105"
          sizes={widthPx ? `${widthPx}px` : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-indigo/55 via-transparent to-transparent" />
        {features.showBadge ? (
          <span
            className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold shadow ${badgeClass}`}
          >
            {creator.badge}
          </span>
        ) : null}
        {features.showHeart ? <ShortlistHeartButton slug={creator.slug} /> : null}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 px-3.5 pb-0 pt-3.5">
        <div>
          <h3 className="flex items-center gap-1.5 font-display text-[15px] font-bold text-indigo">
            <Link href={`/creators/${creator.slug}`} className="hover:underline">
              {creator.displayName}
            </Link>
            {features.showVerified && creator.verified !== false ? (
              <IconVerified size={16} />
            ) : null}
          </h3>
          {showTitle ? (
            <p className="mt-0.5 truncate text-xs text-muted">{creator.title}</p>
          ) : null}
          {features.showLocation ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <IconMapPin size={12} className="shrink-0 text-violet" />
              {creator.locationCity}
              {creator.locationState ? `, ${creator.locationState}` : ""}, {creator.locationCountry}
            </p>
          ) : null}
        </div>

        {features.showSpecialties ? (
          <div className="flex flex-wrap gap-1.5">
            {creator.specialties.slice(0, 3).map((s) => (
              <span
                key={s}
                className="rounded-full bg-lavender px-2 py-0.5 text-[10px] font-semibold text-violet"
              >
                {specialtyLabel(s)}
              </span>
            ))}
          </div>
        ) : null}

        {showBio ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted">{creator.bio}</p>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          {features.showSocials ? (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {socials.map((s) => (
                <span key={s.platform} className="inline-flex items-center gap-1">
                  <SocialIcon platform={s.platform} size={socialIconSize} />
                  {features.showFollowerCounts ? (
                    <span className="text-xs font-bold text-indigo">
                      {formatFollowers(s.followers)}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          ) : (
            <span />
          )}

          {showQr ? (
            <Link
              href={`/c/${creator.slug}`}
              className="relative shrink-0 overflow-hidden rounded-sm border border-border bg-white"
              style={{ width: qrSize, height: qrSize }}
              title="Open Influencer Card"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/qr/${creator.slug}`}
                alt={`${creator.displayName} QR`}
                width={qrSize}
                height={qrSize}
                className="h-full w-full object-contain"
              />
            </Link>
          ) : features.showQr ? (
            <Link
              href={`/c/${creator.slug}`}
              className="flex shrink-0 items-center justify-center rounded-sm border border-dashed border-border text-[8px] font-bold text-muted"
              style={{ width: qrSize, height: qrSize }}
            >
              Card
            </Link>
          ) : null}
        </div>

        {showViewProfile ? (
          <Link
            href={`/creators/${creator.slug}`}
            className="btn-primary mt-1 mb-1 w-full !py-2 text-center text-xs"
          >
            View Profile →
          </Link>
        ) : null}
      </div>

      {features.showStatus && !showViewProfile ? (
        <div className="mt-3 flex items-center justify-center gap-1.5 border-t border-emerald-100 bg-emerald-50/80 px-3 py-2.5 text-[11px] font-semibold text-emerald-700">
          <IconCheck size={13} className="text-emerald-600" />
          {creator.statusLabel}
        </div>
      ) : (
        <div className="mt-3" />
      )}
    </article>
  );
}

/** Horizontal marketing Influencer Card matching the design template. */
export function CompactInfluencerCard({ creator }: { creator: SeedCreator }) {
  const socials = creator.socials.slice(0, 3);
  const stripPlatforms = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "X"] as const;

  function platformLabel(platform: string) {
    if (platform === "INSTAGRAM") return "Instagram";
    if (platform === "TIKTOK") return "TikTok";
    if (platform === "YOUTUBE") return "YouTube";
    if (platform === "X") return "X";
    return platform;
  }

  return (
    <article className="w-full max-w-[480px] overflow-hidden rounded-2xl bg-white shadow-[0_20px_50px_rgba(17,26,90,0.14)] ring-1 ring-[#E4E9F5]">
      {/* Body: left content + QR panel */}
      <div className="flex items-stretch gap-3 p-4 sm:gap-4 sm:p-5">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header: photo | identity + stats */}
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

            <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
              <div>
                <h3 className="flex items-center gap-1.5 font-display text-base font-bold leading-tight text-indigo sm:text-lg">
                  <span className="truncate">{creator.displayName}</span>
                  <IconVerified size={16} className="shrink-0" />
                </h3>
                <p className="mt-0.5 truncate text-xs text-[#7B8499] sm:text-[13px]">
                  {creator.title}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-[#7B8499] sm:text-xs">
                  <IconMapPin size={12} className="shrink-0 text-[#633CFF]" />
                  <span className="truncate">
                    {creator.locationCity}, {creator.locationCountry}
                  </span>
                </p>
              </div>

              {/* Stats with vertical dividers — beside photo under identity */}
              <div className="mt-2.5 flex items-stretch">
                {socials.map((s, i) => (
                  <div key={s.platform} className="flex items-stretch">
                    {i > 0 ? (
                      <span className="mx-3 w-px self-stretch bg-[#DDE3F0] sm:mx-3.5" aria-hidden />
                    ) : null}
                    <div className="flex min-w-0 flex-col">
                      <p className="font-display text-[15px] font-bold leading-none text-indigo sm:text-base">
                        {formatFollowers(s.followers)}
                      </p>
                      <p className="mt-1 whitespace-nowrap text-[10px] font-medium leading-none text-[#8B93A7] sm:text-[11px]">
                        {platformLabel(s.platform)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Specialty tags — under photo + identity */}
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {creator.specialties.slice(0, 4).map((s) => (
              <span
                key={s}
                className="rounded-full bg-[#EAE4FF] px-2.5 py-1 text-[10px] font-semibold text-[#633CFF]"
              >
                {specialtyLabel(s)}
              </span>
            ))}
          </div>
        </div>

        {/* QR panel */}
        <div className="flex w-[108px] shrink-0 flex-col items-center justify-center rounded-xl bg-[#F5F6FA] px-2.5 py-3 sm:w-[120px]">
          <div className="h-[80px] w-[80px] overflow-hidden rounded-md bg-white p-1 sm:h-[88px] sm:w-[88px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/qr/${creator.slug}`}
              alt={`${creator.displayName} QR`}
              width={88}
              height={88}
              className="h-full w-full object-contain"
            />
          </div>
          <p className="mt-2.5 text-center text-[9px] font-semibold leading-snug text-[#8B93A7]">
            Scan to view my
            <br />
            full profile
          </p>
        </div>
      </div>

      {/* Bottom social strip — icons evenly across full card width */}
      <div className="flex w-full items-center justify-between border-t border-[#EEF1FA] bg-white px-5 py-3.5 sm:px-6">
        {stripPlatforms.map((platform) => {
          const linked = creator.socials.find((s) => s.platform === platform);
          const icon = <SocialIcon platform={platform} size={26} />;
          return linked ? (
            <a
              key={platform}
              href={linked.url}
              target="_blank"
              rel="noreferrer"
              className="flex h-7 w-7 shrink-0 items-center justify-center transition hover:scale-110"
              aria-label={platformLabel(platform)}
            >
              {icon}
            </a>
          ) : (
            <span
              key={platform}
              className="flex h-7 w-7 shrink-0 items-center justify-center opacity-35"
              aria-hidden
            >
              {icon}
            </span>
          );
        })}
        <Link
          href={`/c/${creator.slug}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center transition hover:scale-110"
          aria-label="Open Influencer Card link"
        >
          <IconLink size={26} />
        </Link>
      </div>
    </article>
  );
}

export function InfluencerCardView({ creator }: { creator: SeedCreator }) {
  const entitlements = getEntitlements(creator.planTier as PlanCode);
  const specialties = creator.specialties.slice(0, entitlements.specialtiesMax);
  const socials = creator.socials.slice(0, entitlements.socialLinksMax);
  const isPro = creator.planTier === "PRO";
  const isPlus = creator.planTier === "PLUS" || isPro;

  const cardUrl =
    entitlements.shortlink && isPlus
      ? `ic.me/${creator.slug.split("-")[0]}`
      : `influrios.com/c/${creator.slug}`;

  return (
    <div
      className={`mx-auto w-full max-w-sm overflow-hidden rounded-[1.75rem] shadow-2xl ${
        isPro ? "bg-pro text-white ring-1 ring-gold/40" : "bg-white text-indigo"
      }`}
    >
      <div className="relative h-52">
        <Image src={creator.image} alt={creator.displayName} fill className="object-cover" sizes="400px" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <span
          className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold ${
            isPro ? "bg-gold/20 text-[#F6E7B0]" : "bg-white/95 text-violet"
          }`}
        >
          {creator.planTier === "STARTER" ? "Starter" : creator.planTier === "PLUS" ? "Plus" : "Pro"}
        </span>
      </div>
      <div className={`-mt-6 space-y-4 rounded-t-[1.5rem] px-5 pb-6 pt-8 ${isPro ? "bg-pro" : "bg-white"}`}>
        <div className="text-center">
          <h1 className="flex items-center justify-center gap-1.5 font-display text-2xl font-bold">
            {creator.displayName}
            <IconVerified size={20} />
          </h1>
          <p className={`mt-1 text-sm ${isPro ? "text-white/70" : "text-muted"}`}>{creator.title}</p>
          <p className={`mt-1 text-sm ${isPro ? "text-white/70" : "text-muted"}`}>
            {creator.locationCity}, {creator.locationCountry}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {specialties.map((s) => (
            <span
              key={s}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isPro ? "bg-white/10 text-lavender" : "chip"
              }`}
            >
              {specialtyLabel(s)}
            </span>
          ))}
        </div>
        <div className={`rounded-2xl p-3 ${isPro ? "bg-white/5" : "border border-border bg-starter-bg"}`}>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {socials.map((s) => (
              <a
                key={s.platform}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5"
              >
                <SocialIcon platform={s.platform} size={22} />
                <span className={`text-xs font-bold ${isPro ? "text-white" : "text-indigo"}`}>
                  {formatFollowers(s.followers)}
                </span>
              </a>
            ))}
          </div>
        </div>
        <div
          className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-3 text-sm ${
            isPro ? "bg-white/5" : "bg-[#EEF4FF]"
          }`}
        >
          <div className="min-w-0">
            <div className="truncate font-semibold text-blue">{cardUrl}</div>
            <div className={`text-xs ${isPro ? "text-white/50" : "text-muted"}`}>Share my profile</div>
          </div>
          {entitlements.standardQr || entitlements.dynamicQr ? (
            <div
              className={`relative h-[22px] w-[22px] shrink-0 overflow-hidden rounded-sm ${
                isPro ? "ring-1 ring-gold" : "border border-border"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/qr/${creator.slug}`}
                alt={`${creator.displayName} QR code`}
                width={22}
                height={22}
                className="h-full w-full object-contain bg-white"
              />
            </div>
          ) : (
            <div className="text-xs text-muted">No QR on Starter</div>
          )}
        </div>
        <Link
          href={`/creators/${creator.slug}`}
          className={`btn-primary w-full ${isPro ? "ring-1 ring-gold/50" : ""}`}
        >
          {isPro ? "Work With Me →" : isPlus ? "Contact →" : "View Profile →"}
        </Link>
        <p className={`text-center text-xs ${isPro ? "text-white/40" : "text-muted"}`}>Influrios</p>
      </div>
    </div>
  );
}
