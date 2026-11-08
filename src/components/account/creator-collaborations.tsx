import type { ReactNode } from "react";
import Link from "next/link";
import { IconCalendar, IconCheck, IconHandshake, IconMail } from "@/components/icons";
import { PIPELINE_STAGES, type loadCreatorHub } from "@/lib/collaboration-hub";
import { applicationIsInvitation, applicationIsOpenPipeline } from "@/lib/marketplace-listings";
import { formatStoredMoney } from "@/lib/money";
import type { listTeamProposalsForCreator } from "@/lib/team-proposal";

type Hub = Awaited<ReturnType<typeof loadCreatorHub>>;
type Proposals = Awaited<ReturnType<typeof listTeamProposalsForCreator>>;
type Tab = "overview" | "applications" | "invitations" | "active" | "proposals" | "completed" | "history" | "saved";

function shortDate(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  }).format(date);
}

function closedProposal(status: string) {
  return status === "expired" || status === "declined";
}

const STAGE_PILL: Record<string, string> = {
  "In Progress": "bg-[#E8F8EE] text-[#178A45]",
  Review: "bg-[#FFF4D8] text-[#B86E00]",
  Contract: "bg-[#F3EEFF] text-[#6D4AFF]",
  Funded: "bg-[#E8F1FF] text-[#2F6BFF]",
  Released: "bg-[#E8F8EE] text-[#178A45]",
  Match: "bg-[#F4F6FB] text-[#667085]",
};

