import { MemberFrame } from "@/components/account-shell";

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return <MemberFrame audience="creator">{children}</MemberFrame>;
}
