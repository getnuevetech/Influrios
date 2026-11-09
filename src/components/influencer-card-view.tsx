import { actionRecordCardCta } from "@/app/card-cta-actions";
import { IconMapPin, SocialIcon } from "@/components/icons";
import {
  cardChrome,
  EMPTY_ENTITLEMENTS,
  getEntitlements,
  isPlanCode,
  type EntitlementLimits,
} from "@/lib/entitlements";
import { normalizeBrandAvatar } from "@/lib/profile-media";
import { specialtyLabel, type SeedCreator } from "@/lib/seed-data";

const TILE_LABEL: Record<string, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  X: "X",
  FACEBOOK: "Facebook",
  LINKEDIN: "LinkedIn",
  PINTEREST: "Pinterest",
  WEBSITE: "Website",
};

export function InfluencerCardView({
  creator,
  entitlements: entitlementOverride,
  qrDisplay = "default",
  compact = false,
  hideCta = false,
  linkLabel = null,
}: {
  creator: SeedCreator;
  entitlements?: EntitlementLimits;
  qrDisplay?: "default" | "large";
  compact?: boolean;
  hideCta?: boolean;
  linkLabel?: string | null;
}) {
  const entitlements =
    entitlementOverride ??
    (isPlanCode(creator.planTier) ? getEntitlements(creator.planTier) : EMPTY_ENTITLEMENTS);
  const chrome = cardChrome(entitlements);
  const specialties = creator.specialties.slice(0, entitlements.specialtiesMax);
  const socials = creator.socials.slice(0, Math.min(entitlements.socialLinksMax, 4));
  const place = [creator.locationCity, creator.locationState, creator.locationCountry]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(", ");
  const rawHandle = (socials[0]?.handle || creator.slug.split("-")[0] || creator.slug).replace(/^@/, "");
  const handle = rawHandle ? `@${rawHandle}` : "";
  const imageSrc = normalizeBrandAvatar(creator.image, creator.gender);
  const showQr = chrome.showQr;
  const qrPx = qrDisplay === "large" ? (compact ? 132 : 168) : compact ? 112 : 148;
  const cardUrl =
    linkLabel ||
    (chrome.showShortlink ? `INFLR.me/${creator.slug.split("-")[0]}` : `influrios.com/c/${creator.slug}`);

  return (
    <div className="mx-auto w-full max-w-[340px]">
      <article
        className={`relative overflow-hidden text-white shadow-[0_24px_60px_rgba(20,10,80,0.35)] ${
          compact ? "rounded-[28px] px-4 pb-4 pt-4" : "rounded-[32px] px-5 pb-5 pt-5"
        }`}
        style={{
          background:
            "radial-gradient(120% 80% at 100% 0%, rgba(120,80,255,0.55), transparent 46%), radial-gradient(90% 70% at 0% 100%, rgba(70,40,180,0.45), transparent 50%), linear-gradient(165deg, #2a1b78 0%, #1a1468 42%, #120e4a 100%)",
        }}
      >
        <div className="pointer-events-none absolute -right-8 top-10 h-40 w-40 rounded-full bg-[#7c5cff]/30 blur-2xl" />
        <div className="pointer-events-none absolute -left-10 bottom-16 h-32 w-32 rounded-full bg-[#3d2aff]/30 blur-2xl" />
        <div className="relative flex items-center justify-center gap-2 text-sm font-semibold tracking-wide">
          <span aria-hidden className="text-lg leading-none">
            ∞
          </span>
          Influrios
        </div>
        <div className={`relative mx-auto ${compact ? "mt-3 h-[92px] w-[92px]" : "mt-4 h-[112px] w-[112px]"}`}>
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: "conic-gradient(from 210deg, #ff4fd8, #8a5cff, #5b8cff, #ff4fd8)" }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt={creator.displayName}
            className="absolute inset-[3px] h-[calc(100%-6px)] w-[calc(100%-6px)] rounded-full object-cover"
          />
          {creator.verified ? (
            <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#3d7bff] text-[10px] font-bold ring-2 ring-[#1a1468]">
              ✓
            </span>
          ) : null}
        </div>
        <h2 className={`relative text-center font-display font-bold ${compact ? "mt-3 text-[1.55rem]" : "mt-4 text-[1.85rem]"}`}>
          {creator.displayName}
        </h2>
        {handle ? <p className="relative text-center text-sm text-white/80">{handle}</p> : null}
        {specialties.length ? (
          <p className="relative mt-2 text-center text-[13px] text-white/75">
            {specialties.map((item) => specialtyLabel(item)).join(" · ")}
          </p>
        ) : null}
        {place ? (
          <p className="relative mt-1.5 flex items-center justify-center gap-1 text-[13px] text-white/75">
            <IconMapPin size={13} />
            {place}
          </p>
        ) : null}
        {socials.length ? (
          <div className={`relative grid gap-2 ${compact ? "mt-3" : "mt-4"}`} style={{ gridTemplateColumns: `repeat(${socials.length}, minmax(0, 1fr))` }}>
            {socials.map((social) => (
              <a
                key={social.platform}
                href={social.url || "#"}
                target={social.url ? "_blank" : undefined}
                rel="noreferrer"
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/15 bg-white/10 px-1 py-2.5 text-[10px] font-medium text-white/90"
              >
                <SocialIcon platform={social.platform} size={18} />
                {TILE_LABEL[social.platform] ?? social.platform}
                <span className="text-[9px] font-semibold uppercase tracking-wide text-white/70">
                  {social.source === "PROVIDER_SYNCED" || social.source === "PLATFORM_VERIFIED" ? "Verified" : "Unverified"}
                </span>
              </a>
            ))}
          </div>
        ) : null}
        {showQr ? (
          <div className={`relative mx-auto flex items-center justify-center rounded-2xl bg-white ${compact ? "mt-3 p-2" : "mt-4 p-3"}`} style={{ width: qrPx + 24 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/qr/${creator.slug}?size=512&logo=1&v=2`}
              alt={`${creator.displayName} Influrios QR code`}
              width={qrPx}
              height={qrPx}
              className="h-auto w-full"
            />
          </div>
        ) : null}
        <div className="relative mt-4 flex items-center gap-3 text-[11px] font-semibold tracking-[0.14em] text-white/80">
          <span className="h-px flex-1 bg-white/25" />
          {cardUrl}
          <span className="h-px flex-1 bg-white/25" />
        </div>
      </article>
      {!hideCta ? (
        <form action={actionRecordCardCta} className="mt-3">
          <input type="hidden" name="slug" value={creator.slug} />
          <button type="submit" className="btn-primary w-full">
            {chrome.ctaLabel}
          </button>
        </form>
      ) : null}
    </div>
  );
}
