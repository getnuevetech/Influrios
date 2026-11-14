import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminCorridorsPanel } from "@/app/admin/corridors/corridors-panel";
import { AdminFeesPanel } from "@/app/admin/fees/fees-panel";
import { AdminGatewaysPanel } from "@/app/admin/gateways/gateways-panel";
import { AccountRolesPanel } from "@/app/admin/payment-settings/account-roles-panel";
import { CountryRoutesPanel } from "@/app/admin/payment-settings/country-routes-panel";
import {
  PAYMENT_SETTINGS_TABS,
  normalizePaymentSettingsSection,
  paymentSettingsHref,
  visiblePaymentSettingsSections,
  type PaymentSettingsSection,
} from "@/app/admin/payment-settings/owner";
import { PaymentSwitchesPanel } from "@/app/admin/payment-switches/switches-panel";
import { RouteVersionPanel } from "@/app/admin/payment-settings/route-version-panel";
import { TaxPoliciesPanel } from "@/app/admin/payment-settings/tax-panel";
import { canAccessModule, getAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment settings · Admin" };

function PaymentSettingsNav({
  section,
  allowed,
}: {
  section: PaymentSettingsSection;
  allowed: PaymentSettingsSection[];
}) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Payment settings">
      {PAYMENT_SETTINGS_TABS.filter((tab) => allowed.includes(tab.id)).map((tab) => (
        <Link
          key={tab.id}
          href={paymentSettingsHref(tab.id)}
          className={`rounded-full px-4 py-2 text-sm font-bold ${
            tab.id === section ? "bg-[#5836D6] text-white" : "bg-white text-indigo"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export default async function PaymentSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestedRaw = typeof params.section === "string" ? params.section : undefined;
  const requested = normalizePaymentSettingsSection(requestedRaw);
  const session = await getAdminSession();
  if (!session) {
    const next = paymentSettingsHref(requested ?? "routes");
    redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  }
  const allowed = visiblePaymentSettingsSections((module) => canAccessModule(session, module));
  const fallback = allowed.includes("routes") ? "routes" : allowed[0];
  if (!fallback) redirect("/admin?error=forbidden");
  if (requestedRaw && !requested) redirect(paymentSettingsHref(fallback));
  if (requested && !allowed.includes(requested)) redirect("/admin?error=forbidden");
  const section = requested ?? fallback;
  const panelParams = Promise.resolve(params);
  const canFinance = canAccessModule(session, "collab_finance");
  const canCommerce = canAccessModule(session, "commerce");
  const canSwitches = canAccessModule(session, "marketplace") || canFinance;

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-indigo">Payment settings</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Providers and Connections, account roles, country routes, and fees and tax policies. Saving a form does not
            start a charge or move money that is already with a provider.
          </p>
        </div>
        <PaymentSettingsNav section={section} allowed={allowed} />
      </div>
      {section === "providers" ? <AdminGatewaysPanel searchParams={panelParams} /> : null}
      {section === "roles" ? <AccountRolesPanel /> : null}
      {section === "routes" ? (
        <>
          <CountryRoutesPanel searchParams={panelParams} canAddCountry={canFinance} />
          {canFinance ? <AdminCorridorsPanel searchParams={panelParams} /> : null}
          {canFinance ? <RouteVersionPanel routeId={typeof params.route === "string" ? params.route : undefined} routeTab={typeof params.routeTab === "string" ? params.routeTab : undefined} /> : null}
        </>
      ) : null}
      {section === "fees" ? (
        <>
          {canCommerce ? <AdminFeesPanel searchParams={panelParams} /> : null}
          {canSwitches ? <PaymentSwitchesPanel searchParams={panelParams} /> : null}
        </>
      ) : null}
      {section === "tax" ? <TaxPoliciesPanel /> : null}
      {section === "audit" ? (
        <p className="mx-auto max-w-5xl text-sm text-muted">
          Configuration edits are draft versions. They do not rewrite signed prices or historical ledger rows.
        </p>
      ) : null}
    </div>
  );
}
