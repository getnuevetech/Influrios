import { redirect } from "next/navigation";
import { NotificationCentre } from "@/components/notification-centre";
import { getAccountSession } from "@/lib/accounts";
import { noticeFilterFromQuery } from "@/lib/notice-filters";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

type Props = { searchParams: Promise<{ filter?: string; open?: string }> };

export default async function NotificationsPage({ searchParams }: Props) {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/notifications");
  const params = await searchParams;
  const filter = noticeFilterFromQuery(params.filter);
  return (
    <div className="bg-[#F7F8FC] px-4 py-8">
      <NotificationCentre userId={account.id} basePath="/notifications" filter={filter} openId={params.open} />
    </div>
  );
}
