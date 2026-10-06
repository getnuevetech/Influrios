import Link from "next/link";
import { requireAdminPage } from "@/app/admin/guard";
import {
  actionDeleteFeeRule,
  actionDeleteFeeSnapshot,
  actionDeleteJurisdictionGate,
  actionFreezeFeeSnapshot,
  actionSaveFeeRule,
  actionSaveJurisdictionGate,
  actionSimulateFee,
} from "@/app/admin/actions";
import { AdminCollapse } from "@/components/admin-collapse";
import { hasPermission } from "@/lib/admin-auth";
import {
  FEE_METHOD_LABELS,
  FEE_METHODS,
  FEE_TYPE_LABELS,
  FEE_TYPES,
  FUNDING_MODE_CONDITIONS,
  formatCents,
  getFeeStore,
  PROMOTION_CHANNEL_CONDITIONS,
  protectedPaymentLabel,
  RELATIONSHIP_SOURCE_CONDITIONS,
  SERVICE_LEVEL_LABELS,
  SERVICE_LEVELS,
  type CollaborationFeeRule,
} from "@/lib/collaboration-fees";

export const metadata = { title: "Admin · Collaboration fees" };

type Props = {
  searchParams: Promise<{
    simulated?: string;
    jurisdiction?: string;
    serviceLevel?: string;
    grossUsd?: string;
    feeCents?: string;
    rule?: string;
    feeType?: string;
    explanation?: string;
    frozen?: string;
    saved?: string;
    removed?: string;
    error?: string;
  }>;
};

