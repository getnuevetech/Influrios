import Link from "next/link";
import { AdminAccountSection } from "@/app/admin/accounts/account-section";
import { loadAdminAccounts } from "@/app/admin/accounts/load-accounts";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { assignablePlanCodes } from "@/lib/entitlements-db";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business accounts" };

const BUSINESS_ROLES = ["BUSINESS", "AGENCY"] as const;
const FALLBACK_PLANS = ["BUSINESS_FREE", "BUSINESS_PRO", "AGENCY"];

export default async function AdminBusinessAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; reset?: string }>;
}) {
  const session = await requireAdminPage("accounts");
  const canEdit = hasPermission(session, "accounts.edit");
  const params = await searchParams;
  const policy = await getSiteConfig();
  const catalogPlans = await assignablePlanCodes().catch(() => FALLBACK_PLANS);
  const businessPlans = catalogPlans.filter(
    (code) => code.startsWith("BUSINESS") || code === "AGENCY",
  );
  const users = await loadAdminAccounts([...BUSINESS_ROLES]);

  return (
    <AdminAccountSection
      kind="business"
      title="Business accounts"
      blurb={
        <>
          Business and agency sign-ins only. Influencer accounts are on{" "}
          <Link href="/admin/accounts" className="font-semibold text-violet">
            Influencer accounts
          </Link>
          . Guest view and search limits are on{" "}
          <Link href="/admin/guests" className="font-semibold text-violet">
            Guest gates
          </Link>
          . The admin console itself is managed under Access levels.
        </>
      }
      otherHref="/admin/accounts"
      otherLabel="Influencer accounts"
      users={users}
      roleOptions={[...BUSINESS_ROLES]}
      planOptions={businessPlans.length ? businessPlans : FALLBACK_PLANS}
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
