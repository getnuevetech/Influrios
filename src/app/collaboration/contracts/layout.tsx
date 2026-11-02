import { redirect } from "next/navigation";
import { MemberFrame } from "@/components/account-shell";
import { accountAudience } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";

/** Shared contracts inbox — signed-in; chrome follows User.role. */
export default async function ContractsLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect("/login?next=/collaboration/contracts&gate=contracts");
  return <MemberFrame audience={accountAudience(account)}>{children}</MemberFrame>;
}
