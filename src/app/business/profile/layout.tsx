import { MemberFrame } from "@/components/account-shell";

export default function BusinessProfileLayout({ children }: { children: React.ReactNode }) {
  return <MemberFrame audience="business">{children}</MemberFrame>;
}
