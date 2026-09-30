import Link from "next/link";
import { actionPublishLegalVersion, actionSetLegalStatus, actionSetReacceptance } from "@/app/admin/legal/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { ensureLegalCatalog } from "@/lib/legal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Legal documents · Admin" };

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminLegalPage({ searchParams }: Props) {
  const session = await requireAdminPage("legal");
  const canEdit = hasPermission(session, "legal.edit");
  const params = await searchParams;
  let docs: Awaited<ReturnType<typeof prisma.legalDocument.findMany>> = [];
  let counts = new Map<string, number>();
  let dbError = false;
  try {
    await ensureLegalCatalog();
    docs = await prisma.legalDocument.findMany({ orderBy: [{ documentKey: "asc" }, { effectiveDate: "desc" }] });
    const grouped = await prisma.legalAcceptance.groupBy({
      by: ["documentId"],
      _count: { _all: true },
    });
    counts = new Map(grouped.map((row) => [row.documentId, row._count._all]));
  } catch (error) {
    console.error("admin legal", error);
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Legal documents</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Documents are versioned. Publishing a new version supersedes the previous one and keeps the old text and
        acceptance rows. Disabling a version does not delete evidence. Sign in again if this page was forbidden after
        the permission was added.
      </p>
      <p className="mt-2 text-sm">
        <Link href="/admin/legal/export" className="font-semibold text-violet hover:underline">
          Export acceptance ledger
        </Link>
        {" · "}
        <Link href="/legal" className="font-semibold text-violet hover:underline">
          Public Legal Center
        </Link>
      </p>
      {params.saved ? <p className="mt-4 text-sm font-semibold text-emerald-700">Saved. History was kept.</p> : null}
      {params.error ? <p className="mt-4 text-sm text-amber-800">{params.error}</p> : null}
      {dbError ? <p className="mt-4 text-sm text-amber-800">The legal ledger is unavailable.</p> : null}

      <div className="mt-6 space-y-3">
        {docs.map((doc) => (
          <article key={doc.id} className="card-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-indigo">{doc.title}</p>
                <p className="text-xs text-muted">
                  {doc.documentKey} · v{doc.version} · {doc.publishedStatus} · {doc.featureTrigger} · {doc.category} ·{" "}
                  {counts.get(doc.id) ?? 0} records
                </p>
              </div>
              {canEdit ? (
                <div className="flex flex-wrap gap-2">
                  <form action={actionSetReacceptance}>
                    <input type="hidden" name="id" value={doc.id} />
                    <button type="submit" className="btn-secondary !py-1 text-xs">
                      {doc.requiresReacceptance ? "Re-acceptance on" : "Require re-acceptance"}
                    </button>
                  </form>
                  {doc.publishedStatus === "published" ? (
                    <form action={actionSetLegalStatus}>
                      <input type="hidden" name="id" value={doc.id} />
                      <input type="hidden" name="status" value="disabled" />
                      <button type="submit" className="btn-secondary !py-1 text-xs">
                        Disable
                      </button>
                    </form>
                  ) : (
                    <form action={actionSetLegalStatus}>
                      <input type="hidden" name="id" value={doc.id} />
                      <input type="hidden" name="status" value="published" />
                      <button type="submit" className="btn-secondary !py-1 text-xs">
                        Publish
                      </button>
                    </form>
                  )}
                  <form action={actionSetLegalStatus}>
                    <input type="hidden" name="id" value={doc.id} />
                    <input type="hidden" name="status" value="archived" />
                    <button type="submit" className="btn-secondary !py-1 text-xs">
                      Archive
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {canEdit ? (
        <form action={actionPublishLegalVersion} className="card-surface mt-8 space-y-3 p-6">
          <h2 className="font-display text-lg font-bold text-indigo">Publish a new version</h2>
          <p className="text-xs text-muted">
            Use a new version string. The previous published version of the same key becomes superseded and stays in the
            ledger.
          </p>
          <label className="block text-sm font-semibold text-indigo">
            Document key
            <input name="documentKey" required className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Title
            <input name="title" required className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm font-semibold text-indigo">
              Version
              <input name="version" required className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
            </label>
            <label className="block text-sm font-semibold text-indigo">
              Effective date
              <input name="effectiveDate" type="date" required className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
            </label>
            <label className="block text-sm font-semibold text-indigo">
              Trigger
              <input name="featureTrigger" defaultValue="public" className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
            </label>
          </div>
          <label className="block text-sm font-semibold text-indigo">
            Body
            <textarea name="bodyText" required rows={8} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
          </label>
          <label className="flex items-center gap-2 text-sm text-indigo">
            <input type="checkbox" name="requiresAcceptance" className="accent-violet" />
            Requires acceptance
          </label>
          <label className="flex items-center gap-2 text-sm text-indigo">
            <input type="checkbox" name="acknowledgementOnly" className="accent-violet" />
            Acknowledgement only
          </label>
          <label className="flex items-center gap-2 text-sm text-indigo">
            <input type="checkbox" name="requiresReacceptance" className="accent-violet" />
            Require re-acceptance for this version
          </label>
          <button type="submit" className="btn-primary">
            Publish version
          </button>
        </form>
      ) : null}
    </div>
  );
}
