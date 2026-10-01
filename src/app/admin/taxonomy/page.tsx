import { actionAddSynonym, actionRemoveSynonym, actionToggleSpecialty } from "@/app/admin/taxonomy/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { getDirectory } from "@/lib/directory";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Taxonomy · Admin" };

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminTaxonomyPage({ searchParams }: Props) {
  const session = await requireAdminPage("taxonomy");
  const query = await searchParams;
  const canEdit = hasPermission(session, "taxonomy.edit");
  const directory = await getDirectory();
  const synonyms = await prisma.specialtySynonym.findMany({
    include: { specialty: true },
    orderBy: { term: "asc" },
  }).catch(() => []);

  const flat = directory.taxonomy.flatMap((parent) => [
    { slug: parent.slug, name: parent.name, active: parent.active, depth: 0 },
    ...parent.children.map((child) => ({
      slug: child.slug,
      name: child.name,
      active: child.active,
      depth: 1,
    })),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-indigo">Taxonomy</h1>
      <p className="mt-2 text-sm text-muted">
        Inactive specialties drop out of Discover and Categories. New catalog specialties appear here
        and stay hidden after you turn them off. Synonyms such as woodwork resolve to the canonical
        specialty without a deploy.
      </p>
      {query.saved ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Saved.</p>
      ) : null}
      {query.error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{query.error}</p>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-[#E4EBFF] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#E4EBFF] text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Specialty</th>
              <th className="px-4 py-3">Visible</th>
            </tr>
          </thead>
          <tbody>
            {flat.map((row) => (
              <tr key={row.slug} className="border-b border-[#F0F3FA]">
                <td className="px-4 py-3" style={{ paddingLeft: row.depth ? 32 : 16 }}>
                  <div className="font-semibold text-indigo">{row.name}</div>
                  <div className="text-[11px] text-muted">{row.slug}</div>
                </td>
                <td className="px-4 py-3">
                  <form action={actionToggleSpecialty}>
                    <input type="hidden" name="slug" value={row.slug} />
                    <input type="hidden" name="active" value={row.active ? "false" : "true"} />
                    <button type="submit" disabled={!canEdit} className="text-xs font-bold text-violet hover:underline">
                      {row.active ? "Active" : "Hidden"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 font-display text-xl font-bold text-indigo">Search synonyms</h2>
      <form action={actionAddSynonym} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="font-semibold text-indigo">Alias</span>
          <input name="term" placeholder="woodwork" className="mt-1 block rounded-lg border border-[#E4EBFF] px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="font-semibold text-indigo">Specialty</span>
          <select name="slug" className="mt-1 block rounded-lg border border-[#E4EBFF] px-3 py-2">
            {flat.map((row) => (
              <option key={row.slug} value={row.slug}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        {canEdit ? (
          <button type="submit" className="rounded-lg bg-violet px-3 py-2 text-sm font-bold text-white">
            Add
          </button>
        ) : null}
      </form>
      <ul className="mt-4 space-y-2">
        {synonyms.map((row) => (
          <li key={row.id} className="flex items-center justify-between rounded-xl border border-[#E4EBFF] bg-white px-4 py-2 text-sm">
            <span>
              <span className="font-semibold text-indigo">{row.term}</span>
              <span className="text-muted"> → {row.specialty.name}</span>
            </span>
            {canEdit ? (
              <form action={actionRemoveSynonym}>
                <input type="hidden" name="id" value={row.id} />
                <button type="submit" className="text-xs font-bold text-rose-700">
                  Remove
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
