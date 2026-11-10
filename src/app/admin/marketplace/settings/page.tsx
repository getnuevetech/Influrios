import Link from "next/link";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import {
  actionSaveAttributionPolicy,
  actionSaveFundingSchedule,
  actionSaveAttributionSources,
  actionFileAttributionClaim,
  actionResolveAttributionClaim,
  actionCheckWiseRate,
  actionSaveDisputeReasons,
  actionSaveFxRates,
  actionSaveJurisdiction,
  actionSaveWise,
  actionSaveMarketplaceProvider,
  actionSaveMarketplaceSettings,
  actionSaveManualDepositInstructions,
  actionSaveRevenueParties,
  actionSaveTemplates,
  actionEnqueueAutoApproval,
  actionEnqueueReviewDeadlineSweep,
  actionEnqueueDisputeSlaSweep,
  actionEnqueueProviderHoldWarnSweep,
  actionEnqueueFailedPayoutRetrySweep,
  actionEnqueueFundingReconciliationSweep,
  actionEnqueueScheduledReleaseSweep,
  actionSaveCatalogOption,
  actionDeactivateCatalogOption,
  actionActivateCatalogOption,
} from "@/app/admin/marketplace/actions";
import { listAttributionClaims, listAttributionSources } from "@/lib/deal-attribution";
import { listAllCatalogOptions } from "@/lib/catalog-options";
import { listDisputeReasons } from "@/lib/milestone-disputes";
import { fundingTerm } from "@/lib/ledger";
import { listFxRates, listRevenueParties } from "@/lib/settlement";
import { wiseFxConfig } from "@/lib/wise-quote";
import { formatMoney } from "@/lib/money";
import { marketplaceConfig } from "@/lib/marketplace-ledger";
import { getManualDepositInstructions } from "@/lib/funding-checkout";
import { productSwitch } from "@/lib/product-switches";
import { AdminCollapse } from "@/components/admin-collapse";
import { ApprovedProvidersField } from "@/app/admin/marketplace/approved-providers-field";
import {
  approvedProviderPickerOptions,
  buildMarketplaceProviderOptions,
  marketplaceProviderCatalogLabel,
} from "@/app/admin/marketplace/provider-catalog";
import { capabilityDateInputValue, parseApprovedProviderIds } from "@/lib/jurisdiction-capabilities";
import { listProviders } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Marketplace configuration" };

type Props = {
  searchParams: Promise<{ saved?: string; error?: string; code?: string; wiseRate?: string; wiseCurrency?: string; q?: string; status?: string; page?: string }>;
};

