import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { listAccountNotices } from "@/lib/account-notices";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

export default async function CreatorNotificationsPage() {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/creator/notifications");
  const notices = await listAccountNotices(account.id).catch(() => []);
  const unread = notices.filter((row) => !row.readAt);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="font-display text-3xl font-bold text-[#1B1464]">Notifications</h1>
        <p className="mt-1 text-sm text-[#667085]">
          Unread events open the exact invitation or agreement. Opening one clears the unread mark. The invitation stays pending until you respond or it expires.
        </p>
      </div>
      {notices.length === 0 ? (
        <p className="rounded-2xl border border-[#E7ECF5] bg-white p-5 text-sm text-[#667085]">No notifications yet.</p>
      ) : (
        <ul className="divide-y divide-[#EEF2F7] rounded-2xl border border-[#E7ECF5] bg-white">
          {notices.map((row) => (
            <li key={row.id}>
              <Link href={`/creator/notifications/${row.id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-[#F8F6FF]">
                <span>
                  <span className="block text-sm font-semibold text-[#1B1464]">{row.title}</span>
                  <span className="text-xs text-[#667085]">{row.detail}</span>
                </span>
                <span className={`text-[11px] font-semibold ${row.readAt ? "text-[#98A2B3]" : "text-[#6D4AFF]"}`}>
                  {row.readAt ? "Read" : "Unread"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {unread.length === 0 && notices.length > 0 ? (
        <p className="text-xs text-[#667085]">Everything here has been opened. Pending invitations are still waiting for a response.</p>
      ) : null}
    </div>
  );
}
