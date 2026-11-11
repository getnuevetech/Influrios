import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CompletenessRing } from "@/components/creator-profile/completeness-ring";
import { CopyHandle } from "@/components/creator-profile/copy-handle";
import { CreatorProfileTabs } from "@/components/creator-profile/profile-tabs";
import { IconCheck, IconMapPin, IconShare, IconVerified } from "@/components/icons";
import type { ClaimDraft } from "@/lib/claim";
import { BRAND_AVATARS, resolveDisplayBanner } from "@/lib/profile-media";

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
      {params.social === "synced" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Connected and audience statistics were synced.
        </div>
      ) : null}
      {params.social === "connected" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Connected. If audience statistics are missing, use Sync now after setup is complete.
        </div>
      ) : null}
      {params.social === "disconnected" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Disconnected. Further sync has stopped.
        </div>
      ) : null}
      {params.error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>{params.error}</p>
          <p className="mt-1 text-xs">Nothing was retried. Use Retry below when you want to try again.</p>
        </div>
      ) : null}
    </>
  );
}

function locationLabel(draft: ClaimDraft) {
  return [draft.locationCity, draft.locationCountry].filter(Boolean).join(", ") || "Add location";
}

export function CreatorProfileShell({
  draft,
  score,
  primaryNiche,
  planLabel,
  kycVerified,
  children,
  flash,
  hideHeaderActions = false,
}: {
  draft: ClaimDraft;
  score: number;
  primaryNiche?: string | null;
  planLabel?: string;
  kycVerified?: boolean;
  children: ReactNode;
  flash?: ReactNode;
  hideHeaderActions?: boolean;
}) {
  const publicHref = draft.stage === "published" ? `/c/${draft.slug}` : `/claim/preview/${draft.id}`;
  const plan = planLabel || draft.planTier || "STARTER";

  return (
    <div className="mx-auto max-w-[90rem] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-2xl border border-[#E6ECF7] bg-white shadow-[0_8px_28px_rgba(17,26,90,0.05)]">
        <div className="relative h-36 w-full bg-[#EEF2FF] sm:h-44">
          <Image
            src={resolveDisplayBanner({ seed: draft.slug, coverImage: draft.coverImage })}
            alt=""
            fill
            className="object-cover"
            sizes="1200px"
            unoptimized={draft.coverImage?.endsWith(".svg")}
            priority
          />
        </div>

        <div className="relative px-5 pb-5 pt-0 sm:px-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 gap-4">
              <span className="relative -mt-12 h-[5.5rem] w-[5.5rem] shrink-0 overflow-hidden rounded-full border-4 border-white bg-white shadow-md sm:-mt-14 sm:h-28 sm:w-28">
                <Image
                  src={draft.image || BRAND_AVATARS.unspecified}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="112px"
                  unoptimized={draft.image?.endsWith(".svg")}
                />
              </span>
              <div className="min-w-0 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold text-indigo sm:text-[1.75rem]">
                    {draft.displayName || "Creator profile"}
                  </h1>
                  {draft.stage === "published" ? (
                    <span className="inline-flex text-[#2F6BFF]" title="Published profile">
                      <IconVerified size={18} />
                    </span>
                  ) : null}
                </div>
                <div className="mt-1">
                  <CopyHandle handle={draft.slug} />
                </div>
                {draft.bio ? (
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#5B647C] line-clamp-2">
                    {draft.bio}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted">Add a short bio so brands understand your voice.</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-[#5B647C]">
                  <span className="inline-flex items-center gap-1.5">
                    <IconMapPin size={14} />
                    {locationLabel(draft)}
                  </span>
                  {primaryNiche ? (
                    <span className="rounded-full bg-[#F1ECFF] px-2.5 py-0.5 text-[11px] font-semibold text-violet">
                      {primaryNiche}
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#F3F5FA] px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                      No niche yet
                    </span>
                  )}
                  <span className="font-semibold text-violet">
                    {String(plan).charAt(0) + String(plan).slice(1).toLowerCase()} Plan
                  </span>
                  {kycVerified ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <IconCheck size={14} />
                      KYC Verified
                    </span>
                  ) : (
                    <Link href="/dashboard/kyc" className="font-semibold text-amber-700 hover:underline">
                      KYC pending
                    </Link>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5 lg:pt-3">
              <CompletenessRing score={score} />
              {!hideHeaderActions ? (
                <div className="flex w-full flex-col gap-2 sm:w-44">
                  <Link
                    href="/dashboard/details"
                    className="rounded-xl bg-[linear-gradient(120deg,#5B7CFF_0%,#7B4DFF_100%)] px-4 py-2.5 text-center text-[13px] font-semibold text-white shadow-sm"
                  >
                    Edit profile
                  </Link>
                  <Link
                    href={publicHref}
                    className="rounded-xl border border-[#E6ECF7] bg-white px-4 py-2.5 text-center text-[13px] font-semibold text-indigo hover:bg-[#F7F9FF]"
                  >
                    Preview public card
                  </Link>
                  <Link
                    href={publicHref}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E6ECF7] bg-white px-4 py-2.5 text-[13px] font-semibold text-indigo hover:bg-[#F7F9FF]"
                  >
                    <IconShare size={14} />
                    Share profile
                  </Link>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-6">
            <CreatorProfileTabs />
          </div>
        </div>
      </section>

      {flash}
      {children}
    </div>
  );
}
