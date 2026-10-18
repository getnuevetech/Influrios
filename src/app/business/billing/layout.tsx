import { MemberFrame } from "@/components/account-shell";
import { requireBusinessSession } from "@/lib/account-audience";

export default async function BusinessBillingLayout({ children }: { children: React.ReactNode }) {
  await requireBusinessSession("/business/billing");
  return <MemberFrame audience="business">{children}</MemberFrame>;
}
