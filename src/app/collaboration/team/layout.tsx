import { MemberFrame } from "@/components/account-shell";
import { accountAudience } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";

/** Team proposals — chrome follows User.role only. */
export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  return <MemberFrame audience={accountAudience(account)}>{children}</MemberFrame>;
}
