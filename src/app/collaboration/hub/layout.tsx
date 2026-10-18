import { MemberFrame } from "@/components/account-shell";
import { requireCreatorSession } from "@/lib/account-audience";

export default async function CreatorCollaborationHubLayout({ children }: { children: React.ReactNode }) {
  await requireCreatorSession("/collaboration/hub");
  return <MemberFrame audience="creator">{children}</MemberFrame>;
}
