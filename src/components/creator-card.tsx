import Image from "next/image";
import Link from "next/link";
import {
  IconCheck,
  IconLink,
  IconMapPin,
  IconVerified,
  SocialIcon,
} from "@/components/icons";
import { CreatorCardQrButton } from "@/components/creator-card-qr-button";
import { ShortlistHeartButton } from "@/components/shortlist-heart-button";
import type { CardFeatureFlags } from "@/lib/cms";
import {
  formatFollowers,
  platformDisplayName,
  specialtyLabel,
  type SeedCreator,
} from "@/lib/seed-data";
import { cardChrome } from "@/lib/entitlements";
import { entitlementsForPlan } from "@/lib/entitlements-db";

const BADGE_STYLES: Record<string, string> = {
  "Top Influencer": "bg-[#2979FF] text-white",
  "Top Creator": "bg-[#2979FF] text-white", // legacy badge key
  "Rising Star": "bg-[#E879F9] text-white",
  "Business Friendly": "bg-emerald-500 text-white",
  "Fast Growing": "bg-[#633CFF] text-white",
  "High Engagement": "bg-[#633CFF] text-white",
};

const DISCOVER_BADGES: Record<string, { label: string; className: string }> = {
  "Top Influencer": { label: "Top Match", className: "bg-[#2979FF] text-white" },
  "Top Creator": { label: "Top Match", className: "bg-[#2979FF] text-white" }, // legacy badge key
  "Rising Star": { label: "Rising Star", className: "bg-[#E879F9] text-white" },
  "Business Friendly": { label: "Brand Friendly", className: "bg-[#7C4DFF] text-white" },
  "Fast Growing": { label: "Fast Growing", className: "bg-[#14B8A6] text-white" },
  "High Engagement": { label: "High Engagement", className: "bg-[#F97316] text-white" },
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
  /**
   * When true, QR opens the Influencer Card as a popup.
   * View Profile CTA still navigates to the full profile page.
   */
  qrOpensPopup?: boolean;
  /** Discover template: badge names, bio, and View Profile beside the QR. */
  layout?: "grid" | "discover";
};

