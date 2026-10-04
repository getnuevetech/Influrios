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
import { loadCreatorHub, PIPELINE_STAGES } from "@/lib/collaboration-hub";
import { getCms } from "@/lib/cms";
import { getDirectoryCreator, indexCreatorsBySlug, getDirectory } from "@/lib/directory";
import { formatMoney } from "@/lib/money";
import { POPULAR_MATCH_CHIPS } from "@/lib/matching";
import { PAYOUT_METHOD_LABELS, type PayoutMethod } from "@/lib/payout-readiness";
import { formatFollowers, specialtyLabel } from "@/lib/seed-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Collaborations · Hub" };

type Props = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    location?: string;
    budget?: string;
    saved?: string;
  }>;
};

const SIDE_LINKS = [
  { href: "/collaboration/hub", label: "My Collaborations", anchor: null },
  { href: "/collaboration/hub#matches", label: "Find Matches", anchor: "matches" },
  { href: "/collaboration/hub#business-requests", label: "Business Requests", anchor: "business-requests" },
  { href: "/collaboration/hub#saved", label: "Saved Matches", anchor: "saved" },
  { href: "/collaboration/records", label: "Contracts & Agreements", anchor: null },
  { href: "/payments", label: "Payments & Wallet", anchor: null },
  { href: "/dashboard", label: "Influencer Profile", anchor: null },
  { href: "/claim", label: "My Content Kit", anchor: null },
  { href: "/account", label: "Settings", anchor: null },
  { href: "/mentorship", label: "Mentorship", anchor: null },
] as const;

export default async function CollaborationHubPage({ searchParams }: Props) {
  const params = await searchParams;
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

  const [hub, directory, cms] = await Promise.all([
    loadCreatorHub({ userId: account.id, creator }),
    getDirectory().catch(() => null),
    getCms().catch(() => null),
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

  const popularCards =
    cms?.collaborationMatches.matches.length
      ? cms.collaborationMatches.matches.map((match) => {
          const chip = POPULAR_MATCH_CHIPS.find((row) => match.title.includes(row.title));
          const [left, right] = match.title.split(/\s*\+\s*/);
          return {
            title: left?.trim() || match.title,
            subtitle: right ? `+ ${right.trim()}` : chip?.subtitle || "",
            specialty: chip?.specialty || match.tags[0]?.toLowerCase() || "lifestyle",
            image: match.image || chip?.image || "/demo/categories/cat-lifestyle.jpg",
          };
        })
      : POPULAR_MATCH_CHIPS;

  const availableCents = hub.earnings.releasedCents;
  const totalFollowers = creator.socials.reduce((sum, social) => sum + social.followers, 0);
  const engagement = creator.stats?.engagementRate ?? "—";

  return (
    <div className="bg-[#F4F7FF]">
      <section className="border-b border-[#E4E9F5] bg-gradient-to-r from-[#F7F4FF] via-white to-[#EEF5FF]">
        <div className="mx-auto grid w-full max-w-[90rem] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:px-10 lg:py-10">
          <div>
            <h1 className="font-display text-3xl font-bold text-indigo sm:text-4xl">My Collaborations</h1>
            <p className="mt-2 max-w-xl text-sm text-muted sm:text-base">
              Discover new opportunities, connect with influencers and brands, and manage active collaborations in one place.
            </p>
            <Link href="/collaboration?landing=1" className="mt-3 inline-flex text-xs font-bold text-violet hover:underline">
              View public collaboration landing →
            </Link>
          </div>
          <FeaturedCarousel stepPx={200}>
            {popularCards.map((chip) => (
              <Link
                key={`${chip.title}-${chip.subtitle}`}
                href={`/collaboration/hub?category=${encodeURIComponent(chip.specialty)}`}
                className="group w-[180px] shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#E4E9F5]"
              >
                <div className="relative h-24 overflow-hidden">
                  <Image src={chip.image} alt="" fill className="object-cover transition group-hover:scale-105" sizes="180px" />
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-bold text-indigo">{chip.title}</p>
                  <p className="text-[10px] text-muted">{chip.subtitle}</p>
                </div>
              </Link>
            ))}
          </FeaturedCarousel>
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
              const active = link.href === "/collaboration/hub" && !link.anchor;
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

        <div className="min-w-0 space-y-6">
          {params.saved ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              Match saved to your hub.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
                {hub.earnings.ready ? formatMoney(availableCents) : "—"}
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
            className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#E4E9F5] bg-white p-3 shadow-sm"
          >
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

          <section id="matches" className="space-y-3">
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
                      <div className="mt-3 flex items-center gap-2">
                        <Link href="/business" className="btn-primary !px-3 !py-1.5 text-[11px]">
                          View Match
                        </Link>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </FeaturedCarousel>
          </section>

          {hub.creatorMatches.length > 0 ? (
            <section className="space-y-3">
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

          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
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
                          {formatMoney(availableCents)}
                        </p>
                        <p className="text-xs text-muted">
                          Released to you · {formatMoney(hub.earnings.heldCents)} still held
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

          <div className="grid gap-4 xl:grid-cols-3">
            <section id="business-requests" className="rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-base font-bold text-indigo">
                  <IconBuilding size={16} className="text-violet" /> Business Requests
                </h2>
                <Link href="/business" className="text-[11px] font-bold text-violet">
                  View all →
                </Link>
              </div>
              <ul className="space-y-3">
                {requests.length === 0 ? <li className="text-sm text-muted">No matching requests.</li> : null}
                {requests.map((item) => (
                  <li key={item.id} className="rounded-xl border border-[#E8EDF8] p-3">
                    <div className="flex gap-3">
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#F4F7FF]">
                        {item.logoUrl ? (
                          <Image src={item.logoUrl} alt="" fill className="object-contain p-1" sizes="40px" />
                        ) : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-indigo">{item.brand}</p>
                        <p className="text-[11px] text-muted">
                          {item.budget} · {item.location}
                        </p>
                        <Link href="/business" className="btn-primary mt-2 !px-3 !py-1 text-[11px]">
                          View Details
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm">
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
                        <Link href={`/creators/${row.slug}`} className="btn-primary mt-2 !px-3 !py-1 text-[11px]">
                          Connect
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm">
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
          </div>

          <section id="saved" className="rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm">
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
