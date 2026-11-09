import Image from "next/image";
import Link from "next/link";
import { contractHrefFromCampaign } from "@/lib/campaign-contract";
import {
  activeRowForApplication,
  requestMatchesFilter,
  requestQueueRow,
  type ActiveQueueRow,
} from "@/lib/business-collab-workspace";
import type { CampaignBrief } from "@/lib/business";

export type WorkspaceApplication = {
  id: string;
  status: string;
  creatorSlug: string | null;
  creatorName: string;
  image: string;
  title: string;
  briefId: string | null;
  businessRequestId: string | null;
  collaborationId: string | null;
  invitation: boolean;
  hasContract: boolean;
  note: string;
};

export type WorkspaceCreatorCard = {
  slug: string;
  name: string;
  handle: string;
  followers: string;
  specialties: string;
  country: string;
  platforms: string[];
  image: string;
  blurb: string;
};

const TABS = [
  ["requests", "Requests"],
  ["opportunities", "Collaboration Opportunities"],
  ["active", "Active Collaborations"],
] as const;

function tabHref(tab: string, extra?: Record<string, string>) {
  const params = new URLSearchParams({ tab, ...extra });
  return `/collaboration/business?${params.toString()}`;
}

export function BusinessCollaborations(props: {
  tab: "requests" | "opportunities" | "active";
  view: "recommended" | "applications";
  filter: string;
  query: string;
  requestId: string;
  dealId: string;
  error?: string;
  saved?: string;
  briefs: CampaignBrief[];
  publishedBriefIds: string[];
  applications: WorkspaceApplication[];
  creators: WorkspaceCreatorCard[];
  requestsForInvite: { id: string; title: string }[];
}) {
  const rows = props.briefs.map((brief) => {
    const related = props.applications.filter(
      (application) => application.briefId === brief.id,
    );
    const invites = related.filter((application) => application.invitation);
    const inbound = related.filter((application) => !application.invitation);
    const accepted = related.filter((application) => application.status === "ACCEPTED" || application.status === "COLLABORATION_DRAFTED");
    return requestQueueRow({
      id: brief.id,
      title: brief.title,
      briefStatus: brief.status,
      published: props.publishedBriefIds.includes(brief.id),
      inviteCount: invites.length,
      applicationCount: inbound.length,
      acceptedCount: accepted.length,
      updatedLabel: brief.createdAt.slice(0, 10),
    });
  });
  const visible = rows.filter((row) => {
    const q = props.query.trim().toLowerCase();
    if (q && !row.title.toLowerCase().includes(q)) return false;
    return requestMatchesFilter(row.facts, props.filter);
  });
  const activeRows = props.applications
    .map((application) =>
      activeRowForApplication({
        id: application.id,
        status: application.status,
        title: application.title,
        influencer: application.creatorName,
        hasContract: application.hasContract,
      }),
    )
    .filter((row): row is ActiveQueueRow => Boolean(row));
  const bucket = props.filter === "needs" || props.filter === "progress" || props.filter === "completed" ? props.filter : "all";
  const activeVisible = activeRows.filter((row) => {
    if (bucket === "needs") return row.bucket === "needs_action";
    if (bucket === "progress") return row.bucket === "in_progress";
    if (bucket === "completed") return row.bucket === "completed";
    return true;
  });
  const selected = props.applications.find((application) => application.id === props.dealId) ?? props.applications.find((application) => activeRows[0]?.id === application.id);
  const selectedActive = activeRows.find((row) => row.id === selected?.id) ?? activeVisible[0];
  const openApplications = props.applications.filter(
    (application) => application.status !== "ACCEPTED" && application.status !== "COLLABORATION_DRAFTED",
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h1 className="font-display text-4xl font-bold text-[#1B1464]">Collaborations</h1>
      <div className="mt-4 flex gap-6 border-b border-[#E6ECF7] text-sm font-semibold">
        {TABS.map(([id, label]) => (
          <Link
            key={id}
            href={tabHref(id)}
            className={props.tab === id ? "border-b-2 border-[#6D4AFF] pb-3 text-[#6D4AFF]" : "pb-3 text-[#667085]"}
          >
            {label}
          </Link>
        ))}
      </div>
      {props.error ? <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{props.error}</p> : null}
      {props.saved === "published" ? <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">The listing is public. Invitations were not sent.</p> : null}
      {props.saved === "invites" ? <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Invitations were sent. The request stays private.</p> : null}

      {props.tab === "requests" ? (
        <section className="mt-5 rounded-3xl border border-[#E6ECF7] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-bold text-[#1B1464]">Requests</h2>
            <Link href="/collaboration/business/request/new" className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-bold text-white">
              New request
            </Link>
          </div>
          <form className="mt-4 flex flex-wrap gap-2" action="/collaboration/business">
            <input type="hidden" name="tab" value="requests" />
            {[
              ["all", "All requests"],
              ["drafts", "Drafts"],
              ["published", "Published"],
              ["invites", "Invites sent"],
              ["closed", "Closed"],
            ].map(([id, label]) => (
              <button key={id} name="filter" value={id} className={`rounded-full px-3 py-1.5 text-xs font-bold ${props.filter === id || (id === "all" && !props.filter) ? "bg-[#F1ECFF] text-[#6D4AFF]" : "bg-[#F7F8FC] text-[#667085]"}`}>
                {label}
              </button>
            ))}
            <input name="q" defaultValue={props.query} placeholder="Search requests" className="ml-auto min-w-48 rounded-full border border-[#E6ECF7] px-3 py-1.5 text-sm" />
          </form>
          {visible.length === 0 ? (
            <div className="mt-8 text-center">
              <p className="text-sm text-[#667085]">{props.filter && props.filter !== "all" ? "No requests match this filter." : "Create a request to invite influencers or publish a listing."}</p>
              {props.filter && props.filter !== "all" ? (
                <Link href={tabHref("requests")} className="mt-3 inline-block text-sm font-bold text-violet">Clear filters</Link>
              ) : (
                <Link href="/collaboration/business/request/new" className="mt-3 inline-block text-sm font-bold text-violet">New request</Link>
              )}
            </div>
          ) : (
            <table className="mt-4 w-full text-left text-sm">
              <thead className="text-xs text-[#667085]">
                <tr>
                  <th className="py-2 font-semibold">Request</th>
                  <th className="py-2 font-semibold">Visibility</th>
                  <th className="py-2 font-semibold">Activity</th>
                  <th className="py-2 font-semibold">Updated</th>
                  <th className="py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="border-t border-[#F0F3FA]">
                    <td className="py-4 font-bold text-[#1B1464]">{row.title}</td>
                    <td className="py-4">
                      <span className="flex flex-wrap gap-1">
                        {row.facts.map((fact) => (
                          <span key={fact} className="rounded-full bg-[#F4F7FF] px-2 py-0.5 text-[11px] font-bold text-[#4E5872]">{fact}</span>
                        ))}
                      </span>
                    </td>
                    <td className="py-4 text-[#4E5872]">{row.activity}</td>
                    <td className="py-4 text-[#667085]">{row.updatedLabel}</td>
                    <td className="py-4">
                      <Link href={row.actionHref} className="font-bold text-[#6D4AFF]">{row.actionLabel}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-[#667085]">{visible.length} request{visible.length === 1 ? "" : "s"}</p>
          {props.requestId ? (
            <RequestReadout brief={props.briefs.find((brief) => brief.id === props.requestId) ?? null} applications={props.applications.filter((application) => application.briefId === props.requestId)} />
          ) : null}
        </section>
      ) : null}

      {props.tab === "opportunities" ? (
        <section className="mt-5 rounded-3xl border border-[#E6ECF7] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-bold text-[#1B1464]">Opportunities</h2>
            <Link href={tabHref("requests")} className="text-sm font-bold text-[#6D4AFF]">Manage requests</Link>
          </div>
          <div className="mt-4 flex gap-4 text-sm font-semibold">
            <Link href={tabHref("opportunities", { view: "recommended" })} className={props.view === "recommended" ? "border-b-2 border-[#6D4AFF] pb-2 text-[#6D4AFF]" : "pb-2 text-[#667085]"}>Recommended influencers</Link>
            <Link href={tabHref("opportunities", { view: "applications" })} className={props.view === "applications" ? "border-b-2 border-[#6D4AFF] pb-2 text-[#6D4AFF]" : "pb-2 text-[#667085]"}>Applications ({openApplications.length})</Link>
          </div>
          {props.view === "applications" ? (
            <ul className="mt-4 divide-y divide-[#F0F3FA]">
              {openApplications.length === 0 ? <li className="py-6 text-sm text-[#667085]">No open applications or invitations.</li> : null}
              {openApplications
                .filter((application) => !props.requestId || application.briefId === props.requestId)
                .map((application) => (
                  <li key={application.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-bold text-[#1B1464]">{application.creatorName}</p>
                      <p className="text-xs text-[#667085]">{application.title} · {application.invitation ? "Invitation" : "Application"} · {application.status.replaceAll("_", " ")}</p>
                    </div>
                    <Link href={`/collaboration/applications/${application.id}`} className="rounded-full bg-[#6D4AFF] px-3 py-1.5 text-xs font-bold text-white">Review</Link>
                  </li>
                ))}
            </ul>
          ) : (
            <>
              <form className="mt-4 grid gap-2 sm:grid-cols-4" action="/collaboration/business">
                <input type="hidden" name="tab" value="opportunities" />
                <input name="q" defaultValue={props.query} placeholder="Search influencers by name or handle" className="rounded-xl border border-[#E6ECF7] px-3 py-2 text-sm sm:col-span-4" />
              </form>
              <ul className="mt-4 divide-y divide-[#F0F3FA]">
                {props.creators
                  .filter((creator) => {
                    const q = props.query.trim().toLowerCase();
                    if (!q) return true;
                    return `${creator.name} ${creator.handle} ${creator.specialties}`.toLowerCase().includes(q);
                  })
                  .slice(0, 12)
                  .map((creator) => (
                    <li key={creator.slug} className="grid gap-3 py-4 sm:grid-cols-[auto_1fr_1.2fr_auto] sm:items-center">
                      <span className="relative h-14 w-14 overflow-hidden rounded-full bg-[#F4F7FF]">
                        {creator.image ? <Image src={creator.image} alt="" fill className="object-cover" sizes="56px" /> : null}
                      </span>
                      <div>
                        <p className="font-bold text-[#1B1464]">{creator.name}</p>
                        <p className="text-xs text-[#667085]">@{creator.handle}</p>
                        <p className="text-xs text-[#667085]">{creator.followers} followers</p>
                      </div>
                      <div className="text-xs text-[#4E5872]">
                        <p>{creator.specialties}</p>
                        <p>{creator.country}</p>
                        <p className="mt-1">{creator.platforms.join(" · ")}</p>
                        <p className="mt-1 text-[#667085]">{creator.blurb}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Link href={`/creators/${creator.slug}`} className="rounded-xl border border-[#E6ECF7] px-3 py-1.5 text-center text-xs font-bold text-indigo">View profile</Link>
                        <details className="rounded-xl bg-[#6D4AFF] px-3 py-1.5 text-center text-xs font-bold text-white">
                          <summary className="cursor-pointer">Invite to request</summary>
                          <div className="mt-2 space-y-1 text-left">
                            {props.requestsForInvite.map((request) => (
                              <Link key={request.id} href={`/collaboration/business/request/${request.id}?creator=${encodeURIComponent(creator.slug)}`} className="block rounded-lg bg-white px-2 py-1 text-indigo">
                                {request.title}
                              </Link>
                            ))}
                            <Link href={`/collaboration/business/request/new?creator=${encodeURIComponent(creator.slug)}`} className="block rounded-lg bg-white px-2 py-1 text-indigo">
                              New request
                            </Link>
                          </div>
                        </details>
                      </div>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </section>
      ) : null}

      {props.tab === "active" ? (
        <section className="mt-5">
          <h2 className="font-display text-2xl font-bold text-[#1B1464]">Active collaborations</h2>
          {activeRows.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-[#E6ECF7] bg-white p-8 text-sm text-[#667085]">
              <p>Accepted applications and invitations will appear here.</p>
              <div className="mt-3 flex gap-4 font-bold text-[#6D4AFF]">
                <Link href={tabHref("opportunities", { view: "applications" })}>Review applications</Link>
                <Link href={tabHref("requests")}>Manage requests</Link>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-3xl border border-[#E6ECF7] bg-white p-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    ["all", `All (${activeRows.length})`],
                    ["needs", `Needs action (${activeRows.filter((row) => row.bucket === "needs_action").length})`],
                    ["progress", `In progress (${activeRows.filter((row) => row.bucket === "in_progress").length})`],
                    ["completed", `Completed (${activeRows.filter((row) => row.bucket === "completed").length})`],
                  ].map(([id, label]) => (
                    <Link key={id} href={tabHref("active", { filter: id })} className={`rounded-full px-3 py-1.5 text-xs font-bold ${bucket === id || (id === "all" && bucket === "all") ? "bg-[#6D4AFF] text-white" : "bg-[#F7F8FC] text-[#667085]"}`}>
                      {label}
                    </Link>
                  ))}
                </div>
                <ul className="mt-3 space-y-2">
                  {activeVisible.map((row) => (
                    <li key={row.id}>
                      <Link href={row.href} className={`block rounded-2xl border p-3 ${selectedActive?.id === row.id ? "border-[#6D4AFF] bg-[#F8F6FF]" : "border-[#E6ECF7]"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-[#1B1464]">{row.title}</p>
                          <span className="rounded-full bg-[#F1ECFF] px-2 py-0.5 text-[10px] font-bold text-[#6D4AFF]">{row.badge}</span>
                        </div>
                        <p className="text-xs text-[#667085]">{row.influencer}</p>
                        <p className="mt-2 text-xs text-[#4E5872]">Stage {row.stage} · Next {row.nextActor}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              {selected && selectedActive ? <ActiveDetail application={selected} row={selectedActive} briefs={props.briefs} /> : null}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function RequestReadout(props: { brief: CampaignBrief | null; applications: WorkspaceApplication[] }) {
  if (!props.brief) return null;
  const accepted = props.applications.filter((application) => application.status === "ACCEPTED" || application.status === "COLLABORATION_DRAFTED");
  return (
    <div className="mt-4 rounded-2xl bg-[#F8F6FF] p-4 text-sm">
      <p className="font-bold text-[#1B1464]">{props.brief.title}</p>
      <p className="mt-1 text-[#4E5872]">{props.brief.goal}</p>
      {accepted.length > 0 ? (
        <p className="mt-3 font-semibold text-indigo">
          {accepted.length} accepted. Open them in Active collaborations. Editing this request does not continue the work.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-3">
        {props.brief.status !== "closed" ? (
          <Link href={`/collaboration/business/request/${props.brief.id}`} className="font-bold text-[#6D4AFF]">Edit request</Link>
        ) : (
          <Link href="/collaboration/contracts" className="font-bold text-[#6D4AFF]">View agreement</Link>
        )}
        <Link href={`/collaboration/business?tab=active`} className="font-bold text-[#6D4AFF]">Active collaborations</Link>
      </div>
    </div>
  );
}

function ActiveDetail(props: { application: WorkspaceApplication; row: ActiveQueueRow; briefs: CampaignBrief[] }) {
  const brief = props.briefs.find((item) => item.id === props.application.briefId) ?? null;
  const agreementHref = props.application.creatorSlug
    ? contractHrefFromCampaign({
        creatorSlug: props.application.creatorSlug,
        brief,
        applicationId: props.application.id,
        collaborationId: props.application.collaborationId,
        request: brief ? null : { title: props.application.title },
      })
    : "/collaboration/contracts";
  return (
    <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-bold text-[#1B1464]">{props.row.title}</h3>
          <p className="text-sm text-[#667085]">{props.application.creatorName}</p>
        </div>
        <span className="rounded-full bg-[#F1ECFF] px-2 py-1 text-[11px] font-bold text-[#6D4AFF]">{props.row.badge}</span>
      </div>
      <ol className="mt-4 space-y-2 text-sm text-[#4E5872]">
        <li>Agreement {props.application.hasContract ? "signed" : "not signed yet"}</li>
        <li>Funds {props.row.stage === "Content production" || props.row.bucket === "completed" ? "confirmed" : "not confirmed"}</li>
        <li>{props.row.stage}. Next actor: {props.row.nextActor}.</li>
      </ol>
      <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold">
        {!props.application.hasContract ? (
          <Link href={agreementHref} className="rounded-full bg-[#6D4AFF] px-4 py-2 text-white">Create the agreement</Link>
        ) : (
          <Link href={`/collaboration/contracts`} className="rounded-full border border-[#E6ECF7] px-4 py-2 text-indigo">View agreement</Link>
        )}
        <Link href="/payments" className="rounded-full border border-[#E6ECF7] px-4 py-2 text-indigo">View funding</Link>
        <Link href={`/collaboration/applications/${props.application.id}`} className="text-[#6D4AFF]">Review submission</Link>
      </div>
    </div>
  );
}
