import { MemberFrame } from "@/components/account-shell";

export default function MentorshipLayout({ children }: { children: React.ReactNode }) {
  return <MemberFrame audience="creator">{children}</MemberFrame>;
}