export default async function AdminFeesPage({ searchParams }: Props) {
  const session = await requireAdminPage("commerce");
  const canManage = hasPermission(session, "commerce.manage");
  const params = await searchParams;
  const store = await getFeeStore();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">
          Collaboration fee rules
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Phase 12.1 — Admin-versioned fee matrix and immutable snapshots. Fee percentages are never
          hard-coded in product flows (Addendum PA001 / PA002).
        </p>
      </div>

      {params.saved === "rule" || params.saved === "1" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Fee rule saved (version bumped when commercial fields change).
        </div>
      ) : null}
      {params.saved === "jurisdiction" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Jurisdiction gate saved.
        </div>
      ) : null}
      {params.removed === "rule" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Fee rule removed.
        </div>
      ) : null}
      {params.removed === "snapshot" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Fee snapshot removed.
        </div>
      ) : null}
      {params.removed === "jurisdiction" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Jurisdiction gate removed.
        </div>
      ) : null}
      {params.error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {params.error}
        </div>
      ) : null}
      {params.frozen ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Immutable fee snapshot frozen: {params.frozen}
        </div>
      ) : null}

      <section className="card-surface p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Fee simulator</h2>
        <p className="mt-1 text-xs text-muted">
          Resolve the winning rule for a commercial context before either party accepts.
        </p>
        <form action={actionSimulateFee} className="mt-4 grid gap-3 sm:grid-cols-4">
          <label className="text-xs font-semibold text-muted">
            Jurisdiction
            <select
              name="jurisdiction"
              defaultValue={params.jurisdiction || "US"}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
            >
              {store.jurisdictions.map((j) => (
                <option key={j.code} value={j.code}>
                  {j.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">
            Service level
            <select
              name="serviceLevel"
              defaultValue={params.serviceLevel || "contracted"}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
            >
              {SERVICE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {SERVICE_LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">
            Gross value (USD)
            <input
              name="grossUsd"
              type="number"
              step="0.01"
              defaultValue={params.grossUsd || "1000"}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
            />
          </label>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full !py-2 text-sm">
              Simulate fee
            </button>
          </div>
        </form>
        {params.simulated ? (
          <div className="mt-4 rounded-xl bg-[#F0F4FF] px-4 py-3 text-sm text-indigo">
            <p>
              <span className="font-bold">Rule:</span> {params.rule}
              {params.feeType ? (
                <>
                  {" "}
                  · <span className="font-bold">Type:</span>{" "}
                  {FEE_TYPE_LABELS[params.feeType as keyof typeof FEE_TYPE_LABELS] ?? params.feeType}
                </>
              ) : null}
            </p>
            <p className="mt-1">
              <span className="font-bold">Fee:</span>{" "}
              {formatCents(Number(params.feeCents || 0))}
            </p>
            {params.explanation ? (
              <p className="mt-2 text-xs text-muted">{params.explanation}</p>
            ) : null}
            {canManage ? (
              <form action={actionFreezeFeeSnapshot} className="mt-3">
                <input type="hidden" name="jurisdiction" value={params.jurisdiction || "US"} />
                <input type="hidden" name="serviceLevel" value={params.serviceLevel || "contracted"} />
                <input type="hidden" name="grossUsd" value={params.grossUsd || "0"} />
                <button type="submit" className="btn-secondary !py-1.5 text-xs">
                  Freeze immutable snapshot
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-bold text-indigo">Jurisdiction gates</h2>
          <p className="mt-1 text-xs text-muted">
            Manage which markets allow protected payments and whether UI may say “escrow” (PA004). Deeper
            capability flags also live under Marketplace.
          </p>
        </div>
        {store.jurisdictions.map((j) => (
          <AdminCollapse
            key={j.code}
            title={`${j.code} · ${j.label}`}
            subtitle={`${j.protectedPaymentsEnabled ? "Protected payments on" : "Protected payments off"} · ${protectedPaymentLabel(j.escrowTermAllowed)}`}
          >
            {canManage ? (
              <div className="space-y-3">
                <form action={actionSaveJurisdictionGate} className="grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="code" value={j.code} />
                  <label className="text-xs font-semibold text-muted">
                    Code
                    <input
                      value={j.code}
                      readOnly
                      className="mt-1 w-full rounded-lg border border-border bg-[#F7FAFF] px-3 py-2 text-sm text-indigo"
                    />
                  </label>
                  <label className="text-xs font-semibold text-muted">
                    Label
                    <input
                      name="label"
                      defaultValue={j.label}
                      required
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-indigo">
                    <input
                      type="checkbox"
                      name="protectedPaymentsEnabled"
                      defaultChecked={j.protectedPaymentsEnabled}
                      className="accent-violet"
                    />
                    Protected payments enabled
                  </label>
                  <label className="flex items-center gap-2 text-sm text-indigo">
                    <input
                      type="checkbox"
                      name="escrowTermAllowed"
                      defaultChecked={j.escrowTermAllowed}
                      className="accent-violet"
                    />
                    Allow the word escrow
                  </label>
                  <button type="submit" className="btn-primary w-fit !py-2 text-sm sm:col-span-2">
                    Save jurisdiction
                  </button>
                </form>
                <form action={actionDeleteJurisdictionGate}>
                  <input type="hidden" name="code" value={j.code} />
                  <button type="submit" className="text-xs font-semibold text-amber-800 hover:underline">
                    Remove jurisdiction
                  </button>
                </form>
              </div>
            ) : (
              <p className="text-sm text-muted">
                {j.protectedPaymentsEnabled ? "Enabled" : "Disabled"} ·{" "}
                {protectedPaymentLabel(j.escrowTermAllowed)}
              </p>
            )}
          </AdminCollapse>
        ))}
        {canManage ? (
          <form
            action={actionSaveJurisdictionGate}
            className="grid gap-3 rounded-2xl border border-dashed border-[#E4EBFF] bg-white p-4 sm:grid-cols-2"
          >
            <h3 className="font-semibold text-indigo sm:col-span-2">Add jurisdiction gate</h3>
            <label className="text-xs font-semibold text-muted">
              Code (ISO-2)
              <input
                name="code"
                required
                maxLength={2}
                placeholder="KE"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm uppercase text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Label
              <input
                name="label"
                required
                placeholder="Kenya"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="protectedPaymentsEnabled" className="accent-violet" />
              Protected payments enabled
            </label>
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="escrowTermAllowed" className="accent-violet" />
              Allow the word escrow
            </label>
            <button type="submit" className="btn-secondary w-fit sm:col-span-2">
              Create jurisdiction
            </button>
          </form>
        ) : null}
        <p className="text-xs text-muted">
          PA004 — UI must not say “escrow” unless <code>escrowTermAllowed</code> is true for that
          jurisdiction.
        </p>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-bold text-indigo">Active rules</h2>
          <p className="mt-1 text-xs text-muted">
            Existing rules are collapsed after save. Use <span className="font-semibold">Add a fee rule</span>{" "}
            below to create a new matrix row.
          </p>
        </div>
        {store.rules
          .slice()
          .sort((a, b) => b.priority - a.priority)
          .map((rule) => (
            <AdminCollapse
              key={rule.id}
              title={rule.name}
              subtitle={`${rule.active ? "Active" : "Inactive"} · v${rule.version} · ${rule.jurisdiction}/${rule.serviceLevel} · priority ${rule.priority}`}
            >
              <FeeRuleForm rule={rule} canManage={canManage} />
              {canManage ? (
                <form action={actionDeleteFeeRule} className="mt-3 border-t border-[#E6ECFF] pt-3">
                  <input type="hidden" name="id" value={rule.id} />
                  <button type="submit" className="text-xs font-semibold text-amber-800 hover:underline">
                    Remove this rule
                  </button>
                </form>
              ) : null}
            </AdminCollapse>
          ))}

        {canManage ? (
          <div className="rounded-2xl border border-dashed border-[#E4EBFF] bg-white p-4">
            <h3 className="font-semibold text-indigo">Add a fee rule</h3>
            <p className="mt-1 text-xs text-muted">
              Creates a new active matrix row. Leave ID blank — the server assigns one.
            </p>
            <div className="mt-3">
              <FeeRuleForm canManage />
            </div>
          </div>
        ) : null}
      </section>

      <AdminCollapse
        title="Recent fee snapshots"
        subtitle={`${store.snapshots.length} snapshot${store.snapshots.length === 1 ? "" : "s"} · PA006`}
      >
        <p className="text-xs text-muted">
          Accepted commercial quotes freeze here — later rule edits must not recalculate them
          (PA006). Admins may remove snapshots when they are no longer needed for audit.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {store.snapshots.length === 0 ? (
            <li className="text-muted">No snapshots yet — run the simulator and freeze one.</li>
          ) : (
            store.snapshots.slice(0, 10).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E6ECFF] px-3 py-2">
                <span>
                  <span className="font-semibold text-indigo">{s.id}</span> · {s.ruleName} v
                  {s.ruleVersion} · {FEE_TYPE_LABELS[s.feeType] ?? s.feeType} ·{" "}
                  {formatCents(s.calculatedFeeCents)} on{" "}
                  {formatCents(s.basisCents)} ({s.jurisdiction}/{s.serviceLevel})
                </span>
                {canManage ? (
                  <form action={actionDeleteFeeSnapshot}>
                    <input type="hidden" name="id" value={s.id} />
                    <button type="submit" className="text-xs font-semibold text-amber-800 hover:underline">
                      Remove
                    </button>
                  </form>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </AdminCollapse>
    </div>
  );
}

function FeeRuleForm({
  rule,
  canManage,
}: {
  rule?: CollaborationFeeRule;
  canManage: boolean;
}) {
  const isNew = !rule;
  return (
    <form action={actionSaveFeeRule} className="grid gap-3 sm:grid-cols-3">
      {rule ? <input type="hidden" name="id" value={rule.id} /> : null}
      <label className="text-xs font-semibold text-muted sm:col-span-2">
        Name
        <input
          name="name"
          defaultValue={rule?.name ?? ""}
          required
          placeholder="New collaboration fee rule"
          disabled={!canManage}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </label>
      <label className="flex items-end gap-2 text-xs font-semibold">
        <input
          type="checkbox"
          name="active"
          defaultChecked={rule?.active ?? true}
          disabled={!canManage}
        />
        {rule ? `Active · v${rule.version}` : "Active"}
      </label>
      <Field name="priority" label="Priority" defaultValue={String(rule?.priority ?? 100)} disabled={!canManage} />
      <Field name="jurisdiction" label="Jurisdiction" defaultValue={rule?.jurisdiction ?? "*"} disabled={!canManage} />
      <label className="text-xs font-semibold text-muted">
        Service level
        <select
          name="serviceLevel"
          defaultValue={rule?.serviceLevel ?? "contracted"}
          disabled={!canManage}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
        >
          <option value="*">* (any)</option>
          {SERVICE_LEVELS.map((level) => (
            <option key={level} value={level}>
              {SERVICE_LEVEL_LABELS[level]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-muted">
        Fee type
        <select
          name="feeType"
          defaultValue={rule?.feeType ?? "collaboration"}
          disabled={!canManage}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
        >
          {FEE_TYPES.map((type) => (
            <option key={type} value={type}>
              {FEE_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-muted">
        Funding mode
        <select
          name="fundingMode"
          defaultValue={rule?.fundingMode ?? "*"}
          disabled={!canManage}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
        >
          {FUNDING_MODE_CONDITIONS.map((mode) => (
            <option key={mode} value={mode}>
              {mode === "*" ? "* (any)" : mode}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-muted">
        Relationship source
        <select
          name="relationshipSource"
          defaultValue={rule?.relationshipSource ?? "*"}
          disabled={!canManage}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
        >
          {RELATIONSHIP_SOURCE_CONDITIONS.map((source) => (
            <option key={source} value={source}>
              {source === "*" ? "* (any)" : source}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-muted">
        Promotion channel
        <select
          name="promotionChannel"
          defaultValue={rule?.promotionChannel ?? "*"}
          disabled={!canManage}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
        >
          {PROMOTION_CHANNEL_CONDITIONS.map((channel) => (
            <option key={channel} value={channel}>
              {channel === "*" ? "* (any)" : channel}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-muted">
        Method
        <select
          name="method"
          defaultValue={rule?.method ?? "percent"}
          disabled={!canManage}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
        >
          {FEE_METHODS.map((method) => (
            <option key={method} value={method}>
              {FEE_METHOD_LABELS[method]}
            </option>
          ))}
        </select>
      </label>
      <Field name="percentBps" label="Percent (bps)" defaultValue={String(rule?.percentBps ?? 1000)} disabled={!canManage} />
      <Field
        name="fixedUsd"
        label="Fixed / enterprise USD"
        defaultValue={String((rule?.fixedCents ?? 0) / 100)}
        disabled={!canManage}
      />
      <Field
        name="minFeeUsd"
        label="Min fee USD"
        defaultValue={String((rule?.minFeeCents ?? 0) / 100)}
        disabled={!canManage}
      />
      <Field
        name="maxFeeUsd"
        label="Max fee USD"
        defaultValue={rule?.maxFeeCents != null ? String(rule.maxFeeCents / 100) : ""}
        disabled={!canManage}
      />
      <label className="text-xs font-semibold text-muted sm:col-span-3">
        Tier bands JSON (tiered method)
        <textarea
          name="tierBandsJson"
          defaultValue={rule?.tierBands?.length ? JSON.stringify(rule.tierBands) : ""}
          disabled={!canManage}
          rows={2}
          placeholder='[{"upToCents":100000,"percentBps":800},{"upToCents":null,"percentBps":1200}]'
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 font-mono text-xs text-indigo disabled:bg-[#F3F4F6]"
        />
      </label>
      <Field name="payer" label="Payer" defaultValue={rule?.payer ?? "brand"} disabled={!canManage} />
      <label className="text-xs font-semibold text-muted sm:col-span-3">
        Notes
        <input
          name="notes"
          defaultValue={rule?.notes ?? ""}
          disabled={!canManage}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </label>
      {canManage ? (
        <button type="submit" className="btn-primary sm:col-span-3 !py-2 text-sm">
          {isNew ? "Create rule" : "Save rule"}
        </button>
      ) : null}
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  disabled,
}: {
  name: string;
  label: string;
  defaultValue: string;
  disabled?: boolean;
}) {
  return (
    <label className="text-xs font-semibold text-muted">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo disabled:bg-[#F3F4F6]"
      />
    </label>
  );
}
