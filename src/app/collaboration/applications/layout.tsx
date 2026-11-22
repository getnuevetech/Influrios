import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MemberFrame } from "@/components/account-shell";
import { accountAudience } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";

/** Item links under /collaboration/applications only; anything else returns to the list. */
function applicationReturnPath(pathname: string | null): string {
  return pathname && /^\/collaboration\/applications\/[A-Za-z0-9_-]+$/.test(pathname) ? pathname : "/collaboration/applications";
}

/** Shared application/invitation detail — signed-in; chrome follows User.role. */
export default async function ApplicationDetailLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  if (!account) {
    // Signed out: send to login with the exact item as the return target (master-spec §9).
    const next = applicationReturnPath((await headers()).get("x-pathname"));
    redirect(`/login?next=${encodeURIComponent(next)}&gate=applications`);
  }
  return <MemberFrame audience={accountAudience(account)}>{children}</MemberFrame>;
}
