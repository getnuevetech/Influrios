import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { actionApplyToCreatorOpportunity } from "@/app/collaboration/hub/actions";
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";
import { prisma } from "@/lib/db";
import { getDirectoryCreator } from "@/lib/directory";
import { listingApplicationHidesApply } from "@/lib/marketplace-listings";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; applied?: string }>;
};

export default async function CreatorOpeningPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(`/login?next=${encodeURIComponent(`/collaboration/openings/${id}`)}&gate=hub`);
  const draft = await getCreatorSessionDraft().catch(() => null);
  if (!draft?.slug) redirect(`/claim?next=${encodeURIComponent(`/collaboration/openings/${id}`)}`);

  const opening = await prisma.marketplaceCreatorOpportunity.findUnique({ where: { id } }).catch(() => null);
  if (!opening || opening.status !== "published") notFound();
  const owner = await getDirectoryCreator(opening.creatorSlug).catch(() => null);
  const existing = await prisma.marketplaceApplication
    .findFirst({
      where: { opportunityId: opening.id, fromSlug: draft.slug, status: { not: "WITHDRAWN" } },
    })
    .catch(() => null);
  const applied = existing ? listingApplicationHidesApply(existing.status) : false;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <Link href="/collaboration/hub?view=opportunities&tab=openings" className="text-sm font-semibold text-violet">
        ← Opportunities
      </Link>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-violet">Influencer opening</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-indigo">{opening.lookingFor || "Opening"}</h1>
        <p className="mt-2 text-sm text-muted">{owner?.displayName || opening.creatorSlug}</p>
      </div>
      {query.error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{query.error}</p> : null}
      <dl className="card-surface space-y-3 p-5 text-sm">
        {opening.summary ? (
          <div>
            <dt className="font-semibold text-indigo">Summary</dt>
            <dd className="mt-1 text-muted">{opening.summary}</dd>
          </div>
        ) : null}
        {opening.location ? (
          <div>
            <dt className="font-semibold text-indigo">Location</dt>
            <dd className="mt-1 text-muted">{opening.location}</dd>
          </div>
        ) : null}
        {opening.budget ? (
          <div>
            <dt className="font-semibold text-indigo">Compensation</dt>
            <dd className="mt-1 text-muted">{[opening.budget, opening.currency].filter(Boolean).join(" ")}</dd>
          </div>
        ) : null}
        {opening.deliverableSummary ? (
          <div>
            <dt className="font-semibold text-indigo">Deliverables</dt>
            <dd className="mt-1 text-muted">{opening.deliverableSummary}</dd>
          </div>
        ) : null}
        {opening.platforms.length > 0 ? (
          <div>
            <dt className="font-semibold text-indigo">Platforms</dt>
            <dd className="mt-1 text-muted">{opening.platforms.join(", ")}</dd>
          </div>
        ) : null}
        {opening.applicationDeadline ? (
          <div>
            <dt className="font-semibold text-indigo">Apply by</dt>
            <dd className="mt-1 text-muted">{opening.applicationDeadline.toISOString().slice(0, 10)}</dd>
          </div>
        ) : null}
      </dl>
      {applied && existing ? (
        <Link href={`/collaboration/applications/${existing.id}`} className="btn-primary inline-flex">
          View application
        </Link>
      ) : opening.creatorSlug === draft.slug ? (
        <p className="text-sm text-muted">This is your opening.</p>
      ) : (
        <form action={actionApplyToCreatorOpportunity} className="card-surface space-y-3 p-5">
          <input type="hidden" name="opportunityId" value={opening.id} />
          <input type="hidden" name="toSlug" value={opening.creatorSlug} />
          <label className="block text-sm font-semibold text-indigo">
            Note
            <textarea name="note" rows={3} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
          </label>
          <button type="submit" className="btn-primary">
            Connect
          </button>
        </form>
      )}
    </div>
  );
}
