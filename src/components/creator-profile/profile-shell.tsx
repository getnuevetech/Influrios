import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CreatorProfileTabs } from "@/components/creator-profile/profile-tabs";
import { BRAND_AVATARS, resolveDisplayBanner } from "@/lib/profile-media";
import type { ClaimDraft } from "@/lib/claim";

export function ProfileFlash({
  params,
}: {
  params: {
    published?: string;
    saved?: string;
    error?: string;
    social?: string;
  };
}) {
  return (
    <>
      {params.published ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Published! Your Starter card is live.
        </div>
      ) : null}
      {params.saved === "1" || params.saved === "optin" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Profile saved.
        </div>
      ) : null}
      {params.saved === "facets" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Content style and commercial mode saved.
        </div>
      ) : null}
      {params.saved === "notes" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Offer and need saved.
        </div>
      ) : null}
      {params.saved === "destination" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Short-link destination updated. The printed QR is unchanged.
        </div>
      ) : null}
      {params.saved === "schedule" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Destination schedule updated. The QR and NFC tokens stay the same.
        </div>
      ) : null}
      {params.saved === "campaign" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Campaign link updated.
        </div>
      ) : null}
      {params.social === "connected" || params.social === "synced" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          The network returned a follower count and likes.
        </div>
      ) : null}
      {params.social === "disconnected" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Disconnected. Further sync has stopped.
        </div>
      ) : null}
      {params.error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {params.error}
        </div>
      ) : null}
    </>
  );
}

export function CreatorProfileShell({
  draft,
  score,
  title,
  subtitle,
  children,
  flash,
}: {
  draft: ClaimDraft;
  score: number;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  flash?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[90rem] space-y-6 px-4 py-8 sm:px-6 lg:px-10">
      <header className="overflow-hidden rounded-3xl border border-[#E4EBFF] bg-white shadow-[0_12px_40px_rgba(17,26,90,0.06)]">
        <div className="relative h-28 w-full bg-[linear-gradient(120deg,#EEF2FF_0%,#F6F0FF_55%,#E8F1FF_100%)] sm:h-36">
          <Image
            src={resolveDisplayBanner({ seed: draft.slug, coverImage: draft.coverImage })}
            alt=""
            fill
            className="object-cover"
            sizes="1200px"
            unoptimized={draft.coverImage?.endsWith(".svg")}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent" />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4 px-5 pb-5 pt-0 sm:px-7">
          <div className="flex items-end gap-4">
            <span className="relative -mt-10 h-20 w-20 overflow-hidden rounded-full ring-4 ring-white sm:h-24 sm:w-24">
              <Image
                src={draft.image || BRAND_AVATARS.unspecified}
                alt=""
                fill
                className="object-cover"
                sizes="96px"
                unoptimized={draft.image?.endsWith(".svg")}
              />
            </span>
            <div className="min-w-0 pb-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet">My profile</p>
              <h1 className="font-display text-2xl font-bold text-indigo sm:text-3xl">
                {title ?? (draft.displayName || "Creator profile")}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {subtitle ?? (
                  <>
                    Completeness and next actions for your Influencer Card.{" "}
                    <Link href="/dashboard/kyc" className="font-semibold text-violet hover:underline">
                      Identity KYC
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-[#EEE8FF] px-5 py-3 text-center">
            <p className="font-display text-3xl font-bold text-violet">{score}%</p>
            <p className="text-[11px] font-semibold text-indigo">Profile completeness</p>
          </div>
        </div>
        <div className="border-t border-[#EEF2FF] px-3 py-3 sm:px-5">
          <CreatorProfileTabs />
        </div>
      </header>

      {flash}

      {children}
    </div>
  );
}
