import Link from "next/link";
import { SEED_CREATORS, specialtyLabel } from "@/lib/seed-data";

export const metadata = {
  title: "Collaboration",
};

export default function CollaborationPage() {
  const pairs = [
    {
      a: SEED_CREATORS.find((c) => c.slug === "priya-sharma")!,
      b: SEED_CREATORS.find((c) => c.slug === "amara-okonkwo")!,
      why: "Interior transformations plus beauty/lifestyle audiences for a home-ritual campaign.",
      score: 88,
    },
    {
      a: SEED_CREATORS.find((c) => c.slug === "marcus-lee")!,
      b: SEED_CREATORS.find((c) => c.slug === "jordan-blake")!,
      why: "Training content paired with smart-home / recovery tech demos.",
      score: 84,
    },
    {
      a: SEED_CREATORS.find((c) => c.slug === "sofia-martinez")!,
      b: SEED_CREATORS.find((c) => c.slug === "amara-okonkwo")!,
      why: "Beauty education plus natural-hair specialty for a complete haircare launch.",
      score: 92,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-indigo sm:text-4xl">
        Collaboration matches
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        Complementary creators — not competitors. Phase 2 will power “I offer / I need” matching with
        explainable scores. Below are illustrative recommendations from seed data.
      </p>

      <div className="mt-8 grid gap-5">
        {pairs.map((pair) => (
          <article key={pair.a.slug + pair.b.slug} className="card-surface p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="grid flex-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <CreatorMini creator={pair.a} />
                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full brand-gradient text-lg font-bold text-white">
                    {pair.score}%
                  </div>
                  <p className="mt-2 text-xs font-semibold text-muted">Match score</p>
                </div>
                <CreatorMini creator={pair.b} />
              </div>
            </div>
            <p className="mt-4 rounded-xl bg-lavender/40 p-4 text-sm text-indigo">
              <strong>Why this match:</strong> {pair.why}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn-primary !py-2 text-sm" disabled>
                Request match (Phase 2)
              </button>
              <Link href={`/creators/${pair.a.slug}`} className="btn-secondary !py-2 text-sm">
                View {pair.a.displayName.split(" ")[0]}
              </Link>
              <Link href={`/creators/${pair.b.slug}`} className="btn-secondary !py-2 text-sm">
                View {pair.b.displayName.split(" ")[0]}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function CreatorMini({
  creator,
}: {
  creator: (typeof SEED_CREATORS)[number];
}) {
  return (
    <div className="rounded-2xl border border-border bg-starter-bg p-4">
      <p className="font-display font-bold text-indigo">{creator.displayName}</p>
      <p className="text-sm text-muted">{creator.title}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {creator.specialties.slice(0, 2).map((s) => (
          <span key={s} className="chip !text-[11px]">
            {specialtyLabel(s)}
          </span>
        ))}
      </div>
      {creator.offer ? (
        <p className="mt-2 text-xs text-muted">Offers: {creator.offer}</p>
      ) : null}
    </div>
  );
}
