import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FeaturedCarousel } from "@/components/featured-carousel";
import {
  IconArrowRight,
  IconBuilding,
  IconCheck,
  IconHeart,
  IconMapPin,
  IconSearch,
  IconShieldPay,
  IconUsers,
  IconVerified,
  SocialIcon,
} from "@/components/icons";
import { SaveMatchButton } from "@/components/save-match-button";
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";
import { collabOsV1Enabled } from "@/lib/collab-os";
import { loadCreatorHub, PIPELINE_STAGES } from "@/lib/collaboration-hub";
import { getCms } from "@/lib/cms";
import { getDirectoryCreator, indexCreatorsBySlug, getDirectory } from "@/lib/directory";
import { formatStoredMoney } from "@/lib/money";
import { cardsFromStoredCollaborationMatches } from "@/lib/matching";
import { FUNDING_BADGE_CLASS } from "@/lib/funding-badge";
import { PAYOUT_METHOD_LABELS, type PayoutMethod } from "@/lib/payout-readiness";
import { formatFollowers, specialtyLabel } from "@/lib/seed-data";
import {
  applicationIsAcceptedPipeline,
  applicationIsInvitation,
  applicationIsOpenPipeline,
  applicationKindLabel,
} from "@/lib/marketplace-listings";
import {
  actionApplyToBusinessRequest,
  actionApplyToCreatorOpportunity,
} from "./actions";
import { listTeamProposalsForCreator, teamMemberStatusLabel } from "@/lib/team-proposal";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Collaborations · Hub" };

type Props = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    location?: string;
    budget?: string;
    saved?: string;
    applied?: string;
    app?: string;
    error?: string;
    status?: string;
    view?: string;
  }>;
};

type HubView = "opportunities" | "collaborations";

function resolveHubView(raw: string | undefined): HubView {
  return raw === "collaborations" ? "collaborations" : "opportunities";
}

const SIDE_LINKS = [
  { href: "/collaboration/hub?view=collaborations", label: "My Collaborations", anchor: null },
  { href: "/collaboration/hub?view=opportunities#matches", label: "Find Matches", anchor: "matches" },
  { href: "/collaboration/hub?view=opportunities#business-requests", label: "Business Requests", anchor: "business-requests" },
  { href: "/collaboration/hub?view=opportunities#saved", label: "Saved Matches", anchor: "saved" },
  { href: "/collaboration/hub?view=collaborations#team-proposals", label: "Team proposals", anchor: "team-proposals" },
  { href: "/collaboration/records", label: "Active Collaborations", anchor: null },
  { href: "/payments", label: "Payments & Wallet", anchor: null },
  { href: "/dashboard", label: "Influencer Profile", anchor: null },
  { href: "/claim", label: "My Content Kit", anchor: null },
  { href: "/account", label: "Settings", anchor: null },
  { href: "/mentorship", label: "Mentorship", anchor: null },
] as const;

