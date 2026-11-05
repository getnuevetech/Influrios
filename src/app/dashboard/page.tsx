import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { actionPublishDraft } from "@/app/claim/actions";
import { MiniCompletenessRing } from "@/components/creator-profile/completeness-ring";
import { MutedPill, OverviewCard, SoftPill } from "@/components/creator-profile/overview-card";
import { CreatorProfileShell, ProfileFlash } from "@/components/creator-profile/profile-shell";
import {
  IconCheck,
  IconHandshake,
  IconLink,
  IconMegaphone,
  SocialIcon,
} from "@/components/icons";
import { loadCreatorProfileBundle } from "@/lib/creator-profile-data";
import { BRAND_AVATARS, resolveDisplayBanner } from "@/lib/profile-media";

export const dynamic = "force-dynamic";
export const metadata = { title: "My profile" };

type Props = {
  searchParams: Promise<{
    published?: string;
    saved?: string;
    error?: string;
    social?: string;
  }>;
};

function nextActionHref(id: string, draftId: string) {
  if (id === "verified" || id === "email_verified") return `/claim/verify/${draftId}`;
  if (id === "claimed") return `/claim/preview/${draftId}`;
  if (id === "specialty") return "/dashboard/details#specialties";
  if (id === "bio" || id === "location") return "/dashboard/details";
  return "/dashboard/details";
}

function paymentStatus(fundings: { status: string }[]) {
  if (!fundings.length) return { label: "Not configured", tone: "muted" as const };
  if (fundings.some((f) => f.status === "awaiting_provider" || f.status === "held")) {
    return { label: "Action required", tone: "blue" as const };
  }
  return { label: "Ready", tone: "emerald" as const };
}

