import { MemberFrame } from "@/components/account-shell";
import { accountAudience } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";

/** Shared contracts inbox — chrome follows User.role only. */
export default async function ContractsLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  return <MemberFrame audience={accountAudience(account)}>{children}</MemberFrame>;
}
