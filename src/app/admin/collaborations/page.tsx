import Link from "next/link";
import { actionSaveCollaborationSettings, actionSetCollaborationStatus } from "@/app/admin/collaborations/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import {
  collaborationStatusChoices,
  getCollaborationSettings,
  listCollaborations,
} from "@/lib/collaborations";
import { prisma } from "@/lib/db";
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
  const proposalIds = records.map((record) => record.id);
  const agreements = proposalIds.length
    ? await prisma.contractDocument.findMany({
        where: { collaborationId: { in: proposalIds } },
        orderBy: { createdAt: "desc" },
        select: { id: true, collaborationId: true, status: true, fundingId: true },
      }).catch(() => [])
    : [];
  const agreementByProposal = new Map<string, (typeof agreements)[number]>();
  for (const agreement of agreements) {
    if (agreement.collaborationId && !agreementByProposal.has(agreement.collaborationId)) {
      agreementByProposal.set(agreement.collaborationId, agreement);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Proposals</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        This page is only creator-to-creator proposals. It does not list campaign invitations, signed contracts, or
        funding. An agreement created from a campaign lives on{" "}
        <Link href="/admin/deals" className="font-semibold text-violet hover:underline">
          Deals
        </Link>
        , even when this table is empty.
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
            Days that count toward the plan limit
            <input
              name="windowDays"
              type="number"
              min={1}
              max={365}
              defaultValue={settings.windowDays}
              disabled={!canEdit}
              className={inputClass}
            />
            <span className="mt-1 block text-xs font-normal text-muted">
              A sent proposal inside this many days counts toward{" "}
              <Link href="/admin/plans" className="font-semibold text-violet">
                collaboration.proposals.max
              </Link>
              . This does not set a contract fee.
            </span>
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Choices for Commercial framing
            <textarea
              name="commercialOptions"
              rows={5}
              defaultValue={settings.commercialOptions}
              disabled={!canEdit}
              className={inputClass}
            />
            <span className="mt-1 block text-xs font-normal text-muted">
              One choice per line, up to 12 lines of 80 characters. These are the options on Propose a collaboration.
              They are not the gross amount or the milestone split on a signed agreement.
            </span>
          </label>
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
              <th className="px-4 py-3 font-semibold">Agreement</th>
              <th className="px-4 py-3 font-semibold">Proposal status</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const initiator = bySlug.get(record.initiatorSlug);
              const recipient = bySlug.get(record.recipientSlug);
              const agreement = agreementByProposal.get(record.id);
              const nextStatuses = collaborationStatusChoices(record.status);
              const closed = nextStatuses.length <= 1;
              return (
                <tr key={record.id} className="border-b border-[#E4EBFF] last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/deals/${record.id}`} className="font-semibold text-indigo hover:text-violet">
                      {record.title}
                    </Link>
                    <p className="text-xs text-muted">Framing: {record.commercial || "Not set"}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {initiator?.displayName ?? record.initiatorSlug} → {recipient?.displayName ?? record.recipientSlug}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {agreement ? (
                      <Link href={`/admin/deals/${agreement.id}`} className="font-semibold text-violet hover:underline">
                        {agreement.status}
                        {agreement.fundingId ? " · funding linked" : " · no funding yet"}
                      </Link>
                    ) : (
                      <span className="text-muted">No agreement yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {closed ? (
                      <p className="text-xs text-muted">{record.status}. This proposal is closed.</p>
                    ) : (
                      <form action={actionSetCollaborationStatus} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={record.id} />
                        <label className="text-xs text-muted">
                          Reason
                          <input
                            name="reason"
                            required
                            minLength={8}
                            aria-label={`Reason for changing ${record.title}`}
                            disabled={!canEdit}
                            className="mt-1 block w-40 rounded-lg border border-border px-2 py-1 text-xs"
                          />
                        </label>
                        <label className="text-xs text-muted">
                          Next status
                          <select name="status" defaultValue={record.status} disabled={!canEdit} className="mt-1 block rounded-lg border border-border px-2 py-1">
                            {nextStatuses.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </label>
                        {canEdit ? (
                          <button type="submit" className="text-xs font-semibold text-violet">
                            Update proposal
                          </button>
                        ) : null}
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {records.length === 0 && !dbError ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-muted">
                  No creator-to-creator proposals yet. Signed campaign agreements are on Deals.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
