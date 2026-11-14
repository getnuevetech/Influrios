import { redirect } from "next/navigation";
import { ActionInboxPanel } from "@/components/action-inbox-panel";
import { getAccountSession } from "@/lib/accounts";
import { loadActionInbox } from "@/lib/action-inbox-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Action inbox" };

type Props = { searchParams: Promise<{ tab?: string; q?: string; type?: string }> };

export default async function ActionInboxPage({ searchParams }: Props) {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/collaboration/inbox");
  const params = await searchParams;
  const loaded = await loadActionInbox(account);
  return (
    <ActionInboxPanel
      tasks={loaded.tasks}
      notices={loaded.notices}
      tasksFailed={loaded.tasksFailed}
      noticesFailed={loaded.noticesFailed}
      incident={loaded.incident}
      tab={params.tab}
      q={params.q}
      type={params.type}
    />
  );
}