export function CreatorCollaborations({
  hub,
  proposals,
  creatorSlug,
  names = {},
  deadlines = [],
  deadlinesUnavailable = false,
  dueThisWeek = 0,
  tab = "overview",
  query = "",
  page = 1,
  savedMatches = [],
}: {
  hub: Hub;
  proposals: Proposals;
  creatorSlug: string;
  names?: Record<string, string>;
  deadlines?: { id: string; title: string; detail: string; at: Date }[];
  deadlinesUnavailable?: boolean;
  dueThisWeek?: number;
  tab?: string;
  query?: string;
  page?: number;
  savedMatches?: { id: string; title: string; detail: string; href: string }[];
}) {
  const current: Tab =
    tab === "applications" ||
    tab === "invitations" ||
    tab === "active" ||
    tab === "proposals" ||
    tab === "completed" ||
    tab === "history" ||
    tab === "saved"
      ? tab
      : "overview";
  const q = query.trim().toLowerCase();
  const invitations = hub.applications.filter(
    (row) => applicationIsInvitation(row) && applicationIsOpenPipeline(row.status),
  );
  const applications = hub.applications.filter((row) => !applicationIsInvitation(row) && applicationIsOpenPipeline(row.status));
  const openProposals = proposals.filter((proposal) => {
    if (closedProposal(proposal.status) || proposal.status === "accepted") return false;
    return proposal.members.some((member) => member.creatorSlug === creatorSlug && member.status === "invited");
  });
  const active = hub.pipeline.filter((row) => row.stage !== "Released" && row.stage !== "Match");
  const completed = hub.pipeline.filter((row) => row.stage === "Released");
  const history = hub.history ?? [];
  const invitationCount = invitations.length + openProposals.length + hub.status.pending;
  const payoutAccountOnFile = Boolean(hub.payout.readiness?.accountOnFile || hub.payout.readiness?.hasVerifiedMethod);
  const payoutReady = Boolean(hub.payout.readiness?.globalPayoutReady);
  const matches = (text: string) => !q || text.toLowerCase().includes(q);
  const visibleActive = active.filter((row) => matches(`${row.title} ${names[row.counterparty] || row.counterparty}`));
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(visibleActive.length / pageSize));
  const safePage = Math.min(pageCount, Math.max(1, page));
  const pagedActive = visibleActive.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[2rem] font-bold leading-none text-[#1B1464]">Collaborations</h1>
          <p className="mt-2 text-sm text-[#667085]">Manage invitations, deliverables, and ongoing work.</p>
        </div>
        <Link href="/collaboration/hub?view=opportunities" className="inline-flex items-center gap-2 rounded-full bg-[#6D4AFF] px-4 py-2.5 text-sm font-semibold text-white shadow-sm">
          <IconSearchGlyph /> Find opportunities
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active" value={active.length} icon={<IconHandshake size={18} />} tone="bg-[#F4F0FF] text-[#6D4AFF]" />
        <Stat label="Invitations" value={invitationCount} icon={<IconMail size={18} />} tone="bg-[#F3EEFF] text-[#6D4AFF]" />
        <Stat label="Due this week" value={dueThisWeek} icon={<IconCalendar size={18} />} tone="bg-[#FFF6E8] text-[#C47B12]" />
        <Stat label="Completed" value={hub.status.completed} icon={<IconCheck size={18} />} tone="bg-[#E8F8EE] text-[#178A45]" />
      </div>

      {invitationCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F3D7A1] bg-[#FFF8EC] px-4 py-3 text-sm text-[#8A5A12]">
          <span className="inline-flex items-center gap-2 font-medium">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#F6E2B8] text-[11px]">!</span>
            {invitationCount} invitation{invitationCount === 1 ? "" : "s"} need your review.
          </span>
          <Link href="/collaboration/hub?view=collaborations&tab=invitations" className="rounded-full border border-[#E7C48A] bg-white px-3 py-1.5 text-xs font-semibold text-[#8A5A12]">
            Review invitations →
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1 border-b border-[#E7ECF5] text-sm font-semibold text-[#667085]">
        {(
          [
            ["overview", "Overview", null],
            ["applications", "Applications", applications.length],
            ["invitations", "Invitations", invitationCount],
            ["active", "Active", active.length],
            ["proposals", "Team proposals", openProposals.length],
            ["completed", "Completed", completed.length],
            ["history", "History", history.length],
            ["saved", "Saved matches", savedMatches.length],
          ] as const
        ).map(([key, label, count]) => (
          <Link
            key={key}
            href={`/collaboration/hub?view=collaborations&tab=${key}`}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 ${current === key ? "border-[#6D4AFF] text-[#6D4AFF]" : "border-transparent"}`}
          >
            {label}
            {count != null && count > 0 ? (
              <span className={`rounded-full px-1.5 text-[11px] ${current === key ? "bg-[#F3EEFF]" : "bg-[#F4F6FB]"}`}>{count}</span>
            ) : null}
          </Link>
        ))}
      </div>

      {hub.degraded?.length ? (
        <p className="rounded-2xl border border-[#F3D7A1] bg-[#FFF8EC] px-4 py-3 text-sm text-[#8A5A12]">
          Could not load {hub.degraded.join(", ")}. Refresh this page to try again. Nothing here was treated as an empty account.
        </p>
      ) : null}

      {current === "overview" || current === "active" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.72fr)]">
          <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-[#1B1464]">Active collaborations</h2>
              <form action="/collaboration/hub" className="flex flex-wrap gap-2">
                <input type="hidden" name="view" value="collaborations" />
                <input type="hidden" name="tab" value={current} />
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="Search collaborations..."
                  className="h-10 w-48 rounded-full border border-[#E7ECF5] bg-[#F8FAFC] px-4 text-sm outline-none"
                />
              </form>
            </div>
            {visibleActive.length === 0 ? (
              <p className="mt-4 text-sm text-[#667085]">Agreed work appears here after setup is complete.</p>
            ) : (
              <ul className="mt-2 divide-y divide-[#EEF2F7]">
                {pagedActive.map((row) => {
                  const brand = names[row.counterparty] || row.counterparty || row.title;
                  const pct =
                    row.obligationTotal && row.obligationTotal > 0
                      ? Math.round(((row.obligationDone ?? 0) / row.obligationTotal) * 100)
                      : Math.max(8, Math.round(((Math.max(row.stageIndex, 0) + 1) / PIPELINE_STAGES.length) * 100));
                  return (
                    <li key={row.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_120px_90px_auto] lg:items-center">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar label={brand} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-[#1B1464]">{brand}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_PILL[row.stage] || STAGE_PILL.Match}`}>
                              {row.stage}
                            </span>
                          </div>
                          <p className="truncate text-xs text-[#667085]">{row.title}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">Next deliverable</p>
                        <p className="text-sm text-[#1B1464]">{row.revisionSummary || row.stage}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">Progress</p>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#EEF2F7]">
                          <div className="h-full rounded-full bg-[#6D4AFF]" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1 text-[11px] text-[#667085]">
                          {row.obligationTotal
                            ? `${row.obligationDone ?? 0} of ${row.obligationTotal} deliverables`
                            : row.stage}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">Influencer compensation</p>
                        <p className="text-sm font-semibold text-[#1B1464]">
                          {row.netCents != null && row.currency ? formatStoredMoney(row.netCents, row.currency) : "—"}
                        </p>
                        {row.grossCents != null && row.currency ? (
                          <p className="text-[11px] text-[#667085]">
                            Gross {formatStoredMoney(row.grossCents, row.currency)}
                            {row.feeCents != null ? ` · fee ${formatStoredMoney(row.feeCents, row.currency)}` : ""}
                          </p>
                        ) : null}
                      </div>
                      <Link
                        href={row.stage === "Contract" ? row.contractHref || row.href : row.href}
                        className={`inline-flex justify-center rounded-full px-3 py-2 text-xs font-semibold ${
                          row.stage === "Contract" ? "bg-[#6D4AFF] text-white" : "border border-[#E7ECF5] text-[#6D4AFF]"
                        }`}
                      >
                        {row.stage === "Contract" ? "Review contract →" : "Open workspace →"}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {pageCount > 1 ? (
              <div className="mt-3 flex items-center justify-between text-sm font-semibold text-[#6D4AFF]">
                <Link href={`/collaboration/hub?view=collaborations&tab=${current}&page=${Math.max(1, safePage - 1)}`}>Previous</Link>
                <span className="text-xs text-[#667085]">
                  {safePage} of {pageCount}
                </span>
                <Link href={`/collaboration/hub?view=collaborations&tab=${current}&page=${Math.min(pageCount, safePage + 1)}`}>Next</Link>
              </div>
            ) : active.length > 0 && current === "overview" ? (
              <Link href="/collaboration/hub?view=collaborations&tab=active" className="mt-2 inline-flex text-sm font-semibold text-[#6D4AFF]">
                View all {active.length} collaborations →
              </Link>
            ) : null}
          </section>
          <aside className="space-y-4">
            <Panel title="Upcoming deadlines">
              {deadlinesUnavailable ? (
                <p className="text-sm text-[#8A5A12]">Could not load deadlines. Refresh this page to try again.</p>
              ) : deadlines.length === 0 ? (
                <p className="text-sm text-[#667085]">Deliverable and payout dates appear when they are scheduled.</p>
              ) : (
                <ul className="space-y-3">
                  {deadlines.slice(0, 4).map((row) => (
                    <li key={row.id} className="flex items-start justify-between gap-3 text-sm">
                      <span>
                        <span className="block font-semibold text-[#1B1464]">{row.title}</span>
                        <span className="text-xs text-[#667085]">{row.detail}</span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-[#667085]">{shortDate(row.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel
              title="Payment readiness"
              extra={
                payoutReady ? (
                  <span className="text-xs font-semibold text-[#178A45]">Ready</span>
                ) : (
                  <span className="text-xs font-semibold text-[#D14343]">Not ready</span>
                )
              }
            >
              <p className="text-sm text-[#667085]">
                {payoutReady
                  ? "Identity, payout region, and payout account are ready. This is not a payment that has already been sent."
                  : payoutAccountOnFile
                    ? hub.payout.readiness?.blockers[0] ||
                      "A payout account is on file. Releases stay blocked until identity and your payout region are cleared."
                    : hub.payout.readiness?.blockers[0] || "Connect a payout account before a release can be sent."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {payoutAccountOnFile ? null : (
                  <Link href="/creator/earnings#payouts" className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
                    Set up payouts
                  </Link>
                )}
                <Link href="/creator/earnings" className="rounded-full border border-[#E7ECF5] px-4 py-2 text-sm font-semibold text-[#6D4AFF]">
                  View earnings →
                </Link>
              </div>
            </Panel>
            <Panel title="Recent collaboration activity">
              {hub.pipeline.length === 0 && invitations.length === 0 ? (
                <p className="text-sm text-[#667085]">Activity appears after a collaboration starts.</p>
              ) : (
                <ul className="space-y-3">
                  {hub.pipeline.slice(0, 4).map((row) => (
                    <li key={row.id} className="flex items-start justify-between gap-3 text-sm">
                      <span>
                        <span className="block font-semibold text-[#1B1464]">{row.stage}</span>
                        <span className="text-xs text-[#667085]">{row.title}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </aside>
        </div>
      ) : null}

      {current === "overview" || current === "invitations" ? (
        <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
          <h2 className="font-display text-lg font-bold text-[#1B1464]">Invitations</h2>
          {invitations.length + openProposals.length === 0 && hub.status.pending === 0 ? (
            <p className="mt-3 text-sm text-[#667085]">No invitations are waiting. Applications you send stay in Applications sent.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#EEF2F7]">
              {invitations.map((row) => (
                <InviteRow
                  key={row.id}
                  brand={row.requestBrand || "Invitation"}
                  title={row.opportunityLookingFor || row.note || "Review the invitation"}
                  meta={shortDate(row.createdAt) ? `Received ${shortDate(row.createdAt)}` : "Needs your response"}
                  href={`/collaboration/applications/${row.id}`}
                  action="View invitation →"
                />
              ))}
              {openProposals.map((proposal) => (
                <InviteRow
                  key={proposal.id}
                  brand={proposal.title}
                  title="Team proposal"
                  meta="Needs your response · accepting does not start the collaboration"
                  href={`/collaboration/team/${proposal.id}`}
                  action="View invitation →"
                />
              ))}
              {hub.status.pending > 0 ? (
                <li className="py-3">
                  <Link href="/collaboration/records" className="text-sm font-semibold text-[#6D4AFF]">
                    {hub.status.pending} collaboration proposal{hub.status.pending === 1 ? "" : "s"} waiting →
                  </Link>
                </li>
              ) : null}
            </ul>
          )}
        </section>
      ) : null}

      {current === "applications" && applications.length === 0 ? (
        <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-[#1B1464]">Applications sent</h2>
          <p className="mt-3 text-sm text-[#667085]">Applications you send appear here. They are not invitations.</p>
        </section>
      ) : null}

      {(current === "overview" || current === "applications") && applications.length > 0 ? (
        <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
          <h2 className="font-display text-lg font-bold text-[#1B1464]">Applications sent</h2>
          <ul className="mt-3 divide-y divide-[#EEF2F7]">
            {applications.map((row) => (
              <InviteRow
                key={row.id}
                brand={row.requestBrand || row.opportunityLookingFor || "Application"}
                title="Application sent"
                meta={row.status.replaceAll("_", " ")}
                href={`/collaboration/applications/${row.id}`}
                action="View application →"
              />
            ))}
          </ul>
        </section>
      ) : null}

      {current === "proposals" ? (
        <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-[#1B1464]">Team proposals</h2>
          {proposals.length === 0 ? (
            <p className="mt-3 text-sm text-[#667085]">Team invitations appear here. Acceptance still needs the other participants, a contract, and funding.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#EEF2F7]">
              {proposals.map((proposal) => {
                const mine = proposal.members.find((member) => member.creatorSlug === creatorSlug);
                const meta = closedProposal(proposal.status)
                  ? proposal.status === "expired"
                    ? "Expired"
                    : "Declined"
                  : proposal.status === "accepted"
                    ? "All participants accepted · contract and funding still required"
                    : mine?.status === "accepted"
                      ? "You accepted · waiting on other participants"
                      : "Needs your response";
                return (
                  <InviteRow key={proposal.id} brand={proposal.title} title="Team proposal" meta={meta} href={`/collaboration/team/${proposal.id}`} action="View invitation →" />
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {current === "completed" ? (
        <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-[#1B1464]">Completed</h2>
          {completed.length === 0 ? (
            <p className="mt-3 text-sm text-[#667085]">Finished collaborations appear here.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#EEF2F7]">
              {completed.map((row) => (
                <InviteRow
                  key={row.id}
                  brand={names[row.counterparty] || row.title}
                  title={row.title}
                  meta="Completed"
                  href={row.href}
                  action="Open workspace →"
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {current === "history" ? (
        <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-[#1B1464]">History</h2>
          <p className="mt-1 text-sm text-[#667085]">Declined, withdrawn, and expired work stays here. It is not completed delivery.</p>
          {history.length === 0 ? (
            <p className="mt-3 text-sm text-[#667085]">Closed proposals and applications appear here.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#EEF2F7]">
              {history.map((row) => (
                <InviteRow
                  key={`${row.source}-${row.id}`}
                  brand={names[row.counterparty] || row.title}
                  title={row.title}
                  meta={row.counterparty === "Expired" || row.counterparty === "Withdrawn" || row.counterparty === "Declined" ? row.counterparty : "Closed"}
                  href={row.href}
                  action="Open record →"
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {current === "saved" ? (
        <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-[#1B1464]">Saved matches</h2>
          <p className="mt-1 text-sm text-[#667085]">
            Saved campaigns live on{" "}
            <Link href="/collaboration/hub?view=opportunities&tab=saved" className="font-semibold text-[#6D4AFF]">
              Opportunities → Saved
            </Link>
            .
          </p>
          {savedMatches.length === 0 ? (
            <p className="mt-3 text-sm text-[#667085]">No saved partner matches yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#EEF2F7]">
              {savedMatches.map((row) => (
                <InviteRow key={row.id} brand={row.title} title="Saved partner" meta={row.detail} href={row.href} action="Request collaboration →" />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

function IconSearchGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function Avatar({ label }: { label: string }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F3EEFF] text-sm font-bold text-[#6D4AFF]">
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: number; icon: ReactNode; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#E7ECF5] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>{icon}</span>
      <div>
        <p className="text-[13px] font-medium text-[#667085]">{label}</p>
        <p className="font-display text-[1.7rem] font-bold leading-none text-[#1B1464]">{value}</p>
      </div>
    </div>
  );
}

function Panel({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-[#1B1464]">{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

function InviteRow({
  brand,
  title,
  meta,
  href,
  action,
}: {
  brand: string;
  title: string;
  meta: string;
  href: string;
  action: string;
}) {
  return (
    <li className="grid items-center gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
      <div className="flex items-center gap-3">
        <Avatar label={brand} />
        <p className="font-semibold text-[#1B1464]">{brand}</p>
      </div>
      <p className="text-sm text-[#667085]">{title}</p>
      <p className="text-xs text-[#98A2B3]">{meta}</p>
      <Link href={href} className="justify-self-start rounded-full border border-[#E7ECF5] px-3 py-1.5 text-xs font-semibold text-[#6D4AFF] sm:justify-self-end">
        {action}
      </Link>
    </li>
  );
}
