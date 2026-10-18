import { MemberFrame } from "@/components/account-shell";
import { requireCreatorSession } from "@/lib/account-audience";

/** Creator/influencer subscription plans — never business billing. */
export default async function BillingLayout({ children }: { children: React.ReactNode }) {
  await requireCreatorSession("/billing");
  return <MemberFrame audience="creator">{children}</MemberFrame>;
}
