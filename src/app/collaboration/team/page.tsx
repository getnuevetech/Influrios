import Link from "next/link";
import { redirect } from "next/navigation";
import { actionSendTeamProposal } from "@/app/collaboration/team/actions";
import { getAccountSession } from "@/lib/accounts";
import { isBusinessRole } from "@/lib/account-audience";
import { getWorkspace } from "@/lib/business";
import { prisma } from "@/lib/db";
import { listDirectoryCreators } from "@/lib/directory";
import { ensureMarketplaceDefaults, marketplaceConfig } from "@/lib/marketplace-ledger";
import {
  teamFundingReady,
  teamMemberReadiness,
  wizardHrefForProposal,
} from "@/lib/team-proposal";
import { listTeamProposalsForCreator, listTeamProposalsForWorkspace } from "@/lib/team-proposal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Coordinated proposals" };

type Props = {
  searchParams: Promise<{ error?: string; sent?: string; status?: string; creators?: string }>;
};

function parseCreatorQuery(raw: string | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(/[,+\s]+/).map((slug) => slug.trim()).filter(Boolean))];
}

export default async function TeamProposalPage({ searchParams }: Props) {
  const params = await searchParams;
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect("/login?next=/collaboration/team&gate=team");
  const session = account!;
  const ws = await getWorkspace(session.id);
  const creator = account
    ? await prisma.creator.findFirst({ where: { userId: account.id }, select: { slug: true } })
    : null;
  const [directory, outgoing, incoming, config] = await Promise.all([
    listDirectoryCreators().catch(() => []),
    account && ws.businessId !== "public" ? listTeamProposalsForWorkspace(ws.businessId).catch(() => []) : [],
    creator ? listTeamProposalsForCreator(creator.slug).catch(() => []) : [],
    ensureMarketplaceDefaults()
      .then(() => marketplaceConfig())
      .catch(() => null),
  ]);
  const jurisdiction = config?.jurisdictions.find((row) => row.code === "US") ?? config?.jurisdictions[0];
  const provider =
    config?.providers.find((row) => row.code === (jurisdiction?.providerCode || "primary")) ?? config?.provider;
  const preselected = new Set(parseCreatorQuery(params.creators));
  const shortlistSlugs = ws.shortlist.map((item) => item.creatorSlug);
  const bySlug = new Map(directory.map((person) => [person.slug, person]));
  const invitePool: { slug: string; displayName: string; source: "shortlist" | "directory" }[] = [];
  for (const slug of shortlistSlugs) {
    const person = bySlug.get(slug);
    invitePool.push({
      slug,
      displayName: person?.displayName ?? slug,
      source: "shortlist",
    });
  }
  for (const person of directory) {
    if (shortlistSlugs.includes(person.slug)) continue;
    if (invitePool.length >= 24) break;
    invitePool.push({ slug: person.slug, displayName: person.displayName, source: "directory" });
  }
  for (const slug of preselected) {
    if (invitePool.some((row) => row.slug === slug)) continue;
    const person = bySlug.get(slug);
    invitePool.unshift({
      slug,
      displayName: person?.displayName ?? slug,
      source: shortlistSlugs.includes(slug) ? "shortlist" : "directory",
    });
  }

  return (
    <div className="bg-[#F7FAFF]">
      <section className="hero-atmosphere text-white">
        <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6">
          <Link href="/collaboration/business" className="text-sm font-semibold text-lavender/90 hover:underline">
            ← Business hub
          </Link>
          <h1 className="mt-2 font-display text-4xl font-bold">Coordinated proposals</h1>
          <p className="mt-3 max-w-2xl text-white/75">
            Invite two or more influencers to one proposal. Each influencer only sees their own invitation until
            everyone accepts. Funding stays blocked until every accepted influencer has a ready payout route.
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-[90rem] space-y-8 px-4 py-10 sm:px-6">
        {params.error ? <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{params.error}</p> : null}
        {params.sent ? <p className="text-sm font-semibold text-emerald-700">Proposal sent.</p> : null}
        {params.status ? <p className="text-sm font-semibold text-indigo">Status: {params.status}</p> : null}

        {account && isBusinessRole(account.role) && ws.businessId !== "public" ? (
          <form action={actionSendTeamProposal} className="card-surface space-y-3 p-6">
            <h2 className="font-display text-xl font-bold text-indigo">Invite influencers to one proposal</h2>
            <p className="text-sm text-muted">
              Shortlisted creators appear first. Company seats (employees on this workspace) are separate from this
              list.
            </p>
            <label className="block text-sm font-semibold text-indigo">
              Title
              <input name="title" required className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
            </label>
            <label className="block text-sm font-semibold text-indigo">
              Campaign intent
              <textarea
                name="campaignIntent"
                rows={2}
                maxLength={240}
                placeholder="What this coordinated campaign is for"
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
              />
            </label>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="text-sm font-semibold text-indigo">Influencers</legend>
              {invitePool.length === 0 ? (
                <p className="text-sm text-muted sm:col-span-2">
                  No creators available yet.{" "}
                  <Link href="/discover" className="font-semibold text-violet hover:underline">
                    Discover influencers
                  </Link>{" "}
                  and save them to the shortlist.
                </p>
              ) : (
                invitePool.map((person) => (
                  <label key={person.slug} className="flex items-center gap-2 text-sm text-indigo">
                    <input
                      type="checkbox"
                      name="creatorSlug"
                      value={person.slug}
                      defaultChecked={preselected.has(person.slug)}
                    />
                    <span>
                      {person.displayName}
                      {person.source === "shortlist" ? (
                        <span className="ml-1 text-xs font-medium text-muted">· shortlist</span>
                      ) : null}
                    </span>
                  </label>
                ))
              )}
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
            with a business account to invite influencers. Influencer accounts do not see another influencer’s invitation.
          </p>
        )}

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-indigo">Your proposals</h2>
          {outgoing.length === 0 ? <p className="text-sm text-muted">No open invitations from this workspace.</p> : null}
          {await Promise.all(outgoing.map(async (proposal) => {
            const checks = config
              ? await Promise.all(
                  proposal.members.map((member) =>
                    teamMemberReadiness({
                      creatorSlug: member.creatorSlug,
                      businessName: ws.name,
                      jurisdictionProtectedPayments: Boolean(jurisdiction?.protectedPaymentsEnabled),
                      marketplaceProviderReady: Boolean(provider?.ready),
                    }),
                  ),
                )
              : proposal.members.map(() => ({ ready: false, blockers: ["Marketplace config is unavailable."] }));
            const ready = teamFundingReady({
              status: proposal.status,
              payoutReady: checks.map((check) => check.ready),
            });
            const wizardHref = wizardHrefForProposal(proposal);
            return (
              <article key={proposal.id} className="card-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-indigo">{proposal.title}</p>
                  <Link
                    href={`/collaboration/team/${proposal.id}`}
                    className="text-xs font-bold text-violet hover:underline"
                  >
                    Open proposal →
                  </Link>
                </div>
                <p className="mt-1 text-xs uppercase tracking-wide text-violet">{proposal.status}</p>
                {proposal.campaignIntent ? (
                  <p className="mt-1 text-sm text-muted">{proposal.campaignIntent}</p>
                ) : null}
                <ul className="mt-2 text-sm text-muted">
                  {proposal.members.map((member, index) => (
                    <li key={member.id}>
                      {directory.find((row) => row.slug === member.creatorSlug)?.displayName || member.creatorSlug} · {member.role === "creator" ? "influencer" : member.role} · {member.status} · {(member.shareBps / 100).toFixed(2)}%
                      {checks[index] && !checks[index].ready ? " · payout route not ready" : ""}
                    </li>
                  ))}
                </ul>
                {proposal.status === "accepted" && wizardHref ? (
                  <p className="mt-2 text-sm text-indigo">
                    {ready.ok
                      ? "Every payout route is ready. "
                      : "Funding stays blocked until every payout route is ready. "}
                    <Link href={wizardHref} className="font-semibold text-violet hover:underline">
                      Create the agreement
                    </Link>
                  </p>
                ) : null}
                {proposal.status === "declined" ? (
                  <p className="mt-2 text-sm text-muted">Declined. Send a new proposal to change who is included.</p>
                ) : null}
              </article>
            );
          }))}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-indigo">Invitations for you</h2>
          <p className="text-sm text-muted">
            Open each invitation to review campaign details before accepting or declining.
          </p>
          {incoming.length === 0 ? <p className="text-sm text-muted">No team invitations on this account.</p> : null}
          {incoming.map((proposal) => {
            const mine = creator
              ? proposal.members.find((member) => member.creatorSlug === creator.slug)
              : null;
            return (
              <article key={proposal.id} className="card-surface p-4">
                <p className="font-semibold text-indigo">{proposal.title}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-violet">
                  Coordinated invitation
                  {mine?.status ? ` · ${mine.status === "invited" ? "Pending your response" : mine.status}` : ""}
                </p>
                <Link
                  href={`/collaboration/team/${proposal.id}`}
                  className="mt-3 inline-block text-xs font-bold text-violet hover:underline"
                >
                  {mine?.status === "invited" ? "View invitation →" : "View details →"}
                </Link>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
