import { getAdminSession, hasPermission } from "@/lib/admin-auth";
import { loadTaxCatalog } from "@/lib/tax-settings";
import { TaxSettingsClient } from "@/app/admin/payment-settings/tax-settings-client";

export async function TaxPoliciesPanel() {
  const session = await getAdminSession();
  const canEdit = hasPermission(session, "collab_finance.manage");
  const catalog = await loadTaxCatalog();
  return (
    <TaxSettingsClient
      canEdit={canEdit}
      records={catalog.records.map((record) => ({
        ...record,
        calculationMethod: record.calculationMethod,
      }))}
      catalog={{
        plans: catalog.plans.map((plan) => ({ id: plan.id, name: plan.name })),
        feeRules: catalog.feeRules,
        services: catalog.services,
        countries: catalog.countries,
        integrations: catalog.integrations,
        accounts: catalog.accounts,
      }}
      previews={catalog.previews}
    />
  );
}
