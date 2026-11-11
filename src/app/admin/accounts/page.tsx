import { redirect } from "next/navigation";
import { AdminUserAccountsView } from "@/components/admin-accounts-ui";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import {
  loadAccountById,
  loadAccountDetailExtras,
  loadAccountKpis,
  loadAccountTable,
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
  email?: string;
  phone?: string;
  handle?: string;
  status?: string;
  plan?: string;
  kyc?: string;
  page?: string;
  view?: string;
  mode?: string;
  edit?: string;
  saved?: string;
  error?: string;
  reset?: string;
};

function parseTab(raw: string | undefined): AccountsTab {
  if (raw === "business" || raw === "all") return raw;
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
  if (params.tab === "admin") redirect("/admin/admin-users");

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

  const [kpis, table] = await Promise.all([
    loadAccountKpis(),
    loadAccountTable({
      tab,
      q: params.q,
      email: params.email,
      phone: params.phone,
      handle: params.handle,
      status: (params.status as "active" | "suspended" | "all") || "all",
      plan: params.plan,
      kyc: (params.kyc as "verified" | "pending" | "unverified" | "rejected" | "all") || "all",
      page,
      pageSize: 8,
    }),
  ]);

  const focusId = params.view || params.edit || "";
  let selectedRow = focusId
    ? table.rows.find((r) => r.id === focusId) || (await loadAccountById(focusId))
    : null;
  if (selectedRow && focusId && selectedRow.id !== focusId) {
    selectedRow = await loadAccountById(focusId);
  }

  const detail = selectedRow ? await loadAccountDetailExtras(selectedRow.id) : null;

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
        email: params.email,
        phone: params.phone,
        handle: params.handle,
        status: params.status,
        plan: params.plan,
        kyc: params.kyc,
      }}
      selected={selectedRow}
      detail={detail}
      planOptions={planOptions}
      roleOptions={roleOptions}
      canEdit={canEdit}
      initialEditing={params.mode === "edit"}
      flash={{ saved: params.saved, error: params.error, reset: params.reset }}
      policy={{
        consentVersion: policy.consentVersion,
        consentCopy: policy.consentCopy,
        passwordMinLength: policy.passwordMinLength,
      }}
    />
  );
}
