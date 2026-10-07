import Link from "next/link";
import { actionAdvanceSignatureRequest, actionSaveSigningProvider } from "@/app/admin/signing/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { listProviders } from "@/lib/providers";
import { SIGNATURE_STATUSES, signingModeLabel } from "@/lib/signing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Document signing · Admin" };

const inputClass = "mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal";

function signingIdentity(provider?: { code: string; integrationKey: string; userId: string; publicKey: string; secret: string; baseUrl: string }) {
  if (!provider) return null;
  return {
    integrationKey: provider.integrationKey,
    userId: provider.userId,
    accountId: provider.publicKey,
    privateKey: provider.secret === "saved" ? "saved" : "",
    baseUrl: provider.baseUrl,
  };
}

type Props = { searchParams: Promise<{ saved?: string; error?: string; request?: string; status?: string }> };

export default async function AdminSigningPage({ searchParams }: Props) {
  const session = await requireAdminPage("signing");
  const canEdit = hasPermission(session, "signing.edit");
  const params = await searchParams;
  let providers: Awaited<ReturnType<typeof listProviders>> = [];
  let requests: {
    id: string;
    title: string;
    status: string;
    collaborationId: string;
    providerName: string;
    providerCode: string;
    externalId: string;
  }[] = [];
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
      providerCode: row.provider?.code ?? "",
      externalId: row.externalId,
    }));
  } catch (error) {
    console.error("admin signing", error);
    dbError = true;
  }

  const activeCode = providers.find((p) => p.enabled)?.code ?? providers[0]?.code ?? "";

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Document signing</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Enable DocuSign and save the integration key, user id, account id, RSA private key, and API base URL. Mode:{" "}
        <span className="font-semibold text-indigo">{signingModeLabel(activeCode, signingIdentity(providers.find((provider) => provider.enabled) ?? providers[0]))}</span>.
        An accepted collaboration sends the envelope with those saved credentials. Webhook:{" "}
        <code className="text-xs">POST /api/signing/webhook</code>.
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
              Integration key
              <input name="integrationKey" defaultValue={provider.integrationKey} disabled={!canEdit} className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              User id
              <input name="userId" defaultValue={provider.userId} disabled={!canEdit} className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              Account id
              <input name="accountId" defaultValue={provider.publicKey} disabled={!canEdit} className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              OAuth base URL
              <input name="oauthBaseUrl" defaultValue={provider.oauthBaseUrl} placeholder="https://account-d.docusign.com" disabled={!canEdit} className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo sm:col-span-2">
              API base URL
              <input name="baseUrl" defaultValue={provider.baseUrl} placeholder="https://demo.docusign.net" disabled={!canEdit} className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo sm:col-span-2">
              RSA private key ({provider.secret})
              <textarea name="secret" placeholder="Leave blank to keep" disabled={!canEdit} rows={4} className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              Webhook secret ({provider.webhook})
              <input name="webhook" type="password" placeholder="Leave blank to keep" disabled={!canEdit} className={inputClass} />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
              <input type="checkbox" name="enabled" value="1" defaultChecked={provider.enabled} disabled={!canEdit} />
              Enabled
            </label>
            <p className="text-xs text-muted sm:col-span-2">{signingModeLabel(provider.code, signingIdentity(provider))}</p>
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
              Integration key
              <input name="integrationKey" className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              User id
              <input name="userId" className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              Account id
              <input name="accountId" className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              OAuth base URL
              <input name="oauthBaseUrl" placeholder="https://account-d.docusign.com" className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo sm:col-span-2">
              RSA private key
              <textarea name="secret" rows={4} className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              Webhook secret
              <input name="webhook" type="password" className={inputClass} />
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
        <ul className="mt-3 space-y-3">
          {requests.map((request) => (
            <li key={request.id} className="rounded-2xl border border-[#E4EBFF] bg-white px-4 py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/collaboration/records/${request.collaborationId}`} className="font-semibold text-indigo hover:text-violet">
                    {request.title}
                  </Link>
                  <p className="text-muted">
                    {request.status} · {request.providerName}
                    {request.externalId ? ` · ${request.externalId}` : ""}
                  </p>
                  <p className="text-xs text-muted">{signingModeLabel(request.providerCode)}</p>
                </div>
                {canEdit && !["signed", "declined", "voided"].includes(request.status) ? (
                  <div className="flex flex-wrap gap-1">
                    {SIGNATURE_STATUSES.filter((s) => s !== request.status && s !== "signed").map((to) => (
                      <form key={to} action={actionAdvanceSignatureRequest}>
                        <input type="hidden" name="id" value={request.id} />
                        <input type="hidden" name="to" value={to} />
                        <button type="submit" className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold">
                          → {to}
                        </button>
                      </form>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
          {requests.length === 0 && !dbError ? <li className="text-sm text-muted">No signature requests yet. Send one after a collaboration is accepted.</li> : null}
        </ul>
      </section>
    </div>
  );
}
