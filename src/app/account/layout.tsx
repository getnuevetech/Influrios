import { MemberFrame } from "@/components/account-shell";
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";
import { prisma } from "@/lib/db";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  let audience: "creator" | "business" = "creator";
  if (account) {
    const [creator, draft] = await Promise.all([
      prisma.creator.findUnique({ where: { userId: account.id }, select: { id: true } }).catch(() => null),
      getCreatorSessionDraft().catch(() => null),
    ]);
    if (!creator && !draft && account.role === "BUSINESS") audience = "business";
  }
  return <MemberFrame audience={audience}>{children}</MemberFrame>;
}
