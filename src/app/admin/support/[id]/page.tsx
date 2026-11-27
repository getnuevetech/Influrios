import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/app/admin/guard";
import { actionStaffAssign, actionStaffNote, actionStaffReply, actionStaffStatus } from "@/app/admin/support/actions";
import { hasPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { ticketForStaff, ticketRef, ticketStatus, TICKET_STATUS_LABEL, TICKET_STATUSES } from "@/lib/support-tickets";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Support ticket" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ replied?: string; unsent?: string; noted?: string; status?: string; assigned?: string; error?: string }>;
};

const when = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago" }).format(date) + " CT";

const area = "mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal text-indigo";

export default async function AdminSupportTicketPage({ params, searchParams }: Props) {
  const session = await requireAdminPage("accounts");
  const canReply = hasPermission(session, "accounts.edit");
  const { id } = await params;
  const query = await searchParams;
  const ticket = await ticketForStaff(id);
  if (!ticket) notFound();
  const status = ticketStatus(ticket.status);
  const member = ticket.userId
    ? await prisma.user.findUnique({ where: { id: ticket.userId }, select: { email: true, role: true } }).catch(() => null)
    : null;
  const notice = query.error
    ? query.error
    : query.replied
      ? query.unsent
        ? "Reply saved on the ticket, but the email to the member could not be sent. Check Email settings."
        : "Reply sent to the member."
      : query.noted
        ? "Internal note added."
        : query.status
          ? "Status updated."
          : query.assigned
            ? "Assignment updated."
            : null;

  return (
    <div className="max-w-4xl space-y-5">
      <Link href="/admin/support" className="text-sm font-semibold text-violet hover:underline">
        ← Support tickets
      </Link>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-violet">{ticketRef(ticket.number)} · {ticket.topic}</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-indigo">{ticket.subject}</h1>
        <p className="mt-1 text-sm text-muted">
          {ticket.requesterName} &lt;{ticket.requesterEmail}&gt; · {member ? `member (${member.role.toLowerCase()})` : "visitor, not signed in"} · opened{" "}
          {when(ticket.createdAt)}
          {ticket.reference ? ` · Reference: ${ticket.reference}` : ""}
        </p>
      </div>
      {notice ? (
        <p role="status" className={`rounded-xl px-3 py-2 text-sm font-semibold ${query.error || query.unsent ? "bg-amber-50 text-amber-900" : "bg-[#EAF8F2] text-[#087B5A]"}`}>
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold text-indigo">Status: {TICKET_STATUS_LABEL[status]}</span>
        <span className="text-muted">· Assigned: {ticket.assignedTo || "nobody"}</span>
        {canReply ? (
          <>
            <form action={actionStaffStatus} className="flex items-center gap-2">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <select name="status" defaultValue={status} className="rounded-lg border border-border px-2 py-1.5 text-sm">
                {TICKET_STATUSES.map((row) => (
                  <option key={row} value={row}>
                    {TICKET_STATUS_LABEL[row]}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-secondary !py-1.5 text-sm">
                Set status
              </button>
            </form>
            <form action={actionStaffAssign}>
              <input type="hidden" name="ticketId" value={ticket.id} />
              <input type="hidden" name="assignee" value={ticket.assignedTo === session.email ? "" : "me"} />
              <button type="submit" className="text-sm font-semibold text-violet hover:underline">
                {ticket.assignedTo === session.email ? "Unassign me" : "Assign to me"}
              </button>
            </form>
          </>
        ) : null}
      </div>

      <ol className="space-y-3">
        {ticket.messages.map((message) => (
          <li
            key={message.id}
            className={`rounded-2xl border p-4 text-sm ${
              message.author === "note"
                ? "border-amber-200 bg-amber-50"
                : message.author === "staff"
                  ? "border-[#DCD3FF] bg-[#F6F3FF]"
                  : "border-border bg-white"
            }`}
          >
            <p className="text-xs font-semibold text-muted">
              {message.author === "note" ? `Internal note · ${message.authorName}` : message.author === "staff" ? `${message.authorName} · support` : ticket.requesterName}{" "}
              · {when(message.createdAt)}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-indigo">{message.body}</p>
          </li>
        ))}
      </ol>

      {canReply ? (
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <form action={actionStaffReply} className="card-surface space-y-3 p-4">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <label className="block text-xs font-semibold text-muted">
              Reply to {ticket.requesterName} (emailed and shown on their ticket page)
              <textarea name="body" required rows={6} maxLength={4000} className={area} />
            </label>
            <label className="block text-xs font-semibold text-muted">
              After sending, set status to
              <select name="status" defaultValue="waiting_on_member" className={area}>
                <option value="waiting_on_member">Waiting on member</option>
                <option value="resolved">Resolved</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <button type="submit" className="btn-primary w-fit text-sm">
              Send reply
            </button>
          </form>
          <form action={actionStaffNote} className="card-surface space-y-3 p-4">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <label className="block text-xs font-semibold text-muted">
              Internal note (staff only)
              <textarea name="body" required rows={6} maxLength={4000} className={area} />
            </label>
            <button type="submit" className="btn-secondary w-fit text-sm">
              Add note
            </button>
          </form>
        </div>
      ) : (
        <p className="text-sm text-muted">You can view tickets but not reply. Replying needs the &ldquo;accounts.edit&rdquo; permission.</p>
      )}
    </div>
  );
}
