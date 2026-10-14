import { headers } from "next/headers";
import { MemberFrame } from "@/components/account-shell";
import { getAccountSession } from "@/lib/accounts";

/**
 * A BUSINESS/AGENCY role always gets business chrome here, even when the account also
 * has a Creator row or an in-progress claim draft — role wins over heuristics.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  const search = (await headers()).get("x-search") ?? "";
  const requested = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("audience");
  let audience: "creator" | "business" = "creator";
  if (account?.role === "BUSINESS" || account?.role === "AGENCY") audience = "business";
  if (requested === "business" || requested === "creator") audience = requested;
  return <MemberFrame audience={audience}>{children}</MemberFrame>;
}
