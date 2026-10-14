import { MemberFrame } from "@/components/account-shell";

/** Influencer campaign/request detail uses creator account chrome. */
export default function CreatorRequestsLayout({ children }: { children: React.ReactNode }) {
  return <MemberFrame audience="creator">{children}</MemberFrame>;
}
