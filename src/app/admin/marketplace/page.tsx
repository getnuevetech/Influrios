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
  actionSaveRevenueParties,
  actionSaveTemplates,
  actionEnqueueAutoApproval,
  actionEnqueueReviewDeadlineSweep,
  actionEnqueueDisputeSlaSweep,
  actionEnqueueProviderHoldWarnSweep,
  actionEnqueueFailedPayoutRetrySweep,
  actionEnqueueFundingReconciliationSweep,
  actionEnqueueScheduledReleaseSweep,
  actionScheduleMilestoneRelease,
  actionExecuteHeldCancellation,
} from "@/app/admin/marketplace/actions";
import { listAttributionClaims, listAttributionSources } from "@/lib/deal-attribution";
import { readShareSnapshot } from "@/lib/fx-share";
import { listDisputeReasons } from "@/lib/milestone-disputes";
import { CANCELLATION_REASON_LABELS, type CancellationReason } from "@/lib/cancellation-matrix";
import { listPaymentRiskFundings } from "@/lib/collaboration-cancellation";
import { fundingTerm } from "@/lib/ledger";
import { scheduleLabel } from "@/lib/schedule";
import { listFxRates, listRevenueParties } from "@/lib/settlement";
import { wiseFxConfig } from "@/lib/wise-quote";
import { formatMoney } from "@/lib/money";
import { ledgerMonthlyReport, ledgerTotals, listFundings, marketplaceConfig } from "@/lib/marketplace-ledger";
import { productSwitch } from "@/lib/product-switches";
import { FEE_TYPE_LABELS, type FeeType } from "@/lib/collaboration-fees";
import { feeTypeFromFundingSnapshot, type FeeTypeAmount } from "@/lib/ledger";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Marketplace ledger" };

type Props = { searchParams: Promise<{ saved?: string; error?: string; wiseRate?: string; wiseCurrency?: string }> };

const CANCEL_REASONS = Object.keys(CANCELLATION_REASON_LABELS) as CancellationReason[];

function formatFeesByType(feesByType: FeeTypeAmount[], currency: string, totalCents: number) {
  if (feesByType.length === 0) return formatMoney(totalCents, currency);
  if (feesByType.length === 1) {
    const only = feesByType[0];
    const label = FEE_TYPE_LABELS[only.feeType as FeeType] ?? only.feeType;
    return `${label} ${formatMoney(only.amountCents, currency)}`;
  }
  const parts = feesByType.map((row) => {
    const label = FEE_TYPE_LABELS[row.feeType as FeeType] ?? row.feeType;
    return `${label} ${formatMoney(row.amountCents, currency)}`;
  });
  return `${formatMoney(totalCents, currency)} (${parts.join("; ")})`;
}

