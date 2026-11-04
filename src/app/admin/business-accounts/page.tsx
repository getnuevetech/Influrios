import { AdminUserAccountsView } from "@/components/admin-accounts-ui";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import {
  loadAccountById,
  loadAccountDetailExtras,
  loadAccountKpis,
  loadAccountTable,
} from "@/lib/admin-accounts";
import { assignablePlanCodes } from "@/lib/entitlements-db";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business Accounts · Admin" };

const FALLBACK_PLANS = ["BUSINESS_FREE", "BUSINESS_PRO", "AGENCY"];

type Search = {
  q?: string;
  status?: string;
  plan?: string;
  page?: string;
  id?: string;
  saved?: string;
  error?: string;
  reset?: string;
};

export default async function AdminBusinessAccountsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await requireAdminPage("accounts");
  const canEdit = hasPermission(session, "accounts.edit");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const policy = await getSiteConfig();
  const catalogPlans = await assignablePlanCodes().catch(() => FALLBACK_PLANS);
  const businessPlans = catalogPlans.filter(
    (code) => code.startsWith("BUSINESS") || code === "AGENCY",
  );

  const [kpis, table] = await Promise.all([
    loadAccountKpis(),
    loadAccountTable({
      tab: "business",
      q: params.q,
      status: (params.status as "active" | "suspended" | "all") || "all",
      plan: params.plan,
      page,
      pageSize: 8,
      selectedId: params.id,
    }),
  ]);

  let selectedRow =
    (params.id ? table.rows.find((r) => r.id === params.id) : table.rows[0]) || null;
  if (params.id && (!selectedRow || selectedRow.id !== params.id)) {
    selectedRow = await loadAccountById(params.id);
    if (selectedRow && selectedRow.role === "CREATOR") selectedRow = null;
  }
  const detail = selectedRow ? await loadAccountDetailExtras(selectedRow.id) : null;

  return (
    <AdminUserAccountsView
      tab="business"
      basePath="/admin/business-accounts"
      kpis={kpis}
      rows={table.rows}
      total={table.total}
      page={table.page}
      pageSize={table.pageSize}
      filters={{
        q: params.q,
        status: params.status,
        plan: params.plan,
      }}
      selected={selectedRow}
      detail={detail}
      planOptions={businessPlans.length ? businessPlans : FALLBACK_PLANS}
      roleOptions={["BUSINESS", "AGENCY"]}
      canEdit={canEdit}
      flash={{ saved: params.saved, error: params.error, reset: params.reset }}
      policy={{
        consentVersion: policy.consentVersion,
        consentCopy: policy.consentCopy,
        passwordMinLength: policy.passwordMinLength,
      }}
    />
  );
}
