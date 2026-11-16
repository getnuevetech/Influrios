/** @jsxRuntime automatic */
/** @jsxImportSource react */
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { messagesHref, visibleInboxThreads, type InboxThread } from "@/lib/message-inbox";

export type InboxLinkProps = {
  href: string;
  scroll?: boolean;
  prefetch?: boolean;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
  "aria-current"?: "page" | "true";
};

function DefaultLink({ href, scroll, prefetch, className, children, ...rest }: InboxLinkProps) {
  return (
    <Link
      href={href}
      scroll={scroll ?? false}
      prefetch={prefetch}
      className={className}
      aria-label={rest["aria-label"]}
      aria-current={rest["aria-current"]}
    >
      {children}
    </Link>
  );
}

export function MessagesInbox({
  threads,
  failed,
  filter,
  q,
  activeThreadId,
  dimmed,
  linkComponent: LinkComponent = DefaultLink,
}: {
  threads: InboxThread[];
  failed: boolean;
  filter: "all" | "unread";
  q: string;
  activeThreadId: string;
  dimmed: boolean;
  linkComponent?: ComponentType<InboxLinkProps>;
}) {
  const shown = visibleInboxThreads(threads, filter, q);
  return (
    <section
      id="messages-inbox"
      data-inbox-dimmed={dimmed ? "true" : "false"}
      aria-hidden={dimmed || undefined}
      className="mx-auto w-full max-w-3xl rounded-[28px] border border-[#E6ECF7] bg-white p-5 shadow-sm sm:p-6"
    >
      <h1 className="font-display text-3xl font-bold text-[#1B1464]">Messages</h1>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form action="/creator/messages" className="relative min-w-0 flex-1">
          {filter === "unread" ? <input type="hidden" name="filter" value="unread" /> : null}
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8A93A8]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            aria-label="Search conversations"
            placeholder="Search conversations"
            className="h-11 w-full rounded-xl border border-[#E4E9F5] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#6D4AFF]"
          />
          <button type="submit" className="sr-only">
            Search
          </button>
        </form>
        <div className="flex gap-2">
          <FilterLink current={filter} id="all" q={q} LinkComponent={LinkComponent} />
          <FilterLink current={filter} id="unread" q={q} LinkComponent={LinkComponent} />
        </div>
      </div>
      {failed ? (
        <p className="mt-6 text-sm text-[#1B1464]">Conversations could not be loaded. This is not an empty inbox.</p>
      ) : shown.length === 0 ? (
        <p className="mt-6 text-sm text-[#667085]">
          {q.trim() ? "No conversations match that search." : filter === "unread" ? "No unread conversations." : "No conversations yet."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[#EEF2F7]">
          {shown.map((thread) => {
            const active = thread.id === activeThreadId;
            return (
              <li
                key={thread.id}
                data-thread-id={thread.id}
                data-contract-id={thread.contractRef}
                data-unread={thread.unread ? "true" : "false"}
                data-participants={thread.participants.join("|")}
              >
                <LinkComponent
                  href={messagesHref({ filter, q, thread: thread.id })}
                  scroll={false}
                  prefetch={false}
                  aria-current={active ? "true" : undefined}
                  className={`flex items-start gap-3 px-2 py-3 ${active ? "bg-[#F4F0FF]" : "hover:bg-[#F7F8FC]"}`}
                >
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EDE7FF] text-sm font-bold text-[#6D4AFF]">
                    {thread.otherInitials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-bold text-[#1B1464]">{thread.otherParty}</span>
                      <span className="shrink-0 text-xs text-[#667085]">{thread.timeLabel}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-semibold text-[#6D4AFF]">{thread.campaign}</span>
                    {thread.sharedTitle ? (
                      <span className="mt-0.5 block truncate text-xs text-[#667085]">
                        {thread.participants.join(", ")} · {thread.contractRef}
                      </span>
                    ) : null}
                    <span className="mt-0.5 block truncate text-sm text-[#344054]">{thread.previewLine}</span>
                  </span>
                  {thread.unread ? (
                    <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#6D4AFF]" aria-label="Unread" />
                  ) : (
                    <span className="w-2.5 shrink-0" />
                  )}
                  <span className="sr-only">
                    {thread.latestSender}. Contract {thread.contractRef}. {thread.participants.join(", ")}
                  </span>
                </LinkComponent>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function FilterLink({
  current,
  id,
  q,
  LinkComponent,
}: {
  current: "all" | "unread";
  id: "all" | "unread";
  q: string;
  LinkComponent: ComponentType<InboxLinkProps>;
}) {
  const on = current === id;
  return (
    <LinkComponent
      href={messagesHref({ filter: id, q })}
      scroll={false}
      aria-current={on ? "page" : undefined}
      className={`inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold ${
        on ? "bg-[#6D4AFF] text-white" : "border border-[#E4E9F5] text-[#1B1464]"
      }`}
    >
      {id === "all" ? "All" : "Unread"}
    </LinkComponent>
  );
}
