import { MemberFrame } from "@/components/account-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <MemberFrame audience="creator">{children}</MemberFrame>;
}
