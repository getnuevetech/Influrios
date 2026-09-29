import Image from "next/image";
import Link from "next/link";
import { actionAddShortlist } from "@/app/business/actions";
import {
  formatFollowers,
  specialtyLabel,
  totalFollowers,
  type SeedCreator,
} from "@/lib/seed-data";
import { getEntitlements, type PlanCode } from "@/lib/entitlements";

export function CreatorCard({ creator }: { creator: SeedCreator }) {
  const socialPreview = creator.socials.slice(0, 3);

  return (
    <article className="card-surface group flex flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative h-56 overflow-hidden">
        <Image
          src={creator.image}
          alt={creator.displayName}
          fill
          className="object-cover transition duration-500 group-hover:scale-105"
          sizes="(max-width:768px) 100vw, 25vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-indigo/70 via-transparent to-transparent" />
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-violet shadow">
          {creator.badge}
        </span>
        <form action={actionAddShortlist} className="absolute right-3 top-3">
          <input type="hidden" name="slug" value={creator.slug} />
          <input type="hidden" name="note" value="Saved from Discover" />
          <button
            type="submit"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-violet"
            aria-label="Add to business shortlist"
            title="Add to shortlist"
          >
            ♡
          </button>
        </form>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-display text-lg font-bold text-indigo">
            {creator.displayName}{" "}
            <span className="text-blue" aria-label="Verified">
              ✓
            </span>
          </h3>
          <p className="text-sm text-muted">
            {creator.locationCity}, {creator.locationCountry}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {creator.specialties.slice(0, 3).map((s) => (
            <span key={s} className="chip">
              {specialtyLabel(s)}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-muted">
          <div className="flex flex-wrap gap-2">
            {socialPreview.map((s) => (
              <span key={s.platform}>
                {s.platform.slice(0, 2)} {formatFollowers(s.followers)}
              </span>
            ))}
          </div>
          <span className="text-indigo">{formatFollowers(totalFollowers(creator))}</span>
        </div>
        <p className="line-clamp-2 text-sm text-muted">{creator.bio}</p>
        <div className="mt-auto flex items-center gap-2 pt-1">
          <Link href={`/creators/${creator.slug}`} className="btn-primary flex-1 !py-2.5 text-sm">
            View Profile →
          </Link>
          <Link
            href={`/c/${creator.slug}`}
            className="btn-secondary !px-3 !py-2.5 text-xs"
            title="Influencer Card"
          >
            QR
          </Link>
        </div>
        <p className="text-center text-xs font-semibold text-violet">{creator.statusLabel}</p>
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
