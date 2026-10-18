import { MemberFrame } from "@/components/account-shell";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";
import { prisma } from "@/lib/db";

/**
 * Signed-in business/creator users keep MemberFrame chrome.
 * Guests get the public header/footer (marketing chrome is suppressed for /discover).
 */
export default async function DiscoverLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  if (account?.role === "BUSINESS" || account?.role === "AGENCY") {
    return <MemberFrame audience="business">{children}</MemberFrame>;
  }
  if (account) {
    const [creator, draft] = await Promise.all([
      prisma.creator.findUnique({ where: { userId: account.id }, select: { id: true } }).catch(() => null),
      getCreatorSessionDraft().catch(() => null),
    ]);
    if (creator || draft) {
      return <MemberFrame audience="creator">{children}</MemberFrame>;
    }
  }
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
