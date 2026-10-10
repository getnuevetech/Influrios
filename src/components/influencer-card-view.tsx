import Image from "next/image";
import { actionRecordCardCta } from "@/app/card-cta-actions";
import { IconVerified, SocialIcon } from "@/components/icons";
import {
  formatFollowers,
  specialtyLabel,
  type SeedCreator,
} from "@/lib/seed-data";
import {
  cardChrome,
  cardShellClasses,
  getEntitlements,
  isPlanCode,
  type EntitlementLimits,
} from "@/lib/entitlements";

function planBadge(plan: string) {
  if (plan === "PLUS") return "Plus";
  if (plan === "PRO") return "Pro";
  if (plan === "STARTER") return "Starter";
  return plan;
}

export function InfluencerCardView({
  creator,
  entitlements: entitlementOverride,
  qrDisplay = "default",
  compact = false,
  hideCta = false,
  linkLabel = null,
}: {
  creator: SeedCreator;
  /** Effective entitlements. When omitted, launch defaults for the creator plan are used. */
  entitlements?: EntitlementLimits;
  /** `large` = phone-scannable QR (popup / share). */
  qrDisplay?: "default" | "large";
  /** Tighter layout so the Discover popup fits without an inner scrollbar. */
  compact?: boolean;
  /** Hide primary CTA (used on profile card preview). */
  hideCta?: boolean;
  linkLabel?: string | null;
}) {
  const entitlements =
    entitlementOverride ??
    getEntitlements(isPlanCode(creator.planTier) ? creator.planTier : "STARTER");
  const chrome = cardChrome(entitlements);
  const shell = cardShellClasses(chrome);
  const specialties = creator.specialties.slice(0, entitlements.specialtiesMax);
  const socials = creator.socials.slice(0, entitlements.socialLinksMax);
  const place = [creator.locationCity, creator.locationCountry].map((part) => part.trim()).filter(Boolean).join(", ");
  const elevated = chrome.elevated;
  const canQr = chrome.showQr;
  const largeQr = qrDisplay === "large";
  // Popup QR: 160px = 200px − 20%
  const qrPx = largeQr ? (compact ? 140 : 168) : 22;

  const cardUrl =
    linkLabel ||
    (chrome.showShortlink
      ? `INFLR.me/${creator.slug.split("-")[0]}`
      : `influrios.com/c/${creator.slug}`);

  return (
    <div className={`mx-auto w-full max-w-sm overflow-hidden rounded-[1.75rem] shadow-2xl ${shell.root}`}>
      <div className={`relative ${compact ? "h-40" : "h-48"}`}>
        <Image
          src={creator.image}
          alt={creator.displayName}
          fill
          className="object-cover"
          sizes="400px"
          unoptimized={creator.image.endsWith(".svg") || creator.image.startsWith("data:")}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        {!hideCta ? (
          <span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold ${shell.badge}`}>
            {planBadge(creator.planTier)}
          </span>
        ) : null}
      </div>
      <div
        className={`-mt-6 rounded-t-[1.5rem] ${shell.panel} ${
          compact ? "space-y-2.5 px-4 pb-4 pt-6" : "space-y-3.5 px-5 pb-5 pt-7"
        }`}
      >
        <div className="text-center">
          <h1
            className={`flex items-center justify-center gap-1.5 font-display font-bold ${
              compact ? "text-xl" : "text-[1.35rem]"
            }`}
          >
            {creator.displayName}
            {creator.verified ? <IconVerified size={compact ? 18 : 20} /> : null}
          </h1>
          {creator.title?.trim() ? (
            <p className={`mt-0.5 text-sm ${shell.muted}`}>{creator.title}</p>
          ) : null}
          {place ? <p className={`text-sm ${shell.muted}`}>{place}</p> : null}
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {specialties.map((s) => (
            <span key={s} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${shell.chip}`}>
              {specialtyLabel(s)}
            </span>
          ))}
        </div>

        {largeQr && canQr ? (
          <div
            className={`flex flex-col items-center rounded-2xl ${
              compact ? "gap-2 px-3 py-3" : "gap-2.5 px-3 py-4"
            } ${shell.panelSoft}`}
          >
            <div
              className={`relative overflow-hidden bg-white shadow-sm ${
                compact ? "rounded-xl p-2" : "rounded-2xl p-2.5"
              } ${shell.qrRing}`}
              style={{ width: qrPx + (compact ? 16 : 20), height: qrPx + (compact ? 16 : 20) }}
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
            <div className="min-w-0 text-center">
              <div className={`text-[11px] font-semibold ${shell.mutedSoft}`}>Scan to view my full card</div>
              <div className="truncate text-sm font-semibold text-blue">
                {elevated ? <span className="text-[#B8D4FF]">{cardUrl}</span> : cardUrl}
              </div>
            </div>
          </div>
        ) : (
          <div className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-3 text-sm ${shell.panelSoft}`}>
            <div className="min-w-0">
              <div className={`truncate font-semibold ${elevated ? "text-[#B8D4FF]" : "text-blue"}`}>{cardUrl}</div>
              <div className={`text-xs ${shell.mutedSoft}`}>Share my profile</div>
            </div>
            {canQr ? (
              <div className={`relative h-[22px] w-[22px] shrink-0 overflow-hidden rounded-sm ${shell.qrMini}`}>
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
              <div className={`text-xs ${shell.mutedSoft}`}>QR not included</div>
            )}
          </div>
        )}

        <div className={`rounded-2xl ${compact ? "p-2" : "p-3"} ${shell.panelBordered}`}>
          <p
            className={`mb-2 text-center text-[10px] font-bold uppercase tracking-wide ${shell.mutedSoft}`}
          >
            Connect with me
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {socials.map((s) => (
              <a
                key={s.platform}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5"
              >
                <SocialIcon platform={s.platform} size={compact ? 18 : 20} />
                {!hideCta && s.followers > 0 ? (
                  <span className={`text-xs font-bold ${elevated ? "text-white" : "text-indigo"}`}>
                    {formatFollowers(s.followers)}
                  </span>
                ) : null}
              </a>
            ))}
          </div>
        </div>

        {!hideCta ? (
          <>
            <form action={actionRecordCardCta} className="w-full">
              <input type="hidden" name="slug" value={creator.slug} />
              <button
                type="submit"
                className={`btn-primary w-full ${compact ? "!py-2.5 text-sm" : ""} ${shell.ctaRing}`}
              >
                {chrome.ctaLabel}
              </button>
            </form>
            <p className={`text-center text-xs ${shell.mutedFaint}`}>Influrios</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
