import { redirect } from "next/navigation";
import { MemberFrame } from "@/components/account-shell";
<<<<<<< HEAD
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";
import { prisma } from "@/lib/db";

/** Active collaborations stay inside the signed-in account chrome. */
=======
import { accountAudience } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";

/** Active collaborations — chrome follows User.role only. */
>>>>>>> e175ce2 (Hard-separate influencer, business, and agency account shells.)
export default async function CollaborationRecordsLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  if (!account) {
    redirect("/login?next=/collaboration/records");
  }
<<<<<<< HEAD

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
=======
  return <MemberFrame audience={accountAudience(account)}>{children}</MemberFrame>;
>>>>>>> e175ce2 (Hard-separate influencer, business, and agency account shells.)
}
