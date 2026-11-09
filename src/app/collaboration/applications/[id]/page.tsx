import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { IconArrowRight, IconBuilding } from "@/components/icons";
import { getAccountSession } from "@/lib/accounts";
import { prisma } from "@/lib/db";
import { getWorkspace } from "@/lib/business";
import { contractHrefFromCampaign, contractOfferReady } from "@/lib/campaign-contract";
import { getCreatorSessionDraft } from "@/lib/claim";
import { getDirectoryCreator } from "@/lib/directory";
import {
  applicationIsAcceptedPipeline,
  applicationIsInvitation,
  applicationKindLabel,
  applicationTransitionLabel,
  businessApplicationTransitions,
  businessOwnsApplication,
  creatorApplicationRole,
  creatorApplicationTransitions,
  creatorOwnsApplication,
  getMarketplaceApplicationDetail,
  listWorkspaceBusinessRequests,
  transitionMarketplaceApplication,
} from "@/lib/marketplace-listings";
import { actionAddShortlist } from "@/app/collaboration/business/actions";
import { actionTransitionApplicationDetail } from "../actions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ app?: string; error?: string; opened?: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const application = await getMarketplaceApplicationDetail(id).catch(() => null);
  const title =
    application?.requestBrand ??
    application?.opportunityLookingFor ??
    (applicationIsInvitation(application ?? {}) ? "Invitation" : "Application");
  return { title: `${title} · Review` };
}

