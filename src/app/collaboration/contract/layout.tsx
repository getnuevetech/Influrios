import { MemberFrame } from "@/components/account-shell";
import { accountAudience } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";

/** Contract wizard — chrome follows User.role only (never hardcode business). */
export default async function ContractWizardLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  return <MemberFrame audience={accountAudience(account)}>{children}</MemberFrame>;
}
