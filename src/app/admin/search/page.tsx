import Link from "next/link";
import { actionRebuildSearchIndex, actionSaveSearch } from "@/app/admin/search/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { searchIndexStatus } from "@/lib/creator-search";
import { listProviders } from "@/lib/providers";
import { loadMeiliConfig } from "@/lib/search-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search · Admin" };

const inputClass = "mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal";

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminSearchPage({ searchParams }: Props) {
  const session = await requireAdminPage("gateways");
  const canEdit = hasPermission(session, "gateways.edit");
  const params = await searchParams;
  let provider: Awaited<ReturnType<typeof listProviders>>[number] | null = null;
  let activeHost = "";
  let indexStatus: Awaited<ReturnType<typeof searchIndexStatus>> | null = null;
  let dbError = false;
  try {
    const providers = await listProviders("search");
    provider = providers.find((row) => row.code === "meilisearch") ?? providers[0] ?? null;
    activeHost = (await loadMeiliConfig())?.host ?? "";
    indexStatus = await searchIndexStatus();
  } catch (error) {
    console.error("admin search", error);
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Meilisearch</h1>
      <p className="mt-2 text-sm text-muted">
        Discover uses this host when it is enabled. An environment <code>MEILI_HOST</code> is used first when it is set.
        The index in use is {activeHost || "not configured"}.
      </p>
      {params.saved === "indexed" ? <p className="mt-4 text-sm font-semibold text-emerald-700">Index rebuilt.</p> : null}
      {params.saved === "1" ? <p className="mt-4 text-sm font-semibold text-emerald-700">Saved.</p> : null}
      {params.error ? <p className="mt-4 text-sm font-semibold text-amber-800">{params.error}</p> : null}
      {dbError ? <p className="mt-4 text-sm text-amber-800">The database is unavailable.</p> : null}

      {provider ? (
        <form action={actionSaveSearch} className="mt-6 grid gap-3 rounded-2xl border border-[#E4EBFF] bg-white p-4">
          <input type="hidden" name="id" value={provider.id} />
          <label className="text-sm font-semibold text-indigo">
            Name
            <input name="name" defaultValue={provider.name} disabled={!canEdit} className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-indigo">
            Host
            <input name="baseUrl" defaultValue={provider.baseUrl} placeholder="http://meilisearch:7700" disabled={!canEdit} className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-indigo">
            API key ({provider.secret})
            <input name="secret" type="password" placeholder="Leave blank to keep" disabled={!canEdit} className={inputClass} />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
            <input type="checkbox" name="clearSecret" value="1" disabled={!canEdit} />
            Clear the saved API key
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
            <input type="checkbox" name="enabled" value="1" defaultChecked={provider.enabled} disabled={!canEdit} />
            Enabled
          </label>
          {canEdit ? <button type="submit" className="btn-primary w-fit">Save Meilisearch</button> : null}
        </form>
      ) : null}

      <section className="mt-6 rounded-2xl border border-[#E4EBFF] bg-white p-4">
        <h2 className="font-display text-lg font-bold text-indigo">Creator index</h2>
        <dl className="mt-3 grid gap-2 text-sm text-indigo sm:grid-cols-2">
          <div>
            <dt className="text-muted">Postgres creators</dt>
            <dd className="font-semibold">{indexStatus ? indexStatus.postgresCount : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Index documents</dt>
            <dd className="font-semibold">{indexStatus?.indexCount ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Last reindex</dt>
            <dd className="font-semibold">
              {indexStatus?.lastReindexAt
                ? `${indexStatus.lastReindexAt.toISOString().replace("T", " ").slice(0, 16)} UTC`
                : "Not yet"}
              {indexStatus?.lastStatus ? ` (${indexStatus.lastStatus})` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Host in use</dt>
            <dd className="font-semibold">{indexStatus?.host || activeHost || "not configured"}</dd>
          </div>
        </dl>
        {indexStatus?.lastError ? <p className="mt-3 text-sm text-amber-800">{indexStatus.lastError}</p> : null}
        {canEdit ? (
          <form action={actionRebuildSearchIndex} className="mt-4">
            <button type="submit" className="btn-secondary !py-2 text-sm">
              Reindex
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
