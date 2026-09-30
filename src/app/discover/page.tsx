import Link from "next/link";
import { CreatorCard } from "@/components/creator-card";
import { PageShell } from "@/components/page-shell";
import {
  getLanguageOptions,
  getLocationOptions,
  searchCreators,
  SEED_CREATORS,
  SPECIALTY_TAXONOMY,
} from "@/lib/seed-data";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    q?: string;
    specialty?: string;
    country?: string;
    state?: string;
    city?: string;
    platform?: string;
    language?: string;
    followersMin?: string;
    followersMax?: string;
    engagementMin?: string;
    openToCollab?: string;
    verified?: string;
    sort?: string;
  }>;
};

export const metadata = {
  title: "Discover",
};

const PLATFORMS = [
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "YOUTUBE", label: "YouTube" },
  { value: "X", label: "X" },
] as const;

export default async function DiscoverPage({ searchParams }: Props) {
  const params = await searchParams;
  const results = searchCreators(params);
  const locations = getLocationOptions();
  const languages = getLanguageOptions();
  const selectedCountry = locations.find((c) => c.country === params.country);
  const selectedState = selectedCountry?.states.find((s) => s.state === params.state);
  const specialtyCounts = Object.fromEntries(
    SPECIALTY_TAXONOMY.map((s) => [
      s.slug,
      SEED_CREATORS.filter((c) => c.specialties.includes(s.slug)).length,
    ]),
  );

  return (
    <div className="bg-[#F7FAFF] pb-16">
      {/* Hero search */}
      <section className="border-b border-border/70 bg-white">
        <PageShell className="py-10">
          <div className="grid items-end gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h1 className="font-display text-3xl font-bold text-indigo sm:text-4xl lg:text-5xl">
                Discover influencers
              </h1>
              <p className="mt-3 max-w-2xl text-muted">
                Find creators by specialty, location, and platform — organized around what they
                actually influence. Tap ♡ to shortlist for your{" "}
                <Link href="/business" className="font-semibold text-violet hover:underline">
                  Business workspace
                </Link>
                .
              </p>
              <form className="mt-6 flex flex-col gap-3 sm:flex-row">
                <input type="hidden" name="specialty" value={params.specialty ?? ""} />
                <input type="hidden" name="country" value={params.country ?? ""} />
                <input type="hidden" name="state" value={params.state ?? ""} />
                <input type="hidden" name="city" value={params.city ?? ""} />
                <input type="hidden" name="platform" value={params.platform ?? ""} />
                <input
                  name="q"
                  defaultValue={params.q}
                  placeholder="Search influencers by name, niche, keyword, or location…"
                  className="flex-1 rounded-full border border-border bg-white px-5 py-3.5 text-sm outline-none focus:ring-2 focus:ring-violet"
                />
                <button type="submit" className="btn-primary shrink-0 !px-8">
                  Search →
                </button>
              </form>
            </div>
            <p className="hidden text-right font-display text-lg italic text-violet/80 lg:block">
              Find amazing creators for your next campaign
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {SPECIALTY_TAXONOMY.slice(0, 8).map((s) => (
              <Link
                key={s.slug}
                href={`/discover?specialty=${s.slug}`}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  params.specialty === s.slug
                    ? "bg-violet text-white"
                    : "bg-lavender text-violet hover:bg-violet/15"
                }`}
              >
                {s.name}
              </Link>
            ))}
            <Link href="/discover" className="ml-auto text-xs font-bold text-violet hover:underline">
              View all categories →
            </Link>
          </div>
        </PageShell>
      </section>

      <PageShell className="mt-8">
        <div className="grid gap-8 lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr]">
          {/* Sidebar filters */}
          <aside className="h-fit rounded-2xl border border-border bg-white p-5 shadow-sm lg:sticky lg:top-24">
            <form className="space-y-5">
              <div>
                <h2 className="font-display text-sm font-bold text-indigo">Filters</h2>
                <p className="mt-0.5 text-[11px] text-muted">Country, state, city & more</p>
              </div>

              <label className="block text-xs font-bold uppercase tracking-wide text-muted">
                Search
                <input
                  name="q"
                  defaultValue={params.q}
                  placeholder="Name, niche, keyword…"
                  className="mt-1.5 w-full rounded-xl border border-border px-3 py-2 text-sm font-medium text-indigo outline-none focus:ring-2 focus:ring-violet"
                />
              </label>

              <fieldset>
                <legend className="text-xs font-bold uppercase tracking-wide text-muted">
                  Category / niche
                </legend>
                <select
                  name="specialty"
                  defaultValue={params.specialty ?? ""}
                  className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet"
                >
                  <option value="">All specialties</option>
                  {SPECIALTY_TAXONOMY.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name} ({specialtyCounts[s.slug] ?? 0})
                    </option>
                  ))}
                </select>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-xs font-bold uppercase tracking-wide text-muted">
                  Location
                </legend>
                <select
                  name="country"
                  defaultValue={params.country ?? ""}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet"
                >
                  <option value="">All countries</option>
                  {locations.map((c) => (
                    <option key={c.country} value={c.country}>
                      {c.country}
                    </option>
                  ))}
                </select>
                <select
                  name="state"
                  defaultValue={params.state ?? ""}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet"
                >
                  <option value="">All states / regions</option>
                  {(selectedCountry?.states ?? locations.flatMap((c) => c.states)).map((s) => (
                    <option key={`${s.state}`} value={s.state === "—" ? "" : s.state}>
                      {s.state}
                    </option>
                  ))}
                </select>
                <select
                  name="city"
                  defaultValue={params.city ?? ""}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet"
                >
                  <option value="">All cities</option>
                  {(
                    selectedState?.cities ??
                    selectedCountry?.states.flatMap((s) => s.cities) ??
                    locations.flatMap((c) => c.states.flatMap((s) => s.cities))
                  ).map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-bold uppercase tracking-wide text-muted">
                  Platform
                </legend>
                <select
                  name="platform"
                  defaultValue={params.platform ?? ""}
                  className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet"
                >
                  <option value="">All platforms</option>
                  {PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </fieldset>

              <fieldset className="grid grid-cols-2 gap-2">
                <legend className="col-span-2 text-xs font-bold uppercase tracking-wide text-muted">
                  Follower range
                </legend>
                <input
                  name="followersMin"
                  type="number"
                  min={0}
                  step={1000}
                  defaultValue={params.followersMin ?? ""}
                  placeholder="Min"
                  className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet"
                />
                <input
                  name="followersMax"
                  type="number"
                  min={0}
                  step={1000}
                  defaultValue={params.followersMax ?? ""}
                  placeholder="Max"
                  className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet"
                />
              </fieldset>

              <label className="block text-xs font-bold uppercase tracking-wide text-muted">
                Min engagement %
                <input
                  name="engagementMin"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  defaultValue={params.engagementMin ?? ""}
                  placeholder="e.g. 3"
                  className="mt-1.5 w-full rounded-xl border border-border px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-violet"
                />
              </label>

              <label className="block text-xs font-bold uppercase tracking-wide text-muted">
                Language
                <select
                  name="language"
                  defaultValue={params.language ?? ""}
                  className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-violet"
                >
                  <option value="">Any language</option>
                  {languages.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold uppercase tracking-wide text-muted">
                Sort by
                <select
                  name="sort"
                  defaultValue={params.sort ?? "relevant"}
                  className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-violet"
                >
                  <option value="relevant">Most relevant</option>
                  <option value="followers">Followers</option>
                  <option value="engagement">Engagement</option>
                  <option value="name">Name</option>
                </select>
              </label>

              <div className="space-y-2 border-t border-border pt-3">
                <label className="flex items-center justify-between gap-3 text-sm font-medium text-indigo">
                  Verified only
                  <input
                    type="checkbox"
                    name="verified"
                    value="1"
                    defaultChecked={params.verified === "1" || params.verified === "true"}
                    className="h-4 w-4 accent-[#633CFF]"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm font-medium text-indigo">
                  Open to collaborations
                  <input
                    type="checkbox"
                    name="openToCollab"
                    value="1"
                    defaultChecked={params.openToCollab === "1" || params.openToCollab === "true"}
                    className="h-4 w-4 accent-[#633CFF]"
                  />
                </label>
              </div>

              <button type="submit" className="btn-primary w-full">
                Apply filters
              </button>
              <Link
                href="/discover"
                className="block text-center text-xs font-semibold text-violet hover:underline"
              >
                Clear all filters
              </Link>
            </form>
          </aside>

          {/* Results */}
          <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                Showing <strong className="text-indigo">{results.length}</strong> influencers
                {params.specialty ? ` in ${params.specialty}` : ""}
                {params.country ? ` · ${params.country}` : ""}
                {params.state ? ` · ${params.state}` : ""}
                {params.city ? ` · ${params.city}` : ""}
              </p>
            </div>

            {results.length === 0 ? (
              <div className="card-surface p-10 text-center">
                <p className="font-semibold text-indigo">No creators matched those filters.</p>
                <Link href="/discover" className="mt-4 inline-block text-sm font-semibold text-violet">
                  Clear filters
                </Link>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {results.map((c) => (
                  <CreatorCard
                    key={c.slug}
                    creator={c}
                    showTitle
                    showBio
                    showViewProfile
                    qrOpensPopup
                    features={{ showStatus: false }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </PageShell>
    </div>
  );
}
