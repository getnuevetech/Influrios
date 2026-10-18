import { redirect } from "next/navigation";
import { MemberFrame } from "@/components/account-shell";
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";
import { prisma } from "@/lib/db";

/** Active collaborations stay inside the signed-in account chrome. */
export default async function CollaborationRecordsLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  if (!account) {
    redirect("/login?next=/collaboration/records");
  }

  let audience: "creator" | "business" = "business";
  if (account.role === "BUSINESS" || account.role === "AGENCY") {
    audience = "business";
  } else {
    const [creator, draft] = await Promise.all([
      prisma.creator.findUnique({ where: { userId: account.id }, select: { id: true } }).catch(() => null),
      getCreatorSessionDraft().catch(() => null),
    ]);
    audience = creator || draft ? "creator" : "business";
  }

  return <MemberFrame audience={audience}>{children}</MemberFrame>;
}
