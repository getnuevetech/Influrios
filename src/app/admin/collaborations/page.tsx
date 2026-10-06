import Link from "next/link";
import { actionSaveCollaborationSettings, actionSetCollaborationStatus } from "@/app/admin/collaborations/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import {
  COLLABORATION_STATUSES,
  getCollaborationSettings,
  listCollaborations,
} from "@/lib/collaborations";
import { getDirectory, indexCreatorsBySlug } from "@/lib/directory";

export const dynamic = "force-dynamic";
export const metadata = { title: "Collaborations · Admin" };

const inputClass = "mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal";

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminCollaborationsPage({ searchParams }: Props) {
  const session = await requireAdminPage("collaborations");
  const canEdit = hasPermission(session, "collaborations.edit");
  const params = await searchParams;

  let settings: Awaited<ReturnType<typeof getCollaborationSettings>> | null = null;
  let records: Awaited<ReturnType<typeof listCollaborations>> = [];
  let dbError = false;
  try {
    [settings, records] = await Promise.all([getCollaborationSettings(), listCollaborations()]);
  } catch (error) {
    console.error("admin collaborations", error);
    dbError = true;
  }

  const directory = await getDirectory().catch(() => null);
  const bySlug = indexCreatorsBySlug(directory?.creators ?? []);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Collaborations</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        The proposal window and commercial options are edited here. How many proposals a plan can send is the{" "}
        <Link href="/admin/plans" className="font-semibold text-violet">
          collaboration.proposals.max
        </Link>{" "}
        entitlement. Status changes follow draft, sent, accepted, declined, and withdrawn.
      </p>
      {params.saved ? <p className="mt-4 text-sm font-semibold text-emerald-700">Saved.</p> : null}
      {params.error ? <p className="mt-4 text-sm font-semibold text-amber-800">{params.error}</p> : null}
      {dbError ? (
        <p className="mt-4 text-sm text-amber-800">The database is unavailable, so collaborations cannot be saved yet.</p>
      ) : null}

      {settings ? (
        <form action={actionSaveCollaborationSettings} className="mt-6 space-y-3 rounded-2xl border border-[#E4EBFF] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Proposal rules</h2>
          <label className="block text-sm font-semibold text-indigo">
            Window in days
            <input
              name="windowDays"
              type="number"
              min={1}
              max={365}
              defaultValue={settings.windowDays}
              disabled={!canEdit}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Commercial options
            <textarea
              name="commercialOptions"
              rows={5}
              defaultValue={settings.commercialOptions}
              disabled={!canEdit}
              className={inputClass}
            />
          </label>
          <p className="text-xs text-muted">One option per line. These are the choices on the propose form.</p>
          {canEdit ? (
            <button type="submit" className="btn-primary w-fit">
              Save rules
            </button>
          ) : null}
        </form>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-[#E4EBFF] bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[#E4EBFF] text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Proposal</th>
              <th className="px-4 py-3 font-semibold">People</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const initiator = bySlug.get(record.initiatorSlug);
              const recipient = bySlug.get(record.recipientSlug);
              return (
                <tr key={record.id} className="border-b border-[#E4EBFF] last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/collaboration/records/${record.id}`} className="font-semibold text-indigo hover:text-violet">
                      {record.title}
                    </Link>
                    <p className="text-xs text-muted">{record.commercial}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {initiator?.displayName ?? record.initiatorSlug} → {recipient?.displayName ?? record.recipientSlug}
                  </td>
                  <td className="px-4 py-3">
                    <form action={actionSetCollaborationStatus} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={record.id} />
                      <select name="status" defaultValue={record.status} disabled={!canEdit} className="rounded-lg border border-border px-2 py-1">
                        {COLLABORATION_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      {canEdit ? (
                        <button type="submit" className="text-xs font-semibold text-violet">
                          Update
                        </button>
                      ) : null}
                    </form>
                  </td>
                </tr>
              );
            })}
            {records.length === 0 && !dbError ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-muted">
                  No proposals yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
