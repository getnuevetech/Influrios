import { MemberFrame } from "@/components/account-shell";
import { accountAudience } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";

/** Collaboration payments — chrome follows User.role only. */
export default async function PaymentsLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  return <MemberFrame audience={accountAudience(account)}>{children}</MemberFrame>;
}
