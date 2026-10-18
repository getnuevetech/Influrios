import Link from "next/link";
import { actionSaveContractTemplate } from "@/app/admin/contracts/actions";
import { hasPermission } from "@/lib/admin-auth";
import { requireAdminPage } from "@/app/admin/guard";
import {
  CONTRACT_VARIABLES,
  contractPartyProgress,
  ensureContractTemplate,
} from "@/lib/contract-document";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contracts · Admin" };

type Props = { searchParams: Promise<{ error?: string; saved?: string }> };

export default async function AdminContractsPage({ searchParams }: Props) {
  const session = await requireAdminPage("contracts");
  const params = await searchParams;
  const canEdit = hasPermission(session, "contracts.templates");
  const template = await ensureContractTemplate().catch(() => null);
  const documents = await prisma.contractDocument
    .findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { parties: { select: { name: true, email: true, role: true, status: true } } },
    })
    .catch(() => []);
  const signed = documents.filter((row) => row.status === "signed");
  const awaiting = documents.filter((row) => row.status === "sent" || row.status === "draft");
  const other = documents.filter((row) => row.status !== "signed" && row.status !== "sent" && row.status !== "draft");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-indigo">Contracts</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Sent agreements, signature progress, and the collaboration template. Signing channel (in-app or DocuSign)
            is configured under{" "}
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
      {params.error ? <p className="mt-3 text-sm font-semibold text-amber-800">{params.error}</p> : null}

      <section className="mt-8 rounded-2xl border border-[#E4EBFF] bg-white p-5">
        <h2 className="font-display text-xl font-bold text-indigo">Signature status</h2>
        <p className="mt-1 text-sm text-muted">
          {signed.length} fully signed · {awaiting.length} awaiting signatures · {other.length} other
        </p>

        <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-violet">Fully signed</h3>
        <ContractAdminList documents={signed} empty="No fully signed agreements yet." />

        <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-violet">Awaiting signatures</h3>
        <ContractAdminList documents={awaiting} empty="No agreements waiting for signatures." />

        {other.length > 0 ? (
          <>
            <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-violet">Other</h3>
            <ContractAdminList documents={other} empty="" />
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
}: {
  documents: {
    id: string;
    title: string;
    status: string;
    signingChannel: string;
    createdAt: Date;
    parties: { name: string; email: string; role: string; status: string }[];
  }[];
  empty: string;
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
              <Link
                href={`/collaboration/contracts/${document.id}`}
                className="text-xs font-semibold text-violet hover:underline"
              >
                Open →
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
