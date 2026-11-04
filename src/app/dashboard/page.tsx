import Link from "next/link";
import { actionPublishDraft } from "@/app/claim/actions";
import { Chip, ProfileSummaryCard } from "@/components/creator-profile/summary-card";
import { CreatorProfileShell, ProfileFlash } from "@/components/creator-profile/profile-shell";
import { loadCreatorProfileBundle } from "@/lib/creator-profile-data";

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
  if (id === "specialty") return "/dashboard/preferences";
  if (id === "bio" || id === "location") return "/dashboard/details";
  return "/dashboard/details";
}

function paymentStatus(fundings: { status: string }[]) {
  if (!fundings.length) return { label: "Not configured", tone: "muted" as const };
  if (fundings.some((f) => f.status === "awaiting_provider" || f.status === "held")) {
    return { label: "Action required", tone: "blue" as const };
  }
  if (fundings.some((f) => f.status === "completed" || f.status === "held")) {
    return { label: "Ready", tone: "emerald" as const };
  }
  return { label: "Action required", tone: "blue" as const };
}

export default async function CreatorProfileOverviewPage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await loadCreatorProfileBundle();
  const {
    draft,
    optIn,
    activeIntros,
    social,
    shortLink,
    shortHost,
    score,
    nextActions,
    items,
    fundings,
    specialtyName,
    contentStyles,
    commercialModes,
  } = data;

  const specialtyChips = draft.specialties.map(specialtyName);
  const nicheNames = (optIn?.niches ?? []).map(specialtyName);
  const nichePreview =
    nicheNames.length === 0
      ? "No target categories"
      : nicheNames.length <= 3
        ? nicheNames.join(", ")
        : `${nicheNames.slice(0, 3).join(", ")} +${nicheNames.length - 3}`;

  const styleNames = (draft.contentStyles ?? [])
    .map((slug) => contentStyles.find((r) => r.slug === slug)?.name ?? slug)
    .slice(0, 6);
  const modeNames = (draft.commercialModes ?? [])
    .map((slug) => commercialModes.find((r) => r.slug === slug)?.name ?? slug)
    .slice(0, 6);

  const payments = paymentStatus(fundings);
  const qrReady = Boolean(
    shortLink &&
      shortLink.status === "active" &&
      (data.linkLimits?.standardQr || data.linkLimits?.dynamicQr),
  );
  const pendingChecklist = items.filter((i) => !i.done);
  const doneChecklist = items.filter((i) => i.done);

  return (
    <CreatorProfileShell
      draft={draft}
      score={score}
      flash={<ProfileFlash params={params} />}
    >
      <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5 shadow-[0_8px_24px_rgba(17,26,90,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet">
              Next best actions
            </p>
            <p className="mt-1 text-sm text-muted">
              Only the next useful steps stay up top. Completed items move down.
            </p>
          </div>
          {draft.stage === "published" ? (
            <Link href={`/c/${draft.slug}`} className="text-[12px] font-semibold text-violet hover:underline">
              Open live card →
            </Link>
          ) : (
            <Link href={`/claim/preview/${draft.id}`} className="text-[12px] font-semibold text-violet hover:underline">
              View draft card →
            </Link>
          )}
        </div>
        {nextActions.length ? (
          <ul className="mt-4 space-y-3">
            {nextActions.map((action) => (
              <li
                key={action.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EEF2FF] bg-[#FBFBFF] px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-indigo">{action.label}</p>
                  <p className="text-[12px] text-muted">{action.hint}</p>
                </div>
                {action.id === "published" ? (
                  <form action={actionPublishDraft}>
                    <input type="hidden" name="draftId" value={draft.id} />
                    <button type="submit" className="btn-primary !py-2 text-sm">
                      Publish now →
                    </button>
                  </form>
                ) : (
                  <Link href={nextActionHref(action.id, draft.id)} className="btn-secondary !py-2 text-sm">
                    Continue →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-emerald-800">
            Card looks complete. Share{" "}
            <Link href={`/c/${draft.slug}`} className="font-semibold text-violet underline">
              /c/{draft.slug}
            </Link>{" "}
            or{" "}
            <Link href="/billing" className="font-semibold text-violet underline">
              upgrade to Plus
            </Link>{" "}
            for shortlink + QR.
          </p>
        )}
        {doneChecklist.length ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-[12px] font-semibold text-muted">
              {doneChecklist.length} completed checklist items
            </summary>
            <ul className="mt-2 space-y-1 text-[12px] text-muted">
              {doneChecklist.map((item) => (
                <li key={item.id}>✓ {item.label}</li>
              ))}
            </ul>
          </details>
        ) : null}
        {pendingChecklist.length > 5 ? (
          <p className="mt-2 text-[11px] text-muted">
            {pendingChecklist.length - 5} more open items live in Profile Details and Preferences.
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ProfileSummaryCard
          title="Specialties & niches"
          status={`${draft.specialties.length} selected · plan keeps ${data.specialtyCap}`}
          href="/dashboard/preferences#specialties"
          actionLabel="Edit"
        >
          <div className="flex flex-wrap gap-1.5">
            {specialtyChips.slice(0, 6).map((name) => (
              <Chip key={name}>{name}</Chip>
            ))}
            {specialtyChips.length > 6 ? <Chip tone="muted">+{specialtyChips.length - 6} more</Chip> : null}
            {!specialtyChips.length ? <span className="text-muted">No specialties yet.</span> : null}
          </div>
        </ProfileSummaryCard>

        <ProfileSummaryCard
          title="Managed introductions"
          status={
            optIn?.openToManaged
              ? `Enabled · ${optIn.niches.length} target categories · ${activeIntros.length} active`
              : "Not enabled"
          }
          href="/dashboard/preferences#introductions"
        >
          <p className="text-sm text-indigo">{nichePreview}</p>
          {optIn?.updatedAt ? (
            <p className="mt-2 text-[11px] text-muted">
              Last updated {new Date(optIn.updatedAt).toLocaleString()}
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-muted">Opt in to receive category-matched brand intros.</p>
          )}
        </ProfileSummaryCard>

        <ProfileSummaryCard
          title="Content style & commercial mode"
          href="/dashboard/preferences#style"
          actionLabel="Edit"
        >
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {styleNames.map((name) => (
                <Chip key={`s-${name}`} tone="blue">
                  {name}
                </Chip>
              ))}
              {!styleNames.length ? <Chip tone="muted">No content styles</Chip> : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {modeNames.map((name) => (
                <Chip key={`m-${name}`} tone="emerald">
                  {name}
                </Chip>
              ))}
              {!modeNames.length ? <Chip tone="muted">No commercial modes</Chip> : null}
            </div>
          </div>
        </ProfileSummaryCard>

        <ProfileSummaryCard title="I offer" href="/dashboard/preferences#offer-need" actionLabel="Edit">
          <p className="font-semibold text-indigo">{draft.offer || "Not set"}</p>
          {draft.offerDetails ? (
            <p className="mt-1 line-clamp-3 text-[12px] text-muted">{draft.offerDetails}</p>
          ) : null}
        </ProfileSummaryCard>

        <ProfileSummaryCard title="I need" href="/dashboard/preferences#offer-need" actionLabel="Edit">
          <p className="font-semibold text-indigo">{draft.need || "Not set"}</p>
          {draft.needDetails ? (
            <p className="mt-1 line-clamp-3 text-[12px] text-muted">{draft.needDetails}</p>
          ) : null}
        </ProfileSummaryCard>

        <ProfileSummaryCard
          title="Social accounts"
          href="/dashboard/social"
          status={
            social?.accounts?.length
              ? `${social.accounts.filter((a) => a.status === "connected").length} connected`
              : undefined
          }
        >
          <ul className="space-y-1.5 text-sm">
            {(social?.accounts ?? []).map((account) => (
              <li key={account.platform} className="flex items-center justify-between gap-2">
                <span className="font-semibold text-indigo">{account.name}</span>
                <span
                  className={
                    account.status === "connected" ? "font-semibold text-emerald-700" : "text-muted"
                  }
                >
                  {account.status === "connected" ? "✓ Connected" : "— Connect"}
                </span>
              </li>
            ))}
            {!social?.accounts?.length ? (
              <li className="text-muted">Publish your card to connect networks.</li>
            ) : null}
          </ul>
        </ProfileSummaryCard>

        <ProfileSummaryCard
          title="Protected payments"
          status={<Chip tone={payments.tone}>{payments.label}</Chip>}
          href="/creator/earnings"
          actionLabel="Open earnings"
        >
          <p className="text-sm text-muted">
            Payment readiness and payout setup live in Earnings. Escrow deals stay under{" "}
            <Link href="/payments" className="font-semibold text-violet hover:underline">
              Protected payments
            </Link>
            .
          </p>
          {fundings.length ? (
            <p className="mt-2 text-[12px] text-indigo">{fundings.length} deal(s) on this card.</p>
          ) : null}
        </ProfileSummaryCard>

        <ProfileSummaryCard
          title="Your links"
          href="/dashboard/links"
          status={qrReady ? "QR ready" : shortLink ? "Short link available" : "Canonical only"}
        >
          <ul className="space-y-1 text-sm text-indigo">
            <li>
              Canonical:{" "}
              <span className="font-semibold">influrios.com/c/{draft.slug}</span>
            </li>
            <li>
              Short link:{" "}
              <span className="font-semibold">
                {shortLink?.status === "active"
                  ? `https://${shortHost}/${shortLink.slug}`
                  : "Not active on this plan"}
              </span>
            </li>
            <li>QR: {qrReady ? "Active" : "Not included"}</li>
          </ul>
        </ProfileSummaryCard>

        <ProfileSummaryCard title="Media kit" href="/creator/media-kit" actionLabel="Open">
          <p className="text-sm text-muted">
            Public presentation assets and media kit live in their own workspace.
          </p>
        </ProfileSummaryCard>
      </div>

      <p className="text-center text-[12px] text-muted">
        Deep configuration stays one click away in the tabs above — nothing was removed from your profile tools.
      </p>
    </CreatorProfileShell>
  );
}
