import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { contractPartyProgress, resolveContractBodyForChrome } from "@/lib/contract-document";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contract · Admin" };

type Props = { params: Promise<{ id: string }> };

export default async function AdminContractPage({ params }: Props) {
  const session = await requireAdminPage("contracts");
  if (!hasPermission(session, "contracts.view")) {
    redirect(
      "/admin/contracts?error=" +
        encodeURIComponent("This access level cannot open stored agreements. Grant View contracts."),
    );
  }
  const { id } = await params;
  const document = await prisma.contractDocument.findUnique({
    where: { id },
    include: { parties: { orderBy: { createdAt: "asc" } } },
  });
  if (!document) notFound();
  const funding = document.fundingId
    ? await prisma.collaborationFunding
        .findUnique({ where: { id: document.fundingId }, select: { id: true, status: true } })
        .catch(() => null)
    : null;
  const chrome = resolveContractBodyForChrome({
    id: document.id,
    title: document.title,
    status: document.status,
    renderedBody: document.renderedBody,
    signingChannel: document.signingChannel,
    createdAt: document.createdAt,
    parties: document.parties,
  });
  const progress = contractPartyProgress(document.parties);
  const deliverables =
    funding && (funding.status === "held" || funding.status === "completed")
      ? `/collaboration/work/${funding.id}`
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/contracts" className="text-sm font-semibold text-violet hover:underline">
            ← Contracts
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold text-indigo">{document.title}</h1>
          <p className="mt-2 text-sm text-muted">
            {document.status} · {progress.label} · {document.signingChannel === "docusign" ? "DocuSign" : "In-app"} ·{" "}
            {document.id}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/collaboration/contracts/${document.id}/pdf`} className="btn-secondary !py-2 text-sm">
            Open PDF
          </Link>
          {deliverables ? (
            <Link href={deliverables} className="btn-primary !py-2 text-sm">
              Deliverables
            </Link>
          ) : null}
        </div>
      </div>
      <p className="text-sm text-muted">
        This is the stored agreement. Admin view does not sign for a party. Who can open it is the View contracts
        permission under Access.
      </p>
      <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5">
        <h2 className="font-display text-xl font-bold text-indigo">Parties</h2>
        <ul className="mt-3 space-y-2">
          {document.parties.map((party) => (
            <li key={party.id} className="rounded-xl bg-[#F7F9FF] px-3 py-2 text-sm text-indigo">
              <span className="font-semibold">{party.name || party.role}</span>
              <span className="text-muted">
                {" "}
                · {party.role} · {party.email} · {party.status}
                {party.signedAt ? ` · ${party.signedAt.toISOString().slice(0, 10)}` : ""}
              </span>
            </li>
          ))}
        </ul>
        {funding ? (
          <p className="mt-3 text-sm text-muted">
            Funding {funding.id} · {funding.status.replaceAll("_", " ")}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">No funding record is attached yet.</p>
        )}
      </section>
      <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5">
        <h2 className="font-display text-xl font-bold text-indigo">Agreement</h2>
        <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-indigo">{chrome.body}</pre>
      </section>
    </div>
  );
}
