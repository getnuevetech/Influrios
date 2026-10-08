import Link from "next/link";
import { headers } from "next/headers";
import {
  actionAddSuppression,
  actionCopyInvitationLink,
  actionCreateInvitation,
  actionQueueInvitation,
  actionRemoveSuppression,
  actionSaveCampaign,
  actionSaveInvitationSettings,
  actionSaveInvitationTemplate,
} from "@/app/admin/invitations/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { getDirectory } from "@/lib/directory";
import { loadInvitationAdmin } from "@/lib/invitations";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invitations" };

const inputClass = "mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal";

export default async function AdminInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await requireAdminPage("invitations");
  const canEdit = hasPermission(session, "invitations.edit");
  const params = await searchParams;
  const directory = await getDirectory();
  const data = await loadInvitationAdmin().catch(() => null);
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const proto = headerStore.get("x-forwarded-proto") || "http";
  const origin = host ? `${proto}://${host}` : "";

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Invitations</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Invite a directory profile with a private claim link. Email delivery stays off until SMTP is configured, so the
        working step is to copy the link.
      </p>
      {params.saved ? <p className="mt-4 text-sm font-semibold text-emerald-700">Saved.</p> : null}
      {params.error ? <p className="mt-4 text-sm font-semibold text-amber-800">{params.error}</p> : null}
      {!data ? (
        <p className="mt-4 text-sm text-amber-800">The database is unavailable, so invitations cannot be saved yet.</p>
      ) : null}

      {data ? (
        <>
          <form action={actionSaveInvitationSettings} className="mt-6 grid gap-3 rounded-2xl border border-[#E4EBFF] bg-white p-5 sm:grid-cols-2">
            <h2 className="font-display text-lg font-bold text-indigo sm:col-span-2">Timing</h2>
            <label className="block text-sm font-semibold text-indigo">
              Days until the link expires
              <input name="defaultExpiryDays" type="number" min={1} max={365} defaultValue={data.settings.defaultExpiryDays} disabled={!canEdit} className={inputClass} />
            </label>
            <label className="block text-sm font-semibold text-indigo">
              Follow-up after days
              <input name="defaultFollowUpDays" type="number" min={1} max={365} defaultValue={data.settings.defaultFollowUpDays} disabled={!canEdit} className={inputClass} />
            </label>
            {canEdit ? <button type="submit" className="btn-primary sm:col-span-2 w-fit">Save timing</button> : null}
          </form>

          <form action={actionCreateInvitation} className="mt-6 space-y-3 rounded-2xl border border-[#E4EBFF] bg-white p-5">
            <h2 className="font-display text-lg font-bold text-indigo">Invite a profile</h2>
            <label className="block text-sm font-semibold text-indigo">
              Profile
              <select name="slug" required disabled={!canEdit} className={inputClass} defaultValue={directory.creators[0]?.slug}>
                {directory.creators.map((creator) => (
                  <option key={creator.slug} value={creator.slug}>
                    {creator.displayName} ({creator.slug})
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-indigo">
                Template
                <select name="templateId" required disabled={!canEdit} className={inputClass}>
                  {data.templates.filter((template) => template.active).map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-indigo">
                Campaign
                <select name="campaignId" required disabled={!canEdit} className={inputClass}>
                  {data.campaigns.filter((campaign) => campaign.active).map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-indigo">
                Email (optional until SMTP)
                <input name="email" type="email" disabled={!canEdit} className={inputClass} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-semibold text-indigo">
                  Expires in days
                  <input name="expiryDays" type="number" min={1} defaultValue={data.settings.defaultExpiryDays} disabled={!canEdit} className={inputClass} />
                </label>
                <label className="block text-sm font-semibold text-indigo">
                  Follow-up in days
                  <input name="followUpDays" type="number" min={1} defaultValue={data.settings.defaultFollowUpDays} disabled={!canEdit} className={inputClass} />
                </label>
              </div>
            </div>
            {canEdit ? <button type="submit" className="btn-primary">Queue invitation</button> : null}
          </form>

          <h2 className="mt-10 font-display text-lg font-bold text-indigo">Pipeline</h2>
          <div className="mt-3 space-y-3">
            {data.invitations.length === 0 ? <p className="text-sm text-muted">No invitations yet.</p> : null}
            {data.invitations.map((invitation) => {
              const link = `${origin}/invite/${invitation.token}`;
              const followUpDue = invitation.followUpAt && invitation.followUpAt.getTime() < Date.now() && (invitation.status === "queued" || invitation.status === "opened");
              return (
                <article key={invitation.id} className="rounded-2xl border border-[#E4EBFF] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-indigo">{invitation.displayName}</p>
                      <p className="text-sm text-muted">
                        {invitation.creatorSlug} · {invitation.campaign?.name || "No campaign"} · {invitation.template.name}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-violet">
                        {invitation.status}
                        {followUpDue ? " · follow-up due" : ""}
                      </p>
                    </div>
                    <form action={actionQueueInvitation}>
                      <input type="hidden" name="id" value={invitation.id} />
                      <button type="submit" disabled={!canEdit || !data.smtp} className="rounded-xl border border-[#E4EBFF] px-3 py-2 text-sm font-semibold text-muted disabled:cursor-not-allowed">
                        Send email
                      </button>
                    </form>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {data.smtp ? "SMTP is configured. The invite is marked delivered only after SMTP accepts the message." : "Email send is inactive until SMTP is configured."}
                  </p>
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Claim link</p>
                    <a href={link} className="mt-1 block break-all text-sm font-semibold text-violet">
                      {link}
                    </a>
                  </div>
                  {canEdit ? (
                    <form action={actionCopyInvitationLink} className="mt-2">
                      <input type="hidden" name="id" value={invitation.id} />
                      <button type="submit" className="text-sm font-semibold text-violet">Record that the link was copied</button>
                    </form>
                  ) : null}
                  {invitation.events.length ? (
                    <ul className="mt-3 space-y-1 text-xs text-muted">
                      {invitation.events.map((event) => (
                        <li key={event.id}>{event.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {event.kind}{event.actor ? ` · ${event.actor}` : ""}</li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              );
            })}
          </div>

          <h2 className="mt-10 font-display text-lg font-bold text-indigo">Templates</h2>
          <p className="mt-1 text-sm text-muted">Placeholders: {"{{name}}"}, {"{{profile}}"}, {"{{link}}"}, {"{{expiry}}"}.</p>
          <div className="mt-3 space-y-3">
            {data.templates.map((template) => (
              <form key={template.id} action={actionSaveInvitationTemplate} className="space-y-3 rounded-2xl border border-[#E4EBFF] bg-white p-4">
                <input type="hidden" name="id" value={template.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-indigo">Name<input name="name" defaultValue={template.name} disabled={!canEdit} className={inputClass} /></label>
                  <label className="block text-sm font-semibold text-indigo">Subject<input name="subject" defaultValue={template.subject} disabled={!canEdit} className={inputClass} /></label>
                </div>
                <label className="block text-sm font-semibold text-indigo">Body<textarea name="body" rows={3} defaultValue={template.body} disabled={!canEdit} className={inputClass} /></label>
                <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
                  <input type="checkbox" name="active" value="1" defaultChecked={template.active} disabled={!canEdit} /> Active
                </label>
                {canEdit ? <button type="submit" className="rounded-xl border border-[#E4EBFF] px-3 py-2 text-sm font-semibold text-indigo">Save template</button> : null}
              </form>
            ))}
            {canEdit ? (
              <form action={actionSaveInvitationTemplate} className="space-y-3 rounded-2xl border border-dashed border-[#C9D4FF] bg-white p-4">
                <p className="text-sm font-semibold text-indigo">New template</p>
                <input name="name" placeholder="Name" className="w-full rounded-xl border border-border px-3 py-2" />
                <input name="subject" placeholder="Subject" className="w-full rounded-xl border border-border px-3 py-2" />
                <textarea name="body" rows={3} placeholder="Hi {{name}}..." className="w-full rounded-xl border border-border px-3 py-2" />
                <button type="submit" className="text-sm font-semibold text-violet">Add template</button>
              </form>
            ) : null}
          </div>

          <h2 className="mt-10 font-display text-lg font-bold text-indigo">Campaigns</h2>
          <ul className="mt-2 space-y-1 text-sm text-indigo">
            {data.campaigns.map((campaign) => (
              <li key={campaign.id}>{campaign.name}{campaign.active ? "" : " (inactive)"}</li>
            ))}
          </ul>
          {canEdit ? (
            <form action={actionSaveCampaign} className="mt-3 flex gap-2">
              <input name="name" placeholder="New campaign" className="flex-1 rounded-xl border border-border px-3 py-2" />
              <button type="submit" className="rounded-xl border border-[#E4EBFF] px-3 py-2 text-sm font-semibold text-indigo">Add</button>
            </form>
          ) : null}

          <h2 className="mt-10 font-display text-lg font-bold text-indigo">Do not contact</h2>
          <form action={actionAddSuppression} className="mt-3 grid gap-3 rounded-2xl border border-[#E4EBFF] bg-white p-4 sm:grid-cols-4">
            <select name="kind" disabled={!canEdit} className="rounded-xl border border-border px-3 py-2">
              <option value="slug">Profile slug</option>
              <option value="email">Email</option>
            </select>
            <input name="value" placeholder="profile slug or email" disabled={!canEdit} className="rounded-xl border border-border px-3 py-2 sm:col-span-2" />
            <input name="reason" placeholder="Reason" disabled={!canEdit} className="rounded-xl border border-border px-3 py-2" />
            {canEdit ? <button type="submit" className="btn-primary w-fit sm:col-span-4">Suppress</button> : null}
          </form>
          <ul className="mt-3 space-y-2">
            {data.suppressions.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 text-sm text-indigo">
                <span>{row.kind}: {row.value}{row.reason ? ` — ${row.reason}` : ""}</span>
                {canEdit ? (
                  <form action={actionRemoveSuppression}>
                    <input type="hidden" name="id" value={row.id} />
                    <button type="submit" className="font-semibold text-violet">Remove</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
