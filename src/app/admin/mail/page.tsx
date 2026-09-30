import Link from "next/link";
import { actionSaveMailSettings, actionSendMailTest } from "@/app/admin/mail/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { mailSettingsView } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email · Admin" };

type Props = { searchParams: Promise<{ saved?: string; sent?: string; error?: string }> };

export default async function AdminMailPage({ searchParams }: Props) {
  const session = await requireAdminPage("mail");
  const canEdit = hasPermission(session, "mail.edit");
  const params = await searchParams;
  const settings = await mailSettingsView().catch(() => null);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Email</h1>
      <p className="mt-2 text-sm text-muted">
        SMTP settings live here. A test send uses the claim invitation template and reports success only after the
        server accepts the message. Sign in again if this page was forbidden after the permission was added.
      </p>
      {params.saved ? <p className="mt-4 text-sm font-semibold text-emerald-700">SMTP settings saved.</p> : null}
      {params.sent ? (
        <p className="mt-4 text-sm font-semibold text-emerald-700">SMTP accepted the claim invitation template.</p>
      ) : null}
      {params.error ? <p className="mt-4 text-sm text-amber-800">{params.error}</p> : null}
      {!settings ? <p className="mt-4 text-sm text-amber-800">Mail settings are unavailable.</p> : null}

      {settings ? (
        <form action={actionSaveMailSettings} className="card-surface mt-6 space-y-3 p-5">
          <label className="block text-sm">
            <span className="font-semibold text-indigo">Host</span>
            <input name="host" defaultValue={settings.host} disabled={!canEdit} className="mt-1 w-full rounded-xl border border-border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-indigo">Port</span>
            <input name="port" type="number" defaultValue={settings.port} disabled={!canEdit} className="mt-1 w-full rounded-xl border border-border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-indigo">Username</span>
            <input name="username" defaultValue={settings.username} disabled={!canEdit} className="mt-1 w-full rounded-xl border border-border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-indigo">From address</span>
            <input name="fromAddress" defaultValue={settings.fromAddress} disabled={!canEdit} className="mt-1 w-full rounded-xl border border-border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-indigo">Password</span>
            <input name="password" type="password" autoComplete="new-password" placeholder={settings.hasSecret ? "Saved. Leave blank to keep it." : "Not saved"} disabled={!canEdit} className="mt-1 w-full rounded-xl border border-border px-3 py-2" />
          </label>
          <label className="flex items-center gap-2 text-sm text-indigo">
            <input name="enabled" type="checkbox" defaultChecked={settings.enabled} disabled={!canEdit} />
            Enabled
          </label>
          <label className="flex items-center gap-2 text-sm text-indigo">
            <input name="clearSecret" type="checkbox" disabled={!canEdit} />
            Remove the saved password
          </label>
          <p className="text-xs text-muted">
            {settings.envConfigured
              ? `Environment SMTP is also set (${settings.envHost}). That path sends when this row is off.`
              : "No SMTP host is set in the environment. Mail stays unsent until this row is enabled or the environment is configured."}
          </p>
          <button type="submit" disabled={!canEdit} className="btn-primary !py-2 text-sm disabled:opacity-50">
            Save SMTP
          </button>
        </form>
      ) : null}

      <form action={actionSendMailTest} className="card-surface mt-4 space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Test send</h2>
        <p className="text-sm text-muted">
          Sends the claim invitation template to one address. If SMTP is not configured, nothing is sent.
        </p>
        <label className="block text-sm">
          <span className="font-semibold text-indigo">To</span>
          <input name="to" type="email" defaultValue={session.email} required disabled={!canEdit} className="mt-1 w-full rounded-xl border border-border px-3 py-2" />
        </label>
        <button type="submit" disabled={!canEdit} className="btn-secondary !py-2 text-sm disabled:opacity-50">
          Send test
        </button>
      </form>
    </div>
  );
}
