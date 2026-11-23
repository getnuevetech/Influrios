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

type Props = { searchParams: Promise<{ error?: string; saved?: string; deleted?: string; voided?: string; page?: string }> };

export default async function AdminContractsPage({ searchParams }: Props) {
  const session = await requireAdminPage("contracts");
  await repairSignedAgreements().catch(() => 0);
  const params = await searchParams;
  const canView = hasPermission(session, "contracts.view");
  const canEdit = hasPermission(session, "contracts.templates");
  const canDelete = isSuperAdmin(session);
  const template = await ensureContractTemplate().catch(() => null);
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 25;
  // Only agreements still waiting for a signature are listed here; every agreement is on Deals.
  const where = { status: { in: ["draft", "sent"] } };
  const [counts, total, awaiting] = canView
    ? await prisma
        .$transaction([
          prisma.contractDocument.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { status: "asc" } }),
          prisma.contractDocument.count({ where }),
          prisma.contractDocument.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: { parties: { select: { name: true, email: true, role: true, status: true } } },
          }),
        ])
        .catch(() => [[], 0, []] as const)
    : ([[], 0, []] as const);
  const countOf = (statuses: string[]) =>
    counts.filter((row) => statuses.includes(row.status)).reduce((sum, row) => sum + (row._count as { _all: number })._all, 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-indigo">Contracts</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            The agreement template and the agreements still waiting for a signature. Every agreement, signed or not, is
            listed on Deals. A business or influencer cannot delete
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
      {params.error ? <p className="mt-3 text-sm font-semibold text-amber-800">{params.error}</p> : null}
      {!canView ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This access level can edit the template. Opening stored agreements needs the View contracts permission.
        </p>
      ) : null}

      {canView ? (
        <section className="mt-8 rounded-2xl border border-[#E4EBFF] bg-white p-5">
          <h2 className="font-display text-xl font-bold text-indigo">Signature status</h2>
          <p className="mt-1 text-sm text-muted">
            {countOf(["signed"])} fully signed · {countOf(["draft", "sent"])} awaiting signatures ·{" "}
            {countOf(["declined", "voided"])} declined or voided.{" "}
            <Link href="/admin/deals" className="font-semibold text-violet hover:underline">
              See every agreement on Deals
            </Link>
            .
          </p>
          <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-violet">Awaiting signatures</h3>
          <ContractAdminList documents={[...awaiting]} empty="No agreements waiting for signatures." canDelete={canDelete} />
          {pages > 1 ? (
            <p className="mt-3 text-xs text-muted">
              Page {page} of {pages}
              {page > 1 ? (
                <>
                  {" "}· <Link href={`/admin/contracts?page=${page - 1}`} className="font-semibold text-violet">Previous</Link>
                </>
              ) : null}
              {page < pages ? (
                <>
                  {" "}· <Link href={`/admin/contracts?page=${page + 1}`} className="font-semibold text-violet">Next</Link>
                </>
              ) : null}
            </p>
          ) : null}
        </section>
      ) : null}

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
                  href={`/admin/contracts/${document.id}`}
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
                href={`/admin/contracts/${document.id}`}
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
                  <input name="reason" required minLength={8} placeholder="Void reason" className="w-36 rounded border border-border px-1 py-1 text-[11px]" aria-label="Void reason" />
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
