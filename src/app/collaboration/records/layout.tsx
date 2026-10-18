import { redirect } from "next/navigation";
import { MemberFrame } from "@/components/account-shell";
import { accountAudience } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";

/** Active collaborations — chrome follows User.role only. */
export default async function CollaborationRecordsLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  if (!account) {
    redirect("/login?next=/collaboration/records");
  }
  return <MemberFrame audience={accountAudience(account)}>{children}</MemberFrame>;
}
