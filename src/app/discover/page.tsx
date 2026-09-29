import Link from "next/link";
import { CreatorCard } from "@/components/creator-card";
import { searchCreators, SPECIALTY_TAXONOMY } from "@/lib/seed-data";

type Props = {
  searchParams: Promise<{ q?: string; specialty?: string; location?: string; platform?: string }>;
};

export const metadata = {
  title: "Discover",
};

export default async function DiscoverPage({ searchParams }: Props) {
  const params = await searchParams;
  const results = searchCreators(params);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-indigo sm:text-4xl">Discover influencers</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Find creators by specialty, location, and platform — organized around what they actually
          influence.
        </p>
        <form className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Search name, niche, keyword…"
            className="flex-1 rounded-full border border-border bg-white px-5 py-3 outline-none focus:ring-2 focus:ring-violet"
          />
          <select
            name="specialty"
            defaultValue={params.specialty ?? ""}
            className="rounded-full border border-border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-violet"
          >
            <option value="">All specialties</option>
            {SPECIALTY_TAXONOMY.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            name="platform"
            defaultValue={params.platform ?? ""}
            className="rounded-full border border-border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-violet"
          >
            <option value="">All platforms</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="TIKTOK">TikTok</option>
            <option value="YOUTUBE">YouTube</option>
            <option value="X">X</option>
          </select>
          <button type="submit" className="btn-primary">
            Apply
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {SPECIALTY_TAXONOMY.slice(0, 8).map((s) => (
            <Link
              key={s.slug}
              href={`/discover?specialty=${s.slug}`}
              className={`chip ${params.specialty === s.slug ? "ring-2 ring-violet" : ""}`}
            >
              {s.name}
            </Link>
          ))}
        </div>
      </div>

      <p className="mb-4 text-sm text-muted">
        Showing <strong className="text-indigo">{results.length}</strong> creators
        {params.specialty ? ` in ${params.specialty}` : ""}
      </p>

      {results.length === 0 ? (
        <div className="card-surface p-10 text-center">
          <p className="font-semibold text-indigo">No creators matched those filters.</p>
          <Link href="/discover" className="mt-4 inline-block text-sm font-semibold text-violet">
            Clear filters
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((c) => (
            <CreatorCard key={c.slug} creator={c} />
          ))}
        </div>
      )}
    </div>
  );
}
