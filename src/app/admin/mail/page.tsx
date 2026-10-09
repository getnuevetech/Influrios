import Link from "next/link";
import {
  actionDeleteCommTemplate,
  actionSaveCommChannels,
  actionSaveCommTemplate,
  actionSaveMailSettings,
  actionSendCommTemplate,
  actionSendMailTest,
} from "@/app/admin/mail/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { AdminCollapse } from "@/components/admin-collapse";
import { hasPermission } from "@/lib/admin-auth";
import {
  COMM_AUDIENCES,
  COMM_MODES,
  COMM_TEMPLATE_VARIABLES,
  COMM_TRIGGERS,
  SMS_BODY_MAX,
  getCommChannelSettings,
  listCommTemplates,
} from "@/lib/comm-templates";
import { mailSettingsView } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email · Admin" };

type Props = { searchParams: Promise<{ saved?: string; sent?: string; removed?: string; error?: string }> };

export default async function AdminMailPage({ searchParams }: Props) {
  const session = await requireAdminPage("mail");
  const canEdit = hasPermission(session, "mail.edit");
  const params = await searchParams;
  const settings = await mailSettingsView().catch(() => null);
  const channels = await getCommChannelSettings().catch(() => ({
    emailEnabled: true,
    smsEnabled: false,
  }));
  const templates = await listCommTemplates().catch(() => []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Email</h1>
        <p className="mt-2 text-sm text-muted">
          Configure SMTP and manage auto/manual templates. Each template can keep a short SMS body (max {SMS_BODY_MAX}{" "}
          characters) for a later provider. SMS is not sent.
        </p>
      </div>

      {params.saved ? <p className="text-sm font-semibold text-emerald-700">Saved.</p> : null}
      {params.sent ? <p className="text-sm font-semibold text-emerald-700">Test send accepted.</p> : null}
      {params.removed ? <p className="text-sm font-semibold text-emerald-700">Template removed.</p> : null}
      {params.error ? <p className="text-sm font-semibold text-amber-800">{params.error}</p> : null}

      <AdminCollapse title="SMTP settings" subtitle={settings?.enabled ? "Enabled" : "Disabled"} defaultOpen>
        {!settings ? (
          <p className="text-sm text-amber-800">Mail settings are unavailable.</p>
        ) : (
          <form action={actionSaveMailSettings} className="space-y-3">
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
            {canEdit ? (
              <button type="submit" className="btn-primary !py-2 text-sm">
                Save SMTP
              </button>
            ) : null}
          </form>
        )}
      </AdminCollapse>

      <AdminCollapse title="Test SMTP (claim invitation)" subtitle="Uses the invitation template" defaultOpen>
        <form action={actionSendMailTest} className="space-y-3">
          <p className="text-sm text-muted">
            Sends the claim invitation template to one address. Preview labels fill the name, expiry, and profile, and
            the link is this site. The message does not claim a profile. If SMTP is not configured, you will see an
            error after submit — the button stays clickable when you have edit access.
          </p>
          <label className="block text-sm">
            <span className="font-semibold text-indigo">To</span>
            <input
              name="to"
              type="email"
              defaultValue={session.email}
              required
              readOnly={!canEdit}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2"
            />
          </label>
          {canEdit ? (
            <button type="submit" className="btn-primary !py-2 text-sm">
              Send test
            </button>
          ) : (
            <p className="text-xs text-muted">You need mail.edit permission to send a test.</p>
          )}
        </form>
      </AdminCollapse>

      <AdminCollapse
        title="Communication channels"
        subtitle={`Email ${channels.emailEnabled ? "on" : "off"} · SMS off`}
        defaultOpen
      >
        <form action={actionSaveCommChannels} className="space-y-3">
          <p className="text-sm text-muted">
            Email is sent through SMTP when this channel is on. SMS is not sent.
          </p>
          <label className="flex items-center gap-2 text-sm text-indigo">
            <input name="emailEnabled" type="checkbox" defaultChecked={channels.emailEnabled} disabled={!canEdit} />
            Email enabled
          </label>
          {canEdit ? (
            <button type="submit" className="btn-secondary !py-2 text-sm">
              Save channels
            </button>
          ) : null}
        </form>
      </AdminCollapse>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-bold text-indigo">Templates</h2>
          <p className="mt-1 text-sm text-muted">
            Variables:{" "}
            {COMM_TEMPLATE_VARIABLES.map((v) => `{{${v.key}}}`).join(", ")}
          </p>
        </div>

        {templates.map((template) => (
          <AdminCollapse
            key={template.id}
            title={template.name}
            subtitle={`${template.mode} · ${template.audience} · ${template.triggerKey}${template.active ? "" : " · inactive"}`}
          >
            <form action={actionSaveCommTemplate} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={template.id} />
              <input type="hidden" name="key" value={template.key} />
              <label className="text-sm font-semibold text-indigo">
                Name
                <input name="name" defaultValue={template.name} disabled={!canEdit} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-semibold text-indigo">
                Trigger
                <select name="triggerKey" defaultValue={template.triggerKey} disabled={!canEdit} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal">
                  {COMM_TRIGGERS.map((trigger) => (
                    <option key={trigger.key} value={trigger.key}>
                      {trigger.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-indigo">
                Audience
                <select name="audience" defaultValue={template.audience} disabled={!canEdit} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal">
                  {COMM_AUDIENCES.map((audience) => (
                    <option key={audience} value={audience}>
                      {audience}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-indigo">
                Mode
                <select name="mode" defaultValue={template.mode} disabled={!canEdit} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal">
                  {COMM_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-indigo sm:col-span-2">
                Email subject
                <input name="subject" defaultValue={template.subject} disabled={!canEdit} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-semibold text-indigo sm:col-span-2">
                Email body
                <textarea name="bodyEmail" defaultValue={template.bodyEmail} disabled={!canEdit} rows={5} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-semibold text-indigo sm:col-span-2">
                SMS body (stored, not sent, max {SMS_BODY_MAX} chars)
                <textarea name="bodySms" defaultValue={template.bodySms} disabled={!canEdit} rows={2} maxLength={SMS_BODY_MAX} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
              </label>
              <label className="flex items-center gap-2 text-sm text-indigo">
                <input name="active" type="checkbox" defaultChecked={template.active} disabled={!canEdit} />
                Active
              </label>
              <input type="hidden" name="sortOrder" value={template.sortOrder} />
              {canEdit ? (
                <button type="submit" className="btn-primary w-fit !py-2 text-sm">
                  Save template
                </button>
              ) : null}
            </form>
            {canEdit ? (
              <div className="mt-4 space-y-3 border-t border-[#E4EBFF] pt-3">
                <p className="text-xs text-muted">
                  Send email uses preview labels and this address. It does not issue a code or open a collaboration.
                </p>
                <form action={actionSendCommTemplate} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="templateId" value={template.id} />
                  <input type="hidden" name="channel" value="email" />
                  <label className="text-xs font-semibold text-indigo">
                    Email to
                    <input name="to" type="email" defaultValue={session.email} className="mt-1 block rounded-lg border border-border px-2 py-1.5" />
                  </label>
                  <button type="submit" className="btn-secondary !py-1.5 text-xs">
                    Send email
                  </button>
                </form>
                <form action={actionDeleteCommTemplate}>
                  <input type="hidden" name="id" value={template.id} />
                  <button type="submit" className="text-xs font-semibold text-amber-800 hover:underline">
                    Remove template
                  </button>
                </form>
              </div>
            ) : null}
          </AdminCollapse>
        ))}

        {canEdit ? (
          <AdminCollapse title="Add custom template" subtitle="Manual or auto">
            <form action={actionSaveCommTemplate} className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-indigo">
                Key
                <input name="key" required placeholder="seasonal_promo" className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-semibold text-indigo">
                Name
                <input name="name" required placeholder="Seasonal promo" className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-semibold text-indigo">
                Audience
                <select name="audience" defaultValue="all" className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal">
                  {COMM_AUDIENCES.map((audience) => (
                    <option key={audience} value={audience}>
                      {audience}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-indigo">
                Mode
                <select name="mode" defaultValue="manual" className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal">
                  {COMM_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-indigo sm:col-span-2">
                Trigger
                <select name="triggerKey" defaultValue="custom" className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal">
                  {COMM_TRIGGERS.map((trigger) => (
                    <option key={trigger.key} value={trigger.key}>
                      {trigger.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-indigo sm:col-span-2">
                Email subject
                <input name="subject" className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-semibold text-indigo sm:col-span-2">
                Email body
                <textarea name="bodyEmail" rows={4} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-semibold text-indigo sm:col-span-2">
                SMS body (stored, not sent)
                <textarea name="bodySms" rows={2} maxLength={SMS_BODY_MAX} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
              </label>
              <label className="flex items-center gap-2 text-sm text-indigo">
                <input name="active" type="checkbox" defaultChecked />
                Active
              </label>
              <button type="submit" className="btn-secondary w-fit !py-2 text-sm">
                Add template
              </button>
            </form>
          </AdminCollapse>
        ) : null}
      </section>
    </div>
  );
}
