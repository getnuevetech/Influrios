import Link from "next/link";
import {
  inboxChip,
  inboxTabFromQuery,
  inboxTypeFromQuery,
  taskMatchesInbox,
  tasksForTab,
  type InboxTask,
  type InboxTab,
  type InboxTypeFilter,
} from "@/lib/action-inbox";
import type { InboxNotice } from "@/lib/action-inbox-load";

const TABS: { id: InboxTab; label: string }[] = [
  { id: "assigned", label: "Assigned to me" },
  { id: "waiting", label: "Waiting on others" },
  { id: "resolved", label: "Resolved" },
];

const TYPES: { id: InboxTypeFilter; label: string }[] = [
  { id: "all", label: "All types" },
  { id: "delivery", label: "Delivery" },
  { id: "contract", label: "Contract" },
  { id: "funding", label: "Funding" },
  { id: "payout", label: "Payout" },
  { id: "invitation", label: "Invitation" },
];

export function ActionInboxPanel({
  tasks,
  notices,
  tasksFailed,
  noticesFailed,
  incident,
  tab,
  q,
  type,
}: {
  tasks: InboxTask[];
  notices: InboxNotice[];
  tasksFailed: boolean;
  noticesFailed: boolean;
  incident: string;
  tab?: string;
  q?: string;
  type?: string;
}) {
  const selectedTab = inboxTabFromQuery(tab);
  const selectedType = inboxTypeFromQuery(type);
  const query = (q ?? "").trim();
  const visible = tasksForTab(tasks, selectedTab).filter((task) => taskMatchesInbox(task, { q: query, type: selectedType }));
  const assignedCount = tasksForTab(tasks, "assigned").length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="space-y-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-indigo">Needs your attention</h1>
          <p className="mt-1 text-sm text-muted">Opening a notification does not complete the task.</p>
          {tasksFailed ? null : (
            <p className="mt-2 text-sm font-semibold text-indigo">
              {assignedCount} open {assignedCount === 1 ? "task" : "tasks"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <Link
              key={item.id}
              href={inboxHref({ tab: item.id, q: query, type: selectedType })}
              className={`inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold ${
                selectedTab === item.id ? "bg-[#6D4AFF] text-white" : "border border-[#E4E9F5] text-[#1B1464]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <form action="/collaboration/inbox" className="flex flex-wrap gap-2">
          <input type="hidden" name="tab" value={selectedTab} />
          <input
            name="q"
            defaultValue={query}
            placeholder="Search"
            className="h-11 min-w-0 flex-1 rounded-xl border border-[#E4E9F5] px-3 text-sm"
          />
          <select name="type" defaultValue={selectedType} className="h-11 rounded-xl border border-[#E4E9F5] px-3 text-sm">
            {TYPES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <button type="submit" className="h-11 rounded-full border border-[#E4E9F5] px-4 text-sm font-semibold text-[#1B1464]">
            Apply
          </button>
        </form>
        {tasksFailed ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">Action inbox unavailable</p>
            <p className="mt-1">Could not load your tasks. This is not zero. Reference {incident}.</p>
            <Link href="/collaboration/inbox" className="mt-2 inline-flex font-semibold text-[#6D4AFF]">
              Retry
            </Link>
          </div>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted">No tasks in this view.</p>
        ) : (
          <ul className="space-y-3">
            {visible.map((task) => (
              <li key={task.key} className="rounded-2xl border border-[#E4E9F5] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#1B1464]">{task.title}</p>
                    <p className="mt-1 text-xs font-semibold text-[#6D4AFF]">{inboxChip(task)}</p>
                    <p className="mt-1 text-sm text-[#667085]">
                      {task.counterparty} · {task.dueLabel} · {task.state}
                    </p>
                  </div>
                  {task.cta ? (
                    <Link href={task.href} className="inline-flex h-11 items-center rounded-full bg-[#6D4AFF] px-4 text-sm font-semibold text-white">
                      {task.cta}
                    </Link>
                  ) : task.linkLabel && task.state === "Open" ? (
                    <Link href={task.href} className="inline-flex h-11 items-center rounded-full border border-[#E4E9F5] px-4 text-sm font-semibold text-[#1B1464]">
                      {task.linkLabel}
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-[#98A2B3]">
          One task per required action. Complete the action to resolve it. Links stay in this account.
        </p>
      </section>
      <aside className="space-y-3 rounded-2xl border border-[#E4E9F5] bg-white p-4">
        <h2 className="font-display text-lg font-bold text-indigo">Notifications</h2>
        {noticesFailed ? (
          <div className="text-sm text-amber-950">
            <p>Could not load notifications. This is not zero. Reference {incident}.</p>
            <Link href="/collaboration/inbox" className="mt-2 inline-flex font-semibold text-[#6D4AFF]">
              Retry
            </Link>
          </div>
        ) : notices.length === 0 ? (
          <p className="text-sm text-muted">No notifications.</p>
        ) : (
          <ul className="space-y-3">
            {notices.map((notice) => (
              <li key={notice.id} className="border-t border-[#E4E9F5] pt-3 first:border-t-0 first:pt-0">
                <p className="text-sm font-semibold text-[#1B1464]">{notice.title}</p>
                <p className="mt-1 text-xs text-[#667085]">{notice.detail}</p>
                <p className="mt-1 text-xs font-semibold text-[#667085]">{notice.read ? "Read" : "Unread"}</p>
                {notice.read ? (
                  <p className="mt-1 text-xs text-[#667085]">
                    This is a read notification. It confirms a message was sent. No action is required.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-[#667085]">Opening this notification does not complete the task.</p>
                )}
                <Link href={notice.href} className="mt-2 inline-flex text-sm font-semibold text-[#6D4AFF]">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

function inboxHref(input: { tab: InboxTab; q: string; type: InboxTypeFilter }) {
  const params = new URLSearchParams();
  if (input.tab !== "assigned") params.set("tab", input.tab);
  if (input.q) params.set("q", input.q);
  if (input.type !== "all") params.set("type", input.type);
  const query = params.toString();
  return query ? `/collaboration/inbox?${query}` : "/collaboration/inbox";
}
