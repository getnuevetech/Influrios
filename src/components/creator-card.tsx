import Image from "next/image";
import Link from "next/link";
import { actionAddShortlist } from "@/app/business/actions";
import {
  IconCheck,
  IconHeart,
  IconMapPin,
  IconVerified,
  SocialIcon,
} from "@/components/icons";
import {
  formatFollowers,
  specialtyLabel,
  totalFollowers,
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

export function CreatorCard({ creator }: { creator: SeedCreator }) {
  const socialPreview = creator.socials.slice(0, 3);
  const entitlements = getEntitlements(creator.planTier as PlanCode);
  const showQr = entitlements.standardQr || entitlements.dynamicQr;
  const badgeClass = BADGE_STYLES[creator.badge] ?? "bg-white text-violet";

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-[0_12px_32px_rgba(17,26,90,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative h-52 overflow-hidden">
        <Image
          src={creator.image}
          alt={creator.displayName}
          fill
          className="object-cover transition duration-500 group-hover:scale-105"
          sizes="(max-width:768px) 100vw, 20vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-indigo/55 via-transparent to-transparent" />
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold shadow ${badgeClass}`}
        >
          {creator.badge}
        </span>
        <form action={actionAddShortlist} className="absolute right-3 top-3">
          <input type="hidden" name="slug" value={creator.slug} />
          <input type="hidden" name="note" value="Saved from Discover" />
          <button
            type="submit"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-violet shadow"
            aria-label="Add to business shortlist"
            title="Add to shortlist"
          >
            <IconHeart size={15} />
          </button>
        </form>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 px-3.5 pb-0 pt-3.5">
        <div>
          <h3 className="flex items-center gap-1 font-display text-[15px] font-bold text-indigo">
            <Link href={`/creators/${creator.slug}`} className="hover:underline">
              {creator.displayName}
            </Link>
            <IconVerified className="text-blue" size={15} />
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
            <IconMapPin size={12} className="shrink-0 text-violet" />
            {creator.locationCity}, {creator.locationCountry}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {creator.specialties.slice(0, 3).map((s) => (
            <span key={s} className="rounded-full bg-lavender px-2 py-0.5 text-[10px] font-semibold text-violet">
              {specialtyLabel(s)}
            </span>
          ))}
        </div>

        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-muted">
              {socialPreview.map((s) => (
                <SocialIcon key={s.platform} platform={s.platform} size={14} className="text-indigo/80" />
              ))}
            </div>
            <p className="mt-1 font-display text-lg font-bold leading-none text-indigo">
              {formatFollowers(totalFollowers(creator))}
            </p>
          </div>
          {showQr ? (
            <Link
              href={`/c/${creator.slug}`}
              className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-white p-0.5"
              title="Open Influencer Card"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/qr/${creator.slug}`}
                alt={`${creator.displayName} QR`}
                width={56}
                height={56}
                className="h-full w-full object-contain"
              />
            </Link>
          ) : (
            <Link
              href={`/c/${creator.slug}`}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-[9px] font-bold text-muted"
            >
              Card
            </Link>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-1.5 border-t border-emerald-100 bg-emerald-50/80 px-3 py-2.5 text-[11px] font-semibold text-emerald-700">
        <IconCheck size={13} className="text-emerald-600" />
        {creator.statusLabel}
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
          <h1 className="font-display text-2xl font-bold">{creator.displayName}</h1>
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
        <div className={`space-y-2 rounded-2xl p-3 ${isPro ? "bg-white/5" : "border border-border bg-starter-bg"}`}>
          {socials.map((s) => (
            <a
              key={s.platform}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                isPro ? "hover:bg-white/10" : "bg-white hover:bg-lavender/40"
              }`}
            >
              <span className="flex items-center gap-2 font-medium">
                <SocialIcon platform={s.platform} size={16} />
                {s.platform === "INSTAGRAM"
                  ? "Instagram"
                  : s.platform === "TIKTOK"
                    ? "TikTok"
                    : s.platform === "YOUTUBE"
                      ? "YouTube"
                      : s.platform}
              </span>
              <span className="font-bold">{formatFollowers(s.followers)}</span>
            </a>
          ))}
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
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg ${
                isPro ? "ring-2 ring-gold" : "border border-border"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/qr/${creator.slug}`}
                alt={`${creator.displayName} QR code`}
                width={64}
                height={64}
                className="h-full w-full object-contain bg-white p-0.5"
              />
              {isPro ? (
                <span className="absolute bottom-0 left-0 right-0 bg-gold/90 text-center text-[8px] font-bold text-pro">
                  DYNAMIC
                </span>
              ) : null}
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