function StatCard({
  href,
  icon,
  label,
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-[#E6ECF7] bg-white px-4 py-3.5 shadow-[0_4px_16px_rgba(17,26,90,0.03)] transition hover:border-violet/25"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1ECFF] text-violet">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-indigo">{label}</span>
      <span className="text-muted" aria-hidden>
        ›
      </span>
    </Link>
  );
}

export default async function CreatorProfileOverviewPage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await loadCreatorProfileBundle();
  const {
    draft,
    optIn,
    activeIntros,
    social,
    score,
    nextActions,
    items,
    fundings,
    specialtyName,
    contentStyles,
    commercialModes,
    connectedSocialCount,
    primaryNiche,
    kycVerified,
    activeCollaborations,
    opportunityMatches,
    specialtyCap,
  } = data;

  const specialtyChips = draft.specialties.map(specialtyName);
  const nicheChips = (optIn?.niches ?? []).map(specialtyName).slice(0, 6);
  const styleNames = (draft.contentStyles ?? [])
    .map((slug) => contentStyles.find((r) => r.slug === slug)?.name ?? slug)
    .slice(0, 8);
  const modeNames = (draft.commercialModes ?? [])
    .map((slug) => commercialModes.find((r) => r.slug === slug)?.name ?? slug)
    .slice(0, 8);
  const payments = paymentStatus(fundings);
  const doneCount = items.filter((i) => i.done).length;
  const totalCount = items.length || 1;
  const checklistPct = Math.round((doneCount / totalCount) * 100);
  const publicHref = draft.stage === "published" ? `/c/${draft.slug}` : `/claim/preview/${draft.id}`;
  const location = [draft.locationCity, draft.locationCountry].filter(Boolean).join(", ");

  return (
    <CreatorProfileShell
      draft={draft}
      score={score}
      primaryNiche={primaryNiche}
      planLabel={data.planCode}
      kycVerified={kycVerified}
      flash={<ProfileFlash params={params} />}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          href="/dashboard/details"
          icon={<MiniCompletenessRing score={score} />}
          label={`${score}% Profile completeness`}
        />
        <StatCard
          href="/dashboard/social"
          icon={<IconLink size={18} />}
          label={`${connectedSocialCount} Connected social account${connectedSocialCount === 1 ? "" : "s"}`}
        />
        <StatCard
          href="/collaboration/hub?view=opportunities"
          icon={<IconMegaphone size={18} />}
          label={`${opportunityMatches} Opportunity match${opportunityMatches === 1 ? "" : "es"}`}
        />
        <StatCard
          href="/collaboration/hub?view=collaborations"
          icon={<IconHandshake size={18} />}
          label={`${activeCollaborations} Active collaboration${activeCollaborations === 1 ? "" : "s"}`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <OverviewCard title="About me" href="/dashboard/details">
              <p className="text-[13px] leading-relaxed text-[#5B647C] line-clamp-4">
                {draft.bio || "No bio yet. Tell brands what you create."}
              </p>
              <ul className="mt-3 space-y-1.5 text-[12px] text-[#5B647C]">
                <li>
                  <span className="font-semibold text-indigo">Location:</span> {location || "—"}
                </li>
                <li>
                  <span className="font-semibold text-indigo">Niche:</span>{" "}
                  {primaryNiche || "—"}
                </li>
                <li>
                  <span className="font-semibold text-indigo">Plan:</span> {data.planCode}
                </li>
              </ul>
            </OverviewCard>

            <OverviewCard title="Specialties & niches" href="/dashboard/details#specialties">
              <div className="flex flex-wrap gap-1.5">
                {specialtyChips.slice(0, 8).map((name) => (
                  <SoftPill key={name}>{name}</SoftPill>
                ))}
                {specialtyChips.length > 8 ? (
                  <MutedPill>+{specialtyChips.length - 8} more</MutedPill>
                ) : null}
                {!specialtyChips.length ? <MutedPill>No specialties yet</MutedPill> : null}
              </div>
              <Link
                href="/dashboard/details#specialties"
                className="mt-3 inline-flex text-[12px] font-semibold text-violet hover:underline"
              >
                + Add specialty
              </Link>
              <p className="mt-2 text-[11px] text-muted">
                Plan keeps {specialtyCap} · full picker opens on Edit
              </p>
            </OverviewCard>

            <OverviewCard
              title="Content style & commercial mode"
              href="/dashboard/details#style"
            >
              <div className="space-y-3">
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Content style
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {styleNames.length
                      ? styleNames.map((name) => <SoftPill key={`s-${name}`}>{name}</SoftPill>)
                      : <MutedPill>None selected</MutedPill>}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Commercial mode
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {modeNames.length
                      ? modeNames.map((name) => <SoftPill key={`m-${name}`}>{name}</SoftPill>)
                      : <MutedPill>None selected</MutedPill>}
                  </div>
                </div>
              </div>
            </OverviewCard>

            <OverviewCard
              title="Social accounts"
              href="/dashboard/social"
              actionLabel="Manage"
              status={
                <span className="text-[12px] font-semibold text-muted">
                  {connectedSocialCount} connected
                </span>
              }
            >
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(social?.accounts ?? []).map((account) => {
                  const connected = account.status === "connected";
                  return (
                    <li
                      key={account.platform}
                      className="flex items-center gap-2 rounded-xl border border-[#EEF2FF] px-2.5 py-2"
                    >
                      <span className="text-violet">
                        <SocialIcon platform={account.platform} size={16} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-indigo">
                        {account.name}
                      </span>
                      {connected ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <IconCheck size={12} />
                          Connected
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-muted">
                          {account.ready ? "Not connected" : "Not ready"}
                        </span>
                      )}
                    </li>
                  );
                })}
                {!social?.accounts?.length ? (
                  <li className="text-[12px] text-muted">Publish your card to connect networks.</li>
                ) : null}
              </ul>
            </OverviewCard>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <OverviewCard title="I offer" href="/dashboard/details#offer-need">
              <p className="font-semibold text-indigo">{draft.offer || "Not set"}</p>
              {draft.offerDetails ? (
                <p className="mt-1 line-clamp-2 text-[12px] text-muted">{draft.offerDetails}</p>
              ) : null}
            </OverviewCard>
            <OverviewCard title="I need" href="/dashboard/details#offer-need">
              <p className="font-semibold text-indigo">{draft.need || "Not set"}</p>
              {draft.needDetails ? (
                <p className="mt-1 line-clamp-2 text-[12px] text-muted">{draft.needDetails}</p>
              ) : null}
            </OverviewCard>
          </div>

          <OverviewCard
            title="Managed introductions"
            href="/dashboard/details#introductions"
            actionLabel="Edit"
            status={
              optIn?.openToManaged ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Enabled
                </span>
              ) : (
                <span className="rounded-full bg-[#F3F5FA] px-2 py-0.5 text-[11px] font-semibold text-muted">
                  Off
                </span>
              )
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {nicheChips.map((name) => (
                <SoftPill key={name}>{name}</SoftPill>
              ))}
              {(optIn?.niches.length ?? 0) > nicheChips.length ? (
                <MutedPill>+{(optIn?.niches.length ?? 0) - nicheChips.length}</MutedPill>
              ) : null}
              {!nicheChips.length ? (
                <span className="text-[12px] text-muted">
                  {optIn?.openToManaged
                    ? "No target categories selected yet."
                    : "Opt in to receive category-matched brand intros."}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] text-muted">
              {activeIntros.length} active introduction{activeIntros.length === 1 ? "" : "s"} · full
              Preferences / Active / History on Edit
            </p>
          </OverviewCard>
        </div>

        <aside className="space-y-4">
          <OverviewCard title="Next best actions">
            <div className="mb-3">
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-muted">
                <span>
                  {doneCount} of {totalCount} complete
                </span>
                <span>{checklistPct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#EEF2FF]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#5B7CFF,#7B4DFF)]"
                  style={{ width: `${checklistPct}%` }}
                />
              </div>
            </div>
            <ul className="space-y-2.5">
              {items.slice(0, 6).map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-[13px]">
                  <span
                    className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                      item.done ? "bg-emerald-100 text-emerald-700" : "border border-[#D5DCEC] bg-white"
                    }`}
                  >
                    {item.done ? <IconCheck size={10} /> : null}
                  </span>
                  {item.done ? (
                    <span className="text-muted line-through">{item.label}</span>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-indigo">{item.label}</p>
                      {item.id === "published" ? (
                        <form action={actionPublishDraft} className="mt-1">
                          <input type="hidden" name="draftId" value={draft.id} />
                          <button type="submit" className="text-[12px] font-semibold text-violet">
                            Publish now →
                          </button>
                        </form>
                      ) : (
                        <Link
                          href={nextActionHref(item.id, draft.id)}
                          className="text-[12px] font-semibold text-violet hover:underline"
                        >
                          Continue →
                        </Link>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {nextActions.length === 0 ? (
              <p className="mt-2 text-[12px] text-emerald-700">Card looks complete.</p>
            ) : null}
          </OverviewCard>

          <OverviewCard title="Your public card">
            <div className="overflow-hidden rounded-xl border border-[#E6ECF7]">
              <div className="relative h-16 bg-[#EEF2FF]">
                <Image
                  src={resolveDisplayBanner({ seed: draft.slug, coverImage: draft.coverImage })}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="320px"
                  unoptimized={draft.coverImage?.endsWith(".svg")}
                />
              </div>
              <div className="flex items-center gap-3 bg-white p-3">
                <span className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-white">
                  <Image
                    src={draft.image || BRAND_AVATARS.unspecified}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="40px"
                    unoptimized={draft.image?.endsWith(".svg")}
                  />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-indigo">{draft.displayName}</p>
                  <p className="truncate text-[11px] text-muted">@{draft.slug}</p>
                </div>
              </div>
            </div>
            <Link
              href={publicHref}
              className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-[#E6ECF7] px-3 py-2 text-[12px] font-semibold text-violet hover:bg-[#F7F5FF]"
            >
              View public card
            </Link>
          </OverviewCard>

          <OverviewCard
            title="Protected payments"
            href="/creator/earnings"
            actionLabel="Open"
            status={
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  payments.tone === "emerald"
                    ? "bg-emerald-50 text-emerald-700"
                    : payments.tone === "blue"
                      ? "bg-[#E8F1FF] text-[#2F6BFF]"
                      : "bg-[#F3F5FA] text-muted"
                }`}
              >
                {payments.label}
              </span>
            }
          >
            <p className="text-[12px] text-muted">
              Payout readiness lives in Earnings. Escrow deals stay under{" "}
              <Link href="/payments" className="font-semibold text-violet hover:underline">
                Protected payments
              </Link>
              .
            </p>
          </OverviewCard>
        </aside>
      </div>
    </CreatorProfileShell>
  );
}