export default async function AdminMarketplacePage({ searchParams }: Props) {
  const session = await requireAdminPage("marketplace");
  const canManage = hasPermission(session, "marketplace.manage");
  const canHighRiskCancel = hasPermission(session, "collab_finance.high_risk");
  const params = await searchParams;
  const [config, fundings, totals, reasons, sources, claims, rates, parties, wise, reportsOn, collabOsOn, paymentRisk] =
    await Promise.all([
      marketplaceConfig(),
      listFundings(),
      ledgerTotals(),
      listDisputeReasons(),
      listAttributionSources(),
      listAttributionClaims(),
      listFxRates(),
      listRevenueParties(),
      wiseFxConfig(),
      productSwitch("financial_reports"),
      productSwitch("collab_os_v1"),
      listPaymentRiskFundings(),
    ]);
  const monthly = reportsOn ? await ledgerMonthlyReport() : [];
  const cancellable = fundings.filter((f) => f.status === "held" || f.status === "payment_risk");
  const schedulable = fundings.flatMap((funding) =>
    funding.status !== "held"
      ? []
      : funding.milestones
          .filter((m) => m.status === "approved" || m.status === "payout_failed")
          .map((m) => ({ funding, milestone: m })),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Marketplace ledger</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          A prefund stays unfunded until a signed provider webhook confirms it. Cancelling before that confirmation
          posts no ledger entry. Dispute decisions do not move the money the provider is holding. Attribution is
          copied onto the prefund and is not rewritten when the source list changes. A staged or recurring
          prefund stays unfunded until each tranche has its own signed webhook.           Gross is entered in USD. Another currency uses the Wise user rate for the saved profile. A typed
          number is not the rate. Revenue-share lines are written when the provider releases a milestone. They are not cash.
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

      <section className="card-surface p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Marketplace provider</h2>
        <p className="mt-1 text-xs text-muted">
          Ready when enabled and a webhook secret is saved. Status: {config.provider.ready ? "ready" : "not ready"}.
          Webhook secret: {config.provider.webhook}.
        </p>
        {canManage ? (
          <form action={actionSaveMarketplaceProvider} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="code" value={config.provider.code} />
            <label className="text-xs font-semibold text-muted">
              Name
              <input
                name="name"
                defaultValue={config.provider.name}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Webhook secret
              <input
                name="webhook"
                type="password"
                autoComplete="off"
                placeholder={config.provider.webhook === "saved" ? "Saved — leave blank to keep" : "Not saved"}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="enabled" defaultChecked={config.provider.enabled} className="accent-violet" />
              Enabled
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="clearWebhook" className="accent-violet" />
              Clear webhook secret
            </label>
            <button type="submit" className="btn-primary sm:col-span-2 !py-2 text-sm">
              Save provider
            </button>
          </form>
        ) : null}
        {config.providers.filter((row) => row.code !== config.provider.code).map((row) => (
          <form key={row.code} action={actionSaveMarketplaceProvider} className="mt-4 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
            <input type="hidden" name="code" value={row.code} />
            <p className="text-xs font-semibold uppercase tracking-wide text-violet sm:col-span-2">
              {row.code} · {row.ready ? "ready" : "not ready"} · webhook {row.webhook}
            </p>
            <label className="text-xs font-semibold text-muted">
              Name
              <input
                name="name"
                defaultValue={row.name}
                disabled={!canManage}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Webhook secret
              <input
                name="webhook"
                type="password"
                autoComplete="off"
                placeholder={row.webhook === "saved" ? "Saved — leave blank to keep" : "Not saved"}
                disabled={!canManage}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="enabled" defaultChecked={row.enabled} disabled={!canManage} className="accent-violet" />
              Enabled
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="clearWebhook" disabled={!canManage} className="accent-violet" />
              Clear webhook secret
            </label>
            {canManage ? (
              <button type="submit" className="btn-secondary sm:col-span-2 !py-2 text-sm">
                Save {row.code}
              </button>
            ) : null}
          </form>
        ))}
        {canManage ? (
          <form action={actionSaveMarketplaceProvider} className="mt-4 grid gap-3 rounded-xl border border-dashed border-border p-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted">
              New code
              <input name="code" placeholder="eu-provider" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo" />
            </label>
            <label className="text-xs font-semibold text-muted">
              Name
              <input name="name" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo" />
            </label>
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Webhook secret
              <input name="webhook" type="password" autoComplete="off" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo" />
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="enabled" className="accent-violet" />
              Enabled
            </label>
            <button type="submit" className="btn-secondary sm:col-span-2 !py-2 text-sm">
              Add provider
            </button>
          </form>
        ) : null}
      </section>

      <section className="card-surface p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Review window</h2>
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

      <section className="card-surface space-y-4 p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Jurisdictions</h2>
        <p className="text-xs text-muted">
          Capability flags override features even when a fee rule or provider adapter exists (PA007 / Dev §24).
          Managed introduction and managed campaign stay off until legal review is APPROVED and the matching toggle is on.
        </p>
        {config.jurisdictions.map((row) => (
          <form key={row.code} action={actionSaveJurisdiction} className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-4">
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
            <label className="text-xs font-semibold text-muted sm:col-span-3">
              Approved provider ids (comma or JSON; empty = any assigned)
              <input
                name="approvedProviderIds"
                defaultValue={
                  (() => {
                    try {
                      const parsed = JSON.parse(row.approvedProviderIds || "[]") as unknown;
                      return Array.isArray(parsed) ? parsed.join(", ") : row.approvedProviderIds;
                    } catch {
                      return row.approvedProviderIds;
                    }
                  })()
                }
                disabled={!canManage}
                placeholder="primary, airwallex"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Effective from
              <input
                name="capabilitiesEffectiveFrom"
                type="date"
                defaultValue={
                  row.capabilitiesEffectiveFrom
                    ? new Date(row.capabilitiesEffectiveFrom).toISOString().slice(0, 10)
                    : ""
                }
                disabled={!canManage}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Effective to
              <input
                name="capabilitiesEffectiveTo"
                type="date"
                defaultValue={
                  row.capabilitiesEffectiveTo
                    ? new Date(row.capabilitiesEffectiveTo).toISOString().slice(0, 10)
                    : ""
                }
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
            <label className="text-xs font-semibold text-muted">
              Currency
              <input
                name="currency"
                maxLength={3}
                defaultValue={row.currency}
                disabled={!canManage}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm uppercase text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Minor digits
              <input
                name="minorDigits"
                type="number"
                min={0}
                max={4}
                defaultValue={row.minorDigits}
                disabled={!canManage}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Provider
              <select
                name="providerCode"
                defaultValue={row.providerCode}
                disabled={!canManage}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              >
                {config.providers.map((provider) => (
                  <option key={provider.code} value={provider.code}>
                    {provider.name} ({provider.code})
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-muted sm:col-span-2">Shown as {fundingTerm(row.escrowTermAllowed)}.</p>
            {canManage ? (
              <button type="submit" className="btn-secondary !py-2 text-sm sm:col-span-4">
                Save {row.code}
              </button>
            ) : null}
          </form>
        ))}
        {canManage ? (
          <form action={actionSaveJurisdiction} className="grid gap-3 rounded-xl border border-dashed border-border p-4 sm:grid-cols-4">
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
              <input type="checkbox" name="fullPrefundingEnabled" defaultChecked className="accent-violet" />
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
              <select name="legalReviewStatus" defaultValue="PENDING" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo">
                <option value="APPROVED">APPROVED</option>
                <option value="PENDING">PENDING</option>
                <option value="BLOCKED">BLOCKED</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-muted sm:col-span-3">
              Approved provider ids
              <input name="approvedProviderIds" placeholder="primary" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
            </label>
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
              <input name="currency" maxLength={3} defaultValue="USD" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm uppercase" />
            </label>
            <label className="text-xs font-semibold text-muted">
              Minor digits
              <input name="minorDigits" type="number" min={0} max={4} defaultValue={2} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-muted">
              Provider
              <select name="providerCode" defaultValue="primary" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm">
                {config.providers.map((provider) => (
                  <option key={provider.code} value={provider.code}>
                    {provider.name} ({provider.code})
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-secondary !py-2 text-sm sm:col-span-4">
              Add jurisdiction
            </button>
          </form>
        ) : null}
      </section>

      <section className="card-surface p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Wise user rate</h2>
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
                Check 100.00 USD to
                <input name="currency" defaultValue="GBP" maxLength={3} className="mt-1 w-24 rounded-lg border border-border px-3 py-2 text-sm uppercase text-indigo" />
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
      </section>

      <section className="card-surface p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Revenue shares</h2>
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
      </section>

      <section className="card-surface p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Milestone templates</h2>
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
      </section>

      <section className="card-surface p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Scheduled release</h2>
        <p className="mt-1 text-xs text-muted">
          Dev §8: APPROVED → release_scheduled → release_requested → signed{" "}
          <code className="text-[11px]">payout.released</code>. Authorizing release does not move money; the sweep
          queues a durable <code className="text-[11px]">mkt_release_*</code> instruction when due.
        </p>
        {canManage && schedulable.length > 0 ? (
          <form action={actionScheduleMilestoneRelease} className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Approved milestone
              <select
                name="milestonePick"
                required
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
                defaultValue=""
              >
                <option value="">Select</option>
                {schedulable.map(({ funding, milestone }) => (
                  <option key={milestone.id} value={`${funding.id}::${milestone.id}`}>
                    {funding.businessName} → {funding.creatorSlug} · {milestone.title} ·{" "}
                    {formatMoney(milestone.amountCents, funding.currency)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Delay hours
              <input
                name="delayHours"
                type="number"
                min={0}
                max={720}
                defaultValue={0}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <div className="sm:col-span-3">
              <button type="submit" className="btn-secondary !py-2 text-sm">
                Authorize release
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted">
            {canManage ? "No approved held milestones ready to schedule." : "Ops can authorize releases here."}
          </p>
        )}
      </section>

      <section className="card-surface p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Chargebacks &amp; held cancellations</h2>
        <p className="mt-1 text-xs text-muted">
          Chargebacks move a held prefund into payment-risk with no automatic refund. Other cancel reasons and
          dispute refund decisions queue a durable provider instruction (
          <code className="text-[11px]">mkt_refund_*</code> / <code className="text-[11px]">mkt_cancel_*</code>
          ); ledger balances still change only on signed{" "}
          <code className="text-[11px]">payout.refunded</code>. Releases stay blocked while status is payment-risk.
        </p>
        {paymentRisk.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm text-indigo">
            {paymentRisk.map((funding) => (
              <li key={funding.id} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                <span className="font-semibold">Payment risk</span> · {funding.businessName} → {funding.creatorSlug} ·{" "}
                {funding.title} · held {formatMoney(funding.ledger.heldCents, funding.currency)}
                {funding.evidence ? (
                  <p className="mt-1 text-xs text-rose-900">
                    Evidence:{" "}
                    {[
                      funding.evidence.providerCaseId ? `case ${funding.evidence.providerCaseId}` : null,
                      funding.evidence.providerReference
                        ? `ref ${funding.evidence.providerReference}`
                        : null,
                      funding.evidence.reasonCode ? `code ${funding.evidence.reasonCode}` : null,
                      funding.evidence.amountCents != null
                        ? `${formatMoney(funding.evidence.amountCents, funding.evidence.currency)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "pack recorded"}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">No payment-risk fundings right now.</p>
        )}
        {canHighRiskCancel && cancellable.length > 0 ? (
          <form action={actionExecuteHeldCancellation} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Funding
              <select name="fundingId" required className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo">
                <option value="">Select held or payment-risk prefund</option>
                {cancellable.map((funding) => (
                  <option key={funding.id} value={funding.id}>
                    {funding.status} · {funding.businessName} → {funding.creatorSlug} · {funding.title} ·{" "}
                    {formatMoney(funding.grossCents, funding.currency)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Reason
              <select name="reason" required className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo">
                {CANCEL_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {CANCELLATION_REASON_LABELS[reason]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Current milestone id (optional)
              <input
                name="currentMilestoneId"
                placeholder="cuid"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Accepted partial USD (optional)
              <input
                name="acceptedPartialUsd"
                type="number"
                min={0}
                step={0.01}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Note
              <input name="note" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo" />
            </label>
            <label className="text-xs font-semibold text-muted">
              Provider case id (chargeback evidence)
              <input
                name="providerCaseId"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Provider reference
              <input
                name="providerReference"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Evidence amount USD
              <input
                name="evidenceAmountUsd"
                type="number"
                min={0}
                step={0.01}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Evidence reason code
              <input
                name="evidenceReasonCode"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Evidence received at (ISO)
              <input
                name="evidenceReceivedAt"
                placeholder="2026-10-04T12:00:00.000Z"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Evidence attachment URLs (comma or newline)
              <textarea
                name="evidenceAttachmentUrls"
                rows={2}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Confirm password (high-risk)
              <input
                name="stepUpPassword"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Re-enter your admin password"
                className="mt-1 w-full max-w-md rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-secondary !py-2 text-sm">
                Queue cancellation / mark payment-risk
              </button>
            </div>
          </form>
        ) : canHighRiskCancel ? (
          <p className="mt-3 text-sm text-muted">No held fundings available to cancel.</p>
        ) : canManage ? (
          <p className="mt-3 text-sm text-muted">
            Held cancel / payment-risk needs Collab finance · High-risk plus password step-up.
          </p>
        ) : null}
      </section>

      <section className="card-surface p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Dispute reasons</h2>
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
      </section>

      <section className="card-surface p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Attribution</h2>
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
      </section>

      <section className="card-surface p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Funding schedule</h2>
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
      </section>

      <section className="card-surface p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Ledger totals</h2>
        <p className="mt-1 text-xs text-muted">
          These figures are what the provider is holding, released, or refunded. Fees are quoted separately by fee type
          (Product §5). Revenue shares are not cash.
        </p>
        {totals.length === 0 ? <p className="mt-3 text-sm text-muted">No prefunds yet.</p> : null}
        <ul className="mt-3 space-y-2 text-sm text-indigo">
          {totals.map((row) => (
            <li key={row.currency}>
              {row.currency} · held {formatMoney(row.heldCents, row.currency)} · released {formatMoney(row.releasedCents, row.currency)} · refunded{" "}
              {formatMoney(row.refundedCents, row.currency)} · fees{" "}
              {formatFeesByType(row.feesByType, row.currency, row.feeCents)}
              {row.unbalanced > 0 ? ` · ${row.unbalanced} unbalanced` : ""}
            </li>
          ))}
        </ul>
      </section>

      {reportsOn ? (
        <section className="card-surface p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Monthly ledger report</h2>
          <p className="mt-1 text-xs text-muted">
            Amounts recorded in each month. Fees show as separate columns by fee type. Revenue shares are left out.
          </p>
          {monthly.length === 0 ? <p className="mt-3 text-sm text-muted">No ledger rows yet.</p> : null}
          <ul className="mt-3 space-y-2 text-sm text-indigo">
            {monthly.map((row) => (
              <li key={`${row.currency}-${row.month}`}>
                {row.month} · {row.currency} · holds {formatMoney(row.heldCents, row.currency)} · releases{" "}
                {formatMoney(row.releasedCents, row.currency)} · refunds {formatMoney(row.refundedCents, row.currency)} · fees{" "}
                {formatFeesByType(row.feesByType, row.currency, row.feeCents)}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="card-surface p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Monthly ledger report</h2>
          <p className="mt-1 text-sm text-muted">The monthly report is turned off.</p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-indigo">Funding records</h2>
        {fundings.length === 0 ? <p className="text-sm text-muted">No prefunds yet.</p> : null}
        {fundings.map((funding) => {
          const shares = readShareSnapshot(funding.shareSnapshotJson);
          const feeType = feeTypeFromFundingSnapshot(funding.feeSnapshotJson, funding.serviceLevel);
          const feeTypeLabel = FEE_TYPE_LABELS[feeType as FeeType] ?? feeType;
          return (
          <article key={funding.id} className="card-surface p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-indigo">
                  <Link
                    href={`/admin/marketplace/${funding.id}`}
                    className="hover:text-violet hover:underline"
                  >
                    {funding.businessName} → {funding.creatorSlug}
                  </Link>
                </p>
                <p className="text-muted">{funding.title}</p>
                <Link
                  href={`/admin/marketplace/${funding.id}`}
                  className="mt-1 inline-block text-xs font-semibold text-violet hover:underline"
                >
                  Open transaction →
                </Link>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-violet">{funding.status.replaceAll("_", " ")}</p>
            </div>
            <p className="mt-2 text-muted">
              Gross {formatMoney(funding.grossCents, funding.currency)} · {funding.currency} · provider {funding.providerCode} · fee snapshot{" "}
              {formatMoney(funding.feeCents, funding.currency)} ({feeTypeLabel}) · held by provider{" "}
              {formatMoney(funding.ledger.heldCents, funding.currency)} · released{" "}
              {formatMoney(funding.ledger.releasedCents, funding.currency)}
              {funding.attributionLabel ? ` · ${funding.attributionLabel}` : ""}
              {funding.repeatOf ? ` · repeat of ${funding.repeatOf.title}` : ""}
              {scheduleLabel(funding) ? ` · ${scheduleLabel(funding)}` : ""}
              {funding.changeOrderCount > 0 ? ` · change orders ${funding.changeOrderCount} of ${funding.changeOrderLimit}` : ""}
              {shares ? ` · share ${shares.map((party) => `${party.label} ${party.shareBps / 100}%`).join(", ")}` : ""}
            </p>
            {funding.changeOrders.map((order) => (
              <p key={order.id} className="mt-1 text-xs text-indigo">
                Change order {formatMoney(order.previousUsdCents)} → {formatMoney(order.nextUsdCents)}. {order.note}
              </p>
            ))}
            <ul className="mt-2 space-y-1 text-indigo">
              {funding.milestones.map((milestone) => (
                <li key={milestone.id}>
                  {milestone.title} · {formatMoney(milestone.amountCents, funding.currency)} · {milestone.status}
                  {milestone.refundedCents > 0
                    ? ` · refunded ${formatMoney(milestone.refundedCents, funding.currency)} · ${formatMoney(milestone.amountCents - milestone.refundedCents, funding.currency)} left`
                    : ""}
                  {milestone.revisionLimit > 0 ? ` · revisions ${milestone.revisionCount} of ${milestone.revisionLimit}` : " · no revisions"}
                </li>
              ))}
            </ul>
          </article>
          );
        })}
      </section>
    </div>
  );
}
