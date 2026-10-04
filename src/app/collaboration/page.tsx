import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FeaturedCarousel } from "@/components/featured-carousel";
import {
  CategoryGlyph,
  IconArrowRight,
  IconBuilding,
  IconCheck,
  IconHeart,
  IconMapPin,
  IconSearch,
  IconUsers,
  SocialIcon,
} from "@/components/icons";
import { SaveMatchButton } from "@/components/save-match-button";
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";
import { collabOsV1Enabled } from "@/lib/collab-os";
import { getCms } from "@/lib/cms";
import { getCollaborationLanding } from "@/lib/landing-pages";
import { consumeGuestQuota } from "@/lib/guest-usage";
import { loadGuestSuggestionSample } from "@/lib/guest-suggestions";
import {
  allDirectoryMatches,
  filterMatches,
  POPULAR_MATCH_CHIPS,
  scoreCreatorPair,
  type CreatorMatch,
} from "@/lib/matching";
import { actionApplyToBusinessRequest } from "@/app/collaboration/hub/actions";
import {
  listPublishedBusinessRequests,
  listPublishedCreatorOpportunities,
  persistTopMatches,
  saveMatchForUser,
  type MarketplaceBusinessRequestRow,
} from "@/lib/marketplace-listings";
import { entitlementsForPlan } from "@/lib/entitlements-db";
import { getDirectory, getDirectoryCreator, indexCreatorsBySlug } from "@/lib/directory";
import { formatFollowers, specialtyLabel } from "@/lib/seed-data";
import { isPlanCode, type PlanCode } from "@/lib/entitlements";
import { normalizeInfluencerRoleTitle } from "@/lib/terminology-copy";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Collaborations · Influrios",
  description:
    "Find the right influencer collaborations. Match with businesses and influencers, create contracts, and get paid with protected milestones.",
};

type Props = {
  searchParams: Promise<{
    specialty?: string;
    location?: string;
    platform?: string;
    q?: string;
    from?: string;
    requested?: string;
    goal?: string;
    budget?: string;
    save?: string;
    saved?: string;
    error?: string;
    landing?: string;
    sample?: string;
  }>;
};

