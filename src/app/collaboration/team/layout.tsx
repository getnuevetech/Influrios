import { redirect } from "next/navigation";
import { MemberFrame } from "@/components/account-shell";
import { accountAudience } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";

/** Team proposals — signed-in; chrome follows User.role. */
export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect("/login?next=/collaboration/team&gate=team");
  return <MemberFrame audience={accountAudience(account)}>{children}</MemberFrame>;
}
