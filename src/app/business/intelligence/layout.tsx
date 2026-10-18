import { MemberFrame } from "@/components/account-shell";
import { requireBusinessSession } from "@/lib/account-audience";

export default async function BusinessIntelligenceLayout({ children }: { children: React.ReactNode }) {
  await requireBusinessSession("/business/intelligence");
  return <MemberFrame audience="business">{children}</MemberFrame>;
}
