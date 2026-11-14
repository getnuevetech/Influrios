import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MemberFrame } from "@/components/account-shell";
import { accountAudience } from "@/lib/account-audience";
import { safeNextPath } from "@/lib/account-policy";
import { getAccountSession } from "@/lib/accounts";

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  if (!account) {
    const path = safeNextPath((await headers()).get("x-pathname"), "/collaboration/inbox");
    const next = path.startsWith("/collaboration/inbox") ? path : "/collaboration/inbox";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  return <MemberFrame audience={accountAudience(account)}>{children}</MemberFrame>;
}
