import Image from "next/image";
import Link from "next/link";
import {
  IconArrowRight,
  IconBuilding,
  IconCheck,
  IconHandshake,
  IconHeart,
  IconInstagram,
  IconMapPin,
  IconTikTok,
  IconUsers,
  IconYouTube,
  SocialIcon,
} from "@/components/icons";
import { SaveMatchButton } from "@/components/save-match-button";
import {
  allDirectoryMatches,
  BUSINESS_REQUESTS,
  CREATOR_OPPORTUNITIES,
  filterMatches,
  POPULAR_MATCH_CHIPS,
  type BusinessRequest,
  type CreatorMatch,
} from "@/lib/matching";
import { entitlementsForPlan } from "@/lib/entitlements-db";
import { getDirectory, indexCreatorsBySlug } from "@/lib/directory";
import { formatFollowers, specialtyLabel } from "@/lib/seed-data";
import { isPlanCode, type PlanCode } from "@/lib/entitlements";

export const metadata = {
  title: "Collaboration Matches",
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
  }>;
};

const COLLAB_TYPES = [
  { value: "brand-partnership", label: "Brand Partnership" },
  { value: "creator", label: "Creator × Creator" },
  { value: "product", label: "Product Collaboration" },
  { value: "contest", label: "Contest / Experience" },
  { value: "event", label: "Event / Experience" },
  { value: "long-term", label: "Long-term Partnership" },
];

const BRAND_ART: Record<string, { logo: string; image: string }> = {
  "br-sephora": { logo: "/demo/brands/sephora.svg", image: "/demo/categories/cat-beauty.jpg" },
  "br-airbnb": { logo: "/demo/brands/airbnb.svg", image: "/demo/categories/cat-travel.jpg" },
  "br-samsung": { logo: "/demo/brands/samsung.svg", image: "/demo/categories/cat-tech.jpg" },
};

function list(value?: string | string[]) {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).filter(Boolean);
}

