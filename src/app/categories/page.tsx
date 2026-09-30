import Link from "next/link";
import { SEED_CREATORS, SPECIALTY_TAXONOMY } from "@/lib/seed-data";

export const metadata = { title: "Categories" };

export default function CategoriesPage() {
  return (
    <div className="bg-[#F7FAFF]">
      <section className="hero-atmosphere text-white">
        <div className="mx-auto max-w-[90rem] px-4 py-14 sm:px-6 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender/80">
            Discover by niche
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">Categories</h1>
          <p className="mt-3 max-w-2xl text-white/75">
            Browse creators by specialty — beauty, travel, fitness, tech, and more — then open
            Discover to filter and shortlist.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] space-y-8 px-4 py-10 sm:px-6 lg:px-10">
        {SPECIALTY_TAXONOMY.map((parent) => {
          const count = SEED_CREATORS.filter(
            (c) =>
              c.specialties.includes(parent.slug) ||
              parent.children?.some((ch) => c.specialties.includes(ch.slug)),
          ).length;
          return (
            <div key={parent.slug} className="card-surface p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl font-bold text-indigo">{parent.name}</h2>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {count} creator{count === 1 ? "" : "s"} in this category
                  </p>
                </div>
                <Link
                  href={`/discover?specialty=${encodeURIComponent(parent.slug)}`}
                  className="text-[12px] font-semibold text-violet hover:underline"
                >
                  View all →
                </Link>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/discover?specialty=${encodeURIComponent(parent.slug)}`}
                  className="rounded-full bg-violet px-3 py-1.5 text-[11px] font-semibold text-white"
                >
                  {parent.name}
                </Link>
                {(parent.children ?? []).map((ch) => (
                  <Link
                    key={ch.slug}
                    href={`/discover?specialty=${encodeURIComponent(ch.slug)}`}
                    className="rounded-full bg-[#EEF2FF] px-3 py-1.5 text-[11px] font-semibold text-indigo ring-1 ring-[#E0E7FF]"
                  >
                    {ch.name}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
