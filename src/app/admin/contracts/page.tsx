import Link from "next/link";
import { actionDeleteContractDocument, actionSaveContractTemplate, actionVoidContractDocument } from "@/app/admin/contracts/actions";
import { contractMayBeDeleted, contractMayBeVoided } from "@/lib/signed-funding";
import { repairSignedAgreements } from "@/lib/signed-funding-apply";
import { hasPermission, isSuperAdmin } from "@/lib/admin-auth";
import { requireAdminPage } from "@/app/admin/guard";
import {
  CONTRACT_VARIABLES,
  contractPartyProgress,
  ensureContractTemplate,
} from "@/lib/contract-document";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contracts · Admin" };

type Props = { searchParams: Promise<{ error?: string; saved?: string; deleted?: string; voided?: string; q?: string; status?: string; page?: string }> };

export default async function AdminContractsPage({ searchParams }: Props) {
  const session = await requireAdminPage("contracts");
  await repairSignedAgreements().catch(() => 0);
  const params = await searchParams;
  const canEdit = hasPermission(session, "contracts.templates");
  const canDelete = isSuperAdmin(session);
  const template = await ensureContractTemplate().catch(() => null);
  const q = (params.q ?? "").trim();
  const status = (params.status ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 25;
  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { id: q },
            { parties: { some: { email: { contains: q, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };
  const [total, documents] = await prisma
    .$transaction([
      prisma.contractDocument.count({ where }),
      prisma.contractDocument.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { parties: { select: { name: true, email: true, role: true, status: true } } },
      }),
    ])
    .catch(() => [0, []] as const);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const signed = documents.filter((row) => row.status === "signed");
  const awaiting = documents.filter((row) => row.status === "sent" || row.status === "draft");
  const other = documents.filter((row) => row.status !== "signed" && row.status !== "sent" && row.status !== "draft");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-indigo">Contracts</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Sent agreements, signature progress, and the collaboration template. A business or influencer cannot delete
            a contract. A super admin can delete an unused draft. A sent or signed agreement is voided, so the PDF and
            signatures stay on record. Signing channel (in-app or DocuSign) is configured under{" "}
            <Link href="/admin/signing" className="font-semibold text-violet hover:underline">
              Document signing
            </Link>
            .
          </p>
        </div>
        <Link href="/admin/signing" className="btn-secondary !py-2 text-sm">
          Signing settings →
        </Link>
      </div>
      {params.saved ? <p className="mt-3 text-sm font-semibold text-emerald-700">Template saved.</p> : null}
      {params.deleted ? <p className="mt-3 text-sm font-semibold text-emerald-700">Draft deleted.</p> : null}
      {params.voided ? <p className="mt-3 text-sm font-semibold text-emerald-700">Agreement voided.</p> : null}
      <form className="mt-4 flex flex-wrap gap-2" action="/admin/contracts">
        <input name="q" defaultValue={q} placeholder="Title, email, or id" className="rounded-xl border border-border px-3 py-2 text-sm" />
        <select name="status" defaultValue={status} className="rounded-xl border border-border px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {["draft", "sent", "signed", "declined", "voided"].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary !py-2 text-sm">
          Search
        </button>
      </form>
      <p className="mt-2 text-xs text-muted">
        {total} agreement{total === 1 ? "" : "s"} · page {page} of {pages}
        {page > 1 ? (
          <>
            {" "}
            · <Link href={`/admin/contracts?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&page=${page - 1}`} className="font-semibold text-violet">Previous</Link>
          </>
        ) : null}
        {page < pages ? (
          <>
            {" "}
            · <Link href={`/admin/contracts?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&page=${page + 1}`} className="font-semibold text-violet">Next</Link>
          </>
        ) : null}
      </p>
      {params.error ? <p className="mt-3 text-sm font-semibold text-amber-800">{params.error}</p> : null}

      <section className="mt-8 rounded-2xl border border-[#E4EBFF] bg-white p-5">
        <h2 className="font-display text-xl font-bold text-indigo">Signature status</h2>
        <p className="mt-1 text-sm text-muted">
          {signed.length} fully signed · {awaiting.length} awaiting signatures · {other.length} other
        </p>

        <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-violet">Fully signed</h3>
        <ContractAdminList documents={signed} empty="No fully signed agreements yet." canDelete={canDelete} />

        <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-violet">Awaiting signatures</h3>
        <ContractAdminList documents={awaiting} empty="No agreements waiting for signatures." canDelete={canDelete} />

        {other.length > 0 ? (
          <>
            <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-violet">Other</h3>
            <ContractAdminList documents={other} empty="" canDelete={canDelete} />
          </>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold text-indigo">Agreement template</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Variables in double braces are filled when a contract is sent. The PDF is stored on each party&apos;s account.
        </p>
        <form action={actionSaveContractTemplate} className="mt-4 space-y-3">
          <label className="block text-sm font-semibold text-indigo">
            Agreement
            <textarea
              name="body"
              required
              rows={18}
              defaultValue={template?.body ?? ""}
              disabled={!canEdit}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-mono text-xs font-normal"
            />
          </label>
          <p className="text-xs text-muted">Variables: {CONTRACT_VARIABLES.map((key) => `{{${key}}}`).join(", ")}</p>
          {canEdit ? (
            <button type="submit" className="btn-primary !py-2 text-sm">
              Save template
            </button>
          ) : (
            <p className="text-sm text-muted">
              This access level can view the template. Editing needs the template permission.
            </p>
          )}
        </form>
      </section>
    </div>
  );
}

function ContractAdminList({
  documents,
  empty,
  canDelete,
}: {
  documents: {
    id: string;
    title: string;
    status: string;
    signingChannel: string;
    createdAt: Date;
    fundingId?: string | null;
    parties: { name: string; email: string; role: string; status: string }[];
  }[];
  empty: string;
  canDelete: boolean;
}) {
  if (documents.length === 0) {
    return empty ? <p className="mt-2 text-sm text-muted">{empty}</p> : null;
  }
  return (
    <ul className="mt-2 space-y-2">
      {documents.map((document) => {
        const progress = contractPartyProgress(document.parties);
        return (
          <li
            key={document.id}
            className="rounded-xl border border-[#E4EBFF] bg-[#F7F9FF] px-4 py-3 text-sm text-indigo"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link
                  href={`/collaboration/contracts/${document.id}`}
                  className="font-semibold text-violet hover:underline"
                >
                  {document.title}
                </Link>
                <p className="mt-1 text-xs text-muted">
                  {document.status} · {progress.label} ·{" "}
                  {document.signingChannel === "docusign" ? "DocuSign" : "In-app"} ·{" "}
                  {document.createdAt.toISOString().slice(0, 10)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {document.parties
                    .map((party) => `${party.name} (${party.role}: ${party.status})`)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
              <Link
                href={`/collaboration/contracts/${document.id}`}
                className="text-xs font-semibold text-violet hover:underline"
              >
                Open →
              </Link>
              {canDelete && contractMayBeDeleted(document.status) ? (
                <form action={actionDeleteContractDocument} className="text-right">
                  <input type="hidden" name="id" value={document.id} />
                  <label className="flex items-center justify-end gap-1 text-[11px] text-muted">
                    <input type="checkbox" name="confirm" className="accent-rose-600" />
                    Delete this unused draft
                  </label>
                  <button type="submit" className="mt-1 text-[11px] font-semibold text-rose-700">
                    Delete draft
                  </button>
                </form>
              ) : null}
              {canDelete && contractMayBeVoided(document.status, document.fundingId) ? (
                <form action={actionVoidContractDocument} className="text-right">
                  <input type="hidden" name="id" value={document.id} />
                  <input name="reason" required minLength={8} placeholder="Void reason" className="w-36 rounded border border-border px-1 py-1 text-[11px]" />
                  <button type="submit" className="mt-1 block text-[11px] font-semibold text-rose-700">
                    Void agreement
                  </button>
                </form>
              ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
