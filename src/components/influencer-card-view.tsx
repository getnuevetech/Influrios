import Image from "next/image";
import Link from "next/link";
import { IconVerified, SocialIcon } from "@/components/icons";
import {
  formatFollowers,
  specialtyLabel,
  type SeedCreator,
} from "@/lib/seed-data";
import { getEntitlements, type PlanCode } from "@/lib/entitlements";

export function InfluencerCardView({
  creator,
  qrDisplay = "default",
  compact = false,
}: {
  creator: SeedCreator;
  /** `large` = phone-scannable QR (popup / share). */
  qrDisplay?: "default" | "large";
  /** Tighter layout so the Discover popup fits without an inner scrollbar. */
  compact?: boolean;
}) {
  const entitlements = getEntitlements(creator.planTier as PlanCode);
  const specialties = creator.specialties.slice(0, entitlements.specialtiesMax);
  const socials = creator.socials.slice(0, entitlements.socialLinksMax);
  const isPro = creator.planTier === "PRO";
  const isPlus = creator.planTier === "PLUS" || isPro;
  const canQr = entitlements.standardQr || entitlements.dynamicQr;
  const largeQr = qrDisplay === "large";
  // Popup QR: 160px = 200px − 20%
  const qrPx = largeQr ? (compact ? 160 : 200) : 22;

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
      <div className={`relative ${compact ? "h-40" : "h-52"}`}>
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
      <div
        className={`-mt-6 rounded-t-[1.5rem] ${isPro ? "bg-pro" : "bg-white"} ${
          compact ? "space-y-2.5 px-4 pb-4 pt-6" : "space-y-4 px-5 pb-6 pt-8"
        }`}
      >
        <div className="text-center">
          <h1
            className={`flex items-center justify-center gap-1.5 font-display font-bold ${
              compact ? "text-xl" : "text-2xl"
            }`}
          >
            {creator.displayName}
            <IconVerified size={compact ? 18 : 20} />
          </h1>
          <p className={`mt-0.5 text-sm ${isPro ? "text-white/70" : "text-muted"}`}>{creator.title}</p>
          <p className={`text-sm ${isPro ? "text-white/70" : "text-muted"}`}>
            {creator.locationCity}, {creator.locationCountry}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {specialties.map((s) => (
            <span
              key={s}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                isPro ? "bg-white/10 text-lavender" : "chip"
              }`}
            >
              {specialtyLabel(s)}
            </span>
          ))}
        </div>
        <div
          className={`rounded-2xl ${compact ? "p-2" : "p-3"} ${
            isPro ? "bg-white/5" : "border border-border bg-starter-bg"
          }`}
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            {socials.map((s) => (
              <a
                key={s.platform}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5"
              >
                <SocialIcon platform={s.platform} size={compact ? 18 : 22} />
                <span className={`text-xs font-bold ${isPro ? "text-white" : "text-indigo"}`}>
                  {formatFollowers(s.followers)}
                </span>
              </a>
            ))}
          </div>
        </div>

        {largeQr && canQr ? (
          <div
            className={`flex flex-col items-center rounded-2xl ${
              compact ? "gap-2 px-3 py-3" : "gap-3 px-4 py-5"
            } ${isPro ? "bg-white/5" : "bg-[#EEF4FF]"}`}
          >
            <div className="min-w-0 text-center">
              <div className="truncate text-sm font-semibold text-blue">{cardUrl}</div>
              <div className={`text-[11px] ${isPro ? "text-white/50" : "text-muted"}`}>
                Scan to view my full card
              </div>
            </div>
            <div
              className={`relative overflow-hidden bg-white shadow-sm ${
                compact ? "rounded-xl p-2" : "rounded-2xl p-3"
              } ${isPro ? "ring-1 ring-gold/50" : "ring-1 ring-border"}`}
              style={{ width: qrPx + (compact ? 16 : 24), height: qrPx + (compact ? 16 : 24) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/qr/${creator.slug}?size=512&logo=1&v=2`}
                alt={`${creator.displayName} Influrios QR code`}
                width={qrPx}
                height={qrPx}
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        ) : (
          <div
            className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-3 text-sm ${
              isPro ? "bg-white/5" : "bg-[#EEF4FF]"
            }`}
          >
            <div className="min-w-0">
              <div className="truncate font-semibold text-blue">{cardUrl}</div>
              <div className={`text-xs ${isPro ? "text-white/50" : "text-muted"}`}>Share my profile</div>
            </div>
            {canQr ? (
              <div
                className={`relative h-[22px] w-[22px] shrink-0 overflow-hidden rounded-sm ${
                  isPro ? "ring-1 ring-gold" : "border border-border"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/qr/${creator.slug}?size=64&logo=0`}
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
        )}

        <Link
          href={`/creators/${creator.slug}`}
          className={`btn-primary w-full ${compact ? "!py-2.5 text-sm" : ""} ${
            isPro ? "ring-1 ring-gold/50" : ""
          }`}
        >
          {isPro ? "Work With Me →" : isPlus ? "Contact →" : "View Profile →"}
        </Link>
        <p className={`text-center text-xs ${isPro ? "text-white/40" : "text-muted"}`}>Influrios</p>
      </div>
    </div>
  );
}
