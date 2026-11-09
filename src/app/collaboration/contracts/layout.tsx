import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MemberFrame } from "@/components/account-shell";
import { accountAudience } from "@/lib/account-audience";
import { safeNextPath } from "@/lib/account-policy";
import { getAccountSession } from "@/lib/accounts";

/** Shared contracts inbox — signed-in; chrome follows User.role. */
export default async function ContractsLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  if (!account) {
    const path = safeNextPath((await headers()).get("x-pathname"), "/collaboration/contracts");
    const next = path.startsWith("/collaboration/contracts") ? path : "/collaboration/contracts";
    redirect(`/login?next=${encodeURIComponent(next)}&gate=contracts`);
  }
  return <MemberFrame audience={accountAudience(account)}>{children}</MemberFrame>;
}
