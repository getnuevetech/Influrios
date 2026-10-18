import { MemberFrame } from "@/components/account-shell";
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";
import { prisma } from "@/lib/db";

/** Application / invitation detail — signed-in account chrome for creator or business. */
export default async function ApplicationDetailLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  let audience: "creator" | "business" = "business";
  if (account) {
    if (account.role === "BUSINESS" || account.role === "AGENCY") {
      audience = "business";
    } else {
      const [creator, draft] = await Promise.all([
        prisma.creator.findUnique({ where: { userId: account.id }, select: { id: true } }).catch(() => null),
        getCreatorSessionDraft().catch(() => null),
      ]);
      audience = creator || draft ? "creator" : "business";
    }
  }
  return <MemberFrame audience={audience}>{children}</MemberFrame>;
}