export default async function CollaborationPage({ searchParams }: Props) {
  const params = await searchParams;
  const [directory, cms, landing, collabOsOn] = await Promise.all([
    getDirectory(),
    getCms(),
    getCollaborationLanding(),
    collabOsV1Enabled().catch(() => true),
  ]);
  const bySlug = indexCreatorsBySlug(directory.creators);
  const all = await allDirectoryMatches();
  await persistTopMatches(all).catch(() => 0);
  const matches = filterMatches(all, {
    specialty: params.specialty,
    location: params.location,
    platform: params.platform,
    q: params.q,
  });
  const featured = matches[0] ?? all[0];
  const sideMatches = (matches.length > 1 ? matches.slice(1, 4) : all.slice(1, 4)).filter(Boolean);
  const account = await getAccountSession().catch(() => null);
  const draft = account ? await getCreatorSessionDraft().catch(() => null) : null;

  if (collabOsOn && account && draft?.slug && params.landing !== "1" && !params.save) {
    const hubQuery = new URLSearchParams();
    if (params.goal) hubQuery.set("category", params.goal);
    if (params.q) hubQuery.set("q", params.q);
    if (params.budget) hubQuery.set("budget", params.budget);
    if (params.location) hubQuery.set("location", params.location);
    if (params.specialty) hubQuery.set("category", params.specialty);
    if (params.saved) hubQuery.set("saved", params.saved);
    const qs = hubQuery.toString();
    redirect(qs ? `/collaboration/hub?${qs}` : "/collaboration/hub");
  }
  if (collabOsOn && account && !draft?.slug && params.landing !== "1" && !params.save) {
    redirect("/collaboration/business");
  }

  const viewerFromParam = params.from ? bySlug.get(params.from) ?? null : null;
  const viewerFromSession = draft?.slug ? bySlug.get(draft.slug) ?? null : null;
  const viewer = viewerFromParam ?? (account ? viewerFromSession : null);
  const viewerPlan: PlanCode = viewer && isPlanCode(viewer.planTier) ? viewer.planTier : "STARTER";
  const viewerLimits = await entitlementsForPlan(viewerPlan);
  const canRequest = !viewer || viewerLimits.proposalsMax > 0;
  const signedIn = Boolean(account);
  const businessHref = signedIn
    ? collabOsOn
      ? "/collaboration/business"
      : "/collaboration/propose"
    : "/business";
  const joinBusinessHref = signedIn
    ? collabOsOn
      ? "/collaboration/business"
      : "/collaboration/propose"
    : "/business";
  const suggestionsHref = signedIn
    ? draft?.slug
      ? collabOsOn
        ? "/collaboration/hub?category=awareness"
        : "/collaboration/propose"
      : collabOsOn
        ? "/collaboration/business#suggestions"
        : "/collaboration/propose"
    : "/collaboration?landing=1#guest-suggestions";

  if (params.save && account) {
    const [partyASlug, partyBSlug] = params.save.split(":").map((part) => decodeURIComponent(part.trim()));
    if (partyASlug && partyBSlug) {
      const [creatorA, creatorB] = await Promise.all([
        getDirectoryCreator(partyASlug),
        getDirectoryCreator(partyBSlug),
      ]);
      const match = creatorA && creatorB ? scoreCreatorPair(creatorA, creatorB) : null;
      if (match) {
        await saveMatchForUser({ match, userId: account.id }).catch(() => null);
      }
      redirect(
        draft?.slug && collabOsOn
          ? "/collaboration/hub?saved=1"
          : "/collaboration?landing=1&saved=1",
      );
    }
  }
  if (params.save && !account) {
    const gate = await consumeGuestQuota("apply");
    redirect(
      `/login?next=${encodeURIComponent(`/collaboration?save=${params.save}`)}&gate=${
        gate.decision === "hard" ? "apply" : "save"
      }`,
    );
  }

  const [requestPool, opportunities] = await Promise.all([
    listPublishedBusinessRequests({ goal: params.goal }),
    listPublishedCreatorOpportunities(),
  ]);
  const requests = params.budget
    ? requestPool.filter((item) => item.budget === params.budget)
    : requestPool;
  const brand =
    requests.find((item) => {
      if (
        params.location &&
        !item.location.toLowerCase().includes(params.location.toLowerCase()) &&
        !item.location.toLowerCase().includes("global")
      ) {
        return false;
      }
      return true;
    }) ??
    requests[0] ??
    requestPool[0];
  const filteredOpportunities = opportunities.filter((item) => {
    if (!params.specialty) return true;
    const creator = bySlug.get(item.creatorSlug);
    return creator?.specialties.some((slug) => slug.includes(params.specialty!)) ?? false;
  });
  const heroFaces = directory.creators.slice(0, 6);
  const taxonomy = directory.taxonomy;
  const popularCards =
    cms.collaborationMatches.matches.length > 0
      ? cms.collaborationMatches.matches.map((match) => {
          const displayTitle = normalizeInfluencerRoleTitle(match.title);
          const chip = POPULAR_MATCH_CHIPS.find(
            (row) =>
              `${row.title} ${row.subtitle}`.includes(displayTitle.split(" + ")[0] ?? "") ||
              displayTitle.includes(row.title),
          );
          const [left, right] = displayTitle.split(/\s*\+\s*/);
          return {
            title: left?.trim() || displayTitle,
            subtitle: right ? `+ ${right.trim()}` : chip?.subtitle || "",
            specialty: chip?.specialty || match.tags[0]?.toLowerCase() || "lifestyle",
            image: match.image || chip?.image || "/demo/categories/cat-lifestyle.jpg",
          };
        })
      : POPULAR_MATCH_CHIPS;

  const hero = landing.hero;
  const dual = landing.dualPath;
  const showGuestSample = !signedIn || params.landing === "1";
  const guestSample =
    showGuestSample && params.sample === "1"
      ? await loadGuestSuggestionSample({
          goal: params.goal,
          specialty: params.specialty,
          location: params.location,
          platform: params.platform,
          budget: params.budget,
        }).catch(() => null)
      : null;
  const signupForSuggestions = `/login?next=${encodeURIComponent("/collaboration/business#suggestions")}&gate=suggestions`;

  return (
    <div className="bg-[#F7FAFF]">
      {/* —— Hero —— */}
      <section className="border-b border-[#E4E9F5] bg-gradient-to-br from-[#F7F4FF] via-white to-[#EEF5FF]">
        <div className="mx-auto grid w-full max-w-[90rem] items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:py-14">
          <div>
            <h1 className="font-display text-4xl font-bold leading-tight text-indigo sm:text-5xl">
              {hero.title}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted sm:text-base">{hero.subtitle}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href={hero.primaryCta.href} className="btn-primary">
                {hero.primaryCta.label} <IconArrowRight size={14} />
              </a>
              <Link href={suggestionsHref} className="btn-secondary">
                {hero.secondaryCta.label}
              </Link>
            </div>
            <form
              action="/collaboration"
              className="mt-6 flex max-w-xl items-center gap-2 rounded-full bg-white p-1.5 shadow-lg shadow-violet/10 ring-1 ring-[#E4E9F5]"
            >
              <span className="pl-3 text-muted">
                <IconSearch size={18} />
              </span>
              <input
                name="q"
                defaultValue={params.q}
                placeholder={hero.searchPlaceholder}
                className="w-full flex-1 border-0 bg-transparent py-2.5 text-sm text-indigo outline-none placeholder:text-muted/70"
              />
              <button type="submit" className="btn-primary shrink-0 !px-5 !py-2.5">
                Search
              </button>
            </form>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {hero.tags.map((tag) => {
                const slug =
                  taxonomy.find((s) => s.name === tag)?.slug ??
                  tag.toLowerCase().replace(/\s+&\s+/g, "-").replace(/\s+/g, "-");
                return (
                  <Link
                    key={tag}
                    href={`/collaboration?specialty=${encodeURIComponent(slug)}`}
                    className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo ring-1 ring-[#E4E9F5] transition hover:bg-lavender/60"
                  >
                    {tag}
                  </Link>
                );
              })}
              <Link
                href="/categories"
                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet ring-1 ring-[#E4E9F5]"
              >
                More
              </Link>
            </div>
          </div>
          <div className="relative mx-auto hidden h-[340px] w-full max-w-md lg:block">
            {heroFaces.map((creator, index) => (
              <div
                key={creator.slug}
                className={`absolute overflow-hidden rounded-[1.75rem] shadow-2xl ring-2 ring-white ${
                  index === 0
                    ? "left-2 top-6 h-40 w-32 rotate-[-8deg]"
                    : index === 1
                      ? "left-[36%] top-0 h-44 w-36 rotate-[4deg]"
                      : index === 2
                        ? "right-2 top-10 h-40 w-32 rotate-[8deg]"
                        : index === 3
                          ? "bottom-2 left-[28%] h-28 w-40 rotate-[-3deg]"
                          : index === 4
                            ? "bottom-8 right-0 h-24 w-24 rotate-[6deg]"
                            : "left-[8%] top-[48%] h-20 w-20 rotate-[-12deg]"
                }`}
              >
                <Image src={creator.image} alt="" fill className="object-cover" sizes="160px" />
              </div>
            ))}
            <div className="absolute -left-2 bottom-16 max-w-[180px] rounded-2xl bg-violet px-3 py-2 text-[11px] font-bold text-white shadow-lg">
              {hero.collageLabels[0]}
            </div>
            <div className="absolute right-0 top-24 max-w-[170px] rounded-2xl bg-[#2979FF] px-3 py-2 text-[11px] font-bold text-white shadow-lg">
              {hero.collageLabels[1]}
            </div>
            <div className="absolute bottom-0 right-8 max-w-[190px] rounded-2xl bg-indigo px-3 py-2 text-[11px] font-bold text-white shadow-lg">
              {hero.collageLabels[2]}
            </div>
          </div>
        </div>
      </section>

      {/* —— Popular Collaboration Matches —— */}
      <section id="matches" className="mx-auto w-full max-w-[90rem] px-4 py-10 sm:px-6 lg:px-10">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-indigo">{landing.popularMatches.title}</h2>
            <p className="mt-1 text-sm text-muted">{landing.popularMatches.subtitle}</p>
          </div>
          <Link
            href={landing.popularMatches.ctaHref}
            className="shrink-0 text-sm font-bold text-violet hover:underline"
          >
            {landing.popularMatches.ctaLabel} <IconArrowRight size={14} className="inline" />
          </Link>
        </div>
        <FeaturedCarousel stepPx={220}>
          {popularCards.map((chip) => (
            <Link
              key={`${chip.title}-${chip.subtitle}`}
              href={`/collaboration?specialty=${encodeURIComponent(chip.specialty)}`}
              className="group w-[200px] shrink-0 overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_rgba(17,26,90,0.08)] ring-1 ring-[#E4E9F5] transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="relative h-28 overflow-hidden">
                <Image
                  src={chip.image}
                  alt=""
                  fill
                  className="object-cover transition duration-500 group-hover:scale-105"
                  sizes="200px"
                />
              </div>
              <div className="relative px-3 pb-3 pt-5">
                <span className="absolute -top-4 left-3 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-violet shadow ring-1 ring-[#E4E9F5]">
                  <CategoryGlyph slug={chip.specialty} size={16} />
                </span>
                <p className="font-display text-sm font-bold text-indigo">{chip.title}</p>
                <p className="mt-0.5 text-xs font-medium text-muted">{chip.subtitle}</p>
              </div>
            </Link>
          ))}
        </FeaturedCarousel>
      </section>

      {/* —— Choose How You Want to Collaborate —— */}
      <section className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 lg:px-10">
        <h2 className="font-display text-2xl font-bold text-indigo">{dual.title}</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-[#E4E9F5] bg-gradient-to-br from-[#F7F4FF] to-white p-6 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet">{dual.business.eyebrow}</p>
            <h3 className="mt-1 font-display text-xl font-bold text-indigo">{dual.business.title}</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-muted">
              {dual.business.points.map((item) => (
                <li key={item} className="flex gap-2">
                  <IconCheck size={14} className="mt-0.5 shrink-0 text-violet" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href={joinBusinessHref} className="btn-primary mt-5 inline-flex !py-2 text-sm">
              {dual.business.cta.label} <IconArrowRight size={14} />
            </Link>
          </article>
          <article className="rounded-2xl border border-[#E4E9F5] bg-gradient-to-br from-[#EEF5FF] to-white p-6 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2979FF]">
              {dual.influencer.eyebrow}
            </p>
            <h3 className="mt-1 font-display text-xl font-bold text-indigo">{dual.influencer.title}</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-muted">
              {dual.influencer.points.map((item) => (
                <li key={item} className="flex gap-2">
                  <IconCheck size={14} className="mt-0.5 shrink-0 text-[#2979FF]" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href={dual.influencer.cta.href} className="btn-primary mt-5 inline-flex !py-2 text-sm">
              {dual.influencer.cta.label} <IconArrowRight size={14} />
            </Link>
          </article>
        </div>
      </section>

      {params.requested ? (
        <div className="mx-auto mb-4 w-full max-w-[90rem] px-4 sm:px-6 lg:px-10">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Collaboration proposal submitted for review. The other influencer will see your structured brief.
          </div>
        </div>
      ) : null}
      {params.saved ? (
        <div className="mx-auto mb-4 w-full max-w-[90rem] px-4 sm:px-6 lg:px-10">
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            Match saved. Open it anytime from your collaboration hub after you send a proposal.
          </p>
        </div>
      ) : null}
      {params.error ? (
        <div className="mx-auto mb-4 w-full max-w-[90rem] px-4 sm:px-6 lg:px-10">
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {params.error}
          </p>
        </div>
      ) : null}

      {/* —— Featured Collaboration Matches —— */}
      <section className="mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-6 lg:px-10">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-indigo">{landing.featured.title}</h2>
            <p className="mt-1 text-sm text-muted">{landing.featured.subtitle}</p>
          </div>
          <a href="#matches" className="text-sm font-bold text-violet hover:underline">
            {landing.featured.ctaLabel} →
          </a>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          {featured && brand ? (
            <FeaturedMatchCard
              match={featured}
              brand={brand}
              canRequest={canRequest}
              signedIn={signedIn}
              viewerSlug={viewer?.slug}
              viewerPlan={viewerPlan}
            />
          ) : (
            <div className="rounded-2xl border border-[#E4E9F5] bg-white p-8 text-center text-muted">
              No matches for those filters.{" "}
              <Link href="/collaboration" className="font-semibold text-violet">
                Clear filters
              </Link>
            </div>
          )}
          <aside className="space-y-3">
            {sideMatches.map((match) => (
              <Link
                key={`${match.a.slug}-${match.b.slug}`}
                href={`/collaboration/propose?a=${encodeURIComponent(match.a.slug)}&b=${encodeURIComponent(match.b.slug)}`}
                className="flex items-center gap-3 rounded-2xl border border-[#E4E9F5] bg-white p-3 shadow-sm transition hover:border-violet/40"
              >
                <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
                  <Image src={match.a.image} alt="" fill className="object-cover" sizes="48px" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-indigo">
                    {match.a.displayName} × {match.b.displayName}
                  </p>
                  <p className="text-[11px] text-muted">{match.score}% match</p>
                </div>
                <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
                  <Image src={match.b.image} alt="" fill className="object-cover" sizes="48px" />
                </span>
              </Link>
            ))}
          </aside>
        </div>
      </section>

      {/* —— Marketplace —— */}
      <section className="mx-auto grid w-full max-w-[90rem] gap-4 px-4 py-6 sm:px-6 lg:grid-cols-2 lg:px-10">
        <article className="rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-indigo">{landing.marketplace.businessTitle}</h2>
              <p className="text-xs text-muted">{landing.marketplace.businessSubtitle}</p>
            </div>
            <Link href={businessHref} className="text-[11px] font-bold text-violet">
              View all →
            </Link>
          </div>
          <ul className="space-y-3">
            {requests.slice(0, 4).map((item) => (
              <li key={item.id} className="rounded-xl border border-[#E8EDF8] p-3">
                <div className="flex gap-3">
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[#F4F7FF]">
                    {item.logoUrl ? (
                      <Image src={item.logoUrl} alt="" fill className="object-contain p-1.5" sizes="44px" />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-indigo">{item.brand}</p>
                    <p className="text-[11px] text-muted">
                      {item.budget} · {item.location}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted">{item.summary}</p>
                    {signedIn && draft?.slug ? (
                      <form action={actionApplyToBusinessRequest} className="mt-2">
                        <input type="hidden" name="requestId" value={item.id} />
                        <button type="submit" className="inline-flex text-[11px] font-bold text-violet">
                          Apply to request →
                        </button>
                      </form>
                    ) : (
                      <Link
                        href={`/login?next=${encodeURIComponent("/collaboration/hub#business-requests")}&gate=apply`}
                        className="mt-2 inline-flex text-[11px] font-bold text-violet"
                      >
                        Sign in to apply →
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-indigo">{landing.marketplace.influencerTitle}</h2>
              <p className="text-xs text-muted">{landing.marketplace.influencerSubtitle}</p>
            </div>
            <Link href="/discover" className="text-[11px] font-bold text-violet">
              View all →
            </Link>
          </div>
          <ul className="space-y-3">
            {filteredOpportunities.slice(0, 4).map((item) => {
              const creator = bySlug.get(item.creatorSlug);
              if (!creator) return null;
              return (
                <li key={item.id} className="flex gap-3 rounded-xl border border-[#E8EDF8] p-3">
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full">
                    <Image src={creator.image} alt="" fill className="object-cover" sizes="44px" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-indigo">{creator.displayName}</p>
                    <p className="text-[11px] text-muted">Looking for {item.lookingFor}</p>
                    <Link href={`/creators/${creator.slug}`} className="btn-primary mt-2 !px-3 !py-1 text-[11px]">
                      Connect
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </article>
      </section>

      {/* —— Suggestions banner + guest sample (Collab OS §3.3) —— */}
      <section id="guest-suggestions" className="mx-auto w-full max-w-[90rem] px-4 py-4 sm:px-6 lg:px-10">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#633CFF] via-[#5B4CFF] to-[#2979FF] p-5 text-white shadow-lg sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-xl">
              <h2 className="font-display text-xl font-bold">{landing.suggestionsBanner.title}</h2>
              <p className="mt-1 text-sm text-white/80">
                {showGuestSample
                  ? "Enter a campaign goal and specialty for a limited anonymized sample. Sign up to see full influencer identities, save matches, and invite."
                  : landing.suggestionsBanner.subtitle}
              </p>
            </div>
            {!showGuestSample ? (
              <Link
                href={suggestionsHref}
                className="ink-on-light inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold"
              >
                {landing.suggestionsBanner.cta.label} <IconArrowRight size={14} />
              </Link>
            ) : null}
          </div>

          {showGuestSample ? (
            <form
              action="/collaboration#guest-suggestions"
              className="mt-5 grid gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur-sm sm:grid-cols-2 lg:grid-cols-5"
            >
              <input type="hidden" name="landing" value="1" />
              <input type="hidden" name="sample" value="1" />
              <label className="block text-[11px] font-bold uppercase tracking-wide text-white/80">
                Campaign goal
                <select
                  name="goal"
                  defaultValue={params.goal ?? "Brand Awareness"}
                  className="mt-1 w-full rounded-xl border-0 bg-white px-3 py-2 text-sm font-medium text-indigo"
                >
                  <option>Brand Awareness</option>
                  <option>Product Launch</option>
                  <option>Content Series</option>
                  <option>Event Activation</option>
                  <option>Long-term Partnership</option>
                </select>
              </label>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-white/80">
                Specialty
                <select
                  name="specialty"
                  defaultValue={params.specialty ?? "beauty"}
                  className="mt-1 w-full rounded-xl border-0 bg-white px-3 py-2 text-sm font-medium text-indigo"
                >
                  {taxonomy.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-white/80">
                Geography
                <input
                  name="location"
                  defaultValue={params.location ?? "Global"}
                  className="mt-1 w-full rounded-xl border-0 bg-white px-3 py-2 text-sm font-normal text-indigo"
                />
              </label>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-white/80">
                Platform
                <select
                  name="platform"
                  defaultValue={params.platform ?? "INSTAGRAM"}
                  className="mt-1 w-full rounded-xl border-0 bg-white px-3 py-2 text-sm font-medium text-indigo"
                >
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="TIKTOK">TikTok</option>
                  <option value="YOUTUBE">YouTube</option>
                  <option value="X">X</option>
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="ink-on-light w-full rounded-full bg-white px-4 py-2.5 text-sm font-bold"
                >
                  Show sample <IconArrowRight size={14} />
                </button>
              </div>
            </form>
          ) : null}

          {guestSample && guestSample.suggestions.length > 0 ? (
            <div className="mt-5">
              <p className="text-xs font-semibold text-white/85">
                Limited preview · {guestSample.suggestions.length} anonymized suggestion
                {guestSample.suggestions.length === 1 ? "" : "s"} for{" "}
                {guestSample.brief.goal} · {specialtyLabel(guestSample.brief.specialty)}
              </p>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {guestSample.suggestions.map((card) => (
                  <li
                    key={card.sampleId}
                    className="overflow-hidden rounded-2xl border border-white/20 bg-white/95 text-indigo shadow-sm"
                  >
                    <div className="relative h-28">
                      <Image
                        src={card.image}
                        alt=""
                        fill
                        className="object-cover blur-[2px] scale-105"
                        sizes="240px"
                      />
                      <span className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-violet">
                        {card.score}% fit
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-bold text-indigo">{card.label}</p>
                      <p className="text-[11px] text-muted">
                        {card.title} · {card.followersHint}
                      </p>
                      <p className="mt-2 line-clamp-2 rounded-lg bg-[#F8FAFF] p-2 text-[11px] text-muted">
                        {card.reason}
                      </p>
                      <Link
                        href={signupForSuggestions}
                        className="btn-primary mt-3 !px-3 !py-1.5 text-[11px]"
                      >
                        Sign up to reveal <IconArrowRight size={12} />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showGuestSample && params.sample === "1" && guestSample && guestSample.suggestions.length === 0 ? (
            <p className="mt-4 text-sm text-white/85">
              No sample matches yet for that brief. Try another specialty or{" "}
              <Link href={signupForSuggestions} className="font-bold underline">
                sign up
              </Link>{" "}
              for the full suggestion workflow.
            </p>
          ) : null}
        </div>
      </section>

      {/* —— How it works —— */}
      <section className="border-y border-[#E4E9F5] bg-white">
        <div className="mx-auto w-full max-w-[90rem] px-4 py-10 sm:px-6 lg:px-10">
          <h2 className="font-display text-2xl font-bold text-indigo">{landing.howItWorks.title}</h2>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {landing.howItWorks.steps.map((step, index) => (
              <li key={step} className="rounded-2xl border border-[#E4E9F5] bg-[#F8FAFF] p-4">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet text-xs font-bold text-white">
                  {index + 1}
                </span>
                <p className="mt-2 text-sm font-bold text-indigo">{step}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="font-display text-lg font-bold text-indigo">{landing.features.businessTitle}</h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {landing.features.businessItems.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted">
                    <IconCheck size={14} className="mt-0.5 shrink-0 text-violet" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-indigo">{landing.features.influencerTitle}</h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {landing.features.influencerItems.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted">
                    <IconCheck size={14} className="mt-0.5 shrink-0 text-[#2979FF]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-[#E4E9F5] bg-[#F4F0FF] p-5">
            <h3 className="font-display text-lg font-bold text-indigo">{landing.protectedPayments.title}</h3>
            <p className="mt-1 text-sm text-muted">{landing.protectedPayments.subtitle}</p>
            <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {landing.protectedPayments.steps.map((step, index) => (
                <li key={step} className="rounded-xl bg-white px-3 py-3 text-center shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-violet">
                    Step {index + 1}
                  </span>
                  <p className="mt-1 text-xs font-bold text-indigo">{step}</p>
                </li>
              ))}
            </ol>
            <Link href="/payments" className="mt-4 inline-flex text-sm font-bold text-violet">
              Learn about protected payments →
            </Link>
          </div>
        </div>
      </section>

      {/* —— Popular Collaboration Types —— */}
      <section className="mx-auto w-full max-w-[90rem] px-4 py-10 sm:px-6 lg:px-10">
        <h2 className="font-display text-2xl font-bold text-indigo">{landing.collabTypes.title}</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {landing.collabTypes.items.map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAE4FF] text-violet">
                <IconHeart size={16} />
              </span>
              <p className="text-sm font-bold text-indigo">{item}</p>
            </div>
          ))}
        </div>
      </section>

      {/* —— Influencer Mentorship —— */}
      <section className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 lg:px-10">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#633CFF] to-[#2979FF] p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">Mentorship</p>
              <h2 className="mt-1 font-display text-2xl font-bold">{landing.mentorship.title}</h2>
              <p className="mt-2 text-sm text-white/85">{landing.mentorship.subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={landing.mentorship.findCta.href}
                className="ink-on-light inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-bold"
              >
                {landing.mentorship.findCta.label}
              </Link>
              <Link
                href={landing.mentorship.becomeCta.href}
                className="inline-flex rounded-full border border-white/40 px-5 py-2.5 text-sm font-bold text-white"
              >
                {landing.mentorship.becomeCta.label}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* —— Trust bar —— */}
      <section className="border-y border-[#E4E9F5] bg-white">
        <div className="mx-auto w-full max-w-[90rem] px-4 py-10 sm:px-6 lg:px-10">
          <h2 className="text-center font-display text-xl font-bold text-indigo">{landing.trustBar.title}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {landing.trustBar.items.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-xl border border-[#E4E9F5] bg-[#F8FAFF] px-3 py-3 text-sm font-semibold text-indigo"
              >
                <IconCheck size={14} className="shrink-0 text-violet" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* —— Final CTAs —— */}
      <section className="mx-auto w-full max-w-[90rem] px-4 py-12 sm:px-6 lg:px-10">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-gradient-to-br from-[#633CFF] to-[#5B4CFF] p-6 text-white shadow-sm">
            <div className="flex items-center gap-2">
              <IconUsers size={18} />
              <h2 className="font-display text-xl font-bold">{landing.finalCtas.influencer.title}</h2>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-white/85">
              {landing.finalCtas.influencer.points.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <IconCheck size={14} className="mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={landing.finalCtas.influencer.cta.href}
              className="ink-on-light mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-bold"
            >
              {landing.finalCtas.influencer.cta.label} <IconArrowRight size={14} />
            </Link>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-[#2979FF] to-[#633CFF] p-6 text-white shadow-sm">
            <div className="flex items-center gap-2">
              <IconBuilding size={18} />
              <h2 className="font-display text-xl font-bold">{landing.finalCtas.business.title}</h2>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-white/85">
              {landing.finalCtas.business.points.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <IconCheck size={14} className="mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={joinBusinessHref}
              className="ink-on-light mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-bold"
            >
              {landing.finalCtas.business.cta.label} <IconArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeaturedMatchCard({
  match,
  brand,
  canRequest,
  signedIn,
  viewerSlug,
  viewerPlan,
}: {
  match: CreatorMatch;
  brand: MarketplaceBusinessRequestRow;
  canRequest: boolean;
  signedIn: boolean;
  viewerSlug?: string;
  viewerPlan: PlanCode;
}) {
  const factors = [
    ["Audience Alignment", match.breakdown.audienceAlignment],
    ["Content Compatibility", match.breakdown.contentCompatibility],
    ["Goal Synergy", match.breakdown.goalSynergy],
    ["Engagement Potential", match.breakdown.engagementPotential],
  ] as const;
  const proposePath = `/collaboration/propose?a=${encodeURIComponent(match.a.slug)}&b=${encodeURIComponent(match.b.slug)}&from=${encodeURIComponent(viewerSlug ?? match.a.slug)}`;
  const proposeHref = signedIn
    ? proposePath
    : `/login?next=${encodeURIComponent(proposePath)}&gate=proposal`;

  return (
    <article className="rounded-[1.5rem] border border-[#E4E9F5] bg-white p-5 shadow-sm sm:p-6">
      <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <PartyCard
          image={match.a.image}
          name={match.a.displayName}
          title={match.a.title}
          location={`${match.a.locationCity}, ${match.a.locationCountry}`}
          specialties={match.a.specialties}
          socials={match.a.socials}
          engagement={match.a.stats?.engagementRate}
        />
        <div className="flex flex-col items-center gap-3 px-2">
          <ScoreRing score={match.score} />
          <dl className="w-full min-w-[190px] space-y-1.5 text-xs">
            {factors.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <dt className="text-muted">{label}</dt>
                <dd className="font-bold text-indigo">{value}%</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="rounded-2xl border border-[#E8EDF8] bg-white p-4">
          <div className="flex gap-3">
            <span className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-[#F4F7FF]">
              {brand.imageUrl || brand.logoUrl ? (
                <Image
                  src={(brand.imageUrl || brand.logoUrl)!}
                  alt=""
                  fill
                  className={brand.imageUrl ? "object-cover" : "object-contain p-2"}
                  sizes="64px"
                />
              ) : null}
            </span>
            <div>
              <span className="rounded-full bg-[#EAE4FF] px-2 py-0.5 text-[10px] font-bold text-violet">
                Brand
              </span>
              <p className="mt-1 font-display text-lg font-bold text-indigo">{brand.brand}</p>
              <p className="text-xs text-muted">{brand.category}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                <IconMapPin size={12} className="text-violet" />
                {brand.location}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-[#F4F0FF] p-4">
        <p className="flex items-center gap-2 font-bold text-indigo">
          <IconHeart size={14} className="text-violet" /> Why This Match Works
        </p>
        <p className="mt-1 text-sm text-muted">{match.why}</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {signedIn && !canRequest ? (
          <Link href="/card#pricing" className="btn-secondary">
            Upgrade from {viewerPlan} to request matches
          </Link>
        ) : (
          <Link href={proposeHref} className="btn-primary">
            Request Collaboration <IconArrowRight size={14} />
          </Link>
        )}
        <SaveMatchButton
          partyASlug={match.a.slug}
          partyBSlug={match.b.slug}
          signedIn={signedIn}
          returnTo={
            viewerSlug && collabOsOn
              ? "/collaboration/hub?saved=1"
              : "/collaboration?landing=1&saved=1"
          }
        />
      </div>
    </article>
  );
}

function PartyCard({
  image,
  name,
  title,
  location,
  specialties,
  socials,
  engagement,
}: {
  image: string;
  name: string;
  title: string;
  location: string;
  specialties: string[];
  socials: { platform: string; followers: number }[];
  engagement?: string;
}) {
  const primary = socials[0];
  return (
    <div className="rounded-2xl border border-[#E8EDF8] bg-[#F8FAFF] p-4">
      <div className="flex gap-3">
        <span className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl">
          <Image src={image} alt={name} fill className="object-cover" sizes="64px" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-indigo">{name}</p>
          <p className="text-xs text-muted">{title}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted">
            <IconMapPin size={12} className="text-violet" />
            {location}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {specialties.slice(0, 3).map((slug) => (
          <span key={slug} className="rounded-full bg-[#EAE4FF] px-2 py-0.5 text-[10px] font-semibold text-violet">
            {specialtyLabel(slug)}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3 text-[11px] font-semibold text-indigo">
        {primary ? (
          <span className="inline-flex items-center gap-1">
            <SocialIcon platform={primary.platform} size={14} />
            {formatFollowers(primary.followers)}
          </span>
        ) : null}
        <span>{engagement ?? "—"} eng.</span>
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  return (
    <div className="relative h-28 w-28">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#633CFF 0 ${score}%, #2979FF ${score}% ${Math.min(100, score + 8)}%, #E7E9F5 ${Math.min(100, score + 8)}% 100%)`,
        }}
      />
      <div className="absolute inset-[7px] flex flex-col items-center justify-center rounded-full bg-white text-center">
        <span className="font-display text-2xl font-bold leading-none text-indigo">{score}%</span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted">Match Score</span>
      </div>
    </div>
  );
}
