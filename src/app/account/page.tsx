import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/account-settings";
import { accountAudience } from "@/lib/account-audience";
import { getAccountSession } from "@/lib/accounts";
import { pendingCountryForCreator } from "@/lib/country-review";
import { prisma } from "@/lib/db";
import { resolveCreatorIdentityVerified } from "@/lib/kyc-document";
import { emailPreference } from "@/lib/email-live";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account settings" };

const TABS = new Set(["account", "security", "notifications", "verification", "connections", "billing"]);

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; saved?: string; error?: string; country?: string }>;
}) {
  const session = await getAccountSession();
  if (!session) redirect("/login?next=/account");
  const params = await searchParams;
  const audience = accountAudience(session);
  const [user, creator, prefs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.id },
      select: { phone: true, name: true, planTier: true },
    }),
    prisma.creator
      .findUnique({
        where: { userId: session.id },
        select: {
          id: true,
          slug: true,
          displayName: true,
          locationCountry: true,
          identityVerified: true,
          planTier: true,
        },
      })
      .catch(() => null),
    emailPreference(session.email).catch(() => ({
      collaborations: true,
      billing: true,
      outreach: true,
      productNews: false,
    })),
  ]);
  const pendingCountry = creator ? await pendingCountryForCreator(creator.id).catch(() => null) : null;
  const identityVerified = creator
    ? await resolveCreatorIdentityVerified({
        creatorId: creator.id,
        creatorSlug: creator.slug,
        identityVerified: creator.identityVerified,
      }).catch(() => creator.identityVerified === "VERIFIED")
    : false;
  const tab = TABS.has(params.tab ?? "") ? params.tab! : "account";

  return (
    <AccountSettings
      audience={audience}
      tab={tab}
      saved={params.saved}
      error={params.error}
      countryReview={params.country === "review" ? "review" : undefined}
      name={user?.name || session.name || ""}
      displayName={creator?.displayName || ""}
      email={session.email}
      emailVerified={Boolean(session.emailVerifiedAt)}
      hasPassword={session.hasPassword}
      phone={user?.phone ?? ""}
      country={creator?.locationCountry ?? ""}
      identityVerified={identityVerified}
      pendingCountry={pendingCountry}
      planCode={creator?.planTier || user?.planTier || "STARTER"}
      emailPrefs={prefs}
    />
  );
}
