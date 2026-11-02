import { redirect } from "next/navigation";
import { MemberFrame } from "@/components/account-shell";
import { accountAudience } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";

/** Collaboration payments — signed-in only; chrome follows User.role. */
export default async function PaymentsLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect("/login?next=/payments&gate=payments");
  return <MemberFrame audience={accountAudience(account)}>{children}</MemberFrame>;
}
