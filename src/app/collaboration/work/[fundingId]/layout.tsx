import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MemberFrame } from "@/components/account-shell";
import { accountAudience } from "@/lib/account-audience";
import { safeNextPath } from "@/lib/account-policy";
import { getAccountSession } from "@/lib/accounts";

/** Signed-in collaboration workspace. Chrome follows the account role. */
export default async function CollaborationWorkLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  if (!account) {
    const path = safeNextPath((await headers()).get("x-pathname"), "/collaboration/hub");
    const next = path.startsWith("/collaboration/work") ? path : "/collaboration/hub";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  return <MemberFrame audience={accountAudience(account)}>{children}</MemberFrame>;
}
