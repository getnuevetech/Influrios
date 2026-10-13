import { MemberFrame } from "@/components/account-shell";
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";
import { prisma } from "@/lib/db";

/** Shared funding console — keep the sidebar for whichever account is signed in. */
export default async function PaymentsLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  let audience: "creator" | "business" = "business";
  if (account) {
    const [creator, draft] = await Promise.all([
      prisma.creator.findUnique({ where: { userId: account.id }, select: { id: true } }).catch(() => null),
      getCreatorSessionDraft().catch(() => null),
    ]);
    if (creator || draft) audience = "creator";
    else if (account.role === "BUSINESS" || account.role === "AGENCY") audience = "business";
  }
  return <MemberFrame audience={audience}>{children}</MemberFrame>;
}
