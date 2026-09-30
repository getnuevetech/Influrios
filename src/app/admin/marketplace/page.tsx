import Link from "next/link";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import {
  actionSaveJurisdiction,
  actionSaveMarketplaceProvider,
  actionSaveMarketplaceSettings,
  actionSaveTemplates,
} from "@/app/admin/marketplace/actions";
import { fundingTerm } from "@/lib/ledger";
import { formatMoney } from "@/lib/protected-payments";
import { listFundings, marketplaceConfig } from "@/lib/marketplace-ledger";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Marketplace ledger" };

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminMarketplacePage({ searchParams }: Props) {
  const session = await requireAdminPage("marketplace");
  const canManage = hasPermission(session, "marketplace.manage");
  const params = await searchParams;
  const [config, fundings] = await Promise.all([marketplaceConfig(), listFundings()]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Marketplace ledger</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Phase 12.3. A prefund stays unfunded until a signed provider webhook confirms it. The ledger records what the
          provider holds. Influrios does not keep that balance. Sign in again if this page asks for permission.
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
            <button type="submit" className="btn-secondary !py-2 text-sm sm:col-span-4">
              Add jurisdiction
            </button>
          </form>
        ) : null}
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

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-indigo">Funding records</h2>
        {fundings.length === 0 ? <p className="text-sm text-muted">No prefunds yet.</p> : null}
        {fundings.map((funding) => (
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
              Gross {formatMoney(funding.grossCents)} · fee snapshot {formatMoney(funding.feeCents)} · held by provider{" "}
              {formatMoney(funding.ledger.heldCents)} · released {formatMoney(funding.ledger.releasedCents)}
            </p>
            <ul className="mt-2 space-y-1 text-indigo">
              {funding.milestones.map((milestone) => (
                <li key={milestone.id}>
                  {milestone.title} · {formatMoney(milestone.amountCents)} · {milestone.status}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
