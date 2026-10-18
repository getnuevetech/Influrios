import { MemberFrame } from "@/components/account-shell";
import { requireBusinessSession } from "@/lib/account-audience";

export default async function BusinessHomeLayout({ children }: { children: React.ReactNode }) {
  await requireBusinessSession("/business/home");
  return <MemberFrame audience="business">{children}</MemberFrame>;
}
