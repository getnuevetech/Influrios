import Link from "next/link";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { EMAIL_GROUP_LABELS } from "@/lib/email-catalog";
import { listEmailTemplateRows, listRecentEmailDeliveries, loadEmailTemplateEditor } from "@/lib/email-templates";
import { EmailTemplateDialog } from "@/components/email-template-dialog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email templates · Admin" };

function chicago(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function hrefFor(query: { q?: string; group?: string; template?: string }) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.group) params.set("group", query.group);
  if (query.template) params.set("template", query.template);
  const text = params.toString();
  return text ? `/admin/mail/templates?${text}` : "/admin/mail/templates";
}

export default async function EmailTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; group?: string; template?: string; saved?: string; error?: string }>;
}) {
  const session = await requireAdminPage("mail");
  const canEdit = hasPermission(session, "mail.edit");
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const group = params.group ?? "";
  const rows = await listEmailTemplateRows({ q, group });
  const editor = params.template ? await loadEmailTemplateEditor(params.template) : null;
  const deliveries = await listRecentEmailDeliveries();
  const closeHref = hrefFor({ q, group });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link href="/admin/mail" className="text-sm font-semibold text-violet hover:underline">
          ← Email settings
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Email templates</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          These 79 messages are the catalog. Every one starts off. A draft, a publish, and a test stay inside this page.
          Live account, invitation, and collaboration emails keep their current copy until a category is switched.
        </p>
      </div>
      {params.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{params.error}</p>
      ) : null}
      {params.saved === "draft" ? <p className="text-sm font-semibold text-emerald-700">Draft saved. Nothing was sent.</p> : null}
      {params.saved === "published" ? (
        <p className="text-sm font-semibold text-emerald-700">Version published. Live mail is unchanged.</p>
      ) : null}
      {params.saved === "restored" ? <p className="text-sm font-semibold text-emerald-700">Earlier version restored. Live mail is unchanged.</p> : null}
      {params.saved === "test" ? (
        <p className="text-sm font-semibold text-emerald-700">Test sent to the address you entered. Live mail is unchanged.</p>
      ) : null}

      <form className="flex flex-wrap items-end gap-3" action="/admin/mail/templates">
        <label className="text-sm font-semibold text-indigo">
          Search
          <input name="q" defaultValue={q} className="mt-1 block rounded-xl border border-border px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-semibold text-indigo">
          Category
          <select name="group" defaultValue={group} className="mt-1 block rounded-xl border border-border px-3 py-2 font-normal">
            <option value="">All</option>
            {Object.entries(EMAIL_GROUP_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-full bg-[#5836D6] px-4 py-2 text-sm font-bold text-white">
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#F4F5FB] text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Audience</th>
              <th className="px-3 py-2 font-semibold">Category</th>
              <th className="px-3 py-2 font-semibold">Live event</th>
              <th className="px-3 py-2 font-semibold">Version</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Last published</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <Link href={hrefFor({ q, group, template: row.id })} scroll={false} className="font-semibold text-[#5836D6] hover:underline">
                    {row.title}
                  </Link>
                  <div className="text-xs text-muted">{row.id}</div>
                </td>
                <td className="px-3 py-2">{row.audience}</td>
                <td className="px-3 py-2">{row.category}</td>
                <td className="px-3 py-2">{row.trigger}</td>
                <td className="px-3 py-2">{row.version}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">{row.status.startsWith("Published") ? chicago(row.updatedAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-indigo">Delivery log</h2>
        <p className="text-sm text-muted">Recent mail jobs. Verification and reset codes stay out of this list.</p>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F4F5FB] text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">When</th>
                <th className="px-3 py-2 font-semibold">Kind</th>
                <th className="px-3 py-2 font-semibold">To</th>
                <th className="px-3 py-2 font-semibold">Subject</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-muted" colSpan={5}>
                    No mail jobs yet.
                  </td>
                </tr>
              ) : (
                deliveries.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2">{chicago(row.at)}</td>
                    <td className="px-3 py-2">{row.kind}</td>
                    <td className="px-3 py-2">{row.to}</td>
                    <td className="px-3 py-2">
                      {row.subject}
                      {row.error ? <div className="text-xs text-rose-700">{row.error}</div> : null}
                    </td>
                    <td className="px-3 py-2">{row.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editor ? (
        <EmailTemplateDialog
          template={editor.template}
          copy={editor.copy}
          status={editor.status}
          history={editor.history.map((row) => ({
            ...row,
            updatedAtLabel: chicago(row.updatedAt),
          }))}
          closeHref={closeHref}
          canEdit={canEdit}
          query={{ q, group }}
        />
      ) : null}
    </div>
  );
}
