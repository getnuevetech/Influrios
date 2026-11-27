import Link from "next/link";
import { notFound } from "next/navigation";
import { actionReplyToTicket, actionResolveTicket } from "@/app/support/actions";
import { getAccountSession } from "@/lib/accounts";
import { ticketForRequester, ticketRef, ticketStatus, TICKET_STATUS_MEMBER_LABEL } from "@/lib/support-tickets";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support ticket", robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; opened?: string; replied?: string; resolved?: string; error?: string }>;
};

const when = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago" }).format(date) + " CT";

/** The requester's ticket: the conversation with support, a reply box and "this is solved". */
export default async function SupportTicketPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const account = await getAccountSession().catch(() => null);
  const ticket = await ticketForRequester(id, { token: query.t, userId: account?.id, email: account?.email });
  if (!ticket) notFound();
  const status = ticketStatus(ticket.status);
  const token = query.t ?? "";
  const closed = status === "closed";

  return (
    <div className="bg-[#F7FAFF]">
      <div className="mx-auto grid max-w-3xl gap-5 px-4 py-10 sm:px-6">
        <Link href="/support" className="text-sm font-semibold text-violet hover:underline">
          ← Support
        </Link>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-violet">Support ticket {ticketRef(ticket.number)}</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-indigo">{ticket.subject}</h1>
          <p className="mt-2 inline-flex rounded-full bg-[#EEF2FF] px-3 py-1 text-sm font-semibold text-indigo">
            {TICKET_STATUS_MEMBER_LABEL[status]}
          </p>
        </div>
        {query.opened ? (
          <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Your request is ticket {ticketRef(ticket.number)}. We emailed you a link to this page and will email you when we reply.
          </p>
        ) : null}
        {query.replied ? (
          <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Reply added. Our team has been notified.
          </p>
        ) : null}
        {query.resolved ? (
          <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Marked as resolved. Reply below if you need anything else.
          </p>
        ) : null}
        {query.error ? (
          <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {query.error}
          </p>
        ) : null}

        <ol className="grid gap-3">
          {ticket.messages.map((message) => {
            const staff = message.author === "staff";
            return (
              <li
                key={message.id}
                className={`rounded-2xl border p-4 text-sm ${staff ? "border-[#DCD3FF] bg-[#F6F3FF]" : "border-[#E6ECF7] bg-white"}`}
              >
                <p className="text-xs font-semibold text-muted">
                  {staff ? `${message.authorName} · Influrios support` : "You"} · {when(message.createdAt)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-indigo">{message.body}</p>
              </li>
            );
          })}
        </ol>

        {closed ? (
          <p className="text-sm text-muted">
            This ticket is closed. <Link href="/support" className="font-semibold text-violet hover:underline">Open a new request</Link> if you need more help.
          </p>
        ) : (
          <form action={actionReplyToTicket} className="card-surface grid gap-3 p-5">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <input type="hidden" name="t" value={token} />
            <label className="text-sm font-semibold text-indigo">
              Reply
              <textarea
                name="body"
                required
                maxLength={4000}
                rows={5}
                className="mt-1 w-full rounded-xl border border-[#E4EBFF] bg-white px-3 py-2.5 text-sm font-normal text-indigo outline-none focus:border-violet"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="inline-flex h-11 items-center rounded-full bg-violet px-5 text-sm font-semibold text-white">
                Send reply
              </button>
            </div>
          </form>
        )}
        {!closed && status !== "resolved" ? (
          <form action={actionResolveTicket}>
            <input type="hidden" name="ticketId" value={ticket.id} />
            <input type="hidden" name="t" value={token} />
            <button type="submit" className="text-sm font-semibold text-muted underline hover:text-indigo">
              My question is answered — mark as resolved
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
