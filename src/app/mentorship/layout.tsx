import { MemberFrame } from "@/components/account-shell";
import { requireCreatorSession } from "@/lib/account-audience";

export default async function MentorshipLayout({ children }: { children: React.ReactNode }) {
  await requireCreatorSession("/mentorship");
  return <MemberFrame audience="creator">{children}</MemberFrame>;
}