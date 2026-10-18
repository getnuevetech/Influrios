import { MemberFrame } from "@/components/account-shell";
import { requireBusinessSession } from "@/lib/account-audience";

/** Business collab tools — business/agency accounts only. */
export default async function BusinessCollaborationLayout({ children }: { children: React.ReactNode }) {
  await requireBusinessSession("/collaboration/business");
  return <MemberFrame audience="business">{children}</MemberFrame>;
}
