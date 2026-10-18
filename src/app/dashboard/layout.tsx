import { MemberFrame } from "@/components/account-shell";
import { requireCreatorSession } from "@/lib/account-audience";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireCreatorSession("/dashboard");
  return <MemberFrame audience="creator">{children}</MemberFrame>;
}
