import { AdminUserAccountsView } from "@/components/admin-accounts-ui";
import { requireAdminPage } from "@/app/admin/guard";
import { canAccessModule, getAdminAuthStore, hasPermission } from "@/lib/admin-auth";
import {
  loadAccountById,
  loadAccountDetailExtras,
  loadAccountKpis,
  loadAccountTable,
  loadAdminConsoleRows,
  type AccountsTab,
} from "@/lib/admin-accounts";
import { assignablePlanCodes } from "@/lib/entitlements-db";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const metadata = { title: "User Accounts · Admin" };

const FALLBACK_INFLUENCER = ["STARTER", "PLUS", "PRO"];
const FALLBACK_BUSINESS = ["BUSINESS_FREE", "BUSINESS_PRO", "AGENCY"];

type Search = {
  tab?: string;
  q?: string;
  status?: string;
  plan?: string;
  kyc?: string;
  page?: string;
  id?: string;
  saved?: string;
  error?: string;
  reset?: string;
};

function parseTab(raw: string | undefined): AccountsTab {
  if (raw === "business" || raw === "all" || raw === "admin") return raw;
  return "influencer";
}

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await requireAdminPage("accounts");
  const canEdit = hasPermission(session, "accounts.edit");
  const params = await searchParams;
  const tab = parseTab(params.tab);
  const page = Math.max(1, Number(params.page) || 1);
  const policy = await getSiteConfig();
  const catalogPlans = await assignablePlanCodes().catch(() => [
    ...FALLBACK_INFLUENCER,
    ...FALLBACK_BUSINESS,
  ]);
  const influencerPlans = catalogPlans.filter(
    (code) => !code.startsWith("BUSINESS") && code !== "AGENCY",
  );
  const businessPlans = catalogPlans.filter(
    (code) => code.startsWith("BUSINESS") || code === "AGENCY",
  );
  const planOptions =
    tab === "business"
      ? businessPlans.length
        ? businessPlans
        : FALLBACK_BUSINESS
      : tab === "all"
        ? catalogPlans
        : influencerPlans.length
          ? influencerPlans
          : FALLBACK_INFLUENCER;

  const roleOptions =
    tab === "business"
      ? ["BUSINESS", "AGENCY"]
      : tab === "all"
        ? ["CREATOR", "BUSINESS", "AGENCY"]
        : ["CREATOR"];

  const [kpis, table, adminRows, authStore] = await Promise.all([
    loadAccountKpis(),
    tab === "admin"
      ? Promise.resolve({ rows: [], total: 0, page: 1, pageSize: 8 })
      : loadAccountTable({
          tab,
          q: params.q,
          status: (params.status as "active" | "suspended" | "all") || "all",
          plan: params.plan,
          kyc: (params.kyc as "verified" | "pending" | "unverified" | "rejected" | "all") || "all",
          page,
          pageSize: 8,
          selectedId: params.id,
        }),
    tab === "admin" ? loadAdminConsoleRows() : Promise.resolve([]),
    tab === "admin" ? getAdminAuthStore() : Promise.resolve(null),
  ]);

  let selectedRow =
    tab === "admin"
      ? null
      : params.id
        ? table.rows.find((r) => r.id === params.id) || (await loadAccountById(params.id))
        : table.rows[0] || null;
  if (selectedRow && params.id && selectedRow.id !== params.id) {
    selectedRow = await loadAccountById(params.id);
  }

  const detail = selectedRow ? await loadAccountDetailExtras(selectedRow.id) : null;
  const canManageAdmins =
    canAccessModule(session, "access") && hasPermission(session, "access.manage_users");

  return (
    <AdminUserAccountsView
      tab={tab}
      basePath="/admin/accounts"
      kpis={kpis}
      rows={table.rows}
      total={table.total}
      page={table.page}
      pageSize={table.pageSize}
      filters={{
        q: params.q,
        status: params.status,
        plan: params.plan,
        kyc: params.kyc,
      }}
      selected={selectedRow}
      detail={detail}
      planOptions={planOptions}
      roleOptions={roleOptions}
      canEdit={canEdit}
      canManageAdmins={canManageAdmins}
      adminRows={adminRows}
      adminRoles={(authStore?.roles || []).map((r) => ({ id: r.id, name: r.name }))}
      flash={{ saved: params.saved, error: params.error, reset: params.reset }}
      policy={{
        consentVersion: policy.consentVersion,
        consentCopy: policy.consentCopy,
        passwordMinLength: policy.passwordMinLength,
      }}
    />
  );
}
