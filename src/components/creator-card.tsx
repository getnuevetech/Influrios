import Link from "next/link";
import {
  formatFollowers,
  specialtyLabel,
  type SeedCreator,
} from "@/lib/seed-data";
import { getEntitlements, type PlanCode } from "@/lib/entitlements";

export function CreatorCard({ creator }: { creator: SeedCreator }) {
  const primary = creator.specialties[0];
  const socialPreview = creator.socials.slice(0, 3);
  const totalFollowers = creator.socials.reduce((sum, s) => sum + s.followers, 0);

  return (
    <article className="card-surface flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div
        className="relative flex h-36 items-end p-4 text-white"
        style={{
          background: `linear-gradient(135deg, ${creator.avatarColor}, #111a5a)`,
        }}
      >
        <span className="absolute left-3 top-3 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold backdrop-blur">
          {creator.planTier === "STARTER" ? "Starter" : creator.planTier === "PLUS" ? "Plus" : "Pro"}
        </span>
        <div>
          <h3 className="font-display text-lg font-bold">{creator.displayName}</h3>
          <p className="text-sm text-white/80">{creator.locationCity}, {creator.locationCountry}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-sm font-medium text-muted">{creator.title}</p>
        <div className="flex flex-wrap gap-2">
          {creator.specialties.slice(0, 3).map((s) => (
            <span key={s} className="chip">
              {specialtyLabel(s)}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-semibold text-muted">
          {socialPreview.map((s) => (
            <span key={s.platform}>
              {s.platform.slice(0, 2)} {formatFollowers(s.followers)}
            </span>
          ))}
          <span className="text-indigo">{formatFollowers(totalFollowers)} total</span>
        </div>
        <p className="line-clamp-2 text-sm text-muted">{creator.bio}</p>
        <div className="mt-auto flex gap-2 pt-2">
          <Link href={`/creators/${creator.slug}`} className="btn-primary flex-1 !py-2 text-sm">
            View Profile
          </Link>
          <Link
            href={`/c/${creator.slug}`}
            className="btn-secondary !px-3 !py-2 text-sm"
            aria-label="Open Influencer Card"
          >
            Card
          </Link>
        </div>
        {primary ? (
          <p className="text-xs text-muted">Specialty focus: {specialtyLabel(primary)}</p>
        ) : null}
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
      <div
        className="relative h-52"
        style={{
          background: isPro
            ? `linear-gradient(160deg, #0b123f, ${creator.avatarColor})`
            : `linear-gradient(160deg, ${creator.avatarColor}, #2979ff)`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
        <span
          className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold ${
            isPro ? "bg-gold/20 text-gold-highlight text-[#F6E7B0]" : "bg-white/90 text-violet"
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
        <div className={`space-y-2 rounded-2xl p-3 ${isPro ? "bg-white/5" : "bg-starter-bg border border-border"}`}>
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
              <span className="font-medium">{s.platform}</span>
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
            <div className={`truncate font-semibold ${isPro ? "text-blue" : "text-blue"}`}>{cardUrl}</div>
            <div className={`text-xs ${isPro ? "text-white/50" : "text-muted"}`}>Share my profile</div>
          </div>
          {entitlements.standardQr || entitlements.dynamicQr ? (
            <div
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
                isPro ? "bg-white text-pro ring-2 ring-gold" : "bg-white text-indigo border border-border"
              }`}
              aria-label={entitlements.dynamicQr ? "Dynamic QR code" : "Standard QR code"}
            >
              QR
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
        {entitlements.platformBranding !== "minimal" ? (
          <p className={`text-center text-xs ${isPro ? "text-white/40" : "text-muted"}`}>Influrios</p>
        ) : (
          <p className="text-center text-[10px] text-white/30">Influrios</p>
        )}
      </div>
    </div>
  );
}
