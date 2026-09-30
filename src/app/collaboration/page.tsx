import Image from "next/image";
import Link from "next/link";
import { getAgencyStore, listPublishedPortfolios } from "@/lib/agency";
import {
  allCreatorMatches,
  BUSINESS_REQUESTS,
  canRequestMatch,
  CREATOR_OPPORTUNITIES,
  filterMatches,
  POPULAR_MATCH_CHIPS,
  type CreatorMatch,
} from "@/lib/matching";
import { formatFollowers, getCreatorBySlug, SEED_CREATORS, specialtyLabel, SPECIALTY_TAXONOMY } from "@/lib/seed-data";
import type { PlanCode } from "@/lib/entitlements";

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
  }>;
};

export default async function CollaborationPage({ searchParams }: Props) {
  const params = await searchParams;
  const all = allCreatorMatches();
  const matches = filterMatches(all, params);
  const featured = matches[0] ?? all[0];
  const rest = matches.slice(1);
  const viewer = params.from ? getCreatorBySlug(params.from) : SEED_CREATORS[0];
  const viewerPlan = (viewer?.planTier ?? "STARTER") as PlanCode;
  const canRequest = canRequestMatch(viewerPlan);
  const agency = await getAgencyStore().catch(() => null);
  const portfolios = agency ? listPublishedPortfolios(agency) : [];

  return (
    <div className="bg-[#F7FAFF]">
      {/* Hero */}
      <section className="hero-atmosphere relative overflow-hidden text-white">
        <div className="mx-auto grid max-w-[90rem] items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender/80">
              Home · Collaboration Matches
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">
              Collaboration Matches
            </h1>
            <p className="mt-4 max-w-xl text-white/75">
              Connect creators with complementary skills, audiences, and goals. Smart matching
              explains <em>why</em> a pair works — not a black-box rank.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                ["Smarter Matches", "Complementary specialty logic"],
                ["Real Opportunities", "Creators actively looking"],
                ["Stronger Results", "Joint offers brands want"],
              ].map(([t, d]) => (
                <div key={t} className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="font-semibold">{t}</p>
                  <p className="mt-1 text-xs text-white/70">{d}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative hidden h-72 lg:block">
            <Image
              src="/demo/cta-community.jpg"
              alt=""
              fill
              className="rounded-3xl object-cover opacity-90 ring-1 ring-white/20"
              sizes="40vw"
            />
          </div>
        </div>
      </section>

      {/* Popular chips */}
      <section className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-xl font-bold text-indigo">Popular collaboration matches</h2>
          <Link href="/collaboration" className="text-sm font-semibold text-violet">
            View all matches →
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {POPULAR_MATCH_CHIPS.map((chip) => (
            <Link
              key={chip.title}
              href={`/collaboration?specialty=${chip.specialty}`}
              className="relative h-28 w-48 shrink-0 overflow-hidden rounded-2xl"
            >
              <Image src={chip.image} alt={chip.title} fill className="object-cover" sizes="192px" />
              <div className="absolute inset-0 bg-gradient-to-t from-indigo/90 to-transparent" />
              <p className="absolute bottom-2 left-2 right-2 text-xs font-bold text-white">{chip.title}</p>
            </Link>
          ))}
        </div>
      </section>

      {params.requested ? (
        <div className="mx-auto max-w-[90rem] px-4 sm:px-6">
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Collaboration proposal submitted for review. The other creator will see your structured
            brief (demo — no email sent yet).
          </div>
        </div>
      ) : null}

      <div className="mx-auto grid max-w-[90rem] gap-8 px-4 pb-16 sm:px-6 lg:grid-cols-[260px_1fr]">
        {/* Filters */}
        <aside className="card-surface h-fit p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display font-bold text-indigo">Filter Matches</h2>
            <Link href="/collaboration" className="text-xs font-semibold text-violet">
              Reset
            </Link>
          </div>
          <form className="space-y-4">
            <label className="block text-xs font-semibold uppercase text-muted">
              Search
              <input
                name="q"
                defaultValue={params.q}
                placeholder="Creator or keyword"
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo outline-none focus:ring-2 focus:ring-violet"
              />
            </label>
            <label className="block text-xs font-semibold uppercase text-muted">
              Industry / Niche
              <select
                name="specialty"
                defaultValue={params.specialty ?? ""}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo outline-none focus:ring-2 focus:ring-violet"
              >
                <option value="">All niches</option>
                {SPECIALTY_TAXONOMY.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase text-muted">
              Location
              <input
                name="location"
                defaultValue={params.location}
                placeholder="City or country"
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo outline-none focus:ring-2 focus:ring-violet"
              />
            </label>
            <label className="block text-xs font-semibold uppercase text-muted">
              Platform
              <select
                name="platform"
                defaultValue={params.platform ?? ""}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo outline-none focus:ring-2 focus:ring-violet"
              >
                <option value="">All platforms</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="TIKTOK">TikTok</option>
                <option value="YOUTUBE">YouTube</option>
                <option value="X">X</option>
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase text-muted">
              View as creator
              <select
                name="from"
                defaultValue={params.from ?? viewer?.slug ?? ""}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo outline-none focus:ring-2 focus:ring-violet"
              >
                {SEED_CREATORS.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.displayName} ({c.planTier})
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[11px] text-muted">
              Collaboration Type: Brand Partnership · Creator × Creator · Product Collaboration
              (filters expand in Phase 3).
            </p>
            <button type="submit" className="btn-primary w-full !py-2.5 text-sm">
              Apply Filters
            </button>
          </form>
        </aside>

        {/* Main */}
        <div className="space-y-8">
          {featured ? (
            <RecommendedMatch
              match={featured}
              canRequest={canRequest}
              viewerSlug={viewer?.slug ?? "sofia-martinez"}
              viewerPlan={viewerPlan}
            />
          ) : (
            <div className="card-surface p-8 text-center text-muted">
              No matches for those filters.{" "}
              <Link href="/collaboration" className="font-semibold text-violet">
                Clear filters
              </Link>
            </div>
          )}

          {rest.length > 0 ? (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-indigo">
                More complementary matches ({rest.length})
              </h2>
              <div className="grid gap-4">
                {rest.map((m) => (
                  <MatchRow
                    key={`${m.a.slug}-${m.b.slug}`}
                    match={m}
                    canRequest={canRequest}
                    viewerSlug={viewer?.slug ?? "sofia-martinez"}
                    viewerPlan={viewerPlan}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {portfolios.length > 0 ? (
            <section>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold text-indigo">
                    Joint portfolio case studies
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Proof from complementary pairs — Phase 11 agency stubs.
                  </p>
                </div>
                <Link href="/agency" className="text-sm font-semibold text-violet hover:underline">
                  Agency workspace →
                </Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {portfolios.map((p) => {
                  const left = getCreatorBySlug(p.leftSlug);
                  const right = getCreatorBySlug(p.rightSlug);
                  return (
                    <article key={p.id} className="card-surface p-5">
                      <p className="text-xs font-bold uppercase tracking-wide text-violet">
                        {specialtyLabel(p.specialty)}
                      </p>
                      <h3 className="mt-1 font-display text-lg font-bold text-indigo">{p.title}</h3>
                      <p className="text-sm text-muted">{p.tagline}</p>
                      <p className="mt-2 text-sm font-semibold text-indigo">
                        {left?.displayName ?? p.leftSlug} × {right?.displayName ?? p.rightSlug}
                      </p>
                      <p className="mt-2 text-sm text-muted">{p.outcome}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {p.metrics.map((m) => (
                          <span
                            key={m.label}
                            className="rounded-lg bg-[#F0F4FF] px-2.5 py-1 font-semibold text-indigo"
                          >
                            {m.value}{" "}
                            <span className="font-normal text-muted">{m.label}</span>
                          </span>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="card-surface p-5">
              <h2 className="font-display text-lg font-bold text-indigo">Business requests</h2>
              <ul className="mt-4 space-y-4">
                {BUSINESS_REQUESTS.map((br) => (
                  <li key={br.id} className="rounded-xl border border-border bg-starter-bg p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-indigo">{br.brand}</p>
                        <p className="text-xs text-muted">
                          {br.category} · {br.budget} · {br.location}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted">{br.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {br.tags.map((t) => (
                        <span key={t} className="chip !text-[10px]">
                          {t}
                        </span>
                      ))}
                    </div>
                    <button type="button" className="btn-secondary mt-3 !py-1.5 text-xs">
                      View Details
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card-surface p-5">
              <h2 className="font-display text-lg font-bold text-indigo">
                Creator collaboration opportunities
              </h2>
              <ul className="mt-4 space-y-4">
                {CREATOR_OPPORTUNITIES.map((op) => {
                  const c = getCreatorBySlug(op.creatorSlug);
                  if (!c) return null;
                  return (
                    <li key={op.id} className="flex gap-3 rounded-xl border border-border bg-white p-3">
                      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full">
                        <Image src={c.image} alt={c.displayName} fill className="object-cover" sizes="56px" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-indigo">{c.displayName}</p>
                        <p className="text-xs text-muted">Looking for: {op.lookingFor}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted">{op.summary}</p>
                        <Link
                          href={`/creators/${c.slug}`}
                          className="mt-2 inline-flex text-xs font-bold text-violet"
                        >
                          Connect →
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

      {/* Stats + CTA */}
      <section className="border-t border-border bg-white py-10">
        <div className="mx-auto grid max-w-[90rem] grid-cols-2 gap-4 px-4 sm:grid-cols-4 sm:px-6">
          {[
            ["3.5x", "Higher Engagement"],
            ["2.8x", "Audience Growth"],
            ["67%", "Successful Partnerships"],
            ["150K+", "Collaborations Made"],
          ].map(([n, l]) => (
            <div key={l} className="text-center">
              <p className="font-display text-2xl font-bold text-violet">{n}</p>
              <p className="text-sm text-muted">{l}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6">
        <div className="overflow-hidden rounded-[1.75rem] brand-gradient p-8 text-white sm:p-10">
          <h2 className="font-display text-3xl font-bold">Ready to find your perfect match?</h2>
          <p className="mt-2 max-w-xl text-white/80">
            Plus and Pro unlock collaboration requests and proactive recommendations.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/claim" className="rounded-full bg-white px-5 py-3 text-sm font-bold text-violet">
              Join as a Creator
            </Link>
            <Link href="/discover" className="rounded-full border border-white/40 px-5 py-3 text-sm font-bold">
              Join as a Business
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function RecommendedMatch({
  match,
  canRequest,
  viewerSlug,
  viewerPlan,
}: {
  match: CreatorMatch;
  canRequest: boolean;
  viewerSlug: string;
  viewerPlan: PlanCode;
}) {
  return (
    <article className="card-surface overflow-hidden p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-indigo">Recommended Match</h2>
        <span className="text-xs font-semibold text-violet">Why this match? ↓</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <CreatorPanel creator={match.a} />
        <div className="flex flex-col items-center justify-center gap-3 px-2">
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full brand-gradient text-2xl font-bold text-white shadow-lg">
            {match.score}%
          </div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Match Score</p>
          <dl className="w-full max-w-[200px] space-y-1 text-xs">
            {(
              [
                ["Audience Alignment", match.breakdown.audienceAlignment],
                ["Content Compatibility", match.breakdown.contentCompatibility],
                ["Goal Synergy", match.breakdown.goalSynergy],
                ["Engagement Potential", match.breakdown.engagementPotential],
              ] as const
            ).map(([label, val]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-muted">{label}</dt>
                <dd className="font-bold text-indigo">{val}%</dd>
              </div>
            ))}
          </dl>
        </div>
        <CreatorPanel creator={match.b} />
      </div>
      <div className="mt-5 rounded-xl bg-lavender/50 p-4 text-sm text-indigo">
        <p className="font-bold">Why this match works</p>
        <p className="mt-1 text-muted">{match.why}</p>
        {match.reasons.length > 0 ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
            {match.reasons.slice(0, 4).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : null}
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
          <UpgradeCta plan={viewerPlan} />
        )}
        <button type="button" className="btn-secondary">
          Save Match
        </button>
      </div>
    </article>
  );
}

function MatchRow({
  match,
  canRequest,
  viewerSlug,
  viewerPlan,
}: {
  match: CreatorMatch;
  canRequest: boolean;
  viewerSlug: string;
  viewerPlan: PlanCode;
}) {
  return (
    <article className="card-surface flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-3">
        <AvatarStack a={match.a.image} b={match.b.image} />
        <div>
          <p className="font-bold text-indigo">
            {match.a.displayName} + {match.b.displayName}
          </p>
          <p className="text-xs text-muted line-clamp-2">{match.why}</p>
        </div>
      </div>
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full brand-gradient text-sm font-bold text-white">
        {match.score}%
      </div>
      {canRequest ? (
        <Link
          href={`/collaboration/propose?a=${match.a.slug}&b=${match.b.slug}&from=${viewerSlug}`}
          className="btn-primary !py-2 text-sm"
        >
          Request
        </Link>
      ) : (
        <UpgradeCta plan={viewerPlan} compact />
      )}
    </article>
  );
}

function CreatorPanel({ creator }: { creator: CreatorMatch["a"] }) {
  return (
    <div className="rounded-2xl border border-border bg-starter-bg p-4">
      <div className="flex items-center gap-3">
        <span className="relative h-14 w-14 overflow-hidden rounded-full">
          <Image src={creator.image} alt={creator.displayName} fill className="object-cover" sizes="56px" />
        </span>
        <div>
          <p className="font-display font-bold text-indigo">{creator.displayName}</p>
          <p className="text-xs text-muted">{creator.title}</p>
          <p className="text-xs text-muted">
            {creator.locationCity}, {creator.locationCountry}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {creator.specialties.slice(0, 3).map((s) => (
          <span key={s} className="chip !text-[10px]">
            {specialtyLabel(s)}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-muted">
        {creator.socials.slice(0, 3).map((s) => (
          <span key={s.platform}>
            {s.platform.slice(0, 2)} {formatFollowers(s.followers)}
          </span>
        ))}
      </div>
      {creator.offer ? (
        <p className="mt-2 text-xs text-muted">
          <strong className="text-indigo">Offers:</strong> {creator.offer}
        </p>
      ) : null}
      {creator.need ? (
        <p className="text-xs text-muted">
          <strong className="text-indigo">Needs:</strong> {creator.need}
        </p>
      ) : null}
      <Link href={`/creators/${creator.slug}`} className="mt-3 inline-block text-xs font-bold text-violet">
        View profile →
      </Link>
    </div>
  );
}

function AvatarStack({ a, b }: { a: string; b: string }) {
  return (
    <div className="relative h-12 w-20 shrink-0">
      <span className="absolute left-0 top-0 h-12 w-12 overflow-hidden rounded-full ring-2 ring-white">
        <Image src={a} alt="" fill className="object-cover" sizes="48px" />
      </span>
      <span className="absolute left-8 top-0 h-12 w-12 overflow-hidden rounded-full ring-2 ring-white">
        <Image src={b} alt="" fill className="object-cover" sizes="48px" />
      </span>
    </div>
  );
}

function UpgradeCta({ plan, compact }: { plan: PlanCode; compact?: boolean }) {
  return (
    <Link
      href="/card#pricing"
      className={
        compact
          ? "rounded-full bg-lavender px-4 py-2 text-xs font-bold text-violet"
          : "btn-secondary"
      }
    >
      {compact ? "Upgrade to request" : `Upgrade from ${plan} to request matches →`}
    </Link>
  );
}
