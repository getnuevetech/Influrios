import Link from "next/link";
import { requireAdminPage } from "@/app/admin/guard";
import {
  actionFreezeFeeSnapshot,
  actionSaveFeeRule,
  actionSimulateFee,
} from "@/app/admin/actions";
import { hasPermission } from "@/lib/admin-auth";
import {
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

      {params.saved ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Fee rule saved (version bumped when commercial fields change).
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

      <section className="card-surface p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Jurisdiction gates</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="py-2">Code</th>
                <th>Protected payments</th>
                <th>Public term</th>
              </tr>
            </thead>
            <tbody>
              {store.jurisdictions.map((j) => (
                <tr key={j.code} className="border-t border-[#E6ECFF]">
                  <td className="py-2 font-semibold text-indigo">
                    {j.code} · {j.label}
                  </td>
                  <td>{j.protectedPaymentsEnabled ? "Enabled" : "Disabled"}</td>
                  <td>{protectedPaymentLabel(j.escrowTermAllowed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          PA004 — UI must not say “escrow” unless <code>escrowTermAllowed</code> is true for that
          jurisdiction.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-indigo">Active rules</h2>
        {store.rules
          .slice()
          .sort((a, b) => b.priority - a.priority)
          .map((rule) => (
            <form
              key={rule.id}
              action={actionSaveFeeRule}
              className="card-surface grid gap-3 p-4 sm:grid-cols-3"
            >
              <input type="hidden" name="id" value={rule.id} />
              <label className="text-xs font-semibold text-muted sm:col-span-2">
                Name
                <input
                  name="name"
                  defaultValue={rule.name}
                  disabled={!canManage}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-end gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={rule.active}
                  disabled={!canManage}
                />
                Active · v{rule.version}
              </label>
              <Field name="priority" label="Priority" defaultValue={String(rule.priority)} disabled={!canManage} />
              <Field name="jurisdiction" label="Jurisdiction" defaultValue={rule.jurisdiction} disabled={!canManage} />
              <label className="text-xs font-semibold text-muted">
                Service level
                <select
                  name="serviceLevel"
                  defaultValue={rule.serviceLevel}
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
                  defaultValue={rule.feeType}
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
                  defaultValue={rule.fundingMode}
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
                  defaultValue={rule.relationshipSource}
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
                  defaultValue={rule.promotionChannel}
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
                  defaultValue={rule.method}
                  disabled={!canManage}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <option value="percent">percent</option>
                  <option value="fixed">fixed</option>
                  <option value="percent_plus_fixed">percent_plus_fixed</option>
                </select>
              </label>
              <Field name="percentBps" label="Percent (bps)" defaultValue={String(rule.percentBps)} disabled={!canManage} />
              <Field
                name="fixedUsd"
                label="Fixed USD"
                defaultValue={String(rule.fixedCents / 100)}
                disabled={!canManage}
              />
              <Field
                name="minFeeUsd"
                label="Min fee USD"
                defaultValue={String(rule.minFeeCents / 100)}
                disabled={!canManage}
              />
              <Field
                name="maxFeeUsd"
                label="Max fee USD"
                defaultValue={rule.maxFeeCents != null ? String(rule.maxFeeCents / 100) : ""}
                disabled={!canManage}
              />
              <Field name="payer" label="Payer" defaultValue={rule.payer} disabled={!canManage} />
              <label className="text-xs font-semibold text-muted sm:col-span-3">
                Notes
                <input
                  name="notes"
                  defaultValue={rule.notes}
                  disabled={!canManage}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </label>
              {canManage ? (
                <button type="submit" className="btn-primary sm:col-span-3 !py-2 text-sm">
                  Save rule
                </button>
              ) : null}
            </form>
          ))}
      </section>

      <section className="card-surface p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Recent fee snapshots</h2>
        <p className="mt-1 text-xs text-muted">
          Accepted commercial quotes freeze here — later rule edits must not recalculate them
          (PA006).
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {store.snapshots.length === 0 ? (
            <li className="text-muted">No snapshots yet — run the simulator and freeze one.</li>
          ) : (
            store.snapshots.slice(0, 10).map((s) => (
              <li key={s.id} className="rounded-lg border border-[#E6ECFF] px-3 py-2">
                <span className="font-semibold text-indigo">{s.id}</span> · {s.ruleName} v
                {s.ruleVersion} · {FEE_TYPE_LABELS[s.feeType] ?? s.feeType} ·{" "}
                {formatCents(s.calculatedFeeCents)} on{" "}
                {formatCents(s.basisCents)} ({s.jurisdiction}/{s.serviceLevel})
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
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
