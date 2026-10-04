import Link from "next/link";
import { requireAdminPage } from "@/app/admin/guard";
import { actionRestoreFooterStats, actionSaveFooterStats } from "@/app/admin/stats/actions";
import { hasPermission } from "@/lib/admin-auth";
import { DEFAULT_FOOTER_STATS, DEFAULT_FOOTER_TAGLINE, getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Site stats" };

const ICONS = [
  ["user", "Person"],
  ["users", "People"],
  ["handshake", "Handshake"],
  ["building", "Building"],
] as const;

const TONES = [
  ["violet", "Violet"],
  ["sky", "Sky"],
  ["blue", "Blue"],
] as const;

export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; restored?: string }>;
}) {
  const session = await requireAdminPage("banners");
  const canEdit = hasPermission(session, "banners.edit");
  const params = await searchParams;
  const config = await getSiteConfig();
  const stats = config.stats.length ? config.stats : DEFAULT_FOOTER_STATS;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Site stats</h1>
      <p className="mt-2 text-sm text-muted">
        Public footer counters require a source and as-of date (Dev Addendum §23.8). Unverified or stale rows stay
        hidden — placeholder 50K+/12K+ values are never shown as factual scale.
      </p>
      {params.saved ? <p className="mt-4 text-sm font-semibold text-emerald-700">Saved.</p> : null}
      {params.restored ? (
        <p className="mt-4 text-sm font-semibold text-emerald-700">Template stats restored (disabled until verified).</p>
      ) : null}
      <form action={actionSaveFooterStats} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold text-indigo">
          Script line
          <input
            name="footerTagline"
            defaultValue={config.footerTagline || DEFAULT_FOOTER_TAGLINE}
            disabled={!canEdit}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
          />
        </label>
        {stats.map((stat) => (
          <fieldset key={stat.key} className="rounded-2xl border border-[#E4EBFF] bg-white p-4">
            <input type="hidden" name="key" value={stat.key} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-indigo">
                Number
                <input
                  name={`value:${stat.key}`}
                  defaultValue={stat.value}
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold text-indigo">
                Label
                <input
                  name={`label:${stat.key}`}
                  defaultValue={stat.label}
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold text-indigo">
                Icon
                <select
                  name={`icon:${stat.key}`}
                  defaultValue={stat.iconKey}
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
                >
                  {ICONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-indigo">
                Color
                <select
                  name={`tone:${stat.key}`}
                  defaultValue={stat.tone}
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
                >
                  {TONES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-indigo">
                Order
                <input
                  name={`sort:${stat.key}`}
                  type="number"
                  defaultValue={stat.sortOrder}
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold text-indigo sm:col-span-2">
                Source (required to publish)
                <input
                  name={`source:${stat.key}`}
                  defaultValue={stat.source}
                  placeholder="e.g. Internal directory count · ops workbook"
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold text-indigo">
                As of (UTC date)
                <input
                  name={`asOf:${stat.key}`}
                  type="date"
                  defaultValue={stat.asOf ? stat.asOf.slice(0, 10) : ""}
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold text-indigo">
                Max age (days)
                <input
                  name={`maxAge:${stat.key}`}
                  type="number"
                  min={1}
                  max={730}
                  defaultValue={stat.maxAgeDays ?? 90}
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
                />
              </label>
              <div className="flex flex-wrap items-end gap-4 pb-2 text-sm font-semibold text-indigo sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name={`enabled:${stat.key}`} value="1" defaultChecked={stat.enabled} disabled={!canEdit} />
                  Visible when verified
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name={`delete:${stat.key}`} value="1" disabled={!canEdit} />
                  Remove
                </label>
                <span className={`text-xs font-semibold ${stat.verified ? "text-emerald-700" : "text-amber-800"}`}>
                  {stat.verified ? "Verified · public" : "Unverified · hidden on site"}
                </span>
              </div>
            </div>
          </fieldset>
        ))}
        <fieldset className="rounded-2xl border border-dashed border-[#C9D4FF] bg-white p-4">
          <p className="text-sm font-semibold text-indigo">Add a counter</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input name="newValue" placeholder="25K+" disabled={!canEdit} className="rounded-xl border border-border px-3 py-2" />
            <input name="newLabel" placeholder="Label" disabled={!canEdit} className="rounded-xl border border-border px-3 py-2" />
            <input name="newSource" placeholder="Source (required to publish)" disabled={!canEdit} className="rounded-xl border border-border px-3 py-2 sm:col-span-2" />
            <input name="newAsOf" type="date" disabled={!canEdit} className="rounded-xl border border-border px-3 py-2" />
            <select name="newIcon" defaultValue="user" disabled={!canEdit} className="rounded-xl border border-border px-3 py-2">
              {ICONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select name="newTone" defaultValue="violet" disabled={!canEdit} className="rounded-xl border border-border px-3 py-2">
              {TONES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
        {canEdit ? (
          <button type="submit" className="btn-primary">
            Save stats
          </button>
        ) : (
          <p className="text-sm text-muted">Your access level can view this strip. Editing needs the banner edit permission.</p>
        )}
      </form>
      {canEdit ? (
        <form action={actionRestoreFooterStats} className="mt-4">
          <button type="submit" className="text-sm font-semibold text-violet hover:underline">
            Restore disabled placeholder templates
          </button>
        </form>
      ) : null}
    </div>
  );
}
