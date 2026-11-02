import { redirect } from "next/navigation";
import { MemberFrame } from "@/components/account-shell";
import { accountAudience } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";

/** Shared application/invitation detail — signed-in; chrome follows User.role. */
export default async function ApplicationDetailLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect("/login?next=/collaboration/applications&gate=applications");
  return <MemberFrame audience={accountAudience(account)}>{children}</MemberFrame>;
}
