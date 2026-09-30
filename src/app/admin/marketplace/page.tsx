import Link from "next/link";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import {
  actionSaveAttributionPolicy,
  actionSaveFundingSchedule,
  actionSaveAttributionSources,
  actionSaveDisputeReasons,
  actionSaveFxRates,
  actionSaveJurisdiction,
  actionSaveMarketplaceProvider,
  actionSaveMarketplaceSettings,
  actionSaveRevenueParties,
  actionSaveTemplates,
} from "@/app/admin/marketplace/actions";
import { listAttributionSources } from "@/lib/deal-attribution";
import { readShareSnapshot } from "@/lib/fx-share";
import { listDisputeReasons } from "@/lib/milestone-disputes";
import { fundingTerm } from "@/lib/ledger";
import { scheduleLabel } from "@/lib/schedule";
import { listFxRates, listRevenueParties } from "@/lib/settlement";
import { formatMoney } from "@/lib/protected-payments";
import { listFundings, marketplaceConfig } from "@/lib/marketplace-ledger";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Marketplace ledger" };

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminMarketplacePage({ searchParams }: Props) {
  const session = await requireAdminPage("marketplace");
  const canManage = hasPermission(session, "marketplace.manage");
  const params = await searchParams;
  const [config, fundings, reasons, sources, rates, parties] = await Promise.all([
    marketplaceConfig(),
    listFundings(),
    listDisputeReasons(),
    listAttributionSources(),
    listFxRates(),
    listRevenueParties(),
  ]);

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
          prefund stays unfunded until each tranche has its own signed webhook. Gross is entered in USD. Another
          currency uses the admin rate for that jurisdiction. Revenue-share lines are written when the provider
          releases a milestone. They are not cash.
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
          A submitted milestone auto-approves after this many hours. The window is copied onto each new prefund.
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
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="cancelUnconfirmed" defaultChecked={config.cancelUnconfirmed} className="accent-violet" />
              Allow cancelling a prefund before the provider confirms it
            </label>
            <button type="submit" className="btn-primary !py-2 text-sm">
              Save window
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-indigo">{config.reviewWindowHours} hours</p>
        )}
      </section>

      <section className="card-surface space-y-4 p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Jurisdictions</h2>
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
            <label className="text-xs font-semibold text-muted">
              Currency
              <input name="currency" maxLength={3} defaultValue="USD" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm uppercase" />
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
        <h2 className="font-display text-lg font-bold text-indigo">Admin FX rates</h2>
        <p className="mt-1 text-xs text-muted">
          Minor units per 1.00 USD. This is an admin rate, not a live quote. USD stays 1.00 and does not need a row.
          A missing rate refuses the prefund. Later edits do not rewrite a rate already copied onto a funding.
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
                <input
                  name="minorPerUsd"
                  type="number"
                  min={1}
                  defaultValue={rate.minorPerUsd}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-indigo"
                />
                <label className="flex items-center gap-2 text-sm text-indigo">
                  <input type="checkbox" name="activeIndex" value={String(index)} defaultChecked={rate.active} className="accent-violet" />
                  Active
                </label>
              </div>
            ))}
            <div className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
              <input name="newCurrency" maxLength={3} placeholder="EUR" className="rounded-lg border border-border px-3 py-2 text-sm uppercase" />
              <input name="newMinorPerUsd" type="number" min={1} placeholder="Minor units" className="rounded-lg border border-border px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm text-indigo">
                <input type="checkbox" name="newActive" defaultChecked className="accent-violet" />
                Active
              </label>
            </div>
            <button type="submit" className="btn-primary !py-2 text-sm">
              Save FX rates
            </button>
          </form>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-indigo">
            {rates.map((rate) => (
              <li key={rate.currency}>
                {rate.currency} · {rate.minorPerUsd} minor units per 1.00 USD{rate.active ? "" : " · inactive"}
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
          A repeat must be the same business and creator, already confirmed by the provider, inside this window, and
          at least the minimum gross. Changing the window does not rewrite a prefund that was already requested.
        </p>
        {canManage ? (
          <form action={actionSaveAttributionPolicy} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-muted">
              Window days
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
            {config.attributionWindowDays} days · minimum {formatMoney(config.repeatMinGrossCents)}
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

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-indigo">Funding records</h2>
        {fundings.length === 0 ? <p className="text-sm text-muted">No prefunds yet.</p> : null}
        {fundings.map((funding) => {
          const shares = readShareSnapshot(funding.shareSnapshotJson);
          return (
          <article key={funding.id} className="card-surface p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-indigo">
                  {funding.businessName} → {funding.creatorSlug}
                </p>
                <p className="text-muted">{funding.title}</p>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-violet">{funding.status.replaceAll("_", " ")}</p>
            </div>
            <p className="mt-2 text-muted">
              Gross {formatMoney(funding.grossCents, funding.currency)} · {funding.currency} · provider {funding.providerCode} · fee snapshot{" "}
              {formatMoney(funding.feeCents, funding.currency)} · held by provider{" "}
              {formatMoney(funding.ledger.heldCents, funding.currency)} · released{" "}
              {formatMoney(funding.ledger.releasedCents, funding.currency)}
              {funding.attributionLabel ? ` · ${funding.attributionLabel}` : ""}
              {funding.repeatOf ? ` · repeat of ${funding.repeatOf.title}` : ""}
              {scheduleLabel(funding) ? ` · ${scheduleLabel(funding)}` : ""}
              {shares ? ` · share ${shares.map((party) => `${party.label} ${party.shareBps / 100}%`).join(", ")}` : ""}
            </p>
            <ul className="mt-2 space-y-1 text-indigo">
              {funding.milestones.map((milestone) => (
                <li key={milestone.id}>
                  {milestone.title} · {formatMoney(milestone.amountCents, funding.currency)} · {milestone.status}
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