export default async function CollaborationPage({ searchParams }: Props) {
  const params = await searchParams;
  const collabTypes = list(params.collabType);
  const directory = await getDirectory();
  const bySlug = indexCreatorsBySlug(directory.creators);
  const all = await allDirectoryMatches();
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
  const viewer = params.from ? bySlug.get(params.from) : directory.creators[0];
  const viewerPlan: PlanCode = viewer && isPlanCode(viewer.planTier) ? viewer.planTier : "STARTER";
  const viewerLimits = await entitlementsForPlan(viewerPlan);
  const canRequest = viewerLimits.proposalsMax > 0;
  const brand = BUSINESS_REQUESTS.find((item) => {
    if (params.goal && !`${item.tags.join(" ")} ${item.summary}`.toLowerCase().includes(params.goal.toLowerCase())) {
      return false;
    }
    if (params.budget && item.budget !== params.budget) return false;
    if (params.location && !item.location.toLowerCase().includes(params.location.toLowerCase()) && !item.location.toLowerCase().includes("global")) {
      return false;
    }
    return true;
  }) ?? BUSINESS_REQUESTS[0];
  const requests = BUSINESS_REQUESTS.filter((item) => {
    if (params.goal && !`${item.category} ${item.tags.join(" ")} ${item.summary}`.toLowerCase().includes(params.goal.toLowerCase())) {
      return false;
    }
    if (params.budget && item.budget !== params.budget) return false;
    return true;
  });
  const opportunities = CREATOR_OPPORTUNITIES.filter((item) => {
    if (!params.specialty) return true;
    const creator = bySlug.get(item.creatorSlug);
    return creator?.specialties.some((slug) => slug.includes(params.specialty!)) ?? false;
  });
  const heroFaces = directory.creators.slice(0, 4);
  const taxonomy = directory.taxonomy;

  return (
    <div className="bg-[#F4F7FF]">
      <section className="relative overflow-hidden bg-[#120B4A] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,60,255,0.55),_transparent_55%),radial-gradient(ellipse_at_bottom_left,_rgba(41,121,255,0.28),_transparent_50%)]" />
        <div className="relative mx-auto grid w-full max-w-[90rem] items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-16">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60">
              Home <span className="px-1">/</span> Collaboration Matches
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">Collaboration Matches</h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
              Connect creators and brands (or creators) with complementary skills, audiences and goals.
              Discover perfect collaboration opportunities powered by smart matching.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                [IconHandshake, "Smarter Matches", "AI-powered compatibility"],
                [IconBuilding, "Real Opportunities", "Brands & creators actively looking"],
                [IconUsers, "Stronger Results", "Grow together, faster"],
              ].map(([Icon, title, detail]) => (
                <div key={String(title)} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
                  <Icon size={18} className="text-[#C4B5FD]" />
                  <p className="mt-2 text-sm font-bold">{String(title)}</p>
                  <p className="mt-1 text-[11px] leading-snug text-white/70">{String(detail)}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative hidden h-[340px] lg:block">
            {heroFaces.map((creator, index) => (
              <div
                key={creator.slug}
                className={`absolute overflow-hidden rounded-2xl shadow-2xl ring-2 ring-white/30 ${
                  index === 0
                    ? "left-4 top-8 h-36 w-28 rotate-[-8deg]"
                    : index === 1
                      ? "left-[38%] top-0 h-40 w-32 rotate-[3deg]"
                      : index === 2
                        ? "right-6 top-10 h-36 w-28 rotate-[8deg]"
                        : "bottom-4 left-[22%] h-28 w-36 rotate-[-2deg]"
                }`}
              >
                <Image src={creator.image} alt="" fill className="object-cover" sizes="160px" />
              </div>
            ))}
            <p className="absolute right-2 top-2 max-w-[9rem] text-right font-script text-2xl leading-tight text-[#E7DEFF]">
              Different Creators. Bigger Possibilities.
            </p>
            <p className="absolute bottom-2 right-4 font-script text-xl text-white">Brands & Creators, Ideas Together</p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-6 lg:px-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-indigo">Popular Collaboration Matches</h2>
            <p className="text-sm text-muted">Explore real examples of complementary matches that create amazing results.</p>
          </div>
          <Link href="/collaboration" className="shrink-0 text-sm font-bold text-violet">
            View all matches →
          </Link>
        </div>
        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
          {POPULAR_MATCH_CHIPS.map((chip) => (
            <Link
              key={chip.title}
              href={`/collaboration?specialty=${chip.specialty}`}
              className="relative h-28 w-52 shrink-0 overflow-hidden rounded-2xl"
            >
              <Image src={chip.image} alt="" fill className="object-cover" sizes="208px" />
              <span className="absolute inset-0 bg-gradient-to-t from-[#111A5A]/90 via-[#111A5A]/20 to-transparent" />
              <span className="absolute bottom-2 left-3 right-3 text-xs font-bold text-white">{chip.title}</span>
            </Link>
          ))}
        </div>
      </section>

      {params.requested ? (
        <div className="mx-auto mb-4 w-full max-w-[90rem] px-4 sm:px-6 lg:px-10">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Collaboration proposal submitted for review. The other creator will see your structured brief.
          </div>
        </div>
      ) : null}

      <div className="mx-auto grid w-full max-w-[90rem] gap-6 px-4 pb-12 sm:px-6 lg:grid-cols-[270px_1fr] lg:px-10">
        <aside className="h-fit rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display font-bold text-indigo">Filter Matches</h2>
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

            <label className="block text-xs font-bold text-indigo">
              Campaign Goal
              <select
                name="goal"
                defaultValue={params.goal ?? ""}
                className="mt-1.5 w-full rounded-xl border border-border px-3 py-2 text-sm font-medium text-indigo outline-none focus:ring-2 focus:ring-violet"
              >
                <option value="">Any goal</option>
                <option value="awareness">Brand Awareness</option>
                <option value="launch">Product Launch</option>
                <option value="sales">Sales & Conversions</option>
                <option value="community">Community Growth</option>
                <option value="beauty">Beauty</option>
                <option value="travel">Travel</option>
                <option value="tech">Tech</option>
              </select>
            </label>

            <label className="block text-xs font-bold text-indigo">
              Budget Range
              <select
                name="budget"
                defaultValue={params.budget ?? ""}
                className="mt-1.5 w-full rounded-xl border border-border px-3 py-2 text-sm font-medium text-indigo outline-none focus:ring-2 focus:ring-violet"
              >
                <option value="">Select budget range</option>
                {[...new Set(BUSINESS_REQUESTS.map((item) => item.budget))].map((budget) => (
                  <option key={budget} value={budget}>
                    {budget}
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend className="text-xs font-bold text-indigo">Platform</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  ["INSTAGRAM", IconInstagram],
                  ["TIKTOK", IconTikTok],
                  ["YOUTUBE", IconYouTube],
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

            <button type="submit" className="btn-primary w-full !py-2.5 text-sm">
              Apply Filters
            </button>
          </form>
        </aside>

        <div className="min-w-0 space-y-8">
          {featured ? (
            <RecommendedMatch
              match={featured}
              brand={brand}
              canRequest={canRequest}
              viewerSlug={viewer?.slug ?? "sofia-martinez"}
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

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-indigo">Business Requests</h2>
                <Link href="/business" className="text-xs font-bold text-violet">
                  View all opportunities →
                </Link>
              </div>
              <ul className="space-y-3">
                {requests.length === 0 ? (
                  <li className="rounded-2xl border border-dashed border-[#E4E9F5] p-4 text-sm text-muted">
                    No business requests match those filters.
                  </li>
                ) : null}
                {requests.map((item) => {
                  const art = BRAND_ART[item.id];
                  return (
                    <li key={item.id} className="flex gap-3 rounded-2xl border border-[#E8EDF8] p-3">
                      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#F4F7FF]">
                        {art ? <Image src={art.logo} alt="" fill className="object-contain p-2" sizes="56px" /> : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-indigo">{item.brand}</p>
                        <p className="text-xs text-muted">
                          {item.category} · {item.budget} · {item.location}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted">{item.summary}</p>
                        <Link href="/business" className="mt-2 inline-flex text-xs font-bold text-violet">
                          View Details
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-indigo">Creator Collaboration Opportunities</h2>
                <Link href="/discover" className="text-xs font-bold text-violet">
                  View all creators →
                </Link>
              </div>
              <ul className="space-y-3">
                {opportunities.map((item) => {
                  const creator = bySlug.get(item.creatorSlug);
                  if (!creator) return null;
                  return (
                    <li key={item.id} className="flex gap-3 rounded-2xl border border-[#E8EDF8] p-3">
                      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full">
                        <Image src={creator.image} alt="" fill className="object-cover" sizes="56px" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-indigo">{creator.displayName}</p>
                        <p className="text-xs text-muted">
                          {creator.title} · Looking for {item.lookingFor}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted">{item.summary}</p>
                        <Link href={`/creators/${creator.slug}`} className="btn-primary mt-2 !px-3 !py-1.5 text-xs">
                          Connect
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </div>
      </div>

      <section className="border-y border-[#E4E9F5] bg-white">
        <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div>
            <h2 className="font-display text-2xl font-bold text-indigo">The Power of Collaboration</h2>
            <p className="mt-1 max-w-md text-sm text-muted">
              Creators and brands who collaborate see bigger growth, higher engagement and long-term success.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["3.5x", "Higher Engagement"],
              ["2.8x", "Audience Growth"],
              ["67%", "Successful Partnerships"],
              ["150K+", "Collaborations Made"],
            ].map(([value, label]) => (
              <div key={label} className="text-center sm:text-left">
                <p className="font-display text-2xl font-bold text-violet">{value}</p>
                <p className="text-xs text-muted">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#120B4A] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(99,60,255,0.45),_transparent_60%)]" />
        <div className="relative mx-auto flex w-full max-w-[90rem] flex-col items-start gap-4 px-4 py-12 sm:px-6 lg:px-10">
          <h2 className="font-display text-3xl font-bold">Ready to Find Your Perfect Match?</h2>
          <p className="max-w-xl text-sm text-white/75">
            Join Influrios to discover collaboration opportunities with creators and brands worldwide.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/claim" className="ink-on-light inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold">
              Join as a Creator <IconArrowRight size={14} />
            </Link>
            <Link href="/business" className="inline-flex items-center gap-2 rounded-full border border-white/40 px-5 py-3 text-sm font-bold text-white">
              Join as a Business <IconArrowRight size={14} />
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
  viewerSlug,
  viewerPlan,
}: {
  match: CreatorMatch;
  brand: BusinessRequest;
  canRequest: boolean;
  viewerSlug: string;
  viewerPlan: PlanCode;
}) {
  const art = BRAND_ART[brand.id];
  const factors = [
    ["Audience Alignment", match.breakdown.audienceAlignment],
    ["Content Compatibility", match.breakdown.contentCompatibility],
    ["Goal Synergy", match.breakdown.goalSynergy],
    ["Engagement Potential", match.breakdown.engagementPotential],
  ] as const;

  return (
    <article className="rounded-[1.5rem] border border-[#E4E9F5] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet">Recommended Match</p>
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
        <BrandSide brand={brand} image={art?.image} />
      </div>

      <div id="why-this-match" className="mt-5 rounded-2xl bg-[#F4F0FF] p-4">
        <p className="flex items-center gap-2 font-bold text-indigo">
          <IconHeart size={14} className="text-violet" /> Why This Match Works
        </p>
        <p className="mt-1 text-sm text-muted">{match.why}</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {canRequest ? (
          <Link
            href={`/collaboration/propose?a=${match.a.slug}&b=${match.b.slug}&from=${viewerSlug}`}
            className="btn-primary"
          >
            Request Match
          </Link>
        ) : (
          <Link href="/card#pricing" className="btn-secondary">
            Upgrade from {viewerPlan} to request matches
          </Link>
        )}
        <Link href={`/collaboration/records?from=${viewerSlug}`} className="btn-secondary">
          View proposals
        </Link>
        <SaveMatchButton />
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

function BrandSide({ brand, image }: { brand: BusinessRequest; image?: string }) {
  return (
    <div className="rounded-2xl border border-[#E8EDF8] bg-white p-4">
      <div className="flex gap-3">
        <span className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-[#F4F7FF]">
          {image ? <Image src={image} alt="" fill className="object-cover" sizes="64px" /> : null}
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