export async function CreatorCard({
  creator,
  widthPx,
  socialIconSize = 22,
  qrSize = 22,
  features: featureOverrides,
  showTitle = false,
  showBio = false,
  showViewProfile = false,
  qrOpensPopup = false,
  layout = "grid",
}: CreatorCardProps) {
  const discover = layout === "discover";
  const features = { ...DEFAULT_FEATURES, ...featureOverrides };
  const entitlements = await entitlementsForPlan(creator.planTier);
  const canQr = cardChrome(entitlements).showQr;
  const showQr = features.showQr && canQr;
  const discoverBadge = DISCOVER_BADGES[creator.badge];
  const badgeClass = discover
    ? (discoverBadge?.className ?? "bg-[#633CFF] text-white")
    : (BADGE_STYLES[creator.badge] ?? "bg-white text-violet");
  const badgeLabel = discover ? (discoverBadge?.label ?? creator.badge) : creator.badge;

  const socials = creator.socials.filter((s) =>
    features.visiblePlatforms.length
      ? features.visiblePlatforms.includes(s.platform)
      : true,
  ).slice(0, entitlements.socialLinksMax);

  return (
    <article
      style={widthPx ? { width: widthPx, minWidth: widthPx } : undefined}
      className={`group flex ${widthPx ? "shrink-0" : "w-full"} flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-[0_12px_32px_rgba(17,26,90,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-xl`}
    >
      <div className={`relative overflow-hidden ${discover ? "h-48 sm:h-52" : "h-52"}`}>
        <Image
          src={creator.image}
          alt={creator.displayName}
          fill
          className="object-cover transition duration-500 group-hover:scale-105"
          sizes={widthPx ? `${widthPx}px` : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-indigo/55 via-transparent to-transparent" />
        {features.showBadge && badgeLabel.trim() ? (
          <span
            className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold shadow ${badgeClass}`}
          >
            {badgeLabel}
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
            {features.showVerified && creator.verified === true ? (
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
            {creator.specialties.slice(0, Math.min(3, entitlements.specialtiesMax)).map((s) => (
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
                  {features.showFollowerCounts && s.followers > 0 ? (
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

          {discover ? null : features.showQr && qrOpensPopup ? (
            <CreatorCardQrButton
              creator={creator}
              entitlements={entitlements}
              qrSize={qrSize}
              hasQr={showQr}
            />
          ) : showQr ? (
            <Link
              href={`/c/${creator.slug}`}
              className="relative shrink-0 overflow-hidden rounded-sm border border-border bg-white"
              style={{ width: qrSize, height: qrSize }}
              title="Open Influencer Card"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/qr/${creator.slug}?size=${Math.max(64, qrSize * 3)}&logo=0`}
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
          <div className={`mt-1 flex items-center gap-2 ${discover ? "pb-3" : "mb-1"}`}>
            <Link
              href={`/creators/${creator.slug}`}
              className="btn-primary min-w-0 flex-1 !py-2 text-center text-xs"
            >
              View Profile →
            </Link>
            {discover && features.showQr && qrOpensPopup ? (
              <CreatorCardQrButton
                creator={creator}
                entitlements={entitlements}
                qrSize={36}
                hasQr={showQr}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {features.showStatus && !showViewProfile && creator.statusLabel.trim() ? (
        <div
          className={`mt-3 flex items-center justify-center gap-1.5 border-t px-3 py-2.5 text-[11px] font-semibold ${
            creator.openToCollab
              ? "border-emerald-100 bg-emerald-50/80 text-emerald-700"
              : "border-border bg-[#F4F7FF] text-muted"
          }`}
        >
          {creator.openToCollab ? <IconCheck size={13} className="text-emerald-600" /> : null}
          {creator.statusLabel}
        </div>
      ) : (
        <div className="mt-3" />
      )}
    </article>
  );
}

/** Horizontal marketing Influencer Card matching the design template. */
export async function CompactInfluencerCard({ creator }: { creator: SeedCreator }) {
  const entitlements = await entitlementsForPlan(creator.planTier);
  const chrome = cardChrome(entitlements);
  const socials = creator.socials.slice(0, entitlements.socialLinksMax);
  const allowedPlatforms = new Set(socials.map((s) => s.platform));
  const stripPlatforms = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "X"] as const;

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
                        {s.followers > 0 ? formatFollowers(s.followers) : "—"}
                      </p>
                      <p className="mt-1 whitespace-nowrap text-[10px] font-medium leading-none text-[#8B93A7] sm:text-[11px]">
                        {platformDisplayName(s.platform)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Specialty tags — under photo + identity */}
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {creator.specialties.slice(0, entitlements.specialtiesMax).map((s) => (
              <span
                key={s}
                className="rounded-full bg-[#EAE4FF] px-2.5 py-1 text-[10px] font-semibold text-[#633CFF]"
              >
                {specialtyLabel(s)}
              </span>
            ))}
          </div>
        </div>

        {chrome.showQr ? (
        <div className="flex w-[108px] shrink-0 flex-col items-center justify-center rounded-xl bg-[#F5F6FA] px-2.5 py-3 sm:w-[120px]">
          <div className="h-[80px] w-[80px] overflow-hidden rounded-md bg-white p-1 sm:h-[88px] sm:w-[88px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/qr/${creator.slug}?size=256&logo=1`}
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
        ) : null}
      </div>

      {/* Bottom social strip — icons evenly across full card width */}
      <div className="flex w-full items-center justify-between border-t border-[#EEF1FA] bg-white px-5 py-3.5 sm:px-6">
        {stripPlatforms.map((platform) => {
          const linked = allowedPlatforms.has(platform)
            ? creator.socials.find((s) => s.platform === platform)
            : undefined;
          const icon = <SocialIcon platform={platform} size={26} />;
          return linked ? (
            <a
              key={platform}
              href={linked.url}
              target="_blank"
              rel="noreferrer"
              className="flex h-7 w-7 shrink-0 items-center justify-center transition hover:scale-110"
              aria-label={platformDisplayName(platform)}
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

export { InfluencerCardView } from "@/components/influencer-card-view";
