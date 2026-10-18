import { MemberFrame } from "@/components/account-shell";
import { requireBusinessSession } from "@/lib/account-audience";

export default async function BusinessProfileLayout({ children }: { children: React.ReactNode }) {
  await requireBusinessSession("/business/profile");
  return <MemberFrame audience="business">{children}</MemberFrame>;
}