export default async function CollaborationHubPage({ searchParams }: Props) {
  if (!(await collabOsV1Enabled().catch(() => true))) {
    redirect("/collaboration/propose?notice=collab_os_off");
  }
  const params = await searchParams;
  const view = resolveHubView(params.view);
  const isOpportunities = view === "opportunities";
  const account = await getAccountSession().catch(() => null);
  if (!account) {
    redirect(`/login?next=${encodeURIComponent("/collaboration/hub")}&gate=hub`);
  }

  const draft = await getCreatorSessionDraft().catch(() => null);
  if (!draft?.slug) {
    redirect("/claim");
  }

  const creator = await getDirectoryCreator(draft.slug);
  if (!creator) {
    redirect("/claim");
  }

  const [hub, directory, cms, teamProposals] = await Promise.all([
    loadCreatorHub({ userId: account.id, creator }),
    getDirectory().catch(() => null),
    getCms().catch(() => null),
    listTeamProposalsForCreator(draft.slug).catch(() => []),
  ]);
  const bySlug = indexCreatorsBySlug(directory?.creators ?? []);

  const q = params.q?.trim().toLowerCase() ?? "";
  const requests = hub.requests.filter((item) => {
    if (params.budget && item.budget !== params.budget) return false;
    if (params.location && !item.location.toLowerCase().includes(params.location.toLowerCase())) return false;
    if (params.category) {
      const hay = `${item.category} ${item.tags.join(" ")}`.toLowerCase();
      if (!hay.includes(params.category.toLowerCase())) return false;
    }
    if (q) {
      const hay = `${item.brand} ${item.summary} ${item.lookingFor}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const brandMatches = hub.brandMatches.filter((row) => {
    if (params.budget && row.request.budget !== params.budget) return false;
    if (params.category) {
      const hay = `${row.request.category} ${row.request.tags.join(" ")}`.toLowerCase();
      if (!hay.includes(params.category.toLowerCase())) return false;
    }
    if (q) {
      const hay = `${row.request.brand} ${row.request.summary}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const opportunities = hub.opportunities.filter((item) => {
    if (q) {
      const creatorRow = bySlug.get(item.creatorSlug);
      const hay = `${creatorRow?.displayName ?? ""} ${item.lookingFor} ${item.summary}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const popularCards = cardsFromStoredCollaborationMatches(cms?.collaborationMatches.matches ?? []);

  const availableCents = hub.earnings.releasedCents;
  const totalFollowers = creator.socials.reduce((sum, social) => sum + social.followers, 0);
  const engagement = creator.stats?.engagementRate ?? "—";

  return (
    <div className="bg-[#F4F7FF]">
      <section className="border-b border-[#E4E9F5] bg-gradient-to-r from-[#F7F4FF] via-white to-[#EEF5FF]">
        <div className="mx-auto w-full max-w-[90rem] space-y-6 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 max-w-2xl">
              <h1 className="font-display text-3xl font-bold text-indigo sm:text-4xl">
                {isOpportunities ? "Opportunities" : "My Collaborations"}
              </h1>
              <p className="mt-2 text-sm text-muted sm:text-base">
                {isOpportunities
                  ? "Browse brand requests, creator openings, and recommended matches you can apply to."
                  : "Track active pipelines, applications, team invitations, and contracts in progress."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/collaboration/hub?view=opportunities"
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                    isOpportunities ? "bg-violet text-white" : "bg-white text-violet ring-1 ring-[#E4E9F5]"
                  }`}
                >
                  Opportunities
                </Link>
                <Link
                  href="/collaboration/hub?view=collaborations"
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                    !isOpportunities ? "bg-violet text-white" : "bg-white text-violet ring-1 ring-[#E4E9F5]"
                  }`}
                >
                  Collaborations
                </Link>
                <Link href="/collaboration?landing=1" className="inline-flex items-center text-xs font-bold text-violet hover:underline">
                  Public landing →
                </Link>
              </div>
            </div>
          </div>
          {isOpportunities ? (
            popularCards.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#E4E9F5] bg-white px-4 py-6 text-sm text-muted">
                Category match chips appear here once collaboration matches are published.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {popularCards.map((chip) => (
                  <Link
                    key={`${chip.title}-${chip.subtitle}`}
                    href={
                      chip.specialty
                        ? `/collaboration/hub?view=opportunities&category=${encodeURIComponent(chip.specialty)}`
                        : "/collaboration/hub?view=opportunities"
                    }
                    className="group min-w-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#E4E9F5]"
                  >
                    <div className="relative aspect-[5/3] overflow-hidden bg-gradient-to-br from-[#111A5A] to-[#633CFF]">
                      {chip.image ? (
                        <Image src={chip.image} alt="" fill className="object-cover transition group-hover:scale-105" sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 16vw" />
                      ) : null}
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-xs font-bold text-indigo">{chip.title}</p>
                      <p className="truncate text-[10px] text-muted">{chip.subtitle}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )
          ) : null}
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-[90rem] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-10">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm">
            <div className="flex gap-3">
              <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
                <Image src={creator.image} alt="" fill className="object-cover" sizes="64px" />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1 font-display text-lg font-bold text-indigo">
                  {creator.displayName}
                  {creator.verified ? <IconVerified size={14} className="text-violet" /> : null}
                </p>
                <p className="text-xs text-muted">{creator.title}</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                  <IconMapPin size={11} className="text-violet" />
                  {creator.locationCity}, {creator.locationCountry}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {creator.specialties.slice(0, 4).map((slug) => (
                <span key={slug} className="rounded-full bg-[#EAE4FF] px-2 py-0.5 text-[10px] font-semibold text-violet">
                  {specialtyLabel(slug)}
                </span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-indigo">
              {creator.socials.slice(0, 5).map((social) => (
                <SocialIcon key={social.platform} platform={social.platform} size={14} />
              ))}
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="text-[10px] text-muted">Followers</dt>
                <dd className="text-xs font-bold text-indigo">{formatFollowers(totalFollowers)}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-muted">Eng.</dt>
                <dd className="text-xs font-bold text-indigo">{engagement}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-muted">Plan</dt>
                <dd className="text-xs font-bold text-indigo">{creator.planTier}</dd>
              </div>
            </dl>
            <Link href={`/creators/${creator.slug}`} className="btn-secondary mt-4 w-full !py-2 text-center text-xs">
              Edit Profile
            </Link>
          </div>

          <nav className="rounded-2xl border border-[#E4E9F5] bg-white p-2 shadow-sm">
            {SIDE_LINKS.map((link) => {
              const linkView = link.href.includes("view=collaborations")
                ? "collaborations"
                : link.href.includes("view=opportunities")
                  ? "opportunities"
                  : null;
              const active =
                link.label === "My Collaborations"
                  ? !isOpportunities
                  : Boolean(link.anchor) && linkView === view;
              return (
                <Link
                  key={link.label}
                  href={
                    link.label === "Contracts & Agreements"
                      ? `/collaboration/records?from=${encodeURIComponent(creator.slug)}`
                      : link.href
                  }
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold ${
                    active ? "bg-[#EAE4FF] text-violet" : "text-indigo hover:bg-[#F4F7FF]"
                  }`}
                >
                  {link.label}
                  {link.label === "Business Requests" && requests.length > 0 ? (
                    <span className="rounded-full bg-violet px-1.5 text-[10px] font-bold text-white">{requests.length}</span>
                  ) : null}
                  {link.label === "Saved Matches" && hub.status.saved > 0 ? (
                    <span className="rounded-full bg-violet px-1.5 text-[10px] font-bold text-white">{hub.status.saved}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <section
            id="team-proposals"
            className={`rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm ${
              isOpportunities ? "order-40" : "order-10"
            }`}
          >
            <h2 className="font-display text-xl font-bold text-indigo">Team proposals</h2>
            <p className="mt-1 text-sm text-muted">
              Open an invitation to review campaign details before accepting. The business contract opens only after
              every creator accepts.
            </p>
            {params.status ? <p className="mt-2 text-sm font-semibold text-indigo">Status: {params.status}</p> : null}
            {teamProposals.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No team invitations.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {teamProposals.map((proposal) => {
                  const mine = proposal.members.find((member) => member.creatorSlug === creator.slug);
                  return (
                    <li key={proposal.id} className="rounded-xl bg-[#F4F7FF] p-3">
                      <p className="font-semibold text-indigo">{proposal.title}</p>
                      <p className="text-xs uppercase tracking-wide text-violet">
                        Proposal: {proposal.status}
                        {mine ? ` · ${teamMemberStatusLabel(mine.status)}` : ""}
                      </p>
                      <ul className="mt-1 text-sm text-muted">
                        {proposal.members.map((member) => (
                          <li key={member.id}>
                            {member.creatorSlug} · {member.status}
                          </li>
                        ))}
                      </ul>
                      <Link
                        href={`/collaboration/team/${proposal.id}`}
                        className="mt-2 inline-block text-xs font-bold text-violet hover:underline"
                      >
                        {mine?.status === "invited" ? "View invitation →" : "View details →"}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          {params.saved ? (
            <p className="order-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              Match saved to your hub.
            </p>
          ) : null}
          {params.applied ? (
            <p className="order-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              Application submitted. Track status under Applications.
            </p>
          ) : null}
          {params.app ? (
            <p className="order-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              Application moved to {params.app}.
            </p>
          ) : null}
          {params.error ? (
            <p className="order-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{params.error}</p>
          ) : null}

          <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-5 ${isOpportunities ? "order-30" : "order-20"}`}>
            {[
              ["Active Collaborations", hub.status.active, "/collaboration/records?from=" + creator.slug],
              ["Pending Invitations", hub.status.pending, "/collaboration/records?from=" + creator.slug],
              ["Saved Matches", hub.status.saved, "#saved"],
              ["Completed Collaborations", hub.status.completed, "/payments"],
            ].map(([label, value, href]) => (
              <Link
                key={label as string}
                href={href as string}
                className="rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm transition hover:border-violet"
              >
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label as string}</p>
                <p className="mt-1 font-display text-2xl font-bold text-indigo">{value as number}</p>
              </Link>
            ))}
            <div className="rounded-2xl border border-[#E4E9F5] bg-gradient-to-br from-[#633CFF] to-[#2979FF] p-4 text-white shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-white/80">Available Earnings</p>
              <p className="mt-1 font-display text-2xl font-bold">
                {hub.earnings.ready ? formatStoredMoney(availableCents, hub.earnings.currency) : "—"}
              </p>
              <Link href="/payments" className="mt-2 inline-flex text-xs font-bold text-white underline">
                {hub.earnings.ready ? "View Wallet" : "Protected payments"}
              </Link>
              {!hub.earnings.ready ? (
                <p className="mt-2 text-[11px] text-white/75">
                  {hub.payout.readiness?.globalPayoutReady
                    ? "Payout ready — balance appears after milestone release."
                    : "No released earnings yet. Finish payout readiness to withdraw."}
                </p>
              ) : null}
            </div>
          </div>

          <form
            action="/collaboration/hub"
            className={`flex flex-wrap items-center gap-2 rounded-2xl border border-[#E4E9F5] bg-white p-3 shadow-sm ${
              isOpportunities ? "order-10" : "order-50"
            }`}
          >
            <input type="hidden" name="view" value={view} />
            <span className="pl-2 text-muted">
              <IconSearch size={16} />
            </span>
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Search influencers, brands, opportunities…"
              className="min-w-[12rem] flex-1 border-0 bg-transparent text-sm text-indigo outline-none"
            />
            <select name="category" defaultValue={params.category ?? ""} className="rounded-xl border border-border px-2 py-1.5 text-xs">
              <option value="">Category</option>
              {(directory?.taxonomy ?? []).slice(0, 20).map((node) => (
                <option key={node.slug} value={node.slug}>
                  {node.name}
                </option>
              ))}
            </select>
            <input
              name="location"
              defaultValue={params.location}
              placeholder="Location"
              className="w-28 rounded-xl border border-border px-2 py-1.5 text-xs"
            />
            <input
              name="budget"
              defaultValue={params.budget}
              placeholder="Budget"
              className="w-28 rounded-xl border border-border px-2 py-1.5 text-xs"
            />
            <button type="submit" className="btn-primary !px-4 !py-2 text-xs">
              Search
            </button>
          </form>

          <section id="matches" className={`space-y-3 ${isOpportunities ? "order-20" : "order-60"}`}>
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-indigo">Recommended Matches for You</h2>
                <p className="text-sm text-muted">Brand requests scored against your specialties and market.</p>
              </div>
            </div>
            <FeaturedCarousel stepPx={260}>
              {brandMatches.length === 0 ? (
                <p className="text-sm text-muted">No published brand matches yet.</p>
              ) : (
                brandMatches.map(({ request, score }) => (
                  <article
                    key={request.id}
                    className="relative w-[240px] shrink-0 overflow-hidden rounded-2xl border border-[#E4E9F5] bg-white shadow-sm"
                  >
                    <Link href={`/collaboration/requests/${encodeURIComponent(request.id)}`} className="block">
                      <div className="relative h-28 bg-[#F4F7FF]">
                        {request.imageUrl ? (
                          <Image src={request.imageUrl} alt="" fill className="object-cover" sizes="240px" />
                        ) : request.logoUrl ? (
                          <Image src={request.logoUrl} alt="" fill className="object-contain p-6" sizes="240px" />
                        ) : null}
                        <span className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-violet">
                          {score}% Match
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-bold text-indigo">{request.brand}</p>
                        <p className="text-[11px] text-muted">
                          {request.category} · {request.budget}
                        </p>
                        <span className="btn-primary mt-3 inline-flex !px-3 !py-1.5 text-[11px]">View campaign</span>
                      </div>
                    </Link>
                  </article>
                ))
              )}
            </FeaturedCarousel>
          </section>

          {hub.creatorMatches.length > 0 ? (
            <section className={`space-y-3 ${isOpportunities ? "order-25" : "order-65"}`}>
              <h2 className="font-display text-lg font-bold text-indigo">Influencer × Influencer matches</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {hub.creatorMatches.slice(0, 4).map((match) => {
                  const other = match.a.slug === creator.slug ? match.b : match.a;
                  return (
                    <article key={`${match.a.slug}-${match.b.slug}`} className="rounded-2xl border border-[#E4E9F5] bg-white p-3 shadow-sm">
                      <div className="flex gap-2">
                        <span className="relative h-12 w-12 overflow-hidden rounded-full">
                          <Image src={other.image} alt="" fill className="object-cover" sizes="48px" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-indigo">{other.displayName}</p>
                          <p className="text-[11px] text-violet">{match.score}% match</p>
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-2 text-[11px] text-muted">{match.why}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={`/collaboration/propose?a=${encodeURIComponent(match.a.slug)}&b=${encodeURIComponent(match.b.slug)}&from=${encodeURIComponent(creator.slug)}`}
                          className="btn-primary !px-3 !py-1.5 text-[11px]"
                        >
                          Request
                        </Link>
                        <SaveMatchButton
                          partyASlug={match.a.slug}
                          partyBSlug={match.b.slug}
                          signedIn
                          returnTo="/collaboration/hub?saved=1"
                          compact
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className={`grid gap-4 lg:grid-cols-[1fr_280px] ${isOpportunities ? "order-35" : "order-35"}`}>
            <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#633CFF] via-[#5B4CFF] to-[#2979FF] p-5 text-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">Mentorship</p>
                  <h2 className="mt-1 font-display text-xl font-bold">Become an Influrios Influencer Mentor</h2>
                  <p className="mt-1 max-w-md text-sm text-white/80">
                    Share what you know with rising influencers and grow your professional network.
                  </p>
                </div>
                <Link href="/mentorship#become" className="ink-on-light inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-bold">
                  Apply to be a Mentor <IconArrowRight size={14} />
                </Link>
              </div>
            </section>

            <section className="rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-violet">
                <IconShieldPay size={16} />
                <h2 className="font-display text-base font-bold text-indigo">Payout & Earnings</h2>
              </div>
              {(() => {
                const readiness = hub.payout.readiness;
                const primaryLabel =
                  readiness?.primaryMethod &&
                  PAYOUT_METHOD_LABELS[readiness.primaryMethod as PayoutMethod]
                    ? PAYOUT_METHOD_LABELS[readiness.primaryMethod as PayoutMethod]
                    : readiness?.primaryMethod ?? "—";
                return (
                  <>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
                      Global Payout Ready
                    </p>
                    <p
                      className={`mt-1 font-display text-lg font-bold ${
                        readiness?.globalPayoutReady ? "text-emerald-700" : "text-amber-800"
                      }`}
                    >
                      {readiness?.globalPayoutReady ? "Ready" : "Not ready"}
                    </p>
                    <ul className="mt-3 space-y-1 text-xs text-muted">
                      <li>
                        Primary: {primaryLabel} · {readiness?.primaryStatus ?? "—"}
                      </li>
                      <li>
                        Corridor:{" "}
                        {readiness?.countryCode
                          ? readiness.corridorActive
                            ? `${readiness.countryCode} active`
                            : `${readiness.countryCode} inactive`
                          : "country unknown"}
                      </li>
                      <li>
                        Identity: {readiness?.identityVerified ? "verified" : "not verified"}
                      </li>
                    </ul>
                    {readiness && !readiness.globalPayoutReady && readiness.blockers.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-amber-900">
                        {readiness.blockers.slice(0, 3).map((blocker) => (
                          <li key={blocker}>{blocker}</li>
                        ))}
                      </ul>
                    ) : null}
                    {hub.earnings.ready ? (
                      <>
                        <p className="mt-4 font-display text-2xl font-bold text-indigo">
                          {formatStoredMoney(availableCents, hub.earnings.currency)}
                        </p>
                        <p className="text-xs text-muted">
                          Released to you · {formatStoredMoney(hub.earnings.heldCents, hub.earnings.currency)} still held
                        </p>
                      </>
                    ) : (
                      <p className="mt-4 text-xs text-muted">
                        Ledger totals appear here after milestones release — not estimated earnings.
                      </p>
                    )}
                    <Link
                      href="/payments"
                      className={`${hub.earnings.ready ? "btn-primary" : "btn-secondary"} mt-4 w-full !py-2 text-center text-sm`}
                    >
                      Open protected payments
                    </Link>
                  </>
                );
              })()}
            </section>
          </div>

          <div
            id="opportunities"
            className={`grid gap-4 xl:grid-cols-3 ${isOpportunities ? "order-22" : "order-70"}`}
          >
            <section id="business-requests" className="rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-base font-bold text-indigo">
                  <IconBuilding size={16} className="text-violet" /> Business Requests
                </h2>
                <Link
                  href="/collaboration/hub?view=opportunities#business-requests"
                  className="text-[11px] font-bold text-violet"
                >
                  View all →
                </Link>
              </div>
              <ul className="space-y-3">
                {requests.length === 0 ? <li className="text-sm text-muted">No matching requests.</li> : null}
                {requests.map((item) => (
                  <li key={item.id} className="rounded-xl border border-[#E8EDF8] p-3">
                    <div className="flex gap-3">
                      <Link
                        href={`/collaboration/requests/${encodeURIComponent(item.id)}`}
                        className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#F4F7FF]"
                      >
                        {item.logoUrl ? (
                          <Image src={item.logoUrl} alt="" fill className="object-contain p-1" sizes="40px" />
                        ) : null}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/collaboration/requests/${encodeURIComponent(item.id)}`}
                          className="text-sm font-bold text-indigo hover:text-violet hover:underline"
                        >
                          {item.brand}
                        </Link>
                        <p className="text-[11px] text-muted">
                          {item.budget} · {item.location}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Link
                            href={`/collaboration/requests/${encodeURIComponent(item.id)}`}
                            className="btn-secondary !px-3 !py-1 text-[11px]"
                          >
                            View campaign
                          </Link>
                          <form action={actionApplyToBusinessRequest}>
                            <input type="hidden" name="requestId" value={item.id} />
                            <button type="submit" className="btn-primary !px-3 !py-1 text-[11px]">
                              Apply
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm xl:col-span-1">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-base font-bold text-indigo">
                  <IconUsers size={16} className="text-violet" /> Influencer Opportunities
                </h2>
                <Link href="/discover" className="text-[11px] font-bold text-violet">
                  View all →
                </Link>
              </div>
              <ul className="space-y-3">
                {opportunities.length === 0 ? <li className="text-sm text-muted">No opportunities right now.</li> : null}
                {opportunities.map((item) => {
                  const row = bySlug.get(item.creatorSlug);
                  if (!row) return null;
                  return (
                    <li key={item.id} className="flex gap-3 rounded-xl border border-[#E8EDF8] p-3">
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
                        <Image src={row.image} alt="" fill className="object-cover" sizes="40px" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-indigo">{row.displayName}</p>
                        <p className="text-[11px] text-muted">Looking for {item.lookingFor}</p>
                        <form action={actionApplyToCreatorOpportunity} className="mt-2">
                          <input type="hidden" name="opportunityId" value={item.id} />
                          <input type="hidden" name="toSlug" value={item.creatorSlug} />
                          <button type="submit" className="btn-primary !px-3 !py-1 text-[11px]">
                            Connect / Apply
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

            <section
              id="applications"
              className={`rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm ${
                isOpportunities ? "order-28" : "order-22"
              } ${isOpportunities ? "" : "ring-2 ring-violet/30"}`}
            >
              <h2 className="mb-3 font-display text-base font-bold text-indigo">My Applications & Invitations</h2>
              <p className="mb-3 text-xs text-muted">
                Open each item to review full details. Accept, decline, and other actions only appear on the detail page.
              </p>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {hub.applications.length === 0 ? (
                  <li className="text-sm text-muted sm:col-span-2">
                    No applications yet — Apply on a business request above.
                  </li>
                ) : (
                  hub.applications.map((application) => {
                    const invite = applicationIsInvitation(application);
                    const accepted = applicationIsAcceptedPipeline(application.status);
                    const open = applicationIsOpenPipeline(application.status);
                    return (
                      <li key={application.id} className="rounded-xl border border-[#E8EDF8] p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-violet">
                          {applicationKindLabel(application)}
                          {accepted ? " · Accepted" : open && invite ? " · Needs review" : ""}
                        </p>
                        <p className="mt-1 text-sm font-bold text-indigo">
                          {application.requestBrand ??
                            application.opportunityLookingFor ??
                            (application.kind === "creator_opportunity" ? "Creator opportunity" : "Business request")}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold uppercase text-violet">
                          {application.status.replaceAll("_", " ")}
                        </p>
                        {application.note?.trim() ? (
                          <p className="mt-1 line-clamp-2 text-[11px] text-muted">{application.note}</p>
                        ) : null}
                        <Link
                          href={`/collaboration/applications/${application.id}`}
                          className="mt-3 inline-flex text-[11px] font-bold text-violet hover:underline"
                        >
                          {accepted
                            ? "View collaboration →"
                            : invite
                              ? "View invitation →"
                              : "View application →"}
                        </Link>
                      </li>
                    );
                  })
                )}
              </ul>
            </section>

            <section
              id="pipeline"
              className={`rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm ${
                isOpportunities ? "order-29" : "order-24"
              } ${isOpportunities ? "" : "ring-2 ring-violet/30"}`}
            >
              <h2 className="mb-3 font-display text-base font-bold text-indigo">Active Collaboration Pipeline</h2>
              <ul className="space-y-4">
                {hub.pipeline.length === 0 ? (
                  <li className="text-sm text-muted">
                    No active pipeline yet.{" "}
                    <Link href={`/collaboration/propose?from=${creator.slug}`} className="font-semibold text-violet">
                      Start a proposal
                    </Link>
                  </li>
                ) : null}
                {hub.pipeline.map((item) => {
                  const other = bySlug.get(item.counterparty);
                  return (
                    <li key={item.id}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-bold text-indigo">{item.title}</p>
                        <Link href={item.href} className="shrink-0 text-[11px] font-bold text-violet">
                          Open
                        </Link>
                      </div>
                      <p className="mb-2 text-[11px] text-muted">
                        with {other?.displayName ?? item.counterparty} · {item.stage}
                        {item.fundingBadge ? (
                          <>
                            {" "}
                            ·{" "}
                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${FUNDING_BADGE_CLASS[item.fundingBadge]}`}>
                              {item.fundingBadge}
                            </span>
                          </>
                        ) : null}
                        {item.feeCents != null && item.currency ? (
                          <> · fee locked {formatStoredMoney(item.feeCents, item.currency)}</>
                        ) : null}
                        {item.revisionSummary ? <> · {item.revisionSummary}</> : null}
                      </p>
                      <ol className="flex flex-wrap gap-1">
                        {PIPELINE_STAGES.map((stage, index) => {
                          const done = index <= item.stageIndex;
                          return (
                            <li
                              key={stage}
                              className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                done ? "bg-[#EAE4FF] text-violet" : "bg-[#F4F7FF] text-muted"
                              }`}
                            >
                              {done ? <IconCheck size={9} className="mr-0.5 inline" /> : null}
                              {stage}
                            </li>
                          );
                        })}
                      </ol>
                    </li>
                  );
                })}
              </ul>
            </section>

          <section
            id="saved"
            className={`rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm ${
              isOpportunities ? "order-45" : "order-45"
            }`}
          >
            <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-indigo">
              <IconHeart size={16} className="text-violet" /> Saved Matches
            </h2>
            {hub.saved.length === 0 ? (
              <p className="text-sm text-muted">Save matches from recommendations to revisit them here.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {hub.saved.map((row) => {
                  const a = bySlug.get(row.partyASlug);
                  const b = bySlug.get(row.partyBSlug);
                  return (
                    <li key={row.saveId} className="rounded-xl border border-[#E8EDF8] p-3">
                      <p className="text-sm font-bold text-indigo">
                        {a?.displayName ?? row.partyASlug} × {b?.displayName ?? row.partyBSlug}
                      </p>
                      <p className="text-[11px] text-violet">{row.score}% · saved</p>
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted">{row.why}</p>
                      <Link
                        href={`/collaboration/propose?a=${encodeURIComponent(row.partyASlug)}&b=${encodeURIComponent(row.partyBSlug)}&from=${encodeURIComponent(creator.slug)}`}
                        className="mt-2 inline-flex text-[11px] font-bold text-violet"
                      >
                        Open proposal →
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
