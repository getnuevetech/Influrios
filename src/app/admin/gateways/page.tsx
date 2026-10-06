import Link from "next/link";
import {
  actionAssignCountryGateway,
  actionDeleteCountryGroup,
  actionSaveConnect,
  actionSaveCountryGroup,
  actionSaveGateway,
  actionSetDefaultBackupGateway,
} from "@/app/admin/gateways/actions";
import { RemoveGatewayButton } from "@/app/admin/gateways/remove-gateway-button";
import { requireAdminPage } from "@/app/admin/guard";
import { AdminCollapse } from "@/components/admin-collapse";
import { hasPermission } from "@/lib/admin-auth";
import { listPaymentCountryGroups } from "@/lib/payment-country-groups";
import { productSwitch } from "@/lib/product-switches";
import { gatewayCredentialLabels, getDefaultBackupGateway, listProviders, paymentRoutes } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment gateways · Admin" };

const inputClass = "mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal";

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminGatewaysPage({ searchParams }: Props) {
  const session = await requireAdminPage("gateways");
  const canEdit = hasPermission(session, "gateways.edit");
  const params = await searchParams;
  let providers: Awaited<ReturnType<typeof listProviders>> = [];
  let connectProviders: Awaited<ReturnType<typeof listProviders>> = [];
  let routes: Awaited<ReturnType<typeof paymentRoutes>> = [];
  let groups: Awaited<ReturnType<typeof listPaymentCountryGroups>> = [];
  let defaultBackup: Awaited<ReturnType<typeof getDefaultBackupGateway>> = null;
  let connectOn = false;
  let dbError = false;
  try {
    [providers, connectProviders, routes, groups, defaultBackup, connectOn] = await Promise.all([
      listProviders("payment"),
      listProviders("connect"),
      paymentRoutes(),
      listPaymentCountryGroups(),
      getDefaultBackupGateway(),
      productSwitch("stripe_connect"),
    ]);
  } catch (error) {
    console.error("admin gateways", error);
    dbError = true;
  }

  const savedMessage =
    params.saved === "removed"
      ? "Gateway removed."
      : params.saved === "default"
        ? "Default backup gateway saved."
        : params.saved === "group"
          ? "Country group saved and routes updated."
          : params.saved === "group-removed"
            ? "Country group removed."
            : params.saved
              ? "Saved."
              : null;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Payment gateways</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Connect more than one gateway, then assign each country — or a named country group — to one of them. Set one
        default backup gateway so a country can fall back when its assigned gateway fails.
      </p>
      {savedMessage ? <p className="mt-4 text-sm font-semibold text-emerald-700">{savedMessage}</p> : null}
      {params.error ? <p className="mt-4 text-sm font-semibold text-amber-800">{params.error}</p> : null}
      {dbError ? <p className="mt-4 text-sm text-amber-800">The database is unavailable.</p> : null}

      <section className="mt-6 rounded-2xl border border-[#E4EBFF] bg-white p-4">
        <h2 className="font-display text-lg font-bold text-indigo">Default backup gateway</h2>
        <p className="mt-1 text-sm text-muted">
          When a country&apos;s assigned gateway is disabled or missing a secret, checkout and readiness checks use
          this backup instead.
        </p>
        {canEdit ? (
          <form action={actionSetDefaultBackupGateway} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm font-semibold text-indigo">
              Backup gateway
              <select
                name="providerId"
                required
                defaultValue={defaultBackup?.id ?? ""}
                className={inputClass}
              >
                <option value="" disabled>
                  Choose a gateway…
                </option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                    {provider.isDefaultBackup ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-secondary">
              Set as default backup
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm font-semibold text-indigo">
            {defaultBackup ? `${defaultBackup.name} (${defaultBackup.code})` : "No default backup set."}
          </p>
        )}
      </section>

      <section className="mt-6 space-y-3">
        <div>
          <h2 className="font-display text-lg font-bold text-indigo">Country groups</h2>
          <p className="mt-1 text-sm text-muted">
            Group countries and assign one gateway to the whole group. Saving updates each country route to that
            gateway.
          </p>
        </div>
        {groups.map((group) => (
          <AdminCollapse
            key={group.id}
            title={group.name}
            subtitle={`${group.providerName} · ${group.countryCodes.join(", ") || "No countries"}`}
          >
            {canEdit ? (
              <div className="space-y-3">
                <form action={actionSaveCountryGroup} className="grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="id" value={group.id} />
                  <label className="text-sm font-semibold text-indigo">
                    Group name
                    <input name="name" defaultValue={group.name} required className={inputClass} />
                  </label>
                  <label className="text-sm font-semibold text-indigo">
                    Gateway
                    <select name="providerId" defaultValue={group.providerId} className={inputClass}>
                      {providers.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-indigo sm:col-span-2">
                    Country codes (comma-separated)
                    <input
                      name="countryCodes"
                      defaultValue={group.countryCodes.join(", ")}
                      placeholder="NG, GH, KE"
                      required
                      className={inputClass}
                    />
                  </label>
                  <button type="submit" className="btn-primary w-fit">
                    Save group & routes
                  </button>
                </form>
                <form action={actionDeleteCountryGroup}>
                  <input type="hidden" name="id" value={group.id} />
                  <button type="submit" className="text-xs font-semibold text-amber-800 hover:underline">
                    Remove group
                  </button>
                </form>
              </div>
            ) : (
              <p className="text-sm text-muted">
                {group.providerName}: {group.countryCodes.join(", ")}
              </p>
            )}
          </AdminCollapse>
        ))}
        {canEdit ? (
          <form
            action={actionSaveCountryGroup}
            className="grid gap-3 rounded-2xl border border-dashed border-[#E4EBFF] bg-white p-4 sm:grid-cols-2"
          >
            <h3 className="font-semibold text-indigo sm:col-span-2">Add a country group</h3>
            <label className="text-sm font-semibold text-indigo">
              Group name
              <input name="name" required placeholder="West Africa" className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              Gateway
              <select name="providerId" required className={inputClass}>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-indigo sm:col-span-2">
              Country codes (comma-separated)
              <input name="countryCodes" required placeholder="NG, GH, KE" className={inputClass} />
            </label>
            <button type="submit" className="btn-secondary w-fit">
              Create group
            </button>
          </form>
        ) : null}
      </section>

      <AdminCollapse
        title="Per-country routes"
        subtitle={`${routes.length} route${routes.length === 1 ? "" : "s"}`}
        defaultOpen
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[#E4EBFF] text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Gateway</th>
                <th className="px-4 py-3">Ready</th>
                <th className="px-4 py-3">Backup</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => (
                <tr key={route.countryCode} className="border-b border-[#E4EBFF] last:border-0">
                  <td className="px-4 py-3 font-semibold text-indigo">{route.countryCode}</td>
                  <td className="px-4 py-3">
                    <form action={actionAssignCountryGateway} className="flex items-center gap-2">
                      <input type="hidden" name="countryCode" value={route.countryCode} />
                      <select name="providerId" defaultValue={providers.find((provider) => provider.code === route.providerCode)?.id} disabled={!canEdit} className="rounded-lg border border-border px-2 py-1">
                        {providers.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.name}
                          </option>
                        ))}
                      </select>
                      {canEdit ? <button type="submit" className="text-xs font-semibold text-violet">Assign</button> : null}
                    </form>
                  </td>
                  <td className="px-4 py-3 text-muted">{route.ready ? "Ready" : route.reason.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-muted">
                    {route.usingBackup
                      ? `Using ${route.backupProviderName}`
                      : route.backupProviderName
                        ? route.backupProviderName
                        : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canEdit ? (
          <form action={actionAssignCountryGateway} className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-[#E4EBFF] bg-[#F8FAFF] p-4">
            <label className="text-sm font-semibold text-indigo">
              New country
              <input name="countryCode" required maxLength={2} placeholder="NG" className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              Gateway
              <select name="providerId" className={inputClass}>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-secondary">Assign country</button>
          </form>
        ) : null}
      </AdminCollapse>

      <AdminCollapse title="Stripe Connect" subtitle={connectOn ? "Account links on" : "Account links off"}>
        <p className="text-sm text-muted">
          Account links open only when this switch is on and the Connect secret is saved. Nothing is paid out from
          this page.
        </p>
        <div className="mt-3 space-y-4">
          {connectProviders.map((provider) => (
            <form key={provider.id} action={actionSaveConnect} className="grid gap-3 rounded-2xl border border-[#E4EBFF] bg-[#F8FAFF] p-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={provider.id} />
              <input type="hidden" name="code" value={provider.code} />
              <label className="block text-sm font-semibold text-indigo">
                Name
                <input name="name" defaultValue={provider.name} disabled={!canEdit} className={inputClass} />
              </label>
              <label className="block text-sm font-semibold text-indigo">
                Secret ({provider.secret})
                <input name="secret" type="password" placeholder="Leave blank to keep" disabled={!canEdit} className={inputClass} />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
                <input type="checkbox" name="enabled" value="1" defaultChecked={provider.enabled} disabled={!canEdit} />
                Provider enabled
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
                <input type="checkbox" name="stripe_connect" defaultChecked={connectOn} disabled={!canEdit} />
                Allow account links
              </label>
              {canEdit ? <button type="submit" className="btn-primary w-fit">Save Stripe Connect</button> : null}
            </form>
          ))}
        </div>
      </AdminCollapse>

      <section className="mt-8 space-y-4">
        <h2 className="font-display text-lg font-bold text-indigo">Gateway credentials</h2>
        {providers.map((provider) => (
          <AdminCollapse
            key={provider.id}
            title={provider.name}
            subtitle={`${provider.enabled ? "Enabled" : "Disabled"} · Secret ${provider.secret}${provider.isDefaultBackup ? " · Default backup" : ""} · Last webhook ${provider.lastWebhookAt ? new Date(provider.lastWebhookAt).toLocaleString() : "never"} · ${provider.code}`}
          >
            <form action={actionSaveGateway} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={provider.id} />
              <input type="hidden" name="code" value={provider.code} />
              <label className="block text-sm font-semibold text-indigo">
                Name
                <input name="name" defaultValue={provider.name} disabled={!canEdit} className={inputClass} />
              </label>
              <label className="block text-sm font-semibold text-indigo">
                {gatewayCredentialLabels(provider.code).publicKey}
                <input name="publicKey" defaultValue={provider.publicKey} disabled={!canEdit} className={inputClass} />
              </label>
              <label className="block text-sm font-semibold text-indigo sm:col-span-2">
                API base URL
                <input name="baseUrl" defaultValue={provider.baseUrl} placeholder="https://" disabled={!canEdit} className={inputClass} />
              </label>
              {provider.code === "airwallex" ? (
                <>
                  <label className="block text-sm font-semibold text-indigo">
                    Holding account id
                    <input name="holdingAccountId" defaultValue={provider.holdingAccountId} disabled={!canEdit} className={inputClass} />
                  </label>
                  <label className="block text-sm font-semibold text-indigo">
                    Operations account id
                    <input name="operationsAccountId" defaultValue={provider.operationsAccountId} disabled={!canEdit} className={inputClass} />
                  </label>
                </>
              ) : null}
              <label className="block text-sm font-semibold text-indigo">
                {gatewayCredentialLabels(provider.code).secret} ({provider.secret})
                <input name="secret" type="password" placeholder="Leave blank to keep" disabled={!canEdit} className={inputClass} />
              </label>
              <label className="block text-sm font-semibold text-indigo">
                Webhook secret ({provider.webhook})
                <input name="webhook" type="password" placeholder="Leave blank to keep" disabled={!canEdit} className={inputClass} />
              </label>
              {gatewayCredentialLabels(provider.code).note ? (
                <p className="text-xs text-muted sm:col-span-2">{gatewayCredentialLabels(provider.code).note}</p>
              ) : null}
              <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
                <input type="checkbox" name="enabled" value="1" defaultChecked={provider.enabled} disabled={!canEdit} />
                Enabled
              </label>
              {canEdit ? <button type="submit" className="btn-primary w-fit">Save gateway</button> : null}
            </form>
            {canEdit ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#E4EBFF] pt-3">
                {!provider.isDefaultBackup ? (
                  <form action={actionSetDefaultBackupGateway}>
                    <input type="hidden" name="providerId" value={provider.id} />
                    <button type="submit" className="text-xs font-semibold text-violet hover:underline">
                      Set as default backup
                    </button>
                  </form>
                ) : null}
                <RemoveGatewayButton
                  providerId={provider.id}
                  providerName={provider.name}
                  alternatives={providers.map((item) => ({
                    id: item.id,
                    name: item.name,
                    code: item.code,
                  }))}
                />
              </div>
            ) : null}
          </AdminCollapse>
        ))}
        {canEdit ? (
          <form action={actionSaveGateway} className="grid gap-3 rounded-2xl border border-dashed border-[#E4EBFF] bg-white p-4 sm:grid-cols-2">
            <h3 className="font-semibold text-indigo sm:col-span-2">Add a gateway</h3>
            <label className="text-sm font-semibold text-indigo">
              Code
              <input name="code" required placeholder="paystack" className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              Name
              <input name="name" required placeholder="Paystack" className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo sm:col-span-2">
              Secret
              <input name="secret" type="password" className={inputClass} />
            </label>
            <button type="submit" className="btn-secondary w-fit">Add gateway</button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
