import Link from "next/link";
import { actionSaveEmailCategorySwitches } from "@/app/admin/mail/health/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { emailGroupLabel } from "@/lib/email-catalog";
import { listEmailCategorySwitches, listEmailPauses } from "@/lib/email-live";
import { mailSettingsView } from "@/lib/mail";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email health · Admin" };

export default async function EmailHealthPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await requireAdminPage("mail");
  const canEdit = hasPermission(session, "mail.edit");
  const params = await searchParams;
  const [settings, switches, pauses, failed] = await Promise.all([
    mailSettingsView().catch(() => null),
    listEmailCategorySwitches(),
    listEmailPauses(),
    prisma.job.count({
      where: { status: "failed", kind: { in: ["catalog_email", "collab_notification", "verification_email", "password_reset_email", "invitation_email", "mail_test"] } },
    }).catch(() => 0),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/mail" className="text-sm font-semibold text-violet hover:underline">
          ← Email settings
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Email health</h1>
        <p className="mt-2 text-sm text-muted">
          SMTP, category switches, and paused templates. A category that is on sends the catalog. A category that is off keeps the older plain-text sender. Pausing an essential template stops that message.
        </p>
      </div>
      {params.saved ? <p className="text-sm font-semibold text-emerald-700">Category switches saved.</p> : null}
      <section className="rounded-2xl border border-border p-4 text-sm">
        <h2 className="font-display text-lg font-bold text-indigo">Provider</h2>
        <p className="mt-2">{settings?.ready ? `SMTP is ready (${settings.readySource}).` : settings?.readyError || "SMTP is not ready. Nothing is sent."}</p>
        <p className="mt-1 text-muted">From name: {settings?.fromName || "Address only"}</p>
        <p className="mt-1 text-muted">Failed mail jobs: {failed}</p>
      </section>
      <section className="rounded-2xl border border-border p-4">
        <h2 className="font-display text-lg font-bold text-indigo">Paused templates</h2>
        {pauses.length === 0 ? <p className="mt-2 text-sm text-muted">None paused.</p> : null}
        <ul className="mt-2 space-y-2 text-sm">
          {pauses.map((row) => (
            <li key={row.templateKey}>
              <span className="font-semibold text-indigo">{row.templateKey}</span>
              <span className="text-muted"> — {row.reason}</span>
            </li>
          ))}
        </ul>
      </section>
      {canEdit ? (
        <form action={actionSaveEmailCategorySwitches} className="space-y-3 rounded-2xl border border-border p-4">
          <h2 className="font-display text-lg font-bold text-indigo">Live catalog categories</h2>
          {switches.map((row) => (
            <label key={row.key} className="flex items-center gap-2 text-sm text-indigo">
              <input name={row.key} type="checkbox" defaultChecked={row.enabled} />
              {emailGroupLabel(row.key)}
            </label>
          ))}
          <button type="submit" className="rounded-full bg-[#5836D6] px-4 py-2 text-sm font-bold text-white">
            Save switches
          </button>
        </form>
      ) : null}
    </div>
  );
}
