import Link from "next/link";
import {
  actionAdminAddRoster,
  actionAdminCreateCampaign,
  actionAdminCreatePortfolio,
  actionAdminRemoveRoster,
  actionAdminSetCampaignStatus,
  actionAdminTogglePortfolio,
} from "@/app/admin/agency/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { agencyStats, getAgencyStore } from "@/lib/agency";
import { getCreatorBySlug, SEED_CREATORS } from "@/lib/seed-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Agency" };

type Props = {
  searchParams: Promise<{
    error?: string;
    roster?: string;
    removed?: string;
    campaign?: string;
    portfolio?: string;
    status?: string;
    toggled?: string;
  }>;
};

export default async function AdminAgencyPage({ searchParams }: Props) {
  const session = await requireAdminPage("agency");
  const canManage = hasPermission(session, "agency.manage");
  const params = await searchParams;
  const store = await getAgencyStore();
  const stats = agencyStats(store);

  return (
    <div className="mx-auto max-w-[90rem] space-y-8 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
            ← Admin
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Agency</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Phase 11 ops — roster, multi-creator campaigns, and joint portfolio case studies for{" "}
            {store.name}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-center text-xs">
          <div className="rounded-xl bg-lavender px-4 py-2">
            <p className="font-display text-lg font-bold text-violet">{stats.roster}</p>
            <p className="text-muted">Roster</p>
          </div>
          <div className="rounded-xl bg-[#D9E8FF] px-4 py-2">
            <p className="font-display text-lg font-bold text-blue">{stats.campaigns}</p>
            <p className="text-muted">Campaigns</p>
          </div>
          <div className="rounded-xl bg-emerald-100 px-4 py-2">
            <p className="font-display text-lg font-bold text-emerald-700">{stats.published}</p>
            <p className="text-muted">Published</p>
          </div>
        </div>
      </div>

      {params.error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {params.error}
        </div>
      ) : null}
      {params.roster ||
      params.removed ||
      params.campaign ||
      params.portfolio ||
      params.status ||
      params.toggled ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Saved.
        </div>
      ) : null}

      <section className="card-surface overflow-x-auto p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Roster</h2>
        <table className="mt-4 w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="pb-2 pr-3">Creator</th>
              <th className="pb-2 pr-3">Role</th>
              <th className="pb-2 pr-3">Retainer</th>
              <th className="pb-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {store.roster.map((m) => (
              <tr key={m.creatorSlug} className="border-t border-border">
                <td className="py-2.5 pr-3 font-semibold text-indigo">
                  {getCreatorBySlug(m.creatorSlug)?.displayName ?? m.creatorSlug}
                  {canManage ? (
                    <form action={actionAdminRemoveRoster} className="mt-1">
                      <input type="hidden" name="creatorSlug" value={m.creatorSlug} />
                      <button type="submit" className="text-[11px] font-semibold text-rose-700">
                        Remove
                      </button>
                    </form>
                  ) : null}
                </td>
                <td className="py-2.5 pr-3 capitalize">{m.role}</td>
                <td className="py-2.5 pr-3">{m.retainerLabel}</td>
                <td className="py-2.5 text-muted">{m.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {canManage ? (
          <form action={actionAdminAddRoster} className="mt-4 grid gap-3 sm:grid-cols-4">
            <select name="creatorSlug" className="rounded-xl border border-border px-3 py-2 text-sm" required>
              {SEED_CREATORS.filter((c) => !store.roster.some((r) => r.creatorSlug === c.slug)).map(
                (c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.displayName}
                  </option>
                ),
              )}
            </select>
            <select name="role" className="rounded-xl border border-border px-3 py-2 text-sm" defaultValue="talent">
              <option value="lead">Lead</option>
              <option value="specialist">Specialist</option>
              <option value="talent">Talent</option>
            </select>
            <input
              name="retainerLabel"
              placeholder="Retainer"
              defaultValue="Project"
              className="rounded-xl border border-border px-3 py-2 text-sm"
            />
            <button type="submit" className="btn-primary !py-2 text-sm">
              Add
            </button>
            <input type="hidden" name="notes" value="Admin added" />
          </form>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-indigo">Campaigns</h2>
        {store.campaigns.map((c) => (
          <article key={c.id} className="card-surface p-5">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase text-violet">{c.clientName}</p>
                <h3 className="font-display text-lg font-bold text-indigo">{c.title}</h3>
                <p className="text-sm text-muted">
                  {c.summary} · {c.status} · {c.budgetLabel}
                </p>
              </div>
              {canManage ? (
                <div className="flex flex-wrap gap-1">
                  {(["briefing", "casting", "live", "wrapped"] as const).map((st) => (
                    <form key={st} action={actionAdminSetCampaignStatus}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="status" value={st} />
                      <button
                        type="submit"
                        className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold"
                      >
                        {st}
                      </button>
                    </form>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
        {canManage ? (
          <form action={actionAdminCreateCampaign} className="card-surface grid gap-3 p-5 sm:grid-cols-2">
            <input name="title" required placeholder="Title" className="rounded-xl border border-border px-3 py-2 text-sm" />
            <input name="clientName" required placeholder="Client" className="rounded-xl border border-border px-3 py-2 text-sm" />
            <input name="specialty" defaultValue="beauty" className="rounded-xl border border-border px-3 py-2 text-sm" />
            <input name="budgetLabel" defaultValue="$10K" className="rounded-xl border border-border px-3 py-2 text-sm" />
            <input
              name="creatorSlugs"
              defaultValue={store.roster.slice(0, 2).map((r) => r.creatorSlug).join(",")}
              className="rounded-xl border border-border px-3 py-2 text-sm sm:col-span-2"
              placeholder="creator slugs, comma-separated"
            />
            <input
              name="summary"
              defaultValue="Admin-created multi-creator campaign"
              className="rounded-xl border border-border px-3 py-2 text-sm sm:col-span-2"
            />
            <button type="submit" className="btn-primary sm:col-span-2 !py-2 text-sm">
              Create campaign
            </button>
          </form>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-indigo">Joint portfolios</h2>
        {store.portfolios.map((p) => (
          <article key={p.id} className="card-surface flex flex-wrap items-start justify-between gap-3 p-5">
            <div>
              <h3 className="font-display text-lg font-bold text-indigo">{p.title}</h3>
              <p className="text-sm text-muted">
                {getCreatorBySlug(p.leftSlug)?.displayName} ×{" "}
                {getCreatorBySlug(p.rightSlug)?.displayName}
                {p.published ? " · published" : " · draft"}
              </p>
              <p className="mt-1 text-sm text-muted">{p.outcome}</p>
            </div>
            {canManage ? (
              <form action={actionAdminTogglePortfolio}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="published" value={p.published ? "0" : "1"} />
                <button type="submit" className="btn-secondary !py-1.5 text-xs">
                  {p.published ? "Unpublish" : "Publish"}
                </button>
              </form>
            ) : null}
          </article>
        ))}
        {canManage ? (
          <form action={actionAdminCreatePortfolio} className="card-surface grid gap-3 p-5 sm:grid-cols-2">
            <input name="title" required defaultValue="Ops case study" className="rounded-xl border border-border px-3 py-2 text-sm sm:col-span-2" />
            <input name="tagline" defaultValue="Complementary collab proof" className="rounded-xl border border-border px-3 py-2 text-sm sm:col-span-2" />
            <select name="leftSlug" className="rounded-xl border border-border px-3 py-2 text-sm" defaultValue={SEED_CREATORS[0]?.slug}>
              {SEED_CREATORS.map((c) => (
                <option key={c.slug} value={c.slug}>{c.displayName}</option>
              ))}
            </select>
            <select name="rightSlug" className="rounded-xl border border-border px-3 py-2 text-sm" defaultValue={SEED_CREATORS[1]?.slug}>
              {SEED_CREATORS.map((c) => (
                <option key={c.slug} value={c.slug}>{c.displayName}</option>
              ))}
            </select>
            <input name="specialty" defaultValue="beauty" className="rounded-xl border border-border px-3 py-2 text-sm" />
            <select name="campaignId" className="rounded-xl border border-border px-3 py-2 text-sm">
              <option value="">No campaign</option>
              {store.campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <textarea name="outcome" rows={2} defaultValue="Joint story outperformed solo posts on saves." className="rounded-xl border border-border px-3 py-2 text-sm sm:col-span-2" />
            <textarea name="metrics" rows={2} defaultValue={"Reach | 500K\nSaves | 8K"} className="rounded-xl border border-border px-3 py-2 text-sm sm:col-span-2" />
            <button type="submit" className="btn-primary sm:col-span-2 !py-2 text-sm">
              Create portfolio
            </button>
          </form>
        ) : null}
      </section>

      <p className="text-xs text-muted">
        {store.notes} · Public:{" "}
        <Link href="/agency" className="font-semibold text-violet hover:underline">
          /agency
        </Link>
      </p>
    </div>
  );
}
