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
  IconInstagram,
  IconLinkedIn,
  IconMapPin,
  IconSearch,
  IconTikTok,
  IconUsers,
  IconX,
  IconYouTube,
  SocialIcon,
} from "@/components/icons";
import { SaveMatchButton } from "@/components/save-match-button";
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";
import { getCms } from "@/lib/cms";
import {
  allDirectoryMatches,
  filterMatches,
  POPULAR_MATCH_CHIPS,
  scoreCreatorPair,
  type CreatorMatch,
} from "@/lib/matching";
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

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Collaborations",
};

type Props = {
  searchParams: Promise<{
    specialty?: string;
    location?: string;
    platform?: string;
    q?: string;
    from?: string;
    requested?: string;
    collabType?: string | string[];
    audience?: string;
    goal?: string;
    budget?: string;
    verified?: string;
    save?: string;
    saved?: string;
    error?: string;
    landing?: string;
  }>;
};

const COLLAB_TYPES = [
  { value: "brand-partnership", label: "Brand Partnership" },
  { value: "creator", label: "Influencer × Influencer" },
  { value: "product", label: "Product Collaboration" },
  { value: "content-exchange", label: "Content Exchange" },
  { value: "event", label: "Event / Experience" },
  { value: "long-term", label: "Long-term Partnership" },
];

const POPULAR_TAGS = ["Skincare", "Travel", "Fitness", "Food", "Tech", "Home Decor"];

function list(value?: string | string[]) {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).filter(Boolean);
}

