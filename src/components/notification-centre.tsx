import Link from "next/link";
import { listAccountNotices, markNoticeRead } from "@/lib/account-notices";

type Filter = "all" | "action" | "updates";

function isAction(title: string, kind: string) {
  return /invit|sign|revision|payout|fund|deliver/i.test(`${kind} ${title}`);
}

function when(value: Date) {
  const minutes = Math.round((Date.now() - value.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

export async function NotificationCentre({
  userId,
  basePath,
  filter,
  openId,
}: {
  userId: string;
  basePath: string;
  filter: Filter;
  openId?: string;
}) {
  const notices = await listAccountNotices(userId).catch(() => []);
  const open = openId ? notices.find((row) => row.id === openId) ?? null : null;
  const destination = open ? await markNoticeRead(userId, open.id).catch(() => open.href) : null;
  const rows = notices.filter((row) => {
    if (filter === "action") return isAction(row.title, row.kind);
    if (filter === "updates") return !isAction(row.title, row.kind);
    return true;
  });
  const actionCount = notices.filter((row) => isAction(row.title, row.kind)).length;
  const updateCount = notices.length - actionCount;
  const href = (nextFilter: Filter, id?: string) => {
    const params = new URLSearchParams();
    if (nextFilter !== "all") params.set("filter", nextFilter);
    if (id) params.set("open", id);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="font-display text-3xl font-bold text-[#1B1464]">Notification centre</h1>
        <p className="mt-1 text-sm text-[#667085]">
          Unread and action required are different. Opening a notice marks it read and does not complete the task.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-sm font-semibold">
        <Link href={href("all")} className={`rounded-full px-3 py-1.5 ${filter === "all" ? "bg-[#F3EEFF] text-[#6D4AFF]" : "bg-white text-[#667085]"}`}>All ({notices.length})</Link>
        <Link href={href("action")} className={`rounded-full px-3 py-1.5 ${filter === "action" ? "bg-[#F3EEFF] text-[#6D4AFF]" : "bg-white text-[#667085]"}`}>Action required ({actionCount})</Link>
        <Link href={href("updates")} className={`rounded-full px-3 py-1.5 ${filter === "updates" ? "bg-[#F3EEFF] text-[#6D4AFF]" : "bg-white text-[#667085]"}`}>Updates ({updateCount})</Link>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-[#E7ECF5] bg-white p-5 text-sm text-[#667085]">Nothing in this filter.</p>
      ) : (
        <ul className="divide-y divide-[#EEF2F7] rounded-2xl border border-[#E7ECF5] bg-white">
          {rows.map((row) => {
            const action = isAction(row.title, row.kind);
            const read = Boolean(row.readAt) || row.id === openId;
            return (
              <li key={row.id}>
                <Link href={href(filter, row.id)} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-[#F8F6FF]">
                  <span>
                    <span className="block text-sm font-semibold text-[#1B1464]">{row.title}</span>
                    <span className="text-xs text-[#667085]">{row.detail}</span>
                  </span>
                  <span className="text-right text-[11px] font-semibold">
                    <span className={`block ${read ? "text-[#98A2B3]" : "text-[#6D4AFF]"}`}>{read ? "Read" : "Unread"}</span>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 ${action ? "bg-amber-50 text-amber-800" : "bg-[#F4F6FB] text-[#667085]"}`}>
                      {action ? "Action required" : "Update"}
                    </span>
                    <span className="mt-1 block font-normal text-[#98A2B3]">{when(row.createdAt)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {open && destination ? (
        <div className="fixed inset-0 z-50">
          <Link href={href(filter)} aria-label="Close notification" className="absolute inset-0 bg-[#1B1464]/40" />
          <div role="dialog" aria-modal="true" aria-labelledby="notice-title" className="absolute left-1/2 top-1/2 w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-white p-6 shadow-2xl">
            <h2 id="notice-title" className="font-display text-2xl font-bold text-[#1B1464]">{open.title}</h2>
            <p className="mt-2 text-sm text-[#344054]">{open.detail}</p>
            <p className="mt-3 text-xs text-[#667085]">This notice is now read. The invitation, signature, or payment task stays open until you finish it.</p>
            <div className="mt-5 flex justify-end gap-2">
              <Link href={href(filter)} className="rounded-full border border-[#E4E9F5] px-4 py-2 text-sm font-semibold text-[#344054]">Close</Link>
              <Link href={destination} className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">Open</Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
