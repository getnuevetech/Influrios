import Link from "next/link";
import { AdminAccountSection } from "@/app/admin/accounts/account-section";
import { loadAdminAccounts } from "@/app/admin/accounts/load-accounts";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { assignablePlanCodes } from "@/lib/entitlements-db";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Influencer accounts" };

const INFLUENCER_ROLES = ["CREATOR"] as const;
const FALLBACK_PLANS = ["STARTER", "PLUS", "PRO"];

export default async function AdminInfluencerAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; reset?: string }>;
}) {
  const session = await requireAdminPage("accounts");
  const canEdit = hasPermission(session, "accounts.edit");
  const params = await searchParams;
  const policy = await getSiteConfig();
  const catalogPlans = await assignablePlanCodes().catch(() => FALLBACK_PLANS);
  const influencerPlans = catalogPlans.filter(
    (code) => !code.startsWith("BUSINESS") && code !== "AGENCY",
  );
  const users = await loadAdminAccounts([...INFLUENCER_ROLES]);

  return (
    <AdminAccountSection
      kind="influencer"
      title="Influencer accounts"
      blurb={
        <>
          Creator sign-ins only. Business and agency accounts are on{" "}
          <Link href="/admin/business-accounts" className="font-semibold text-violet">
            Business accounts
          </Link>
          . Guest view and search limits are on{" "}
          <Link href="/admin/guests" className="font-semibold text-violet">
            Guest gates
          </Link>
          . The admin console itself is managed under Access levels.
        </>
      }
      otherHref="/admin/business-accounts"
      otherLabel="Business accounts"
      users={users}
      roleOptions={[...INFLUENCER_ROLES]}
      planOptions={influencerPlans.length ? influencerPlans : FALLBACK_PLANS}
      canEdit={canEdit}
      params={params}
      policy={{
        consentVersion: policy.consentVersion,
        consentCopy: policy.consentCopy,
        passwordMinLength: policy.passwordMinLength,
      }}
    />
  );
}
