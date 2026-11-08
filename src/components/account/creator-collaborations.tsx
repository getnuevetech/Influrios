import type { ReactNode } from "react";
import Link from "next/link";
import { IconCalendar, IconCheck, IconHandshake, IconMail } from "@/components/icons";
import type { loadCreatorHub } from "@/lib/collaboration-hub";
import { applicationIsInvitation, applicationIsOpenPipeline } from "@/lib/marketplace-listings";
import { formatMoney } from "@/lib/money";
import type { listTeamProposalsForCreator } from "@/lib/team-proposal";

type Hub = Awaited<ReturnType<typeof loadCreatorHub>>;
type Proposals = Awaited<ReturnType<typeof listTeamProposalsForCreator>>;

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

export function CreatorCollaborations({
  hub,
  proposals,
  creatorSlug,
  names = {},
  deadlines = [],
  dueThisWeek = 0,
}: {
  hub: Hub;
  proposals: Proposals;
  creatorSlug: string;
  names?: Record<string, string>;
  deadlines?: { id: string; title: string; detail: string; at: Date }[];
  dueThisWeek?: number;
}) {
  const invitations = hub.applications.filter(
    (row) => applicationIsInvitation(row) && applicationIsOpenPipeline(row.status),
  );
  const openProposals = proposals.filter((proposal) =>
    proposal.members.some((member) => member.creatorSlug === creatorSlug && member.status === "invited"),
  );
  const active = hub.pipeline.filter((row) => row.stage !== "Released" && row.stage !== "Match");
  const completed = hub.status.completed;
  const invitationCount = invitations.length + hub.status.pending + openProposals.length;
  const payoutReady = Boolean(hub.payout.readiness?.globalPayoutReady || hub.payout.readiness?.hasVerifiedMethod);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#1a1464]">Collaborations</h1>
          <p className="mt-1 text-sm text-[#6b7394]">Manage invitations, deliverables, and ongoing work.</p>
        </div>
        <Link href="/collaboration/hub?view=opportunities" className="btn-primary">
          Find opportunities
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active" value={hub.status.active} icon={<IconHandshake size={16} />} tone="bg-[#F4F0FF] text-[#6d4aff]" />
        <Stat label="Invitations" value={invitationCount} icon={<IconMail size={16} />} tone="bg-[#EEF3FF] text-[#3d6bff]" />
        <Stat label="Due this week" value={dueThisWeek} icon={<IconCalendar size={16} />} tone="bg-[#FFF6E8] text-[#C47B12]" />
        <Stat label="Completed" value={completed} icon={<IconCheck size={16} />} tone="bg-[#E9F8EF] text-[#159A4A]" />
      </div>

      {invitationCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F3D7A4] bg-[#FFF7E8] px-4 py-3 text-sm text-[#8A5A12]">
          <span>
            {invitationCount} invitation{invitationCount === 1 ? "" : "s"} need your review.
          </span>
          <a href="#invitations" className="rounded-full border border-[#E7C48A] bg-white px-3 py-1 text-xs font-semibold">
            Review invitations →
          </a>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-[#E6ECF7] text-sm font-semibold text-[#5c6588]">
        <span className="border-b-2 border-[#6d4aff] px-3 py-2 text-[#6d4aff]">Overview</span>
        <a href="#invitations" className="px-3 py-2">Invitations {invitationCount}</a>
        <a href="#active" className="px-3 py-2">Active {active.length}</a>
        <a href="#proposals" className="px-3 py-2">Team proposals {openProposals.length}</a>
        <span className="px-3 py-2">Completed {completed}</span>
        <span className="px-3 py-2">Saved matches {hub.status.saved}</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.75fr)]">
        <section id="active" className="rounded-3xl border border-[#E6ECF7] bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#1a1464]">Active collaborations</h2>
          {active.length === 0 ? (
            <p className="mt-3 text-sm text-[#6b7394]">Accepted collaborations will show here.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#EEF2FA]">
              {active.map((row) => {
                const brand = names[row.counterparty] || row.counterparty || row.title;
                return (
                  <li key={row.id} className="grid gap-3 py-3 md:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.6fr))] md:items-center">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F0FF] text-sm font-bold text-[#6d4aff]">
                        {brand.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <p className="font-semibold text-[#1a1464]">{brand}</p>
                        <p className="text-xs text-[#6b7394]">{row.title}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8b93ad]">Next deliverable</p>
                      <p className="text-sm text-[#1a1464]">{row.revisionSummary || row.stage}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8b93ad]">Agreed fee</p>
                      <p className="text-sm font-semibold text-[#1a1464]">
                        {row.grossCents != null && row.currency ? formatMoney(row.grossCents, row.currency) : "—"}
                      </p>
                    </div>
                    <Link
                      href={row.stage === "Contract" ? "/collaboration/contracts" : row.href}
                      className="inline-flex justify-center rounded-full border border-[#E6ECF7] px-3 py-1.5 text-xs font-semibold text-[#6d4aff]"
                    >
                      {row.stage === "Contract" ? "Review contract →" : "Open workspace →"}
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
              <h2 className="font-display text-lg font-bold text-[#1a1464]">Payment readiness</h2>
              {payoutReady ? null : <span className="text-xs font-semibold text-[#d14343]">Action required</span>}
            </div>
            <p className="mt-2 text-sm text-[#6b7394]">
              {payoutReady
                ? "A payout method is saved for completed collaborations."
                : "Connect a payout account to get paid for completed collaborations."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/creator/earnings#payouts" className="btn-primary">
                Set up payouts
              </Link>
              <Link href="/creator/earnings" className="btn-secondary">
                View earnings →
              </Link>
            </div>
          </section>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section id="invitations" className="rounded-3xl border border-[#E6ECF7] bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#1a1464]">Invitations</h2>
          {invitations.length === 0 && openProposals.length === 0 && hub.status.pending === 0 ? (
            <p className="mt-3 text-sm text-[#6b7394]">No invitations are waiting.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {invitations.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#1a1464]">{row.requestBrand || row.opportunityLookingFor || "Invitation"}</p>
                    <p className="text-xs text-[#6b7394]">{shortDate(row.createdAt)}</p>
                  </div>
                  <Link href={`/collaboration/applications/${row.id}`} className="rounded-full border border-[#E6ECF7] px-3 py-1 text-xs font-semibold text-[#6d4aff]">
                    View invitation →
                  </Link>
                </li>
              ))}
              {openProposals.map((proposal) => (
                <li key={proposal.id} className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[#1a1464]">{proposal.title}</p>
                  <Link href={`/collaboration/team/${proposal.id}`} className="rounded-full border border-[#E6ECF7] px-3 py-1 text-xs font-semibold text-[#6d4aff]">
                    View invitation →
                  </Link>
                </li>
              ))}
              {hub.status.pending > 0 ? (
                <li>
                  <Link href="/collaboration/records" className="text-xs font-semibold text-[#6d4aff]">
                    {hub.status.pending} collaboration proposal{hub.status.pending === 1 ? "" : "s"} waiting →
                  </Link>
                </li>
              ) : null}
            </ul>
          )}
        </section>
        <section id="proposals" className="rounded-3xl border border-[#E6ECF7] bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#1a1464]">Recent collaboration activity</h2>
          {hub.pipeline.length === 0 ? (
            <p className="mt-3 text-sm text-[#6b7394]">Activity appears after a collaboration starts.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {hub.pipeline.slice(0, 4).map((row) => (
                <li key={row.id}>
                  <p className="font-semibold text-[#1a1464]">{row.stage}</p>
                  <p className="text-[#6b7394]">{row.title}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
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
