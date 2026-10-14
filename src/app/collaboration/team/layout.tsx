import { MemberFrame } from "@/components/account-shell";
import { getAccountSession } from "@/lib/accounts";

/** Team proposals are a business tool — keep business chrome when signed in as BUSINESS. */
export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  const audience =
    account?.role === "BUSINESS" || account?.role === "AGENCY" ? "business" : "creator";
  return <MemberFrame audience={audience}>{children}</MemberFrame>;
}
