import Image from "next/image";
import Link from "next/link";
import { AccountDialog } from "@/components/account-dialog";
import {
  actionCloseBusinessRequest,
  actionDeleteBusinessRequest,
  actionWithdrawParticipation,
} from "@/app/collaboration/business/actions";
import { contractHrefFromCampaign } from "@/lib/campaign-contract";
import {
  activeRowForApplication,
  requestMatchesFilter,
  requestQueueRow,
  type ActiveQueueRow,
} from "@/lib/business-collab-workspace";
import type { CampaignBrief } from "@/lib/business";
import { defaultWithdrawMessage, WITHDRAW_REASONS } from "@/lib/request-lifecycle";
import { recordStatusAxes } from "@/lib/record-status";

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
  fundingId?: string | null;
  fundingStatus?: string | null;
  contractId?: string | null;
  note: string;
  updatedAt?: string;
  /** Customer label for the invitation's current state (never a raw status code). */
  statusLabel?: string;
  /** What the business owes on this invitation, if anything. */
  task?: "answer" | "decide" | null;
  question?: string | null;
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
  ["opportunities", "Opportunities"],
  ["active", "Active Collaborations"],
] as const;

function tabHref(tab: string, extra?: Record<string, string>) {
  const params = new URLSearchParams({ tab, ...extra });
  return `/collaboration/business?${params.toString()}`;
}

function statusTone(status: string) {
  if (status === "Open") return "bg-emerald-50 text-emerald-800";
  if (status === "Draft") return "bg-[#EEF2F7] text-[#4E5872]";
  if (status === "Closed" || status === "Cancelled") return "bg-rose-50 text-rose-800";
  return "bg-[#F4F7FF] text-[#4E5872]";
}