export default async function CollaborationPage({ searchParams }: Props) {
  const params = await searchParams;
  const collabTypes = list(params.collabType);
  const [directory, cms] = await Promise.all([getDirectory(), getCms()]);
  const bySlug = indexCreatorsBySlug(directory.creators);
  const all = await allDirectoryMatches();
  await persistTopMatches(all).catch(() => 0);
  const matches = filterMatches(all, {
    specialty: params.specialty,
    location: params.location,
    platform: params.platform,
    q: params.q,
  }).filter((match) => {
    if (!params.audience) return true;
    const hay = `${match.a.specialties.join(" ")} ${match.b.specialties.join(" ")} ${match.a.bio} ${match.b.bio}`.toLowerCase();
    return hay.includes(params.audience.toLowerCase());
  });
  const featured = matches[0] ?? all[0];
  const account = await getAccountSession().catch(() => null);
  const draft = account ? await getCreatorSessionDraft().catch(() => null) : null;

  // Signed-in creators land on Figure 2 hub; guests keep Figure 1. Opt out with ?landing=1.
  if (account && draft?.slug && params.landing !== "1" && !params.save) {
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

  const viewerFromParam = params.from ? bySlug.get(params.from) ?? null : null;
  const viewerFromSession = draft?.slug ? bySlug.get(draft.slug) ?? null : null;
  const viewer = viewerFromParam ?? (account ? viewerFromSession : null);
  const viewerPlan: PlanCode = viewer && isPlanCode(viewer.planTier) ? viewer.planTier : "STARTER";
  const viewerLimits = await entitlementsForPlan(viewerPlan);
  const canRequest = !viewer || viewerLimits.proposalsMax > 0;
  const signedIn = Boolean(account);
  const businessHref = signedIn ? "/business/workspace" : "/business";
  const joinBusinessHref = "/business";
  const suggestionsHref = signedIn
    ? "/collaboration/hub?category=awareness"
    : `/login?next=${encodeURIComponent("/collaboration?goal=awareness")}&gate=suggestions`;

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
      redirect(draft?.slug ? "/collaboration/hub?saved=1" : "/collaboration?landing=1&saved=1");
    }
  }
  if (params.save && !account) {
    redirect(`/login?next=${encodeURIComponent(`/collaboration?save=${params.save}`)}&gate=save`);
  }

  const [requestPool, opportunities] = await Promise.all([
    listPublishedBusinessRequests({ goal: params.goal }),
    listPublishedCreatorOpportunities(),
  ]);
  const budgetOptions = [...new Set(requestPool.map((item) => item.budget))];
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
    }) ?? requests[0] ?? requestPool[0];
  const filteredOpportunities = opportunities.filter((item) => {
    if (!params.specialty) return true;
    const creator = bySlug.get(item.creatorSlug);
    return creator?.specialties.some((slug) => slug.includes(params.specialty!)) ?? false;
  });
  const heroFaces = directory.creators.slice(0, 4);
  const taxonomy = directory.taxonomy;
  const popularCards =
    cms.collaborationMatches.matches.length > 0
      ? cms.collaborationMatches.matches.map((match) => {
          const chip = POPULAR_MATCH_CHIPS.find(
            (row) => `${row.title} ${row.subtitle}`.includes(match.title.split(" + ")[0] ?? "") || match.title.includes(row.title),
          );
          const [left, right] = match.title.split(/\s*\+\s*/);
          return {
            title: left?.trim() || match.title,
            subtitle: right ? `+ ${right.trim()}` : chip?.subtitle || "",
            specialty: chip?.specialty || match.tags[0]?.toLowerCase() || "lifestyle",
            image: match.image || chip?.image || "/demo/categories/cat-lifestyle.jpg",
          };
        })
      : POPULAR_MATCH_CHIPS;

  return (
    <div className="bg-[#F4F7FF]">
      {/* —— Hero (Figure 1) —— */}
      <section className="border-b border-[#E4E9F5] bg-gradient-to-br from-[#F7F4FF] via-white to-[#EEF5FF]">
        <div className="mx-auto grid w-full max-w-[90rem] items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:py-14">
          <div>
            <h1 className="font-display text-4xl font-bold leading-tight text-indigo sm:text-5xl">
              Collaboration Opportunities. Find the Right Collaboration. Build Bigger Opportunities.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              Influrios connects influencers, businesses, and professionals for specialty-fit collaborations —
              without asking anyone to rebuild their audience on another social network.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="#matches" className="btn-primary">
                Explore Collaborations <IconArrowRight size={14} />
              </a>
              <Link href={suggestionsHref} className="btn-secondary">
                Get Collaboration Suggestions
              </Link>
            </div>
            <form action="/collaboration" className="mt-6 flex max-w-xl items-center gap-2 rounded-full bg-white p-1.5 shadow-lg shadow-violet/10 ring-1 ring-[#E4E9F5]">
              <span className="pl-3 text-muted">
                <IconSearch size={18} />
              </span>
              <input
                name="q"
                defaultValue={params.q}
                placeholder="Search influencers, businesses, niches or collaboration opportunities..."
                className="w-full flex-1 border-0 bg-transparent py-2.5 text-sm text-indigo outline-none placeholder:text-muted/70"
              />
              <button type="submit" className="btn-primary shrink-0 !px-5 !py-2.5">
                Search <IconArrowRight size={14} />
              </button>
            </form>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted">Popular:</span>
              {POPULAR_TAGS.map((tag) => {
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
            </div>
          </div>
          <div className="relative mx-auto hidden h-[320px] w-full max-w-md lg:block">
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
                        : "bottom-2 left-[28%] h-28 w-40 rotate-[-3deg]"
                }`}
              >
                <Image src={creator.image} alt="" fill className="object-cover" sizes="160px" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* —— Popular Collaboration Matches —— */}
      <section id="matches" className="mx-auto w-full max-w-[90rem] px-4 py-10 sm:px-6 lg:px-10">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-indigo">Popular Collaboration Matches</h2>
            <p className="mt-1 text-sm text-muted">
              Explore real examples of influencer and brand categories that work great together.
            </p>
          </div>
          <Link href="/categories" className="shrink-0 text-sm font-bold text-violet hover:underline">
            View all categories <IconArrowRight size={14} className="inline" />
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

      {params.requested ? (
        <div className="mx-auto mb-4 w-full max-w-[90rem] px-4 sm:px-6 lg:px-10">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Collaboration proposal submitted for review. The other influencer will see your structured brief.
          </div>
        </div>
      ) : null}

      {/* —— Filters + Featured + Rails —— */}
      <div className="mx-auto grid w-full max-w-[90rem] gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[250px_minmax(0,1fr)_280px] lg:px-10">
        <aside className="h-fit rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display font-bold text-indigo">Filter Collaborations</h2>
            <Link href="/collaboration" className="text-xs font-bold text-violet">
              Reset All
            </Link>
          </div>
          <form className="space-y-4">
            <label className="block text-xs font-bold text-indigo">
              Industry / Niche
              <select
                name="specialty"
                defaultValue={params.specialty ?? ""}
                className="mt-1.5 w-full rounded-xl border border-border px-3 py-2 text-sm font-medium text-indigo outline-none focus:ring-2 focus:ring-violet"
              >
                <option value="">Select industry</option>
                {taxonomy.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend className="text-xs font-bold text-indigo">Collaboration Type</legend>
              <ul className="mt-2 space-y-2">
                {COLLAB_TYPES.map((item) => (
                  <li key={item.value}>
                    <label className="flex items-center gap-2 text-sm text-indigo">
                      <input
                        type="checkbox"
                        name="collabType"
                        value={item.value}
                        defaultChecked={collabTypes.includes(item.value)}
                        className="h-4 w-4 rounded accent-[#633CFF]"
                      />
                      {item.label}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>

            <label className="block text-xs font-bold text-indigo">
              Location
              <input
                name="location"
                defaultValue={params.location}
                placeholder="Select location"
                className="mt-1.5 w-full rounded-xl border border-border px-3 py-2 text-sm font-medium text-indigo outline-none focus:ring-2 focus:ring-violet"
              />
            </label>

            <label className="block text-xs font-bold text-indigo">
              Budget Range
              <select
                name="budget"
                defaultValue={params.budget ?? ""}
                className="mt-1.5 w-full rounded-xl border border-border px-3 py-2 text-sm font-medium text-indigo outline-none focus:ring-2 focus:ring-violet"
              >
                <option value="">Select budget range</option>
                {budgetOptions.map((budget) => (
                  <option key={budget} value={budget}>
                    {budget}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-bold text-indigo">
              Audience Type
              <select
                name="audience"
                defaultValue={params.audience ?? ""}
                className="mt-1.5 w-full rounded-xl border border-border px-3 py-2 text-sm font-medium text-indigo outline-none focus:ring-2 focus:ring-violet"
              >
                <option value="">All audiences</option>
                <option value="beauty">Beauty audiences</option>
                <option value="travel">Travel audiences</option>
                <option value="fitness">Fitness audiences</option>
                <option value="lifestyle">Lifestyle audiences</option>
              </select>
            </label>

            <fieldset>
              <legend className="text-xs font-bold text-indigo">Platform</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  ["INSTAGRAM", IconInstagram],
                  ["TIKTOK", IconTikTok],
                  ["YOUTUBE", IconYouTube],
                  ["X", IconX],
                  ["LINKEDIN", IconLinkedIn],
                ].map(([value, Icon]) => {
                  const active = params.platform === value;
                  return (
                    <label
                      key={String(value)}
                      className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl ring-1 ${
                        active ? "bg-violet text-white ring-violet" : "bg-white text-indigo ring-[#E4E9F5]"
                      }`}
                    >
                      <input type="radio" name="platform" value={String(value)} defaultChecked={active} className="sr-only" />
                      <Icon size={18} />
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
              <input
                type="checkbox"
                name="verified"
                value="1"
                defaultChecked={params.verified === "1"}
                className="h-4 w-4 rounded accent-[#633CFF]"
              />
              Verified accounts only
            </label>

            <button type="submit" className="btn-primary w-full !py-2.5 text-sm">
              Apply Filters
            </button>
          </form>
        </aside>

        <div className="min-w-0 space-y-6">
          {featured && brand ? (
            <RecommendedMatch
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

          {params.saved ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              Match saved. Open it anytime from your collaboration records after you send a proposal.
            </p>
          ) : null}
          {params.error ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
              {params.error}
            </p>
          ) : null}

          <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#633CFF] via-[#5B4CFF] to-[#2979FF] p-5 text-white shadow-lg sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-md">
                <h2 className="font-display text-xl font-bold">Need Collaboration Ideas?</h2>
                <p className="mt-1 text-sm text-white/80">
                  Tell us your category and campaign goal. Guests get a limited preview — full matches unlock after signup.
                </p>
              </div>
              <Link
                href={suggestionsHref}
                className="ink-on-light inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold"
              >
                Get Collaboration Suggestions <IconArrowRight size={14} />
              </Link>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#E4E9F5] bg-white shadow-sm">
            <div className="grid items-center gap-4 p-5 sm:grid-cols-[1.1fr_0.9fr] sm:p-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet">Mentorship</p>
                <h2 className="mt-1 font-display text-2xl font-bold text-indigo">Become a Mentor on Influrios</h2>
                <ul className="mt-3 space-y-1.5 text-sm text-muted">
                  {["Share knowledge with rising influencers", "Build your professional network", "Make an impact in your niche"].map(
                    (item) => (
                      <li key={item} className="flex items-start gap-2">
                        <IconCheck size={14} className="mt-0.5 shrink-0 text-violet" />
                        {item}
                      </li>
                    ),
                  )}
                </ul>
                <Link href="/mentorship" className="btn-primary mt-4 inline-flex !py-2 text-sm">
                  Learn about Mentorship <IconArrowRight size={14} />
                </Link>
              </div>
              <div className="relative hidden h-40 sm:block">
                {directory.creators.slice(0, 3).map((creator, index) => (
                  <span
                    key={creator.slug}
                    className={`absolute overflow-hidden rounded-2xl ring-2 ring-white shadow-lg ${
                      index === 0
                        ? "left-4 top-2 h-28 w-24"
                        : index === 1
                          ? "left-[38%] top-6 h-28 w-24"
                          : "right-4 top-0 h-32 w-28"
                    }`}
                  >
                    <Image src={creator.image} alt="" fill className="object-cover" sizes="112px" />
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-indigo">Business Requests</h2>
              <Link href={businessHref} className="text-[11px] font-bold text-violet">
                View all →
              </Link>
            </div>
            <ul className="space-y-3">
              {requests.map((item) => (
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
                      <Link href={businessHref} className="mt-2 inline-flex text-[11px] font-bold text-violet">
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
              <h2 className="font-display text-base font-bold text-indigo">Influencer Collaboration Opportunities</h2>
              <Link href="/discover" className="text-[11px] font-bold text-violet">
                View all opportunities →
              </Link>
            </div>
            <ul className="space-y-3">
              {filteredOpportunities.map((item) => {
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
          </section>
        </div>
      </div>

      {/* —— Choose how / How it works / Protected payments —— */}
      <section className="mx-auto w-full max-w-[90rem] px-4 py-10 sm:px-6 lg:px-10">
        <h2 className="font-display text-2xl font-bold text-indigo">Choose How You Want to Collaborate</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-[#E4E9F5] bg-white p-6 shadow-sm">
            <h3 className="font-display text-xl font-bold text-indigo">Work with the Right Influencers</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-muted">
              {[
                "Find influencers by specialty, audience and market",
                "Get influencer suggestions for your campaign goals",
                "Post requests and fund collaborations by milestone",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <IconCheck size={14} className="mt-0.5 shrink-0 text-violet" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href={joinBusinessHref} className="btn-primary mt-5 inline-flex !py-2 text-sm">
              Create Business Profile <IconArrowRight size={14} />
            </Link>
          </article>
          <article className="rounded-2xl border border-[#E4E9F5] bg-white p-6 shadow-sm">
            <h3 className="font-display text-xl font-bold text-indigo">Find Opportunities & Grow</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-muted">
              {[
                "Join Influrios as an Influencer with your existing social presence",
                "Get discovered for specialty-fit collaborations",
                "Save matches and manage proposals in one hub",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <IconCheck size={14} className="mt-0.5 shrink-0 text-violet" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/claim" className="btn-primary mt-5 inline-flex !py-2 text-sm">
              Join as an Influencer <IconArrowRight size={14} />
            </Link>
          </article>
        </div>
      </section>

      <section className="border-y border-[#E4E9F5] bg-white">
        <div className="mx-auto w-full max-w-[90rem] px-4 py-10 sm:px-6 lg:px-10">
          <h2 className="font-display text-2xl font-bold text-indigo">How Influrios Collaboration Works</h2>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {[
              "Discover",
              "Match",
              "Agree on Terms",
              "Fund Collaboration",
              "Complete Milestones",
              "Release Payment",
            ].map((step, index) => (
              <li key={step} className="rounded-2xl border border-[#E4E9F5] bg-[#F8FAFF] p-4">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet text-xs font-bold text-white">
                  {index + 1}
                </span>
                <p className="mt-2 text-sm font-bold text-indigo">{step}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 rounded-2xl border border-[#E4E9F5] bg-[#F4F0FF] p-5">
            <h3 className="font-display text-lg font-bold text-indigo">Protected Collaboration Payments</h3>
            <p className="mt-1 text-sm text-muted">
              Business funds the collaboration → milestones completed → milestones approved → payments released → platform commission.
            </p>
            <Link href="/payments" className="mt-3 inline-flex text-sm font-bold text-violet">
              Learn about protected payments →
            </Link>
          </div>
        </div>
      </section>

      {/* —— Dual acquisition banners —— */}
      <section className="mx-auto w-full max-w-[90rem] px-4 py-12 sm:px-6 lg:px-10">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-gradient-to-br from-[#633CFF] to-[#5B4CFF] p-6 text-white shadow-sm">
            <div className="flex items-center gap-2">
              <IconUsers size={18} />
              <h2 className="font-display text-xl font-bold">Join as an Influencer</h2>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-white/85">
              {[
                "Access influencer collaboration opportunities",
                "Get matched with relevant brands",
                "Grow with your existing social presence",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <IconCheck size={14} className="mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/claim" className="ink-on-light mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-bold">
              Join as an Influencer <IconArrowRight size={14} />
            </Link>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-[#2979FF] to-[#633CFF] p-6 text-white shadow-sm">
            <div className="flex items-center gap-2">
              <IconBuilding size={18} />
              <h2 className="font-display text-xl font-bold">Create Business Profile</h2>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-white/85">
              {[
                "Find influencers faster",
                "Post requests and collaboration briefs",
                "Fund deals with protected milestones",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <IconCheck size={14} className="mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href={joinBusinessHref} className="ink-on-light mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-bold">
              Create Business Profile <IconArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function RecommendedMatch({
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
  const registerHref = `/register?next=${encodeURIComponent(proposePath)}`;

  return (
    <article className="rounded-[1.5rem] border border-[#E4E9F5] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet">Featured Collaboration Match</p>
          <h2 className="font-display text-xl font-bold text-indigo">A high-potential collaboration</h2>
          <p className="text-sm text-muted">Based on complementary audiences, content style and goals.</p>
        </div>
        <a href="#why-this-match" className="text-xs font-bold text-violet">
          Why this match?
        </a>
      </div>

      <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <CreatorSide creator={match.a} />
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
        <BrandSide brand={brand} image={brand.imageUrl ?? undefined} logo={brand.logoUrl ?? undefined} />
      </div>

      <div id="why-this-match" className="mt-5 rounded-2xl bg-[#F4F0FF] p-4">
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
            Request a Collaboration <IconArrowRight size={14} />
          </Link>
        )}
        {!signedIn ? (
          <Link href={registerHref} className="btn-secondary">
            Create account
          </Link>
        ) : viewerSlug ? (
          <Link href={`/collaboration/records?from=${viewerSlug}`} className="btn-secondary">
            View proposals
          </Link>
        ) : (
          <Link href="/claim" className="btn-secondary">
            Claim your Influencer Profile
          </Link>
        )}
        <SaveMatchButton
          partyASlug={match.a.slug}
          partyBSlug={match.b.slug}
          signedIn={signedIn}
          returnTo={viewerSlug ? "/collaboration/hub?saved=1" : "/collaboration?landing=1&saved=1"}
        />
      </div>
    </article>
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

function CreatorSide({ creator }: { creator: CreatorMatch["a"] }) {
  const primary = creator.socials[0];
  return (
    <div className="rounded-2xl border border-[#E8EDF8] bg-[#F8FAFF] p-4">
      <div className="flex gap-3">
        <span className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl">
          <Image src={creator.image} alt={creator.displayName} fill className="object-cover" sizes="64px" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-indigo">{creator.displayName}</p>
          <p className="text-xs text-muted">{creator.title}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted">
            <IconMapPin size={12} className="text-violet" />
            {creator.locationCity}, {creator.locationCountry}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {creator.specialties.slice(0, 3).map((slug) => (
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
        <span>{creator.stats?.engagementRate ?? "—"} eng.</span>
        <span>{formatFollowers(creator.socials.reduce((sum, social) => sum + social.followers, 0))} reach</span>
      </div>
    </div>
  );
}

function BrandSide({
  brand,
  image,
  logo,
}: {
  brand: MarketplaceBusinessRequestRow;
  image?: string;
  logo?: string;
}) {
  const media = image || logo;
  return (
    <div className="rounded-2xl border border-[#E8EDF8] bg-white p-4">
      <div className="flex gap-3">
        <span className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-[#F4F7FF]">
          {media ? (
            <Image
              src={media}
              alt=""
              fill
              className={image ? "object-cover" : "object-contain p-2"}
              sizes="64px"
            />
          ) : null}
        </span>
        <div>
          <span className="rounded-full bg-[#EAE4FF] px-2 py-0.5 text-[10px] font-bold text-violet">Brand</span>
          <p className="mt-1 font-display text-lg font-bold text-indigo">{brand.brand}</p>
          <p className="text-xs text-muted">{brand.category}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {brand.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-[#F4F7FF] px-2 py-0.5 text-[10px] font-semibold text-indigo ring-1 ring-[#E4E9F5]">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          [brand.budget, "Budget"],
          [brand.location, "Market"],
          [brand.lookingFor.split(" ")[0], "Fit"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-xl bg-[#F8FAFF] px-1 py-2">
            <p className="truncate text-[11px] font-bold text-indigo">{value}</p>
            <p className="text-[10px] text-muted">{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-start gap-1 text-xs text-muted">
        <IconCheck size={12} className="mt-0.5 shrink-0 text-violet" />
        {brand.summary}
      </p>
    </div>
  );
}
