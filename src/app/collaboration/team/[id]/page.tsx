import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { actionRespondTeamProposal } from "@/app/collaboration/team/actions";
import { getAccountSession } from "@/lib/accounts";
import { isBusinessRole } from "@/lib/account-audience";
import { getWorkspace } from "@/lib/business";
import { prisma } from "@/lib/db";
import {
  getTeamProposal,
  teamMemberStatusLabel,
  visibleTeamMembers,
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
  const agreement = await prisma.contractDocument.findFirst({
    where: { teamProposalId: proposal.id, status: { notIn: ["voided", "declined"] } },
    select: { id: true, parties: { select: { userId: true, email: true, creatorSlug: true } } },
  });
  if (agreement) {
    const email = account.email.trim().toLowerCase();
    const onContract =
      ownsAsBusiness ||
      agreement.parties.some(
        (party) =>
          party.userId === account.id ||
          party.email.trim().toLowerCase() === email ||
          (creator?.slug && party.creatorSlug === creator.slug),
      );
    if (!onContract) notFound();
    redirect(`/collaboration/contracts/${agreement.id}`);
  }
  if (!myMember && !isBusinessRole(account.role)) {
    redirect("/collaboration/team?error=" + encodeURIComponent("You are not on this proposal."));
  }

  const canRespond =
    Boolean(myMember && myMember.status === "invited") &&
    (proposal.status === "sent" || proposal.status === "partial");
  const wizardHref = ownsAsBusiness ? wizardHrefForProposal(proposal) : null;
  const members = visibleTeamMembers(proposal.members, {
    creatorSlug: creator?.slug ?? null,
    canSeeAll: ownsAsBusiness,
  });

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
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet">Coordinated invitation</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-indigo">{proposal.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {ownsAsBusiness ? (
            <>
              Proposal status: <span className="font-semibold uppercase text-violet">{proposal.status}</span>
            </>
          ) : (
            "This invitation is not a contract. You can see who else was invited. Compensation stays between the business and each influencer."
          )}
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
          <h2 className="text-sm font-bold text-indigo">{ownsAsBusiness ? "Invited influencers" : "Other influencers on this invitation"}</h2>
          <ul className="mt-2 space-y-2">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E8EDF8] bg-[#F8F6FF] px-3 py-2 text-sm"
              >
                <span className="font-semibold text-indigo">
                  {member.creatorSlug}
                  {creator && member.creatorSlug === creator.slug ? " (you)" : ""}
                  {member.role ? <span className="font-normal text-muted"> · {member.role}</span> : null}
                </span>
                {member.status || member.shareBps != null ? (
                  <span className="text-xs font-bold uppercase text-violet">
                    {member.status
                      ? member.status === "invited" && creator?.slug === member.creatorSlug
                        ? teamMemberStatusLabel(member.status)
                        : member.status
                      : null}
                    {member.shareBps != null ? ` · ${(member.shareBps / 100).toFixed(2)}%` : ""}
                  </span>
                ) : null}
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
                  ? "Every teammate accepted. The business can open the agreement."
                  : "You accepted this invitation. This team agreement opens after every teammate accepts. You do not see their compensation or private negotiations."}
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
            <p className="text-sm text-muted">This invitation is closed. Send a new invitation to change who is included.</p>
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
