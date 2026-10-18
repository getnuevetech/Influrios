import { MemberFrame } from "@/components/account-shell";
import { accountAudience } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  return <MemberFrame audience={accountAudience(account)}>{children}</MemberFrame>;
}
