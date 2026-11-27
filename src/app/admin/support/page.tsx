import Link from "next/link";
import { requireAdminPage } from "@/app/admin/guard";
import { listTicketsForStaff, ticketRef, ticketStatus, TICKET_STATUS_LABEL, TICKET_STATUSES } from "@/lib/support-tickets";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Support tickets" };

type Props = { searchParams: Promise<{ status?: string; q?: string }> };

const ago = (date: Date) => {
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const TONE: Record<string, string> = {
  open: "bg-[#FFF4E5] text-[#9A5B00]",
  waiting_on_member: "bg-[#EEF2FF] text-indigo",
  resolved: "bg-[#EAF7EF] text-[#146C3A]",
  closed: "bg-[#F2F4F7] text-muted",
};

export default async function AdminSupportPage({ searchParams }: Props) {
  await requireAdminPage("support");
  const params = await searchParams;
  const status = params.status === "all" ? "all" : params.status ? ticketStatus(params.status) : "open";
  const { rows, countByStatus } = await listTicketsForStaff({ status, q: params.q });
  const total = Object.values(countByStatus).reduce((sum, n) => sum + (n ?? 0), 0);
  const tabs: { id: string; label: string; count: number }[] = [
    ...TICKET_STATUSES.map((id) => ({ id, label: TICKET_STATUS_LABEL[id], count: countByStatus[id] ?? 0 })),
    { id: "all", label: "All", count: total },
  ];
  const href = (id: string) => `/admin/support?status=${id}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-indigo">Support tickets</h1>
        <p className="mt-1 text-sm text-muted">
          Requests from the support page. Replies are emailed to the member and shown on their ticket page. New tickets and member
          replies notify the support address set under{" "}
          <Link href="/admin/mail" className="font-semibold text-violet hover:underline">
            Email → Support contact
          </Link>
          .
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={href(tab.id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${status === tab.id ? "border-violet bg-violet text-white" : "border-border text-indigo"}`}
          >
            {tab.label} · {tab.count}
          </Link>
        ))}
        <form className="ml-auto flex gap-2" action="/admin/support">
          <input type="hidden" name="status" value={status} />
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="S-1001, email, name or subject"
            className="w-64 rounded-lg border border-border px-3 py-1.5 text-sm"
          />
          <button type="submit" className="btn-secondary !py-1.5 text-sm">
            Search
          </button>
        </form>
      </div>
      <div className="card-surface overflow-x-auto">
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-muted">No tickets here.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last update</th>
                <th className="px-4 py-3">Assigned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEEFF5]">
              {rows.map((row) => {
                const last = row.messages[0];
                return (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link href={`/admin/support/${row.id}`} className="font-semibold text-violet hover:underline">
                        {ticketRef(row.number)} · {row.subject}
                      </Link>
                      {last ? (
                        <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-muted">
                          {last.author === "staff" ? "Support: " : last.author === "note" ? "Note: " : ""}
                          {last.body}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {row.requesterName}
                      <span className="block text-xs text-muted">
                        {row.requesterEmail}
                        {row.userId ? " · member" : " · visitor"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[row.status] ?? TONE.closed}`}>
                        {TICKET_STATUS_LABEL[ticketStatus(row.status)]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{ago(row.lastActivityAt)}</td>
                    <td className="px-4 py-3 text-muted">{row.assignedTo || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
