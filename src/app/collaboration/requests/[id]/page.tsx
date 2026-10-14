import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { IconArrowRight, IconBuilding, IconMapPin } from "@/components/icons";
import { actionApplyToBusinessRequest } from "@/app/collaboration/hub/actions";
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";
import { getPublishedBusinessRequest } from "@/lib/marketplace-listings";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ applied?: string; error?: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const request = await getPublishedBusinessRequest(id).catch(() => null);
  return { title: request ? `${request.brand} · Campaign` : "Campaign" };
}

export default async function CreatorCampaignRequestPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const account = await getAccountSession().catch(() => null);
  if (!account) {
    redirect(`/login?next=${encodeURIComponent(`/collaboration/requests/${id}`)}&gate=hub`);
  }
  const draft = await getCreatorSessionDraft().catch(() => null);
  if (!draft?.slug) {
    redirect(`/claim?next=${encodeURIComponent(`/collaboration/requests/${id}`)}`);
  }

  const request = await getPublishedBusinessRequest(id).catch(() => null);
  if (!request) notFound();

  const existing = await prisma.marketplaceApplication
    .findFirst({
      where: {
        kind: "business_request",
        businessRequestId: request.id,
        fromUserId: account.id,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    })
    .catch(() => null);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/collaboration/hub?view=opportunities#matches"
        className="inline-flex items-center gap-1 text-sm font-semibold text-violet hover:underline"
      >
        ← Back to opportunities
      </Link>

      {query.applied ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Application sent for this campaign.
        </p>
      ) : null}
      {query.error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          {query.error}
        </p>
      ) : null}

      <article className="overflow-hidden rounded-3xl border border-[#E6ECF7] bg-white shadow-sm">
        <div className="relative h-48 bg-[#F4F7FF] sm:h-56">
          {request.imageUrl ? (
            <Image src={request.imageUrl} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 768px" />
          ) : request.logoUrl ? (
            <Image src={request.logoUrl} alt="" fill className="object-contain p-10" sizes="(max-width: 768px) 100vw, 768px" />
          ) : (
            <div className="flex h-full items-center justify-center text-violet">
              <IconBuilding size={40} />
            </div>
          )}
        </div>

        <div className="space-y-5 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet">Campaign</p>
              <h1 className="mt-1 font-display text-3xl font-bold text-indigo">{request.brand}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span>{request.category}</span>
                {request.location ? (
                  <span className="inline-flex items-center gap-1">
                    <IconMapPin size={14} /> {request.location}
                  </span>
                ) : null}
                {request.budget ? <span className="font-semibold text-indigo">{request.budget}</span> : null}
              </p>
            </div>
            {request.logoUrl && request.imageUrl ? (
              <span className="relative h-14 w-14 overflow-hidden rounded-2xl border border-[#E6ECF7] bg-white">
                <Image src={request.logoUrl} alt="" fill className="object-contain p-2" sizes="56px" />
              </span>
            ) : null}
          </div>

          {request.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {request.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-[#EEF2FA] px-2.5 py-1 text-[11px] font-semibold text-muted">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <section>
            <h2 className="text-sm font-bold text-indigo">About this campaign</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#4E5872]">
              {request.summary || "No summary provided."}
            </p>
          </section>

          <section>
            <h2 className="text-sm font-bold text-indigo">Looking for</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#4E5872]">
              {request.lookingFor || "Open to matching creators."}
            </p>
          </section>

          <div className="rounded-2xl border border-[#E6ECF7] bg-[#F8F6FF] p-4">
            {existing ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-indigo">You already applied</p>
                  <p className="mt-1 text-xs text-muted">Status: {existing.status.replaceAll("_", " ")}</p>
                </div>
                <Link
                  href="/collaboration/hub?view=collaborations#applications"
                  className="btn-secondary !py-2 text-sm"
                >
                  View applications
                </Link>
              </div>
            ) : (
              <form action={actionApplyToBusinessRequest} className="space-y-3">
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="returnTo" value={`/collaboration/requests/${request.id}`} />
                <label className="block text-sm font-semibold text-indigo">
                  Note to the brand (optional)
                  <textarea
                    name="note"
                    rows={3}
                    placeholder="Share why you’re a fit for this campaign"
                    className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-normal"
                  />
                </label>
                <button type="submit" className="btn-primary inline-flex items-center gap-2 !py-2.5 text-sm">
                  Apply to campaign <IconArrowRight size={14} />
                </button>
              </form>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
