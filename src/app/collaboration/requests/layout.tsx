import { MemberFrame } from "@/components/account-shell";
import { requireCreatorSession } from "@/lib/account-audience";

/** Influencer campaign/request detail — creator chrome only. */
export default async function CreatorRequestsLayout({ children }: { children: React.ReactNode }) {
  await requireCreatorSession("/collaboration/requests");
  return <MemberFrame audience="creator">{children}</MemberFrame>;
}
