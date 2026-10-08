import Image from "next/image";
import Link from "next/link";
import { getWorkspace } from "@/lib/business";
import { businessEntitlementsForPlan } from "@/lib/entitlements-db";
import {
  getAllAudienceSnapshots,
  getNicheTrends,
  getRelationshipSignals,
  NICHE_BALANCE_LABEL,
} from "@/lib/intelligence";
import { getDirectory, indexCreatorsBySlug } from "@/lib/directory";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business · Intelligence" };

const BALANCE_COLOR: Record<string, string> = {
  more_requests: "bg-amber-100 text-amber-800",
  even: "bg-slate-100 text-slate-700",
  more_creators: "bg-emerald-100 text-emerald-800",
};

export default async function BusinessIntelligencePage() {
  const ws = await getWorkspace();
  const entitlements = await businessEntitlementsForPlan(ws.plan);
  const locked = !entitlements.intelligence;

  const snapshots = locked ? [] : (await getAllAudienceSnapshots()).slice(0, 6);
  const trends = locked ? [] : await getNicheTrends();
  const signals = locked ? [] : await getRelationshipSignals();
  const directory = await getDirectory().catch(() => null);
  const bySlug = indexCreatorsBySlug(directory?.creators ?? []);

  return (
    <div className="bg-[#F7FAFF]">
      <section className="hero-atmosphere text-white">
        <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6">
          <Link href="/collaboration/business" className="text-sm font-semibold text-lavender/90 hover:underline">
            ← Business Collaboration Hub
          </Link>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-lavender/80">
            Business Intelligence
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold">Audience & relationship intelligence</h1>
          <p className="mt-3 max-w-2xl text-white/75">
            Snapshots, niche trends, and relationship signals for validated B2B demand — exportable
            when your plan includes Intelligence.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[90rem] space-y-6 px-4 py-8 sm:px-6">
        {locked ? (
          <div className="card-surface p-8 text-center">
            <h2 className="font-display text-2xl font-bold text-indigo">Business Pro unlocks Intelligence</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
              Audience snapshots, niche demand trends, relationship signals, and CSV/JSON exports are
              available on Business Pro and Agency.
            </p>
            <Link href="/collaboration/business#pricing" className="btn-primary mt-6 inline-flex">
              View business plans →
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                Audience splits appear only when a creator record includes claimed demographics.
                Reach uses follower totals already on the profile. Niche rows compare open requests
                with creators in the directory. Searches are not stored, so they are not counted.
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="/api/intelligence/export?format=json"
                  className="btn-secondary !py-2 text-sm"
                >
                  Export JSON
                </a>
                <a
                  href="/api/intelligence/export?format=csv"
                  className="btn-primary !py-2 text-sm"
                >
                  Export CSV
                </a>
              </div>
            </div>

            {/* Niche trends */}
            <section className="card-surface p-6">
              <h2 className="font-display text-xl font-bold text-indigo">Niche counts</h2>
              <p className="mt-1 text-sm text-muted">
                Open briefs, collaborations, agency campaigns, and published marketplace listings
                compared with creators in the directory.
              </p>
              {trends.length === 0 ? (
                <p className="mt-5 text-sm text-muted">No specialties are on published creators or open requests.</p>
              ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {trends.map((t) => (
                    <div key={t.specialty} className="rounded-2xl border border-border bg-white p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-display font-bold text-indigo">{t.label}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${BALANCE_COLOR[t.balance]}`}>
                          {NICHE_BALANCE_LABEL[t.balance]}
                        </span>
                      </div>
                      <p className="mt-3 font-display text-2xl font-bold text-violet">
                        {t.requestCount}
                        <span className="text-sm font-medium text-muted"> requests</span>
                      </p>
                      <p className="mt-1 text-sm font-semibold text-indigo">{t.creatorSupply} creators</p>
                      <p className="mt-2 text-xs text-muted">{t.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Audience snapshots */}
            <section className="card-surface p-6">
              <h2 className="font-display text-xl font-bold text-indigo">Audience snapshots</h2>
              <p className="mt-1 text-sm text-muted">
                Coarse demographics and reach — privacy-permitted summary for brief fit.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {snapshots.map((s) => {
                  const creator = bySlug.get(s.creatorSlug);
                  return (
                    <div
                      key={s.creatorSlug}
                      className="flex gap-4 rounded-2xl border border-border bg-white p-4"
                    >
                      {creator ? (
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                          <Image
                            src={creator.image}
                            alt={s.displayName}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        </div>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/creators/${s.creatorSlug}`}
                            className="font-display font-bold text-indigo hover:underline"
                          >
                            {s.displayName}
                          </Link>
                          <span className="rounded-full bg-lavender px-2 py-0.5 text-[10px] font-semibold text-violet">
                            {s.source}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          Reach {s.totalReach} · Engagement {s.engagementRate}
                        </p>
                        {s.source === "claimed_metrics" ? (
                          <>
                            <div className="mt-2 flex flex-wrap gap-3 text-xs">
                              <span className="font-semibold text-indigo">♀ {s.gender.female}%</span>
                              <span className="font-semibold text-indigo">♂ {s.gender.male}%</span>
                              <span className="text-muted">
                                Top: {s.topLocations[0]?.name ?? "—"} ({s.topLocations[0]?.pct ?? 0}%)
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {s.ages.slice(0, 3).map((a) => (
                                <span
                                  key={a.range}
                                  className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-semibold text-indigo"
                                >
                                  {a.range} {a.pct}%
                                </span>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="mt-2 text-xs text-muted">No claimed audience split on this profile.</p>
                        )}
                        <a
                          href={`/api/intelligence/export?format=json&slug=${s.creatorSlug}`}
                          className="mt-2 inline-block text-xs font-semibold text-violet hover:underline"
                        >
                          Export this creator →
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Relationship signals */}
            <section className="card-surface p-6">
              <h2 className="font-display text-xl font-bold text-indigo">Relationship signals</h2>
              <p className="mt-1 text-sm text-muted">Managed introductions. A score is not assigned here.</p>
              {signals.length === 0 ? (
                <p className="mt-5 text-sm text-muted">No managed introductions yet.</p>
              ) : (
                <ul className="mt-5 space-y-3">
                  {signals.map((sig) => (
                    <li
                      key={sig.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-white px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-display font-bold text-indigo">{sig.title}</p>
                        <p className="mt-0.5 text-xs text-muted">{sig.parties.join(" · ")}</p>
                        <p className="mt-1 text-sm text-indigo/80">{sig.note}</p>
                      </div>
                      <p className="text-[10px] font-semibold uppercase text-muted">{sig.status}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