export function BusinessCollaborations(props: {
  tab: "requests" | "opportunities" | "active";
  view: "recommended" | "applications";
  filter: string;
  query: string;
  requestId: string;
  dealId: string;
  requestPanel?: string;
  withdrawId?: string;
  businessName?: string;
  error?: string;
  saved?: string;
  briefs: CampaignBrief[];
  publishedBriefIds: string[];
  applications: WorkspaceApplication[];
  creators: WorkspaceCreatorCard[];
  requestsForInvite: { id: string; title: string }[];
  openBriefIds?: string[];
  orphanRequests?: { id: string; title: string }[];
}) {
  const rows = props.briefs.map((brief) => {
    const related = props.applications.filter((application) => application.briefId === brief.id);
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
    if (props.filter === "open") return (props.openBriefIds ?? []).includes(row.id);
    return requestMatchesFilter(row.facts, props.filter, row.open);
  });
  const orphanRequests = props.filter === "open" ? props.orphanRequests ?? [] : [];
  const listedCount = visible.length + orphanRequests.length;
  const activeRows = props.applications
    .map((application) =>
      activeRowForApplication({
        id: application.id,
        status: application.status,
        title: application.title,
        influencer: application.creatorName,
        hasContract: application.hasContract,
        fundingStatus: application.fundingStatus,
        updatedLabel: application.updatedAt?.slice(0, 10),
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
  const selectedRequest = props.briefs.find((brief) => brief.id === props.requestId) ?? null;
  const selectedRequestApps = props.applications.filter((application) => application.briefId === props.requestId);
  const selectedDeal = props.applications.find((application) => application.id === props.dealId) ?? null;
  const selectedActive = activeRows.find((row) => row.id === selectedDeal?.id) ?? null;
  const withdrawApp = props.applications.find((application) => application.id === props.withdrawId) ?? null;
  const openApplications = props.applications.filter(
    (application) => application.status !== "ACCEPTED" && application.status !== "COLLABORATION_DRAFTED",
  );
  const requestPanel = props.requestPanel === "invitations" || props.requestPanel === "activity" ? props.requestPanel : "overview";
  const listClose = tabHref(props.tab, {
    ...(props.filter ? { filter: props.filter } : {}),
    ...(props.query ? { q: props.query } : {}),
    ...(props.view !== "recommended" ? { view: props.view } : {}),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl font-bold text-[#1B1464]">Collaborations</h1>
        {props.tab === "requests" ? (
          <Link href="/collaboration/business/request/new" className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-bold text-white">
            + New request
          </Link>
        ) : null}
      </div>
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
      {props.saved === "invites" ? <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Invitations were sent.</p> : null}
      {props.saved === "withdrawn" ? <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Participation withdrawn. The influencer was notified.</p> : null}
      {props.saved === "deleted" || props.saved === "closed" || props.saved === "archived" ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Request updated.</p>
      ) : null}

      {props.tab === "requests" ? (
        <section className="mt-5 rounded-3xl border border-[#E6ECF7] bg-white p-5">
          <form className="flex flex-wrap gap-2" action="/collaboration/business">
            <input type="hidden" name="tab" value="requests" />
            {[
              ["all", "All requests"],
              ["open", "Open"],
              ["drafts", "Drafts"],
              ["published", "Published"],
              ["invites", "Invite only"],
              ["closed", "Closed"],
            ].map(([id, label]) => (
              <button key={id} name="filter" value={id} className={`rounded-full px-3 py-1.5 text-xs font-bold ${props.filter === id || (id === "all" && !props.filter) ? "bg-[#F1ECFF] text-[#6D4AFF]" : "bg-[#F7F8FC] text-[#667085]"}`}>
                {label}
              </button>
            ))}
            <input name="q" defaultValue={props.query} placeholder="Search requests" className="ml-auto min-w-48 rounded-full border border-[#E6ECF7] px-3 py-1.5 text-sm" />
          </form>
          {listedCount === 0 ? (
            <div className="mt-8 text-center">
              <p className="text-sm text-[#667085]">{props.filter && props.filter !== "all" ? "No requests match this filter." : "Create a request to invite influencers or publish a listing."}</p>
              <Link href="/collaboration/business/request/new" className="mt-3 inline-block text-sm font-bold text-violet">New request</Link>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="text-xs text-[#667085]">
                  <tr>
                    <th className="py-2 font-semibold">Request</th>
                    <th className="py-2 font-semibold">Status</th>
                    <th className="py-2 font-semibold">Visibility</th>
                    <th className="py-2 font-semibold">Responses</th>
                    <th className="py-2 font-semibold">Updated</th>
                    <th className="py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.id} className="border-t border-[#F0F3FA]">
                      <td className="py-4">
                        <Link href={row.actionHref} scroll={false} className="font-bold text-[#1B1464] hover:text-[#6D4AFF]">
                          {row.title}
                        </Link>
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusTone(row.status)}`}>{row.status}</span>
                      </td>
                      <td className="py-4 text-[#4E5872]">{row.visibility}</td>
                      <td className="py-4 text-[#4E5872]">{row.responses}</td>
                      <td className="py-4 text-[#667085]">{row.updatedLabel}</td>
                      <td className="py-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <Link href={row.actionHref} scroll={false} className="font-bold text-[#6D4AFF]">View</Link>
                          {row.openCollaborationHref ? (
                            <Link href={row.openCollaborationHref} className="font-bold text-[#6D4AFF]">Open collaboration</Link>
                          ) : null}
                          <details className="relative">
                            <summary className="cursor-pointer list-none px-1 font-bold text-[#667085]" aria-label="More actions">···</summary>
                            <div className="absolute right-0 z-10 mt-1 w-44 rounded-xl border border-[#E6ECF7] bg-white p-2 text-xs shadow-lg">
                              <Link href={`/collaboration/business/request/${row.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-[#F7F8FC]">Edit request</Link>
                              <Link href={`${row.actionHref}&panel=invitations`} scroll={false} className="block rounded-lg px-2 py-1.5 hover:bg-[#F7F8FC]">Invitations</Link>
                              <form action={actionDeleteBusinessRequest}>
                                <input type="hidden" name="briefId" value={row.id} />
                                <button type="submit" className="block w-full rounded-lg px-2 py-1.5 text-left text-rose-700 hover:bg-rose-50">Delete request</button>
                              </form>
                            </div>
                          </details>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {orphanRequests.map((row) => (
                    <tr key={row.id} className="border-t border-[#F0F3FA]">
                      <td className="py-4 font-bold text-[#1B1464]">{row.title}</td>
                      <td className="py-4"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusTone("Open")}`}>Open</span></td>
                      <td className="py-4 text-[#4E5872]">—</td>
                      <td className="py-4 text-[#4E5872]">No brief on file</td>
                      <td className="py-4 text-[#667085]">—</td>
                      <td className="py-4 text-[#667085]">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-[#667085]">{listedCount} request{listedCount === 1 ? "" : "s"}</p>
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
              {openApplications.map((application) => (
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
            <ul className="mt-4 divide-y divide-[#F0F3FA]">
              {props.creators.slice(0, 12).map((creator) => (
                <li key={creator.slug} className="grid gap-3 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                  <span className="relative h-14 w-14 overflow-hidden rounded-full bg-[#F4F7FF]">
                    {creator.image ? <Image src={creator.image} alt="" fill className="object-cover" sizes="56px" /> : null}
                  </span>
                  <div>
                    <p className="font-bold text-[#1B1464]">{creator.name}</p>
                    <p className="text-xs text-[#667085]">@{creator.handle} · {creator.followers}</p>
                    <p className="text-xs text-[#4E5872]">{creator.specialties}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Link href={`/creators/${creator.slug}`} className="rounded-xl border border-[#E6ECF7] px-3 py-1.5 text-center text-xs font-bold text-indigo">View profile</Link>
                    <Link href={`/creators/${creator.slug}?invite=1`} className="rounded-xl bg-[#6D4AFF] px-3 py-1.5 text-center text-xs font-bold text-white">Invite</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {props.tab === "active" ? (
        <section className="mt-5 rounded-3xl border border-[#E6ECF7] bg-white p-5">
          <h2 className="font-display text-2xl font-bold text-[#1B1464]">Active collaborations</h2>
          {activeRows.length === 0 ? (
            <div className="mt-4 text-sm text-[#667085]">
              <p>Accepted applications and invitations will appear here.</p>
              <Link href={tabHref("opportunities", { view: "applications" })} className="mt-3 inline-block font-bold text-[#6D4AFF]">Review applications</Link>
            </div>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
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
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead className="text-xs text-[#667085]">
                    <tr>
                      <th className="py-2 font-semibold">Campaign</th>
                      <th className="py-2 font-semibold">Counterparty</th>
                      <th className="py-2 font-semibold">Work status</th>
                      <th className="py-2 font-semibold">Next action</th>
                      <th className="py-2 font-semibold">Updated</th>
                      <th className="py-2 font-semibold">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeVisible.map((row) => (
                      <tr key={row.id} className="border-t border-[#F0F3FA]">
                        <td className="py-4 font-bold text-[#1B1464]">{row.title}</td>
                        <td className="py-4 text-[#4E5872]">{row.influencer}</td>
                        <td className="py-4">
                          <span className="rounded-full bg-[#F1ECFF] px-2.5 py-0.5 text-[11px] font-bold text-[#6D4AFF]">{row.workStatus}</span>
                        </td>
                        <td className="py-4 text-[#4E5872]">{row.nextAction}</td>
                        <td className="py-4 text-[#667085]">{row.updatedLabel || "—"}</td>
                        <td className="py-4">
                          <Link href={row.href} scroll={false} className="font-bold text-[#6D4AFF]">Open</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ) : null}

      {selectedRequest ? (
        <AccountDialog title={selectedRequest.title || "Request"} closeHref={listClose} wide>
          <div className="flex flex-wrap gap-4 border-b border-[#EEF2F7] text-sm font-semibold">
            {[
              ["overview", "Overview"],
              ["invitations", `Invitations (${selectedRequestApps.filter((row) => row.invitation).length})`],
              ["activity", "Activity"],
            ].map(([id, label]) => (
              <Link
                key={id}
                href={`${tabHref("requests", { request: selectedRequest.id, panel: id, ...(props.filter ? { filter: props.filter } : {}), ...(props.query ? { q: props.query } : {}) })}`}
                scroll={false}
                className={requestPanel === id ? "border-b-2 border-[#6D4AFF] pb-2 text-[#6D4AFF]" : "pb-2 text-[#667085]"}
              >
                {label}
              </Link>
            ))}
          </div>
          {requestPanel === "overview" ? (
            <div className="mt-4 grid gap-6 sm:grid-cols-[1.4fr_0.8fr]">
              <div className="space-y-4 text-sm text-[#344054]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Brief</p>
                  <p className="mt-1 whitespace-pre-wrap">{selectedRequest.goal || "No brief yet."}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Deliverables</p>
                  <p className="mt-1 whitespace-pre-wrap">{selectedRequest.deliverables || selectedRequest.summary || "—"}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Budget</p>
                    <p className="mt-1">{selectedRequest.budget ? `${selectedRequest.budgetCurrency || "USD"} ${selectedRequest.budget}` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Response deadline</p>
                    <p className="mt-1">{selectedRequest.responseDeadline?.slice(0, 10) || "—"}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Status</p>
                  <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusTone(rows.find((row) => row.id === selectedRequest.id)?.status || "Draft")}`}>
                    {rows.find((row) => row.id === selectedRequest.id)?.status || "Draft"}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Visibility</p>
                  <p className="mt-1 font-semibold text-[#1B1464]">{rows.find((row) => row.id === selectedRequest.id)?.visibility || "Invite only"}</p>
                </div>
              </div>
            </div>
          ) : null}
          {requestPanel === "invitations" ? (
            <ul className="mt-4 divide-y divide-[#EEF2F7]">
              {selectedRequestApps.filter((row) => row.invitation).length === 0 ? (
                <li className="py-6 text-sm text-[#667085]">No invitations yet.</li>
              ) : null}
              {selectedRequestApps.filter((row) => row.invitation).map((application) => (
                <li key={application.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="relative h-10 w-10 overflow-hidden rounded-full bg-[#F4F7FF]">
                      {application.image ? <Image src={application.image} alt="" fill className="object-cover" sizes="40px" /> : (
                        <span className="flex h-full w-full items-center justify-center text-xs font-bold text-[#6D4AFF]">
                          {application.creatorName.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <div>
                      <p className="font-bold text-[#1B1464]">{application.creatorName}</p>
                      <p className={`text-xs ${application.task ? "font-semibold text-[#6D4AFF]" : "text-[#667085]"}`}>
                        {application.statusLabel || application.status.replaceAll("_", " ")}
                      </p>
                      {application.task === "answer" && application.question ? (
                        <p className="mt-1 max-w-md text-xs text-[#344054]">“{application.question}”</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/collaboration/applications/${application.id}`}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${application.task ? "bg-[#6D4AFF] text-white" : "border border-[#E6ECF7] text-[#1B1464]"}`}
                  >
                    {application.task === "answer" ? "Answer question" : application.task === "decide" ? "Review response" : "Open"}
                  </Link>
                  {application.status === "ACCEPTED" || application.status === "COLLABORATION_DRAFTED" || application.status === "REQUESTED" || application.status === "VIEWED" || application.status === "RESPONDED" || application.status === "NEGOTIATING" ? (
                    <Link
                      href={`${tabHref("requests", { request: selectedRequest.id, panel: "invitations", withdraw: application.id })}`}
                      scroll={false}
                      className="rounded-full border border-[#E6ECF7] px-3 py-1.5 text-xs font-bold text-[#1B1464]"
                    >
                      Withdraw participation
                    </Link>
                  ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {requestPanel === "activity" ? (
            <ul className="mt-4 space-y-2 text-sm text-[#4E5872]">
              <li>Request created · {selectedRequest.createdAt.slice(0, 10)}</li>
              {selectedRequestApps.map((application) => (
                <li key={application.id}>
                  {application.invitation ? "Invitation" : "Application"} · {application.creatorName} · {application.statusLabel || application.status.replaceAll("_", " ")}
                </li>
              ))}
              {selectedRequestApps.some((application) => application.hasContract) ? <li>Linked collaboration / agreement on record</li> : null}
            </ul>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3 border-t border-[#EEF2F7] pt-4">
            {selectedRequest.status !== "closed" && selectedRequest.status !== "cancelled" ? (
              <>
                <Link href={`/collaboration/business/request/${selectedRequest.id}`} className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-bold text-white">Edit request</Link>
                {props.publishedBriefIds.includes(selectedRequest.id) ? null : (
                  <Link href={`/collaboration/business/request/${selectedRequest.id}?step=3`} className="rounded-full border border-[#E6ECF7] px-4 py-2 text-sm font-bold text-indigo">Publish</Link>
                )}
                <form action={actionCloseBusinessRequest}>
                  <input type="hidden" name="briefId" value={selectedRequest.id} />
                  <button type="submit" className="rounded-full border border-[#E6ECF7] px-4 py-2 text-sm font-bold text-indigo">Close request</button>
                </form>
              </>
            ) : (
              <Link href="/collaboration/contracts" className="rounded-full border border-[#E6ECF7] px-4 py-2 text-sm font-bold text-indigo">View agreements</Link>
            )}
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-full border border-[#E6ECF7] px-4 py-2 text-sm font-bold text-indigo">More actions</summary>
              <div className="absolute bottom-12 left-0 z-10 w-48 rounded-xl border border-[#E6ECF7] bg-white p-2 text-xs shadow-lg">
                <form action={actionDeleteBusinessRequest}>
                  <input type="hidden" name="briefId" value={selectedRequest.id} />
                  <button type="submit" className="block w-full rounded-lg px-2 py-1.5 text-left text-rose-700 hover:bg-rose-50">Delete request</button>
                </form>
              </div>
            </details>
          </div>
        </AccountDialog>
      ) : null}

      {selectedDeal && selectedActive ? (
        <AccountDialog title={selectedActive.title} closeHref={tabHref("active", bucket === "all" ? {} : { filter: bucket })} wide>
          <ActiveWorkspacePopup application={selectedDeal} row={selectedActive} briefs={props.briefs} />
        </AccountDialog>
      ) : null}

      {withdrawApp && selectedRequest ? (
        <AccountDialog
          title="Withdraw participation"
          closeHref={tabHref("requests", { request: selectedRequest.id, panel: "invitations", ...(props.filter ? { filter: props.filter } : {}) })}
        >
          <form action={actionWithdrawParticipation} className="space-y-4 text-sm">
            <input type="hidden" name="applicationId" value={withdrawApp.id} />
            <input type="hidden" name="briefId" value={selectedRequest.id} />
            <input type="hidden" name="returnTab" value="requests" />
            <p><span className="text-[#667085]">Recipient</span><br /><span className="font-bold text-[#1B1464]">{withdrawApp.creatorName}</span></p>
            <p><span className="text-[#667085]">Request</span><br /><span className="font-bold text-[#1B1464]">{selectedRequest.title}</span></p>
            <label className="block">
              <span className="text-xs font-semibold text-[#667085]">Reason</span>
              <select name="reason" required defaultValue="Campaign cancelled" className="mt-1 w-full rounded-xl border border-[#E6ECF7] px-3 py-2">
                {WITHDRAW_REASONS.map((reason) => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#667085]">Message to influencer</span>
              <textarea
                name="message"
                required
                rows={4}
                defaultValue={defaultWithdrawMessage({
                  businessName: props.businessName || "The business",
                  requestTitle: selectedRequest.title || "this request",
                  reason: "Campaign cancelled",
                })}
                className="mt-1 w-full rounded-xl border border-[#E6ECF7] px-3 py-2"
              />
            </label>
            <p className="rounded-xl bg-[#EEF4FF] px-3 py-2 text-[#1D4ED8]">
              {withdrawApp.hasContract || withdrawApp.fundingStatus
                ? "If a signed agreement or funding is linked, confirmation will open settlement instead."
                : "No signed agreement or funding is linked."}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href={tabHref("requests", { request: selectedRequest.id, panel: "invitations" })}
                scroll={false}
                className="rounded-full border border-[#E6ECF7] px-4 py-2 font-bold text-indigo"
              >
                Keep participation
              </Link>
              <button type="submit" className="rounded-full bg-[#6D4AFF] px-4 py-2 font-bold text-white">Withdraw & notify</button>
            </div>
          </form>
        </AccountDialog>
      ) : null}
    </div>
  );
}

function ActiveWorkspacePopup(props: {
  application: WorkspaceApplication;
  row: ActiveQueueRow;
  briefs: CampaignBrief[];
}) {
  const brief = props.briefs.find((item) => item.id === props.application.briefId) ?? null;
  const axes = recordStatusAxes({
    invitation: props.application.status,
    agreement: props.application.hasContract ? "signed" : null,
    fundingStatus: props.application.fundingStatus,
  });
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
    <div className="space-y-5">
      <p className="text-sm text-[#667085]">{props.application.creatorName}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatusChip label="Contract" value={props.row.contractStatus} done={props.row.contractStatus === "Signed"} />
        <StatusChip label="Funding" value={props.row.fundingStatus === "Confirmed" ? "Confirmed" : props.row.fundingStatus} done={props.row.fundingStatus === "Confirmed"} />
        <StatusChip label="Payout" value={props.row.payoutStatus} done={props.row.payoutStatus === "Paid"} />
      </div>
      <div className="rounded-2xl border border-[#EEF2F7] p-4 text-sm text-[#4E5872]">
        <p className="font-semibold text-[#1B1464]">Overview</p>
        <p className="mt-2">{brief?.goal || props.application.note || "Agreed scope follows the signed request and agreement."}</p>
        <p className="mt-3">Invitation {axes.invitation} · Agreement {axes.agreement} · Funding {axes.funding} · Delivery {axes.delivery} · Bank payout {axes.payout}</p>
        <p className="mt-2 font-semibold text-[#1B1464]">Next: {props.row.nextAction}</p>
      </div>
      <div className="flex flex-wrap gap-3 text-sm font-bold">
        {!props.application.hasContract ? (
          <Link href={agreementHref} className="rounded-full bg-[#6D4AFF] px-4 py-2 text-white">Create the agreement</Link>
        ) : (
          <Link href={props.application.contractId ? `/collaboration/contracts/${props.application.contractId}` : "/collaboration/contracts"} className="rounded-full border border-[#E6ECF7] px-4 py-2 text-indigo">View agreement</Link>
        )}
        {props.application.fundingId && props.row.fundingStatus === "Confirmed" ? (
          <Link href={`/collaboration/work/${props.application.fundingId}`} className="rounded-full bg-[#6D4AFF] px-4 py-2 text-white">
            {props.row.nextAction === "Review delivery" ? "Review milestone" : "Open workspace"}
          </Link>
        ) : props.application.fundingId ? (
          <Link href={`/payments/checkout/${props.application.fundingId}`} className="rounded-full bg-[#6D4AFF] px-4 py-2 text-white">Deposit funds</Link>
        ) : null}
      </div>
    </div>
  );
}

function StatusChip({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className={`rounded-2xl border px-3 py-3 text-sm ${done ? "border-[#D7F5E5] bg-[#F3FBF7]" : "border-[#E6ECF7] bg-[#F8FAFC]"}`}>
      <p className="text-xs font-semibold text-[#667085]">{label}</p>
      <p className={`mt-1 font-bold ${done ? "text-emerald-800" : "text-[#4E5872]"}`}>{label} {value}</p>
    </div>
  );
}
