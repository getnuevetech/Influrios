import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { actionRespondTeamProposal } from "@/app/collaboration/team/actions";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { prisma } from "@/lib/db";
import {
  getTeamProposal,
  teamMemberStatusLabel,
  wizardHrefForProposal,
} from "@/lib/team-proposal";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; status?: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proposal = await getTeamProposal(id).catch(() => null);
  return { title: proposal ? `${proposal.title} · Team invitation` : "Team invitation" };
}

export default async function TeamProposalDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const account = await getAccountSession().catch(() => null);
  if (!account) {
    redirect(`/login?next=${encodeURIComponent(`/collaboration/team/${id}`)}`);
  }

  const proposal = await getTeamProposal(id).catch(() => null);
  if (!proposal) notFound();

  const creator = await prisma.creator
    .findFirst({ where: { userId: account.id }, select: { slug: true } })
    .catch(() => null);
  const ws = await getWorkspace(account.id).catch(() => null);
  const ownsAsBusiness = Boolean(ws && ws.businessId !== "public" && ws.businessId === proposal.workspaceId);
  const myMember = creator
    ? proposal.members.find((member) => member.creatorSlug === creator.slug)
    : null;

  if (!ownsAsBusiness && !myMember) {
    redirect("/collaboration/team?error=" + encodeURIComponent("You are not on this proposal."));
  }

  const canRespond =
    Boolean(myMember && myMember.status === "invited") &&
    (proposal.status === "sent" || proposal.status === "partial");
  const wizardHref = wizardHrefForProposal(proposal);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <Link
        href={ownsAsBusiness ? "/collaboration/team" : "/collaboration/hub#team-proposals"}
        className="inline-flex items-center gap-1 text-sm font-semibold text-violet hover:underline"
      >
        ← Back to list
      </Link>

      {query.status ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Proposal status: {query.status}
        </p>
      ) : null}
      {query.error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{query.error}</p>
      ) : null}

      <article className="rounded-3xl border border-[#E6ECF7] bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet">Team invitation</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-indigo">{proposal.title}</h1>
        <p className="mt-2 text-sm text-muted">
          Proposal status:{" "}
          <span className="font-semibold uppercase text-violet">{proposal.status}</span>
        </p>
        {myMember ? (
          <p className="mt-1 text-sm font-semibold text-indigo">
            Your response: {teamMemberStatusLabel(myMember.status)}
          </p>
        ) : null}

        {proposal.campaignIntent ? (
          <section className="mt-5">
            <h2 className="text-sm font-bold text-indigo">Campaign intent</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#4E5872]">
              {proposal.campaignIntent}
            </p>
          </section>
        ) : null}

        <section className="mt-5">
          <h2 className="text-sm font-bold text-indigo">Team members</h2>
          <ul className="mt-2 space-y-2">
            {proposal.members.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E8EDF8] bg-[#F8F6FF] px-3 py-2 text-sm"
              >
                <span className="font-semibold text-indigo">
                  {member.creatorSlug}
                  {creator && member.creatorSlug === creator.slug ? " (you)" : ""}
                </span>
                <span className="text-xs font-bold uppercase text-violet">
                  {member.status === "invited" && creator?.slug === member.creatorSlug
                    ? teamMemberStatusLabel(member.status)
                    : member.status}
                  {" · "}
                  {(member.shareBps / 100).toFixed(2)}%
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-6 rounded-2xl border border-[#E6ECF7] bg-[#F8F6FF] p-4">
          {canRespond ? (
            <>
              <p className="mb-2 text-sm font-bold text-indigo">Respond to this invitation</p>
              <p className="mb-3 text-xs text-muted">
                Review the campaign intent and team shares above before accepting or declining.
              </p>
              <form action={actionRespondTeamProposal} className="flex flex-wrap gap-2">
                <input type="hidden" name="proposalId" value={proposal.id} />
                <input type="hidden" name="returnTo" value={`/collaboration/team/${proposal.id}`} />
                <button name="decision" value="accepted" className="btn-primary !py-2 text-sm">
                  Accept invitation
                </button>
                <button name="decision" value="declined" className="btn-secondary !py-2 text-sm">
                  Decline
                </button>
              </form>
            </>
          ) : myMember?.status === "accepted" ? (
            <div>
              <p className="text-sm font-bold text-indigo">You accepted this invitation</p>
              <p className="mt-1 text-xs text-muted">
                {proposal.status === "accepted"
                  ? "Every creator accepted. The business can open the contract."
                  : "Waiting for the remaining creators to respond. This is no longer an open invite for you."}
              </p>
              {proposal.status === "accepted" && wizardHref ? (
                <Link href={wizardHref} className="mt-3 inline-block text-sm font-bold text-violet hover:underline">
                  Open contract →
                </Link>
              ) : null}
            </div>
          ) : myMember?.status === "declined" ? (
            <p className="text-sm text-muted">You declined this invitation.</p>
          ) : proposal.status === "declined" ? (
            <p className="text-sm text-muted">This proposal is closed. A new proposal is required to change the team.</p>
          ) : ownsAsBusiness ? (
            <p className="text-sm text-muted">
              Track member responses above. The contract opens only after every creator accepts.
            </p>
          ) : (
            <p className="text-sm text-muted">No further action needed from you on this invitation.</p>
          )}
        </div>
      </article>
    </div>
  );
}