export default async function ApplicationDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const account = await getAccountSession().catch(() => null);
  if (!account) {
    redirect(`/login?next=${encodeURIComponent(`/collaboration/applications/${id}`)}`);
  }

  let application = await getMarketplaceApplicationDetail(id).catch(() => null);
  if (!application) notFound();

  const draft = await getCreatorSessionDraft().catch(() => null);
  const ws = await getWorkspace(account.id).catch(() => null);
  const ownedIds =
    ws && ws.businessId !== "public"
      ? (await listWorkspaceBusinessRequests(ws.businessId)).map((row) => row.id)
      : [];

  const asBusiness = businessOwnsApplication(application, ownedIds, ws?.briefs.map((brief) => brief.id) ?? []);
  const asCreator = draft?.slug ? creatorOwnsApplication(application, draft.slug) : false;
  if (!asBusiness && !asCreator) {
    redirect("/collaboration/hub?error=" + encodeURIComponent("You cannot view that application."));
  }

  const agreement = await prisma.contractDocument.findFirst({
    where: {
      status: { notIn: ["voided", "declined"] },
      OR: [
        { applicationId: application.id },
        ...(application.collaborationId ? [{ collaborationId: application.collaborationId }] : []),
      ],
    },
    select: { id: true },
  });
  if (agreement) redirect(`/collaboration/contracts/${agreement.id}`);

  const creatorRole = draft?.slug ? creatorApplicationRole(application, draft.slug) : null;
  const isInvite = applicationIsInvitation(application);

  // Opening the detail marks REQUESTED → VIEWED for the reviewing party (business or invitee).
  const shouldMarkViewed =
    application.status === "REQUESTED" &&
    ((asBusiness && !asCreator) || (asCreator && creatorRole === "invitee"));
  if (shouldMarkViewed) {
    await transitionMarketplaceApplication({
      id: application.id,
      toStatus: "VIEWED",
      actorUserId: account.id,
      note: "Opened for review",
    }).catch(() => null);
    redirect(`/collaboration/applications/${id}?opened=1`);
  }

  // Re-read after potential concurrent updates (opened redirect already refreshes).
  application = (await getMarketplaceApplicationDetail(id)) ?? application;

  const campaignBrief = application.briefId || application.requestBriefId
    ? ws?.briefs.find((brief) => brief.id === (application.briefId || application.requestBriefId)) ?? null
    : null;
  const shortlistedSlugs = ws?.shortlist.map((item) => item.creatorSlug) ?? [];
  const offerReady =
    asBusiness &&
    contractOfferReady({
      status: application.status,
      creatorSlug: application.creatorSlug,
      shortlistedSlugs,
    });
  const accepted = applicationIsAcceptedPipeline(application.status);
  const nextStatuses = (asBusiness
    ? businessApplicationTransitions(application.status)
    : creatorRole
      ? creatorApplicationTransitions(application.status, creatorRole)
      : []
  ).filter((status) => status !== "COLLABORATION_DRAFTED");

  const counterpartSlug =
    asBusiness
      ? application.creatorSlug
      : null;
  const counterpart = counterpartSlug
    ? await getDirectoryCreator(counterpartSlug).catch(() => null)
    : null;

  const title =
    campaignBrief?.title ||
    application.requestBrand ||
    application.opportunityLookingFor ||
    counterpart?.displayName ||
    applicationKindLabel(application);
  const valueCurrency = (campaignBrief?.budgetCurrency || application.requestCurrency || "").trim();
  const valueAmount = campaignBrief?.budget || application.requestBudget || "";

  const backHref = asBusiness
    ? "/collaboration/business#applicants"
    : "/collaboration/hub?view=collaborations#applications";

  const showContractLink = offerReady;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm font-semibold text-violet hover:underline">
        ← Back to list
      </Link>

      {query.opened ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Details opened. Review the {isInvite ? "invitation" : "application"} below before taking action.
        </p>
      ) : null}
      {query.app ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Updated to {query.app.replaceAll("_", " ")}.
        </p>
      ) : null}
      {query.error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{query.error}</p>
      ) : null}

      <article className="overflow-hidden rounded-3xl border border-[#E6ECF7] bg-white shadow-sm">
        {(application.requestImageUrl || application.requestLogoUrl) && (
          <div className="relative h-40 bg-[#F4F7FF] sm:h-48">
            {application.requestImageUrl ? (
              <Image
                src={application.requestImageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 768px"
              />
            ) : application.requestLogoUrl ? (
              <Image
                src={application.requestLogoUrl}
                alt=""
                fill
                className="object-contain p-10"
                sizes="(max-width: 768px) 100vw, 768px"
              />
            ) : null}
          </div>
        )}

        <div className="space-y-5 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet">
                {applicationKindLabel(application)}
              </p>
              <h1 className="mt-1 font-display text-3xl font-bold text-indigo">{title}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                {application.requestCategory ? <span>{application.requestCategory}</span> : null}
                {application.requestLocation ? <span>{application.requestLocation}</span> : null}
                {valueAmount ? (
                  <span className="font-semibold text-indigo">
                    {valueCurrency ? `${valueCurrency} ${valueAmount}` : valueAmount}
                  </span>
                ) : null}
              </p>
            </div>
            <span className="rounded-full bg-[#EAE4FF] px-3 py-1 text-[11px] font-bold uppercase text-violet">
              {application.status.replaceAll("_", " ")}
            </span>
          </div>

          {counterpart ? (
            <div className="flex items-center gap-3 rounded-2xl border border-[#E8EDF8] bg-[#F8F6FF] p-3">
              <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white">
                <Image src={counterpart.image} alt="" fill className="object-cover" sizes="48px" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-indigo">{counterpart.displayName}</p>
                <p className="text-xs text-muted">@{counterpart.slug}</p>
              </div>
            </div>
          ) : null}

          {isInvite ? (
            <section className="rounded-2xl border border-[#E8EDF8] bg-[#F8F6FF] p-4">
              <h2 className="text-sm font-bold text-indigo">Private invitation</h2>
              <p className="mt-1 text-xs text-muted">
                {asBusiness
                  ? "Only you and this influencer can see this offer, deadline, and response."
                  : "This invitation is only yours. Other people invited to the campaign are not shown here, and your response does not change theirs."}
              </p>
              {application.offerText ? (
                <p className="mt-3 text-sm text-[#4E5872]">
                  <span className="font-semibold text-indigo">Compensation. </span>
                  {application.offerText}
                </p>
              ) : null}
              {application.deliverables ? (
                <p className="mt-2 text-sm text-[#4E5872]">
                  <span className="font-semibold text-indigo">Deliverables. </span>
                  {application.deliverables}
                </p>
              ) : null}
              {application.responseDeadline ? (
                <p className="mt-2 text-sm text-[#4E5872]">
                  <span className="font-semibold text-indigo">Respond by. </span>
                  {application.responseDeadline.slice(0, 10)}
                </p>
              ) : null}
            </section>
          ) : null}

          {application.requestSummary ? (
            <section>
              <h2 className="text-sm font-bold text-indigo">Campaign summary</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#4E5872]">
                {application.requestSummary}
              </p>
            </section>
          ) : null}

          {application.requestLookingFor || application.opportunityLookingFor ? (
            <section>
              <h2 className="text-sm font-bold text-indigo">Looking for</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#4E5872]">
                {application.requestLookingFor || application.opportunityLookingFor}
              </p>
            </section>
          ) : null}

          {application.opportunitySummary ? (
            <section>
              <h2 className="text-sm font-bold text-indigo">Opportunity</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#4E5872]">
                {application.opportunitySummary}
              </p>
            </section>
          ) : null}

          {application.note?.trim() ? (
            <section>
              <h2 className="text-sm font-bold text-indigo">Note</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#4E5872]">{application.note}</p>
            </section>
          ) : null}

          {!application.requestSummary && !application.opportunitySummary && !application.note ? (
            <div className="flex items-start gap-2 rounded-2xl border border-[#E8EDF8] bg-[#F4F7FF] p-4 text-sm text-muted">
              <IconBuilding size={18} className="mt-0.5 shrink-0 text-violet" />
              <p>Review the status history below, then use the actions for this {isInvite ? "invitation" : "application"}.</p>
            </div>
          ) : null}

          {application.events.length > 0 ? (
            <section>
              <h2 className="text-sm font-bold text-indigo">Status history</h2>
              <ol className="mt-2 space-y-2 border-t border-[#E8EDF8] pt-3">
                {application.events.map((event) => (
                  <li key={event.id} className="text-xs text-muted">
                    <span className="font-semibold text-indigo">
                      {event.fromStatus ? `${event.fromStatus} → ` : ""}
                      {event.toStatus}
                    </span>
                    {event.note ? ` · ${event.note}` : ""}
                    {" · "}
                    {new Date(event.createdAt).toLocaleString()}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <div className="rounded-2xl border border-[#E6ECF7] bg-[#F8F6FF] p-4">
            {accepted && asBusiness && !offerReady ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-indigo">Accepted, not assigned</p>
                  <p className="mt-1 text-xs text-muted">
                    Shortlist this influencer before an agreement can be created. Accepting does not assign the campaign.
                  </p>
                </div>
                {application.creatorSlug ? (
                  <form action={actionAddShortlist}>
                    <input type="hidden" name="slug" value={application.creatorSlug} />
                    <button type="submit" className="btn-primary !py-2 text-sm">
                      Shortlist
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}
            {showContractLink && application.creatorSlug ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-indigo">Accepted</p>
                  <p className="mt-1 text-xs text-muted">
                    Title, value, and scope from this {isInvite ? "invitation" : "request"} are carried into the agreement.
                    This also appears in Active collaborations.
                  </p>
                </div>
                <Link
                  href={contractHrefFromCampaign({
                    creatorSlug: application.creatorSlug,
                    brief: campaignBrief,
                    applicationId: application.id,
                    collaborationId: application.collaborationId,
                    request: campaignBrief
                      ? null
                      : {
                          title: application.requestBrand,
                          budget: application.requestBudget,
                          currency: application.requestCurrency,
                          summary: application.requestSummary,
                        },
                  })}
                  className="btn-primary inline-flex items-center gap-2 !py-2 text-sm"
                >
                  Create the agreement <IconArrowRight size={14} />
                </Link>
                <Link href={`/collaboration/business?tab=active&deal=${encodeURIComponent(application.id)}`} className="text-sm font-bold text-violet">
                  Open in Active collaborations
                </Link>
              </div>
            ) : null}
            {accepted && !asBusiness ? (
              <p className="text-sm text-muted">
                You accepted. The business can open the agreement from Active collaborations.
              </p>
            ) : null}

            {nextStatuses.length > 0 ? (
              <div className={showContractLink ? "mt-4 border-t border-[#E6ECF7] pt-4" : ""}>
                <p className="mb-2 text-sm font-bold text-indigo">Actions</p>
                <p className="mb-3 text-xs text-muted">
                  These actions appear only after you open this {isInvite ? "invitation" : "application"}.
                </p>
                <div className="flex flex-wrap gap-2">
                  {nextStatuses.map((status) => (
                    <form key={status} action={actionTransitionApplicationDetail}>
                      <input type="hidden" name="applicationId" value={application.id} />
                      <input type="hidden" name="toStatus" value={status} />
                      <button
                        type="submit"
                        className={`rounded-lg px-3 py-2 text-xs font-bold ${
                          status === "DECLINED" || status === "WITHDRAWN" || status === "EXPIRED"
                            ? "border border-border text-muted"
                            : status === "ACCEPTED"
                              ? "bg-violet text-white"
                              : "border border-violet/30 text-violet"
                        }`}
                      >
                        {applicationTransitionLabel(status)}
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            ) : !showContractLink ? (
              <p className="text-sm text-muted">No further actions on this {isInvite ? "invitation" : "application"}.</p>
            ) : null}
          </div>
        </div>
      </article>
    </div>
  );
}
