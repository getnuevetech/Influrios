import Link from "next/link";
import { requireAdminPage } from "@/app/admin/guard";
import {
  getAllAudienceSnapshots,
  getIntelligenceStore,
  getNicheTrends,
  getRelationshipSignals,
} from "@/lib/intelligence";

export const metadata = { title: "Admin · Intelligence" };

export default async function AdminIntelligencePage() {
  await requireAdminPage("intelligence");
  const store = await getIntelligenceStore();
  const snapshots = getAllAudienceSnapshots();
  const trends = getNicheTrends();
  const signals = await getRelationshipSignals();
  const rising = trends.filter((t) => t.signal === "rising").length;

  return (
    <div className="mx-auto max-w-[90rem] space-y-8 px-4 py-10 sm:px-6">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Intelligence</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Phase 5 ops view — audience snapshot coverage, niche trends, and relationship signals.
          Automate exports only after B2B demand validates.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 text-center text-xs">
        <div className="rounded-xl bg-lavender px-4 py-2">
          <p className="font-display text-lg font-bold text-violet">{snapshots.length}</p>
          <p className="text-muted">Snapshots</p>
        </div>
        <div className="rounded-xl bg-[#D9E8FF] px-4 py-2">
          <p className="font-display text-lg font-bold text-blue">{rising}</p>
          <p className="text-muted">Rising niches</p>
        </div>
        <div className="rounded-xl bg-emerald-100 px-4 py-2">
          <p className="font-display text-lg font-bold text-emerald-700">{signals.length}</p>
          <p className="text-muted">Signals</p>
        </div>
      </div>

      <section className="card-surface p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Store notes</h2>
        <p className="mt-2 text-sm text-muted">{store.notes}</p>
        <p className="mt-2 text-xs text-muted">
          Watched specialties: {store.watchedSpecialties.join(", ")}
          {store.lastExportAt ? ` · Last export ${new Date(store.lastExportAt).toLocaleString()}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/business/intelligence" className="btn-secondary !py-2 text-sm">
            Open business Intelligence UI
          </Link>
          <a href="/api/intelligence/export?format=json" className="btn-primary !py-2 text-sm">
            Hit export API (JSON)
          </a>
        </div>
      </section>

      <section className="card-surface overflow-x-auto p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Trend table</h2>
        <table className="mt-4 w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="pb-2 pr-3 font-semibold">Niche</th>
              <th className="pb-2 pr-3 font-semibold">Demand</th>
              <th className="pb-2 pr-3 font-semibold">Growth</th>
              <th className="pb-2 pr-3 font-semibold">Supply</th>
              <th className="pb-2 font-semibold">Signal</th>
            </tr>
          </thead>
          <tbody>
            {trends.map((t) => (
              <tr key={t.specialty} className="border-t border-border">
                <td className="py-2.5 pr-3 font-semibold text-indigo">{t.label}</td>
                <td className="py-2.5 pr-3">{t.demandIndex}</td>
                <td className="py-2.5 pr-3">
                  {t.growthPct >= 0 ? "+" : ""}
                  {t.growthPct}%
                </td>
                <td className="py-2.5 pr-3">{t.creatorSupply}</td>
                <td className="py-2.5 capitalize">{t.signal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card-surface p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Relationship signals</h2>
        <ul className="mt-4 divide-y divide-border">
          {signals.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <p className="font-semibold text-indigo">{s.title}</p>
                <p className="text-xs text-muted">
                  {s.kind} · {s.parties.join(" / ")}
                </p>
              </div>
              <span className="rounded-full bg-lavender px-2.5 py-1 text-xs font-bold text-violet">
                {s.strength} · {s.status}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
