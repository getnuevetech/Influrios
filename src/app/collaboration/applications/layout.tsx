import { MemberFrame } from "@/components/account-shell";
import { accountAudience } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";

/** Shared application/invitation detail — signed-in; chrome follows User.role. */
export default async function ApplicationDetailLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  // Signed out: the page redirects to login with the exact item as the return target (master-spec §9).
  if (!account) return <>{children}</>;
  return <MemberFrame audience={accountAudience(account)}>{children}</MemberFrame>;
}