export default async function AdminMarketplaceSettingsPage({ searchParams }: Props) {
  const session = await requireAdminPage("marketplace");
  const canManage = hasPermission(session, "marketplace.manage");
  const params = await searchParams;
  const [config, reasons, sources, claims, rates, parties, wise, reportsOn, collabOsOn, collabTypes, timeframes, paymentGateways, depositInstructions] =
    await Promise.all([
      marketplaceConfig(),
      listDisputeReasons(),
      listAttributionSources(),
      listAttributionClaims(),
      listFxRates(),
      listRevenueParties(),
      wiseFxConfig(),
      productSwitch("financial_reports"),
      productSwitch("collab_os_v1"),
      listAllCatalogOptions("collab_type"),
      listAllCatalogOptions("timeframe"),
      listProviders("payment").catch(() => []),
      getManualDepositInstructions(),
    ]);
  const marketplaceProviders = config.providers.filter((row) => row.code !== "demo");
  const demoProvider = config.providers.find((row) => row.code === "demo") ?? null;
  const providersByCode = new Map(marketplaceProviders.map((row) => [row.code, row]));
  const providerOptions = buildMarketplaceProviderOptions({
    paymentGateways,
    configuredMarketplace: marketplaceProviders,
  });
  const providerCodes = new Set(providerOptions.map((row) => row.code));
  // Keep the last-saved provider selected after redirect — empty defaultValue made browsers fall back to Primary.
  const requestedProviderCode = (params.code ?? "").trim().toLowerCase();
  const providerFormDefault = providerCodes.has(requestedProviderCode)
    ? requestedProviderCode
    : providerCodes.has(config.provider.code)
      ? config.provider.code
      : providerOptions[0]?.code ?? "primary";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Marketplace ledger</h1>
        <p className="mt-2">
          <Link href="/admin/marketplace" className="text-sm font-semibold text-violet hover:underline">
            ← Prefunds and releases
          </Link>
        </p>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Provider setup, jurisdictions, exchange rates, templates, and catalogs. Prefunds and release actions stay on the ledger. A provider code named demo
          cannot confirm a hold. Cancelling before confirmation posts no ledger entry. Dispute decisions do not
          move the money the provider is holding.
          Attribution is copied onto the prefund and is not rewritten when the source list changes. Staged or recurring
          prefunds stay unfunded until each tranche has its own confirmation. Gross is entered in USD. A new prefund
          uses the currency saved on that country corridor when one is saved, and otherwise the jurisdiction currency.
          A blank currency is not saved as USD. Revenue-share lines are written when the provider releases a
          milestone. They are not cash.
        </p>
      </div>

      {params.saved ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Saved {params.saved}.
        </div>
      ) : null}
      {params.error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {params.error}
        </div>
      ) : null}

      <section className="card-surface space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Manual deposit instructions</h2>
        <p className="max-w-3xl text-sm text-muted">
          ACH wire and check payments show these details to the business. Recording the payment leaves the agreement
          unfunded until finance confirms the deposit on the transaction.
        </p>
        {canManage ? (
          <form action={actionSaveManualDepositInstructions} className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted">
              Bank name
              <input name="bankName" defaultValue={depositInstructions.bankName} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal text-indigo" />
            </label>
            <label className="text-xs font-semibold text-muted">
              Account name
              <input name="accountName" defaultValue={depositInstructions.accountName} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal text-indigo" />
            </label>
            <label className="text-xs font-semibold text-muted">
              Routing number
              <input name="routingNumber" defaultValue={depositInstructions.routingNumber} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal text-indigo" />
            </label>
            <label className="text-xs font-semibold text-muted">
              Account number
              <input name="accountNumber" defaultValue={depositInstructions.accountNumber} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal text-indigo" />
            </label>
            <label className="text-xs font-semibold text-muted">
              Check payable to
              <input name="checkPayableTo" defaultValue={depositInstructions.checkPayableTo} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal text-indigo" />
            </label>
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Check mailing address
              <input name="checkMailingAddress" defaultValue={depositInstructions.checkMailingAddress} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal text-indigo" />
            </label>
            <button type="submit" className="btn-primary w-fit text-sm">
              Save deposit instructions
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted">Finance saves the bank and check details.</p>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-bold text-indigo">Marketplace provider</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            This is the ledger webhook that confirms a collaboration prefund — not Payment gateways API keys.
            The Provider list comes from{" "}
            <Link href="/admin/gateways" className="font-semibold text-violet hover:underline">
              Payment gateways
            </Link>{" "}
            (plus Primary), so a new gateway for another country appears here automatically. Enable it, paste that
            provider’s webhook signing secret, then assign the <strong>same</strong> provider on each jurisdiction below —
            jurisdictions still on Primary keep using Primary even after you configure Stripe or Airwallex here.
            Platform default (
            {marketplaceProviderCatalogLabel(config.provider.code, config.provider.name, providerOptions)}):{" "}
            {config.provider.ready ? "ready" : "not ready"}.
          </p>
        </div>

        {canManage ? (
          <form
            action={actionSaveMarketplaceProvider}
            className="grid gap-3 rounded-2xl border border-[#E4EBFF] bg-white p-4 sm:grid-cols-2"
          >
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Provider
              <select
                name="code"
                required
                defaultValue={providerFormDefault}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              >
                {providerOptions.map((row) => {
                  const configured = providersByCode.get(row.code);
                  const status = configured
                    ? configured.ready
                      ? "ready"
                      : configured.webhook === "saved"
                        ? "webhook saved · not enabled"
                        : "not configured yet"
                    : "not configured yet";
                  return (
                    <option key={row.code} value={row.code}>
                      {row.name} — {row.detail} ({status})
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Status
              <select
                name="enabled"
                defaultValue="1"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              >
                <option value="1">Enabled</option>
                <option value="0">Disabled</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Clear saved webhook secret?
              <select
                name="clearWebhook"
                defaultValue="0"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              >
                <option value="0">Keep current secret</option>
                <option value="1">Clear saved secret</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Webhook signing secret
              <input
                name="webhook"
                type="password"
                autoComplete="off"
                placeholder="Paste secret from the provider webhook settings (leave blank to keep a saved secret)"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
              <span className="mt-1 block text-[11px] font-normal text-muted">
                From the provider dashboard for <code className="text-indigo">/api/marketplace/webhook</code>
                {" "}(for example Stripe <code className="text-indigo">whsec_…</code>, or the Airwallex webhook
                secret). Not the API key from Payment gateways.
              </span>
            </label>
            <button type="submit" className="btn-primary sm:col-span-2 !py-2 text-sm">
              Save marketplace provider
            </button>
          </form>
        ) : null}

        <AdminCollapse
          title="Configured providers"
          subtitle={`${marketplaceProviders.length} saved · ${providerOptions.length} available from gateways`}
          defaultOpen
        >
          <ul className="space-y-2 text-sm text-indigo">
            {providerOptions.map((row) => {
              const configured = providersByCode.get(row.code);
              return (
                <li key={row.code} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E4EBFF] px-3 py-2">
                  <span className="font-semibold">{row.name}</span>
                  <span className="text-xs text-muted">
                    {configured
                      ? `${configured.enabled ? "Enabled" : "Disabled"} · webhook ${configured.webhook} · ${configured.ready ? "ready" : "not ready"}`
                      : "Not saved yet — choose it in Provider above"}
                  </span>
                </li>
              );
            })}
          </ul>
          {paymentGateways.length === 0 ? (
            <p className="mt-3 text-xs text-amber-800">
              No Payment gateways found yet. Add Stripe, Airwallex, or another gateway on Payment gateways, then
              return here to save its marketplace webhook.
            </p>
          ) : null}
          {demoProvider ? (
            <p className="mt-3 text-xs text-muted">
              Demo is retained for local testing only and cannot confirm a real prefund
              ({demoProvider.enabled ? "enabled" : "disabled"} · webhook {demoProvider.webhook}).
            </p>
          ) : null}
        </AdminCollapse>
      </section>

      <section className="card-surface p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Review window</h2>
        <p className="mt-1 text-xs text-muted">
          Quote life, the unknown-command wait, dispute reminders, hold warnings, payout retries, stale funding, the review notice, and team proposal life are edited on Payment settings.
        </p>
        <p className="mt-1 text-xs text-muted">
          A submitted milestone auto-approves after this many hours. The window, the revision limit, and the evidence cap are copied onto each new prefund or dispute. A gross cap of 0 means no cap. It is checked on the USD amount when a prefund is created. Lowering it does not cancel a prefund already requested. Turning partial refunds off blocks a new request. A request already recorded still waits for the provider, and the rest of that milestone can be released. A change order amends the gross while the prefund is still waiting for the provider. The limit is copied onto that prefund. Zero means none. Turning change orders off blocks a new amendment and leaves one already recorded in place. The earlier fee snapshot stays on the change order. An open-dispute limit of 0 means no extra limit. Turning risk controls off skips that check and leaves the gross cap in place. The monthly report lists amounts recorded that month. Turning it off hides the report and does not delete ledger rows.
        </p>
        {canManage ? (
          <form action={actionSaveMarketplaceSettings} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-muted">
              Hours
              <input
                name="reviewWindowHours"
                type="number"
                min={1}
                max={720}
                defaultValue={config.reviewWindowHours}
                className="mt-1 w-32 rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Revisions
              <input
                name="maxRevisions"
                type="number"
                min={0}
                max={20}
                defaultValue={config.maxRevisions}
                className="mt-1 w-32 rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Evidence
              <input
                name="maxEvidence"
                type="number"
                min={0}
                max={20}
                defaultValue={config.maxEvidence}
                className="mt-1 w-32 rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Gross cap USD
              <input
                name="maxGrossUsd"
                type="number"
                min={0}
                max={1000000}
                step={1}
                defaultValue={config.maxGrossCents / 100}
                className="mt-1 w-32 rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Change orders
              <input
                name="maxChangeOrders"
                type="number"
                min={0}
                max={20}
                defaultValue={config.maxChangeOrders}
                className="mt-1 w-32 rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="partialRefundsEnabled" defaultChecked={config.partialRefundsEnabled} className="accent-violet" />
              Allow a partial refund request
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="changeOrdersEnabled" defaultChecked={config.changeOrdersEnabled} className="accent-violet" />
              Allow a change order before the provider confirms
            </label>
            <label className="text-xs font-semibold text-muted">
              Open disputes
              <input
                name="maxOpenDisputes"
                type="number"
                min={0}
                max={1000}
                defaultValue={config.maxOpenDisputes}
                className="mt-1 w-32 rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="riskControlsEnabled" defaultChecked={config.riskControlsEnabled} className="accent-violet" />
              Limit new prefunds when a business has too many open disputes
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="financialReports" defaultChecked={reportsOn} className="accent-violet" />
              Show the monthly ledger report
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="collabOsV1" defaultChecked={collabOsOn} className="accent-violet" />
              Collaboration OS hubs and contract wizard (`collab_os_v1`)
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="cancelUnconfirmed" defaultChecked={config.cancelUnconfirmed} className="accent-violet" />
              Allow cancelling a prefund before the provider confirms it
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input
                type="checkbox"
                name="autoApprovalEnabled"
                defaultChecked={config.autoApprovalEnabled}
                className="accent-violet"
              />
              Run milestone auto-approval job when the review window expires
            </label>
            <label className="text-xs font-semibold text-muted">
              Kill fee % (current milestone after work begins)
              <input
                name="killFeePercent"
                type="number"
                min={0}
                max={100}
                step={1}
                defaultValue={Math.round((config.killFeeBps ?? 2500) / 100)}
                className="mt-1 w-32 rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Kill fee fixed USD
              <input
                name="killFeeFixedUsd"
                type="number"
                min={0}
                step={0.01}
                defaultValue={((config.killFeeFixedCents ?? 0) / 100).toFixed(2)}
                className="mt-1 w-32 rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <button type="submit" className="btn-primary !py-2 text-sm">
              Save window
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-indigo">
            {config.reviewWindowHours} hours · {config.maxRevisions} revisions · {config.maxEvidence} evidence · cap{" "}
            {config.maxGrossCents > 0 ? formatMoney(config.maxGrossCents) : "off"} · partial refunds{" "}
            {config.partialRefundsEnabled ? "on" : "off"} · change orders{" "}
            {config.changeOrdersEnabled ? config.maxChangeOrders : "off"} · open disputes{" "}
            {config.riskControlsEnabled ? config.maxOpenDisputes : "off"} · monthly report {reportsOn ? "on" : "off"}
            · collab OS {collabOsOn ? "on" : "off"} · auto-approval {config.autoApprovalEnabled ? "on" : "off"} · kill fee{" "}
            {((config.killFeeBps ?? 0) / 100).toFixed(0)}% + {formatMoney(config.killFeeFixedCents ?? 0)}
          </p>
        )}
        {canManage ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={actionEnqueueAutoApproval}>
              <button type="submit" className="btn-secondary !py-1.5 text-xs">
                Queue auto-approval sweep now
              </button>
            </form>
            <form action={actionEnqueueReviewDeadlineSweep}>
              <button type="submit" className="btn-secondary !py-1.5 text-xs">
                Queue review-deadline notices now
              </button>
            </form>
            <form action={actionEnqueueDisputeSlaSweep}>
              <button type="submit" className="btn-secondary !py-1.5 text-xs">
                Queue dispute SLA reminders now
              </button>
            </form>
            <form action={actionEnqueueProviderHoldWarnSweep}>
              <button type="submit" className="btn-secondary !py-1.5 text-xs">
                Queue provider hold warnings now
              </button>
            </form>
            <form action={actionEnqueueFailedPayoutRetrySweep}>
              <button type="submit" className="btn-secondary !py-1.5 text-xs">
                Queue failed payout retries now
              </button>
            </form>
            <form action={actionEnqueueFundingReconciliationSweep}>
              <button type="submit" className="btn-secondary !py-1.5 text-xs">
                Queue funding reconciliation now
              </button>
            </form>
            <form action={actionEnqueueScheduledReleaseSweep}>
              <button type="submit" className="btn-secondary !py-1.5 text-xs">
                Queue scheduled releases now
              </button>
            </form>
          </div>
        ) : null}
      </section>

      <section id="catalog" className="card-surface space-y-5 p-5">
        <div>
          <h2 className="font-display text-lg font-bold text-indigo">Campaign intent catalog</h2>
          <p className="mt-1 text-xs text-muted">
            Collaboration type and timeframe options shown on the business Campaign Intent form. Removing an option
            only hides it from new picks — briefs already saved with it keep the stored value.
          </p>
        </div>

        {([
          { kind: "collab_type" as const, label: "Collaboration types", rows: collabTypes },
          { kind: "timeframe" as const, label: "Timeframes", rows: timeframes },
        ]).map((group) => (
          <div key={group.kind} className="rounded-xl border border-border p-4">
            <h3 className="font-display text-base font-bold text-indigo">{group.label}</h3>
            <ul className="mt-3 space-y-2">
              {group.rows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 rounded-lg bg-[#F7FAFF] px-3 py-2">
                  <span className={`text-sm ${row.active ? "text-indigo" : "text-muted line-through"}`}>
                    {row.label}
                  </span>
                  {canManage ? (
                    row.active ? (
                      <form action={actionDeactivateCatalogOption}>
                        <input type="hidden" name="id" value={row.id} />
                        <button type="submit" className="text-xs font-semibold text-muted hover:text-rose-600">
                          Deactivate
                        </button>
                      </form>
                    ) : (
                      <form action={actionActivateCatalogOption}>
                        <input type="hidden" name="id" value={row.id} />
                        <button type="submit" className="text-xs font-semibold text-violet hover:underline">
                          Restore
                        </button>
                      </form>
                    )
                  ) : (
                    <span className="text-xs text-muted">{row.active ? "Active" : "Inactive"}</span>
                  )}
                </li>
              ))}
            </ul>
            {canManage ? (
              <form action={actionSaveCatalogOption} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="kind" value={group.kind} />
                <label className="text-xs font-semibold text-muted">
                  Add option
                  <input
                    name="label"
                    required
                    placeholder="Label"
                    className="mt-1 w-56 rounded-lg border border-border px-3 py-2 text-sm text-indigo"
                  />
                </label>
                <button type="submit" className="btn-secondary !py-2 text-sm">
                  Add
                </button>
              </form>
            ) : null}
          </div>
        ))}
      </section>

      <section className="card-surface space-y-4 p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Jurisdictions</h2>
        <p className="text-xs text-muted">
          Capability flags override features even when a fee rule or provider adapter exists (PA007 / Dev §24).
          Managed introduction and managed campaign stay off until legal review is APPROVED and the matching toggle is on.
        </p>
        {config.jurisdictions.map((row) => (
          <AdminCollapse
            key={row.code}
            title={`${row.label} (${row.code})`}
            subtitle={`${row.currency} · ${row.protectedPaymentsEnabled ? "protected payments on" : "protected payments off"} · legal ${row.legalReviewStatus}`}
            defaultOpen={params.code === row.code}
          >
          <form action={actionSaveJurisdiction} className="grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="code" value={row.code} />
            <label className="text-xs font-semibold text-muted">
              Code
              <input value={row.code} readOnly className="mt-1 w-full rounded-lg border border-border bg-[#F7FAFF] px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-muted sm:col-span-3">
              Label
              <input
                name="label"
                defaultValue={row.label}
                disabled={!canManage}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input
                type="checkbox"
                name="protectedPaymentsEnabled"
                defaultChecked={row.protectedPaymentsEnabled}
                disabled={!canManage}
                className="accent-violet"
              />
              Protected payments
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input
                type="checkbox"
                name="escrowTermAllowed"
                defaultChecked={row.escrowTermAllowed}
                disabled={!canManage}
                className="accent-violet"
              />
              Allow the word escrow
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input
                type="checkbox"
                name="fullPrefundingEnabled"
                defaultChecked={row.fullPrefundingEnabled}
                disabled={!canManage}
                className="accent-violet"
              />
              Full prefunding
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input
                type="checkbox"
                name="stagedPrefundingEnabled"
                defaultChecked={row.stagedPrefundingEnabled}
                disabled={!canManage}
                className="accent-violet"
              />
              Staged prefunding
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input
                type="checkbox"
                name="recurringFundingEnabled"
                defaultChecked={row.recurringFundingEnabled}
                disabled={!canManage}
                className="accent-violet"
              />
              Recurring funding
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input
                type="checkbox"
                name="managedIntroductionEnabled"
                defaultChecked={row.managedIntroductionEnabled}
                disabled={!canManage}
                className="accent-violet"
              />
              Managed introduction
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input
                type="checkbox"
                name="managedNegotiationEnabled"
                defaultChecked={row.managedNegotiationEnabled}
                disabled={!canManage}
                className="accent-violet"
              />
              Managed negotiation / campaign
            </label>
            <label className="text-xs font-semibold text-muted">
              Legal review
              <select
                name="legalReviewStatus"
                defaultValue={row.legalReviewStatus}
                disabled={!canManage}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              >
                <option value="APPROVED">APPROVED</option>
                <option value="PENDING">PENDING</option>
                <option value="BLOCKED">BLOCKED</option>
              </select>
            </label>
            <ApprovedProvidersField
              options={approvedProviderPickerOptions(
                providerOptions,
                parseApprovedProviderIds(row.approvedProviderIds),
              )}
              selected={parseApprovedProviderIds(row.approvedProviderIds)}
              disabled={!canManage}
            />
            <label className="text-xs font-semibold text-muted">
              Effective from
              <input
                name="capabilitiesEffectiveFrom"
                type="date"
                defaultValue={capabilityDateInputValue(row.capabilitiesEffectiveFrom)}
                disabled={!canManage}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Effective to
              <input
                name="capabilitiesEffectiveTo"
                type="date"
                defaultValue={capabilityDateInputValue(row.capabilitiesEffectiveTo)}
                disabled={!canManage}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Capability notes
              <input
                name="capabilityNotes"
                defaultValue={row.capabilityNotes}
                disabled={!canManage}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Review window hours (blank = marketplace default)
              <input
                name="reviewWindowHours"
                type="number"
                min={0}
                max={8760}
                defaultValue={row.reviewWindowHours ?? ""}
                disabled={!canManage}
                placeholder={String(config.reviewWindowHours)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Max revisions (blank = marketplace default)
              <input
                name="maxRevisions"
                type="number"
                min={0}
                max={20}
                defaultValue={row.maxRevisions ?? ""}
                disabled={!canManage}
                placeholder={String(config.maxRevisions)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <input type="hidden" name="currency" value={row.currency} />
            <input type="hidden" name="minorDigits" value={row.minorDigits} />
            <input type="hidden" name="providerCode" value={row.providerCode} />
            <p className="text-xs text-muted sm:col-span-4">
              Currency {row.currency}, {row.minorDigits} minor digits, holding provider {row.providerCode}.{" "}
              <Link href="/admin/payment-settings" className="font-semibold text-violet hover:underline">
                Edit the route on Payment settings
              </Link>
              .
            </p>
            <p className="text-sm text-muted sm:col-span-2">Shown as {fundingTerm(row.escrowTermAllowed)}.</p>
            {canManage ? (
              <button type="submit" className="btn-secondary !py-2 text-sm sm:col-span-4">
                Save {row.code}
              </button>
            ) : null}
          </form>
          </AdminCollapse>
        ))}
        {canManage ? (
          <AdminCollapse title="Add jurisdiction" subtitle="New country capability set">
          <form action={actionSaveJurisdiction} className="grid gap-3 sm:grid-cols-4">
            <label className="text-xs font-semibold text-muted">
              New code
              <input name="code" maxLength={2} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm uppercase" />
            </label>
            <label className="text-xs font-semibold text-muted sm:col-span-3">
              Label
              <input name="label" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="protectedPaymentsEnabled" className="accent-violet" />
              Protected payments
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="escrowTermAllowed" className="accent-violet" />
              Allow the word escrow
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="fullPrefundingEnabled" className="accent-violet" />
              Full prefunding
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="stagedPrefundingEnabled" className="accent-violet" />
              Staged prefunding
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="recurringFundingEnabled" className="accent-violet" />
              Recurring funding
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="managedIntroductionEnabled" className="accent-violet" />
              Managed introduction
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="managedNegotiationEnabled" className="accent-violet" />
              Managed negotiation / campaign
            </label>
            <label className="text-xs font-semibold text-muted">
              Legal review
              <select name="legalReviewStatus" required defaultValue="" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo">
                <option value="">Choose a legal review status</option>
                <option value="APPROVED">APPROVED</option>
                <option value="PENDING">PENDING</option>
                <option value="BLOCKED">BLOCKED</option>
              </select>
            </label>
            <ApprovedProvidersField
              options={approvedProviderPickerOptions(providerOptions)}
              selected={[]}
            />
            <label className="text-xs font-semibold text-muted">
              Effective from
              <input name="capabilitiesEffectiveFrom" type="date" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-muted">
              Effective to
              <input name="capabilitiesEffectiveTo" type="date" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Capability notes
              <input name="capabilityNotes" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-muted">
              Currency
              <input name="currency" maxLength={3} required className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm uppercase" />
            </label>
            <label className="text-xs font-semibold text-muted">
              Minor digits
              <input name="minorDigits" type="number" min={0} max={4} required className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-muted">
              Provider
              <select name="providerCode" required defaultValue="" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm">
                <option value="">Choose a provider</option>
                {providerOptions.map((provider) => (
                  <option key={provider.code} value={provider.code}>
                    {provider.name}
                    {providersByCode.get(provider.code)?.ready ? " · ready" : " · configure webhook above first"}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-secondary !py-2 text-sm sm:col-span-4">
              Add jurisdiction
            </button>
          </form>
          </AdminCollapse>
        ) : null}
      </section>

      <AdminCollapse title="Wise user rate" subtitle="FX quote tooling">
        <h2 className="sr-only">Wise user rate</h2>
        <p className="mt-1 text-xs text-muted">
          A non-USD prefund asks Wise for the user rate on this profile. USD stays 1.00. If Wise is not ready, or the
          quote fails, nothing is funded. The returned rate is copied onto the funding. The minor-unit figure below is
          only the last quote this server stored. It is not used for the next prefund. Wise transfer fees are not added.
        </p>
        <p className="mt-2 text-xs text-muted">
          Status: {wise.ready ? "ready" : "not ready"}. Token: {wise.token}. Profile: {wise.profileId || "missing"}.
        </p>
        {params.wiseRate ? (
          <p className="mt-2 text-sm text-indigo">
            Latest check for {params.wiseCurrency}: 1.00 USD = {params.wiseRate} {params.wiseCurrency} at the Wise user rate.
          </p>
        ) : null}
        {canManage ? (
          <>
            <form action={actionSaveWise} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-muted">
                Host
                <select name="baseUrl" defaultValue={wise.baseUrl} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo">
                  <option value="https://api.wise.com">api.wise.com</option>
                  <option value="https://api.wise-sandbox.com">api.wise-sandbox.com</option>
                  <option value="https://api.transferwise.com">api.transferwise.com</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-muted">
                API version
                <input name="apiVersion" defaultValue={wise.apiVersion} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo" />
              </label>
              <label className="text-xs font-semibold text-muted">
                Profile id
                <input name="profileId" defaultValue={wise.profileId} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo" />
              </label>
              <label className="text-xs font-semibold text-muted">
                API token
                <input
                  name="token"
                  type="password"
                  autoComplete="off"
                  placeholder={wise.token === "saved" ? "Saved — leave blank to keep" : "Not saved"}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-indigo">
                <input type="checkbox" name="enabled" defaultChecked={wise.enabled} className="accent-violet" />
                Enabled
              </label>
              <label className="flex items-center gap-2 text-sm text-indigo">
                <input type="checkbox" name="clearToken" className="accent-violet" />
                Clear API token
              </label>
              <button type="submit" className="btn-primary sm:col-span-2 !py-2 text-sm">
                Save Wise
              </button>
            </form>
            <form action={actionCheckWiseRate} className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-xs font-semibold text-muted">
                USD amount
                <input name="amount" inputMode="decimal" className="mt-1 w-28 rounded-lg border border-border px-3 py-2 text-sm text-indigo" />
              </label>
              <label className="text-xs font-semibold text-muted">
                To currency
                <input name="currency" maxLength={3} className="mt-1 w-24 rounded-lg border border-border px-3 py-2 text-sm uppercase text-indigo" />
              </label>
              <label className="text-xs font-semibold text-muted">
                Minor digits
                <input name="minorDigits" inputMode="numeric" maxLength={1} className="mt-1 w-24 rounded-lg border border-border px-3 py-2 text-sm text-indigo" />
              </label>
              <button type="submit" className="btn-secondary !py-2 text-sm">
                Pull Wise user rate
              </button>
            </form>
          </>
        ) : null}
        <h3 className="mt-6 font-display text-base font-bold text-indigo">Allowed currencies</h3>
        <p className="mt-1 text-xs text-muted">
          Only an active currency can be quoted. Turning one off refuses that prefund. USD does not need a row.
        </p>
        {canManage ? (
          <form action={actionSaveFxRates} className="mt-4 space-y-3">
            {rates.map((rate, index) => (
              <div key={rate.currency} className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
                <input
                  name="currency"
                  defaultValue={rate.currency}
                  maxLength={3}
                  className="rounded-lg border border-border px-3 py-2 text-sm uppercase text-indigo"
                />
                <p className="self-center text-sm text-muted">Last stored quote: {rate.minorPerUsd} minor units per 1.00 USD</p>
                <label className="flex items-center gap-2 text-sm text-indigo">
                  <input type="checkbox" name="activeIndex" value={String(index)} defaultChecked={rate.active} className="accent-violet" />
                  Active
                </label>
              </div>
            ))}
            <div className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
              <input name="newCurrency" maxLength={3} placeholder="EUR" className="rounded-lg border border-border px-3 py-2 text-sm uppercase" />
              <p className="self-center text-sm text-muted">A new currency waits for a Wise quote.</p>
              <label className="flex items-center gap-2 text-sm text-indigo">
                <input type="checkbox" name="newActive" defaultChecked className="accent-violet" />
                Active
              </label>
            </div>
            <button type="submit" className="btn-primary !py-2 text-sm">
              Save currencies
            </button>
          </form>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-indigo">
            {rates.map((rate) => (
              <li key={rate.currency}>
                {rate.currency} · last stored {rate.minorPerUsd} minor units{rate.active ? "" : " · inactive"}
              </li>
            ))}
          </ul>
        )}
      </AdminCollapse>

      <AdminCollapse title="Revenue shares" subtitle="Party splits">
        <h2 className="sr-only">Revenue shares</h2>
        <p className="mt-1 text-xs text-muted">
          Active shares must add up to 100%. The split is copied onto a prefund and written as share lines only when
          the provider releases a milestone. Those lines are not cash, and a later edit does not rewrite a frozen split.
        </p>
        {canManage ? (
          <form action={actionSaveRevenueParties} className="mt-4 space-y-3">
            {parties.map((party, index) => (
              <div key={party.id} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
                <input type="hidden" name="id" value={party.id} />
                <input name="label" defaultValue={party.label} className="rounded-lg border border-border px-3 py-2 text-sm text-indigo" />
                <input
                  name="sharePercent"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={party.shareBps / 100}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-indigo"
                />
                <label className="flex items-center gap-2 text-sm text-indigo">
                  <input type="checkbox" name="activeIndex" value={String(index)} defaultChecked={party.active} className="accent-violet" />
                  Active
                </label>
              </div>
            ))}
            <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
              <input name="newLabel" placeholder="Add a party" className="rounded-lg border border-border px-3 py-2 text-sm" />
              <input name="newSharePercent" type="number" min={1} max={100} placeholder="%" className="rounded-lg border border-border px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm text-indigo">
                <input type="checkbox" name="newActive" className="accent-violet" />
                Active
              </label>
            </div>
            <button type="submit" className="btn-primary !py-2 text-sm">
              Save revenue shares
            </button>
          </form>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-indigo">
            {parties.map((party) => (
              <li key={party.id}>
                {party.label} · {party.shareBps / 100}%{party.active ? "" : " · inactive"}
              </li>
            ))}
          </ul>
        )}
      </AdminCollapse>

      <AdminCollapse title="Milestone templates" subtitle="Default contract milestones">
        <h2 className="sr-only">Milestone templates</h2>
        <p className="mt-1 text-xs text-muted">Active shares must add up to 100%. Later edits do not change an existing prefund.</p>
        {canManage ? (
          <form action={actionSaveTemplates} className="mt-4 space-y-3">
            {config.templates.map((template, index) => (
              <div key={template.id} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
                <input type="hidden" name="id" value={template.id} />
                <input
                  name="title"
                  defaultValue={template.title}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-indigo"
                />
                <input
                  name="sharePercent"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={template.shareBps / 100}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-indigo"
                />
                <label className="flex items-center gap-2 text-sm text-indigo">
                  <input type="checkbox" name="activeIndex" value={String(index)} defaultChecked={template.active} className="accent-violet" />
                  Active
                </label>
              </div>
            ))}
            <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
              <input name="newTitle" placeholder="Add a milestone" className="rounded-lg border border-border px-3 py-2 text-sm" />
              <input name="newSharePercent" type="number" min={1} max={100} placeholder="%" className="rounded-lg border border-border px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm text-indigo">
                <input type="checkbox" name="newActive" defaultChecked className="accent-violet" />
                Active
              </label>
            </div>
            <button type="submit" className="btn-primary !py-2 text-sm">
              Save templates
            </button>
          </form>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-indigo">
            {config.templates.map((template) => (
              <li key={template.id}>
                {template.title} · {template.shareBps / 100}%{template.active ? "" : " · inactive"}
              </li>
            ))}
          </ul>
        )}
      </AdminCollapse>


      <AdminCollapse title="Dispute reasons" subtitle="Catalog">
        <h2 className="sr-only">Dispute reasons</h2>
        <p className="mt-1 text-xs text-muted">
          The label is copied onto a dispute when it opens. Later edits do not rename open cases. A decision does not
          move money; the provider webhook does.
        </p>
        {canManage ? (
          <form action={actionSaveDisputeReasons} className="mt-4 space-y-3">
            {reasons.map((reason, index) => (
              <div key={reason.id} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input type="hidden" name="id" value={reason.id} />
                <input name="label" defaultValue={reason.label} className="rounded-lg border border-border px-3 py-2 text-sm text-indigo" />
                <label className="flex items-center gap-2 text-sm text-indigo">
                  <input type="checkbox" name="activeIndex" value={String(index)} defaultChecked={reason.active} className="accent-violet" />
                  Active
                </label>
              </div>
            ))}
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input name="newLabel" placeholder="Add a reason" className="rounded-lg border border-border px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm text-indigo">
                <input type="checkbox" name="newActive" defaultChecked className="accent-violet" />
                Active
              </label>
            </div>
            <button type="submit" className="btn-primary !py-2 text-sm">
              Save reasons
            </button>
          </form>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-indigo">
            {reasons.map((reason) => (
              <li key={reason.id}>
                {reason.label}
                {reason.active ? "" : " · inactive"}
              </li>
            ))}
          </ul>
        )}
      </AdminCollapse>

      <AdminCollapse title="Attribution" subtitle="Sources and claims">
        <h2 className="sr-only">Attribution</h2>
        <p className="mt-1 text-xs text-muted">
          Attribution expiry is finite (never forever). A repeat must be the same business and creator, already
          confirmed by the provider, inside this expiry window, and at least the minimum gross. Pre-existing
          relationship claims can be contested and resolved here; upheld claims block managed introduction fees.
        </p>
        {canManage ? (
          <form action={actionSaveAttributionPolicy} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-muted">
              Expiry days
              <input
                name="attributionWindowDays"
                type="number"
                min={1}
                max={3650}
                defaultValue={config.attributionWindowDays}
                className="mt-1 w-32 rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Repeat minimum USD
              <input
                name="repeatMinUsd"
                type="number"
                min={0}
                step={1}
                defaultValue={config.repeatMinGrossCents / 100}
                className="mt-1 w-40 rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <button type="submit" className="btn-primary !py-2 text-sm">
              Save attribution
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-indigo">
            Expires after {config.attributionWindowDays} days · minimum {formatMoney(config.repeatMinGrossCents)}
          </p>
        )}
        {canManage ? (
          <form action={actionSaveAttributionSources} className="mt-4 space-y-3">
            {sources.map((source, index) => (
              <div key={source.id} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input type="hidden" name="id" value={source.id} />
                <input name="label" defaultValue={source.label} className="rounded-lg border border-border px-3 py-2 text-sm text-indigo" />
                <label className="flex items-center gap-2 text-sm text-indigo">
                  <input type="checkbox" name="activeIndex" value={String(index)} defaultChecked={source.active} className="accent-violet" />
                  Active
                </label>
              </div>
            ))}
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input name="newLabel" placeholder="Add a source" className="rounded-lg border border-border px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm text-indigo">
                <input type="checkbox" name="newActive" defaultChecked className="accent-violet" />
                Active
              </label>
            </div>
            <button type="submit" className="btn-primary !py-2 text-sm">
              Save sources
            </button>
          </form>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-indigo">
            {sources.map((source) => (
              <li key={source.id}>
                {source.label}
                {source.active ? "" : " · inactive"}
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-6 font-display text-base font-bold text-indigo">Pre-existing relationship contests</h3>
        {canManage ? (
          <form action={actionFileAttributionClaim} className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted">
              Business
              <input name="businessName" required className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-muted">
              Influencer slug
              <input name="creatorSlug" required className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Evidence
              <textarea name="evidence" required rows={2} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Optional funding id
              <input name="fundingId" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-mono" />
            </label>
            <button type="submit" className="btn-secondary !py-2 text-sm sm:col-span-2">
              File pre-existing claim
            </button>
          </form>
        ) : null}
        <ul className="mt-4 space-y-3">
          {claims.length === 0 ? <li className="text-sm text-muted">No attribution claims yet.</li> : null}
          {claims.map((claim) => (
            <li key={claim.id} className="rounded-xl border border-border p-3 text-sm text-indigo">
              <p className="font-semibold">
                {claim.businessName} → {claim.creatorSlug} · {claim.status}
              </p>
              <p className="mt-1 text-xs text-muted">{claim.evidence}</p>
              {canManage && (claim.status === "open" || claim.status === "under_review") ? (
                <form action={actionResolveAttributionClaim} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="claimId" value={claim.id} />
                  <label className="text-xs font-semibold text-muted">
                    Admin note
                    <input name="adminNote" className="mt-1 w-56 rounded-lg border border-border px-2 py-1.5 text-sm" />
                  </label>
                  <button type="submit" name="decision" value="upheld" className="btn-primary !py-1.5 text-xs">
                    Uphold (pre-existing)
                  </button>
                  <button type="submit" name="decision" value="rejected" className="btn-secondary !py-1.5 text-xs">
                    Reject
                  </button>
                </form>
              ) : null}
              {claim.resolvedAt ? (
                <p className="mt-1 text-[11px] text-muted">
                  Resolved {claim.resolvedAt.toISOString().slice(0, 10)}
                  {claim.adminNote ? ` · ${claim.adminNote}` : ""}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </AdminCollapse>

      <AdminCollapse title="Funding schedule" subtitle="Recurring and staged">
        <h2 className="sr-only">Funding schedule</h2>
        <p className="mt-1 text-xs text-muted">
          Staged deals split the gross into prefunds now. Recurring deals open only the first prefund. The next one
          is created after the provider confirms the current one and the interval has passed. Neither posts a hold.
        </p>
        {canManage ? (
          <form action={actionSaveFundingSchedule} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="stagedFundingEnabled" defaultChecked={config.stagedFundingEnabled} className="accent-violet" />
              Staged
            </label>
            <label className="text-xs font-semibold text-muted">
              Max stages
              <input
                name="maxStages"
                type="number"
                min={2}
                max={12}
                defaultValue={config.maxStages}
                className="mt-1 w-24 rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="recurringFundingEnabled" defaultChecked={config.recurringFundingEnabled} className="accent-violet" />
              Recurring
            </label>
            <label className="text-xs font-semibold text-muted">
              Interval days
              <input
                name="recurringIntervalDays"
                type="number"
                min={1}
                max={365}
                defaultValue={config.recurringIntervalDays}
                className="mt-1 w-28 rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Max occurrences
              <input
                name="maxRecurrences"
                type="number"
                min={2}
                max={24}
                defaultValue={config.maxRecurrences}
                className="mt-1 w-28 rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <button type="submit" className="btn-primary !py-2 text-sm">
              Save schedule
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-indigo">
            {config.stagedFundingEnabled ? `Staged up to ${config.maxStages}` : "Staged off"}
            {" · "}
            {config.recurringFundingEnabled
              ? `Recurring every ${config.recurringIntervalDays} days, up to ${config.maxRecurrences}`
              : "Recurring off"}
          </p>
        )}
      </AdminCollapse>


    </div>
  );
}
