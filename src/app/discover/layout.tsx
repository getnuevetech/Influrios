import { MemberFrame } from "@/components/account-shell";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { accountAudience } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";

/**
 * Signed-in members keep role-correct MemberFrame chrome.
 * Guests get the public header/footer (marketing chrome is suppressed for /discover).
 */
export default async function DiscoverLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSession().catch(() => null);
  if (account) {
    return <MemberFrame audience={accountAudience(account)}>{children}</MemberFrame>;
  }
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
