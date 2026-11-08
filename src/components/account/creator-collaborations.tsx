import type { ReactNode } from "react";
import Link from "next/link";
import { IconCalendar, IconCheck, IconHandshake, IconMail } from "@/components/icons";
import type { loadCreatorHub } from "@/lib/collaboration-hub";
import { applicationIsInvitation, applicationIsOpenPipeline } from "@/lib/marketplace-listings";
import { formatStoredMoney } from "@/lib/money";
import type { listTeamProposalsForCreator } from "@/lib/team-proposal";

type Hub = Awaited<ReturnType<typeof loadCreatorHub>>;
type Proposals = Awaited<ReturnType<typeof listTeamProposalsForCreator>>;
type Tab = "overview" | "applications" | "invitations" | "proposals" | "active" | "history";

function shortDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  }).format(date);
}

function proposalClosed(status: string) {
  return status === "expired" || status === "declined";
}

export function CreatorCollaborations({
  hub,
  proposals,
  creatorSlug,
  names = {},
  deadlines = [],
  dueThisWeek = 0,
  tab = "overview",
}: {
  hub: Hub;
  proposals: Proposals;
  creatorSlug: string;
  names?: Record<string, string>;
  deadlines?: { id: string; title: string; detail: string; at: Date }[];
  dueThisWeek?: number;
  tab?: string;
}) {
  const current: Tab =
    tab === "applications" || tab === "invitations" || tab === "proposals" || tab === "active" || tab === "history"
      ? tab
      : "overview";
  const invitations = hub.applications.filter(
    (row) => applicationIsInvitation(row) && applicationIsOpenPipeline(row.status),
  );
  const pendingApplications = hub.applications.filter(
    (row) => !applicationIsInvitation(row) && applicationIsOpenPipeline(row.status),
  );
  const setupApplications = hub.applications.filter(
    (row) => !applicationIsInvitation(row) && (row.status === "ACCEPTED" || row.status === "COLLABORATION_DRAFTED"),
  );
  const openProposals = proposals.filter((proposal) => {
    if (proposalClosed(proposal.status) || proposal.status === "accepted") return false;
    return proposal.members.some((member) => member.creatorSlug === creatorSlug && member.status === "invited");
  });
  const active = hub.pipeline.filter((row) => row.stage !== "Released" && row.stage !== "Match");
  const historyApplications = hub.applications.filter(
    (row) => row.status === "DECLINED" || row.status === "EXPIRED" || row.status === "WITHDRAWN",
  );
  const historyWork = hub.pipeline.filter((row) => row.stage === "Released");
  const historyProposals = proposals.filter(
    (proposal) => proposalClosed(proposal.status) || proposal.members.some((member) => member.creatorSlug === creatorSlug && member.status === "declined"),
  );
  const needsAction = invitations.length + openProposals.length + hub.status.pending;
  const payoutReady = Boolean(hub.payout.readiness?.globalPayoutReady || hub.payout.readiness?.hasVerifiedMethod);
  const show = (name: Tab) => current === "overview" || current === name;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#1a1464]">Collaborations</h1>
          <p className="mt-1 text-sm text-[#6b7394]">Your collaboration workspace. Manage applications, invitations, and agreed work.</p>
        </div>
        <Link href="/collaboration/hub?view=opportunities" className="btn-primary">
          Find opportunities
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Needs your action" value={needsAction} icon={<IconMail size={16} />} tone="bg-[#FFF6E8] text-[#C47B12]" />
        <Stat label="Pending applications" value={pendingApplications.length} icon={<IconCheck size={16} />} tone="bg-[#EEF3FF] text-[#3d6bff]" />
        <Stat label="Active collaborations" value={active.length} icon={<IconHandshake size={16} />} tone="bg-[#F4F0FF] text-[#6d4aff]" />
        <Stat label="Upcoming deadlines" value={dueThisWeek} icon={<IconCalendar size={16} />} tone="bg-[#E9F8EF] text-[#159A4A]" />
      </div>

      {needsAction > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F3D7A4] bg-[#FFF7E8] px-4 py-3 text-sm text-[#8A5A12]">
          <span>
            {needsAction} item{needsAction === 1 ? "" : "s"} need your action.
          </span>
          <Link href="/collaboration/hub?view=collaborations&tab=invitations" className="rounded-full border border-[#E7C48A] bg-white px-3 py-1 text-xs font-semibold">
            Review invitations →
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-[#E6ECF7] text-sm font-semibold text-[#5c6588]">
        {(
          [
            ["overview", "Overview"],
            ["applications", `Applications ${pendingApplications.length + setupApplications.length}`],
            ["invitations", `Invitations ${invitations.length}`],
            ["proposals", `Team proposals ${proposals.length}`],
            ["active", `Active ${active.length}`],
            ["history", "History"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={`/collaboration/hub?view=collaborations&tab=${key}`}
            className={`border-b-2 px-3 py-2 ${current === key ? "border-[#6d4aff] text-[#6d4aff]" : "border-transparent"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {show("applications") ? (
        <section className="rounded-3xl border border-[#E6ECF7] bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#1a1464]">Applications</h2>
          {pendingApplications.length + setupApplications.length === 0 ? (
            <p className="mt-3 text-sm text-[#6b7394]">Applications you submit appear here. The original listing then shows Applied.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#EEF2FA]">
              {[...setupApplications, ...pendingApplications].map((row) => (
                <Item
                  key={row.id}
                  title={row.requestBrand || row.opportunityLookingFor || "Application"}
                  status={row.status === "ACCEPTED" || row.status === "COLLABORATION_DRAFTED" ? "Accepted · setup still required" : row.status.replaceAll("_", " ")}
                  next={row.status === "ACCEPTED" ? "Continue terms, contract, and funding" : "Waiting on the other party"}
                  href={`/collaboration/applications/${row.id}`}
                  action="View application →"
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {show("invitations") ? (
        <section className="rounded-3xl border border-[#E6ECF7] bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#1a1464]">Invitations</h2>
          {invitations.length === 0 && openProposals.length === 0 && hub.status.pending === 0 ? (
            <p className="mt-3 text-sm text-[#6b7394]">No invitations are waiting. Expired invitations stay in History.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#EEF2FA]">
              {invitations.map((row) => (
                <Item
                  key={row.id}
                  title={row.requestBrand || row.opportunityLookingFor || "Invitation"}
                  status="Needs your response"
                  next={`Received ${shortDate(row.createdAt)}`}
                  href={`/collaboration/applications/${row.id}`}
                  action="Review invitation →"
                />
              ))}
              {openProposals.map((proposal) => (
                <Item
                  key={proposal.id}
                  title={proposal.title}
                  status="Team proposal · needs your response"
                  next="Accepting does not start the collaboration until the other participants and setup are complete"
                  href={`/collaboration/team/${proposal.id}`}
                  action="Review invitation →"
                />
              ))}
              {hub.status.pending > 0 ? (
                <li className="py-3">
                  <Link href="/collaboration/records" className="text-sm font-semibold text-[#6d4aff]">
                    {hub.status.pending} collaboration proposal{hub.status.pending === 1 ? "" : "s"} waiting →
                  </Link>
                </li>
              ) : null}
            </ul>
          )}
        </section>
      ) : null}

      {show("proposals") ? (
        <section className="rounded-3xl border border-[#E6ECF7] bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#1a1464]">Team proposals</h2>
          {proposals.length === 0 ? (
            <p className="mt-3 text-sm text-[#6b7394]">Team invitations appear here. An acceptance is not an active collaboration by itself.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#EEF2FA]">
              {proposals.map((proposal) => {
                const mine = proposal.members.find((member) => member.creatorSlug === creatorSlug);
                const status = proposalClosed(proposal.status)
                  ? proposal.status === "expired"
                    ? "Expired"
                    : "Declined"
                  : proposal.status === "accepted"
                    ? "All participants accepted · contract and funding still required"
                    : mine?.status === "accepted"
                      ? "You accepted · waiting on other participants"
                      : mine?.status === "declined"
                        ? "You declined"
                        : "Needs your response";
                return (
                  <Item
                    key={proposal.id}
                    title={proposal.title}
                    status={status}
                    next={proposal.members.map((member) => `${member.creatorSlug} · ${member.status}`).join(" · ")}
                    href={`/collaboration/team/${proposal.id}`}
                    action={proposalClosed(proposal.status) ? "View history →" : "Review invitation →"}
                  />
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {show("active") ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.75fr)]">
          <section className="rounded-3xl border border-[#E6ECF7] bg-white p-4 shadow-sm">
            <h2 className="font-display text-lg font-bold text-[#1a1464]">Active collaborations</h2>
            {active.length === 0 ? (
              <p className="mt-3 text-sm text-[#6b7394]">Agreed work appears here after the required setup is complete.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[#EEF2FA]">
                {active.map((row) => {
                  const brand = names[row.counterparty] || row.counterparty || row.title;
                  return (
                    <li key={row.id} className="grid gap-3 py-3 md:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.6fr))] md:items-center">
                      <div>
                        <p className="font-semibold text-[#1a1464]">{brand}</p>
                        <p className="text-xs text-[#6b7394]">{row.title}</p>
                        <p className="mt-1 text-xs text-[#8b93ad]">{row.stage}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8b93ad]">Next</p>
                        <p className="text-sm text-[#1a1464]">{row.revisionSummary || row.stage}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8b93ad]">Agreed fee</p>
                        <p className="text-sm font-semibold text-[#1a1464]">
                          {row.grossCents != null && row.currency ? formatStoredMoney(row.grossCents, row.currency) : "—"}
                        </p>
                      </div>
                      <Link
                        href={row.href}
                        className="inline-flex justify-center rounded-full border border-[#E6ECF7] px-3 py-1.5 text-xs font-semibold text-[#6d4aff]"
                      >
                        Open workspace →
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <div className="space-y-4">
            <section className="rounded-3xl border border-[#E6ECF7] bg-white p-4 shadow-sm">
              <h2 className="font-display text-lg font-bold text-[#1a1464]">Upcoming deadlines</h2>
              {deadlines.length === 0 ? (
                <p className="mt-3 text-sm text-[#6b7394]">Deadlines appear when a release is scheduled.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {deadlines.slice(0, 4).map((row) => (
                    <li key={row.id} className="flex justify-between gap-3">
                      <span className="text-[#1a1464]">
                        {row.title}
                        <span className="block text-xs text-[#6b7394]">{row.detail}</span>
                      </span>
                      <span className="text-[#6b7394]">{shortDate(row.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-3xl border border-[#E6ECF7] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-[#1a1464]">Payments</h2>
                {payoutReady ? null : <span className="text-xs font-semibold text-[#d14343]">Action required</span>}
              </div>
              <p className="mt-2 text-sm text-[#6b7394]">
                {payoutReady
                  ? "A payout method is saved. Earnings and contracts stay on their own pages."
                  : "Connect a payout account before completed work can be paid."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/creator/earnings#payouts" className="btn-primary">
                  Set up payouts
                </Link>
                <Link href="/collaboration/contracts" className="btn-secondary">
                  Contracts →
                </Link>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {show("history") ? (
        <section className="rounded-3xl border border-[#E6ECF7] bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#1a1464]">History</h2>
          {historyApplications.length + historyWork.length + historyProposals.length === 0 ? (
            <p className="mt-3 text-sm text-[#6b7394]">Completed, declined, cancelled, and expired work appears here.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#EEF2FA]">
              {historyApplications.map((row) => (
                <Item
                  key={row.id}
                  title={row.requestBrand || row.opportunityLookingFor || "Application"}
                  status={row.status === "EXPIRED" ? "Expired" : row.status === "DECLINED" ? "Declined" : "Withdrawn"}
                  next="No response is needed"
                  href={`/collaboration/applications/${row.id}`}
                  action="View record →"
                />
              ))}
              {historyWork.map((row) => (
                <Item
                  key={row.id}
                  title={row.title}
                  status="Completed"
                  next={names[row.counterparty] || row.counterparty}
                  href={row.href}
                  action="Open workspace →"
                />
              ))}
              {historyProposals.map((proposal) => (
                <Item
                  key={proposal.id}
                  title={proposal.title}
                  status={proposal.status === "expired" ? "Expired" : "Declined"}
                  next="No response is needed"
                  href={`/collaboration/team/${proposal.id}`}
                  action="View record →"
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

function Item({
  title,
  status,
  next,
  href,
  action,
}: {
  title: string;
  status: string;
  next: string;
  href: string;
  action: string;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div>
        <p className="font-semibold text-[#1a1464]">{title}</p>
        <p className="text-xs text-[#6b7394]">{status}</p>
        <p className="text-xs text-[#8b93ad]">Next: {next}</p>
      </div>
      <Link href={href} className="rounded-full border border-[#E6ECF7] px-3 py-1 text-xs font-semibold text-[#6d4aff]">
        {action}
      </Link>
    </li>
  );
}

function Stat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#E6ECF7] bg-white px-4 py-3 shadow-sm">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
      <div>
        <p className="text-xs font-semibold text-[#6b7394]">{label}</p>
        <p className="font-display text-2xl font-bold text-[#1a1464]">{value}</p>
      </div>
    </div>
  );
}
