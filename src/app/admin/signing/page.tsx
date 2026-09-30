import Link from "next/link";
import { actionSaveSigningProvider } from "@/app/admin/signing/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { listProviders } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Document signing · Admin" };

const inputClass = "mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal";

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminSigningPage({ searchParams }: Props) {
  const session = await requireAdminPage("signing");
  const canEdit = hasPermission(session, "signing.edit");
  const params = await searchParams;
  let providers: Awaited<ReturnType<typeof listProviders>> = [];
  let requests: { id: string; title: string; status: string; collaborationId: string; providerName: string }[] = [];
  let dbError = false;
  try {
    providers = await listProviders("signing");
    const rows = await prisma.signatureRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { provider: true },
    });
    requests = rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      collaborationId: row.collaborationId,
      providerName: row.provider?.name ?? "Unassigned",
    }));
  } catch (error) {
    console.error("admin signing", error);
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Document signing</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Connect the signing API used after a collaboration is accepted. A queued request is not a signed document.
        It stays queued until the provider confirms the signature.
      </p>
      {params.saved ? <p className="mt-4 text-sm font-semibold text-emerald-700">Saved.</p> : null}
      {params.error ? <p className="mt-4 text-sm font-semibold text-amber-800">{params.error}</p> : null}
      {dbError ? <p className="mt-4 text-sm text-amber-800">The database is unavailable.</p> : null}

      <section className="mt-6 space-y-4">
        {providers.map((provider) => (
          <form key={provider.id} action={actionSaveSigningProvider} className="grid gap-3 rounded-2xl border border-[#E4EBFF] bg-white p-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={provider.id} />
            <input type="hidden" name="code" value={provider.code} />
            <label className="text-sm font-semibold text-indigo">
              Name
              <input name="name" defaultValue={provider.name} disabled={!canEdit} className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              Account id
              <input name="accountId" defaultValue={provider.publicKey} disabled={!canEdit} className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo sm:col-span-2">
              API base URL
              <input name="baseUrl" defaultValue={provider.baseUrl} placeholder="https://" disabled={!canEdit} className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              API secret ({provider.secret})
              <input name="secret" type="password" placeholder="Leave blank to keep" disabled={!canEdit} className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              Webhook secret ({provider.webhook})
              <input name="webhook" type="password" placeholder="Leave blank to keep" disabled={!canEdit} className={inputClass} />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
              <input type="checkbox" name="enabled" value="1" defaultChecked={provider.enabled} disabled={!canEdit} />
              Enabled
            </label>
            {canEdit ? <button type="submit" className="btn-primary w-fit">Save signing API</button> : null}
          </form>
        ))}
        {canEdit ? (
          <form action={actionSaveSigningProvider} className="grid gap-3 rounded-2xl border border-dashed border-[#E4EBFF] bg-white p-4 sm:grid-cols-2">
            <h2 className="font-display text-lg font-bold text-indigo sm:col-span-2">Add a signing API</h2>
            <label className="text-sm font-semibold text-indigo">
              Code
              <input name="code" required placeholder="docusign" className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              Name
              <input name="name" required placeholder="DocuSign" className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo sm:col-span-2">
              API base URL
              <input name="baseUrl" placeholder="https://" className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              Account id
              <input name="accountId" className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              API secret
              <input name="secret" type="password" className={inputClass} />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
              <input type="checkbox" name="enabled" value="1" />
              Enabled
            </label>
            <button type="submit" className="btn-secondary w-fit">Add signing API</button>
          </form>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold text-indigo">Requests</h2>
        <ul className="mt-3 space-y-2">
          {requests.map((request) => (
            <li key={request.id} className="rounded-2xl border border-[#E4EBFF] bg-white px-4 py-3 text-sm">
              <Link href={`/collaboration/records/${request.collaborationId}`} className="font-semibold text-indigo hover:text-violet">
                {request.title}
              </Link>
              <p className="text-muted">
                {request.status} · {request.providerName}
              </p>
            </li>
          ))}
          {requests.length === 0 && !dbError ? <li className="text-sm text-muted">No signature requests yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
