import Link from "next/link";
import { actionRespondTeamProposal, actionSendTeamProposal } from "@/app/collaboration/team/actions";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { prisma } from "@/lib/db";
import { listDirectoryCreators } from "@/lib/directory";
import { teamFundingReady } from "@/lib/team-proposal";
import { listTeamProposalsForCreator, listTeamProposalsForWorkspace } from "@/lib/team-proposal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team proposals" };

type Props = { searchParams: Promise<{ error?: string; sent?: string; status?: string }> };

export default async function TeamProposalPage({ searchParams }: Props) {
  const params = await searchParams;
  const account = await getAccountSession();
  const ws = await getWorkspace(account?.id);
  const creator = account
    ? await prisma.creator.findFirst({ where: { userId: account.id }, select: { slug: true } })
    : null;
  const [directory, outgoing, incoming] = await Promise.all([
    listDirectoryCreators().catch(() => []),
    account && ws.businessId !== "public" ? listTeamProposalsForWorkspace(ws.businessId).catch(() => []) : [],
    creator ? listTeamProposalsForCreator(creator.slug).catch(() => []) : [],
  ]);

  return (
    <div className="bg-[#F7FAFF]">
      <section className="hero-atmosphere text-white">
        <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6">
          <Link href="/collaboration/business" className="text-sm font-semibold text-lavender/90 hover:underline">
            ← Business hub
          </Link>
          <h1 className="mt-2 font-display text-4xl font-bold">Team proposals</h1>
          <p className="mt-3 max-w-2xl text-white/75">
            Invite two or more influencers on one proposal. The contract opens only after every person accepts.
            Funding waits until every payout route is ready.
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-[90rem] space-y-8 px-4 py-10 sm:px-6">
        {params.error ? <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{params.error}</p> : null}
        {params.sent ? <p className="text-sm font-semibold text-emerald-700">Proposal sent.</p> : null}
        {params.status ? <p className="text-sm font-semibold text-indigo">Status: {params.status}</p> : null}

        {account && ws.businessId !== "public" ? (
          <form action={actionSendTeamProposal} className="card-surface space-y-3 p-6">
            <h2 className="font-display text-xl font-bold text-indigo">Send a team proposal</h2>
            <label className="block text-sm font-semibold text-indigo">
              Title
              <input name="title" required className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
            </label>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="text-sm font-semibold text-indigo">Creators</legend>
              {directory.slice(0, 12).map((person) => (
                <label key={person.slug} className="flex items-center gap-2 text-sm text-indigo">
                  <input type="checkbox" name="creatorSlug" value={person.slug} />
                  {person.displayName}
                </label>
              ))}
            </fieldset>
            <button type="submit" className="btn-primary !py-2 text-sm">
              Send proposal
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted">
            <Link href="/login?next=/collaboration/team" className="font-semibold text-violet hover:underline">
              Sign in
            </Link>{" "}
            with a business account to send a team proposal.
          </p>
        )}

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-indigo">Your proposals</h2>
          {outgoing.length === 0 ? <p className="text-sm text-muted">No team proposals from this workspace.</p> : null}
          {outgoing.map((proposal) => {
            const ready = teamFundingReady({
              status: proposal.status,
              payoutReady: proposal.members.map(() => false),
            });
            return (
              <article key={proposal.id} className="card-surface p-4">
                <p className="font-semibold text-indigo">{proposal.title}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-violet">{proposal.status}</p>
                <ul className="mt-2 text-sm text-muted">
                  {proposal.members.map((member) => (
                    <li key={member.id}>
                      {member.creatorSlug} · {member.status}
                    </li>
                  ))}
                </ul>
                {proposal.status === "accepted" ? (
                  <p className="mt-2 text-sm text-indigo">
                    {ready.ok
                      ? "Ready to fund."
                      : "Contract can open. Funding stays blocked until every payout route is ready."}
                  </p>
                ) : null}
              </article>
            );
          })}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-indigo">Invitations for you</h2>
          {incoming.length === 0 ? <p className="text-sm text-muted">No team invitations on this account.</p> : null}
          {incoming.map((proposal) => (
            <article key={proposal.id} className="card-surface p-4">
              <p className="font-semibold text-indigo">{proposal.title}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-violet">{proposal.status}</p>
              {proposal.status === "sent" && creator ? (
                <form action={actionRespondTeamProposal} className="mt-3 flex gap-2">
                  <input type="hidden" name="proposalId" value={proposal.id} />
                  <button name="decision" value="accepted" className="btn-primary !py-1.5 text-xs">
                    Accept
                  </button>
                  <button name="decision" value="declined" className="btn-secondary !py-1.5 text-xs">
                    Decline
                  </button>
                </form>
              ) : null}
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
