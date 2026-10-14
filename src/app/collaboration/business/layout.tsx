import { MemberFrame } from "@/components/account-shell";

/** Business collab tools use the same signed-in business chrome as /business/home. */
export default function BusinessCollaborationLayout({ children }: { children: React.ReactNode }) {
  return <MemberFrame audience="business">{children}</MemberFrame>;
}
