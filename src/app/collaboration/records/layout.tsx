import { MemberFrame } from "@/components/account-shell";

/** Active collaborations stay inside the business account chrome. */
export default function CollaborationRecordsLayout({ children }: { children: React.ReactNode }) {
  return <MemberFrame audience="business">{children}</MemberFrame>;
}
