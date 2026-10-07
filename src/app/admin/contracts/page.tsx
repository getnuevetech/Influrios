import Link from "next/link";
import { actionSaveContractTemplate } from "@/app/admin/contracts/actions";
import { hasPermission } from "@/lib/admin-auth";
import { requireAdminPage } from "@/app/admin/guard";
import { CONTRACT_VARIABLES, ensureContractTemplate } from "@/lib/contract-document";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contract template" };

type Props = { searchParams: Promise<{ error?: string; saved?: string }> };

export default async function AdminContractsPage({ searchParams }: Props) {
  const session = await requireAdminPage("contracts");
  const params = await searchParams;
  const canEdit = hasPermission(session, "contracts.templates");
  const template = await ensureContractTemplate().catch(() => null);
  const documents = await prisma.contractDocument.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { parties: { select: { name: true, status: true } } },
  }).catch(() => []);

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-indigo">Contract template</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        The text below is the agreement. Variables in double braces are filled when a contract is sent. The PDF and
        the DocuSign envelope use that filled agreement. A contract is signed only when DocuSign reports every party
        complete, and the PDF is stored on each party&apos;s account.
      </p>
      {params.saved ? <p className="mt-3 text-sm font-semibold text-emerald-700">Template saved.</p> : null}
      {params.error ? <p className="mt-3 text-sm font-semibold text-amber-800">{params.error}</p> : null}
      <form action={actionSaveContractTemplate} className="mt-6 space-y-3">
        <label className="block text-sm font-semibold text-indigo">
          Agreement
          <textarea
            name="body"
            required
            rows={22}
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
          <p className="text-sm text-muted">This access level can view the template. Editing needs the template permission.</p>
        )}
      </form>
      <section className="mt-8">
        <h2 className="font-display text-xl font-bold text-indigo">Sent agreements</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {documents.map((document) => (
            <li key={document.id}>
              <Link href={`/collaboration/contracts/${document.id}`} className="font-semibold text-violet hover:underline">
                {document.title}
              </Link>{" "}
              · {document.status} · {document.parties.map((party) => `${party.name} (${party.status})`).join(", ")}
            </li>
          ))}
          {documents.length === 0 ? <li className="text-muted">No agreements have been sent.</li> : null}
        </ul>
      </section>
    </div>
  );
}
