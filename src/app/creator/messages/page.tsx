import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ConversationPopup } from "@/app/creator/messages/conversation-popup";
import { MessagesInbox } from "@/app/creator/messages/messages-inbox";
import { getAccountSession } from "@/lib/accounts";
import { inboxFilter, loadMessageInbox, messagesHref, openMessageThread, queryValue } from "@/lib/message-inbox";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

type Props = {
  searchParams: Promise<{ filter?: string | string[]; q?: string | string[]; thread?: string | string[] }>;
};

export default async function CreatorMessagesPage({ searchParams }: Props) {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/creator/messages");
  const params = await searchParams;
  const filter = inboxFilter(queryValue(params.filter));
  const q = queryValue(params.q);
  const threadId = queryValue(params.thread);
  const headerList = await headers();
  const prefetch =
    headerList.get("next-router-prefetch") === "1" || headerList.get("purpose") === "prefetch";
  const inbox = await loadMessageInbox(account);
  let opened: Awaited<ReturnType<typeof openMessageThread>> | null = null;
  if (threadId) {
    try {
      opened = await openMessageThread(account, threadId, new Date(), { markRead: !prefetch });
    } catch {
      opened = { ok: false, error: "This conversation could not be loaded." };
    }
  }
  return (
    <>
      <MessagesInbox
        threads={inbox.ok ? inbox.threads : []}
        failed={!inbox.ok}
        filter={filter}
        q={q}
        activeThreadId={opened?.ok ? opened.view.thread.id : ""}
        dimmed={Boolean(threadId)}
      />
      {threadId && opened ? (
        <ConversationPopup closeHref={messagesHref({ filter, q })} state={opened} />
      ) : null}
    </>
  );
}
