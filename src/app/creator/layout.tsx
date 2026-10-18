import { MemberFrame } from "@/components/account-shell";
import { requireCreatorSession } from "@/lib/account-audience";

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  await requireCreatorSession("/creator");
  return <MemberFrame audience="creator">{children}</MemberFrame>;
}
