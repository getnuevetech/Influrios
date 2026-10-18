import { MemberFrame } from "@/components/account-shell";
import { requireBusinessSession } from "@/lib/account-audience";

export default async function BusinessCampaignsLayout({ children }: { children: React.ReactNode }) {
  await requireBusinessSession("/business/campaigns");
  return <MemberFrame audience="business">{children}</MemberFrame>;
}
