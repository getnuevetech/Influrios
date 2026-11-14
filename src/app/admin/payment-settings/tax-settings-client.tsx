"use client";

import { useMemo, useState } from "react";
import { buildTaxRows, filterTaxRows, registrationLabel, statusCounts, subjectLabel } from "@/lib/tax-configuration";
import { TaxSetupDialog, type TaxDialogCatalog, type TaxDialogRecord } from "@/app/admin/payment-settings/tax-setup-dialog";

const STATUS_CLASS = {
  ready: "bg-emerald-50 text-emerald-700",
  draft: "bg-[#F1ECFF] text-violet",
  needs_review: "bg-orange-50 text-orange-700",
} as const;

export function TaxSettingsClient({
  records,
  catalog,
  previews,
  canEdit,
}: {
  records: (TaxDialogRecord & { calculationMethod: "" | "automatic" | "manual"; providerCode: string; accountLabel: string; status: string; name: string })[];
  catalog: TaxDialogCatalog;
  previews: { id: string; appliesTo: string; ok: boolean; reason: string; correction: string; taxCents: number | null; totalCents: number | null; amountCents: number; createdAt: string }[];
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<"configurations" | "registrations" | "history">("configurations");
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("ALL");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = useMemo(() => buildTaxRows(records.map((record) => ({
    id: record.id,
    name: record.name,
    appliesTo: record.appliesTo,
    calculationMethod: record.calculationMethod,
    providerCode: record.providerCode,
    accountLabel: record.accountLabel,
    status: record.status,
    countryCode: record.countryCode,
  }))), [records]);
  const counts = statusCounts(rows);
  const visible = filterTaxRows(rows, { query, country, status });
  const openRecord = records.find((record) => record.id === openId) ?? null;
  const creating = openId?.startsWith("missing:") || openId === "new";
  const draftRecord: TaxDialogRecord | null = creating
    ? {
        id: openId ?? "new",
        name: "",
        appliesTo: openId?.startsWith("missing:") ? openId.slice("missing:".length) : "subscription",
        linkedIds: [],
        countryCode: "US",
        regionCode: "",
        environment: "sandbox",
        providerCode: catalog.integrations[0]?.id ?? "",
        providerAccountId: "",
        accountLabel: "",
        calculationMethod: "",
        taxCategory: "",
        inclusive: false,
        liableEntity: "",
        registrationStatus: "not_synced",
        filingArrangement: "",
        ratePercent: "",
        jurisdiction: "",
        effectiveFrom: "",
        effectiveTo: "",
      }
    : openRecord;

  return (
    <div data-screen="A02" className="mx-auto max-w-6xl space-y-4 px-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted">Payment Settings / Tax</p>
          <h2 className="font-display text-3xl font-bold text-indigo">Tax Settings</h2>
          <p className="mt-1 text-sm text-muted">Configure tax by product, country, and provider account.</p>
        </div>
        {canEdit ? (
          <button type="button" onClick={() => setOpenId("new")} className="rounded-full bg-violet px-4 py-2.5 text-sm font-semibold text-white">+ Add configuration</button>
        ) : null}
      </div>
      <div className="flex gap-4 border-b text-sm font-semibold">
        {([
          ["configurations", "Configurations"],
          ["registrations", "Registrations"],
          ["history", "Test history"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`border-b-2 pb-2 ${tab === id ? "border-violet text-violet" : "border-transparent text-muted"}`}>{label}</button>
        ))}
      </div>
      {tab === "configurations" ? (
        <>
          <p className="rounded-2xl bg-[#F6F4FF] px-4 py-2 text-sm">
            <span className="font-semibold text-emerald-700">{counts.ready} ready</span>
            <span className="mx-2 text-muted">·</span>
            <span className="font-semibold text-violet">{counts.draft} drafts</span>
            <span className="mx-2 text-muted">·</span>
            <span className="font-semibold text-orange-700">{counts.needsReview} needs review</span>
          </p>
          <div className="grid gap-2 md:grid-cols-[1fr_14rem_12rem]">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search configurations" className="rounded-xl border bg-white px-3 py-2 text-sm" />
            <select value={country} onChange={(event) => setCountry(event.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm">
              <option value="ALL">All countries</option>
              {catalog.countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm">
              <option value="all">All statuses</option>
              <option value="ready">Ready</option>
              <option value="draft">Draft</option>
              <option value="needs_review">Needs review</option>
            </select>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F7F8FC] text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Applies to</th>
                  <th className="px-4 py-3 font-semibold">Calculation</th>
                  <th className="px-4 py-3 font-semibold">Account</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-4 py-3 font-semibold">{row.appliesLabel}</td>
                    <td className="px-4 py-3">{row.calculation}</td>
                    <td className="px-4 py-3">{row.account}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_CLASS[row.status]}`}>
                        {row.status === "ready" ? "Ready" : row.status === "draft" ? "Draft" : "Needs review"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => setOpenId(row.id)} className="rounded-full border px-3 py-1.5 text-xs font-semibold text-violet">{row.action}</button>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No configurations match.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="rounded-2xl border bg-white px-4 py-3 text-sm">
            <p className="font-semibold">Setup checklist</p>
            <ol className="mt-2 flex flex-wrap gap-4 text-muted">
              <li>1. Select products and account</li>
              <li>2. Confirm tax category and responsibility</li>
              <li>3. Test and activate</li>
            </ol>
          </div>
        </>
      ) : null}
      {tab === "registrations" ? (
        <div className="overflow-hidden rounded-2xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F7F8FC] text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Applies to</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Registration</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-t">
                  <td className="px-4 py-3">{subjectLabel(record.appliesTo)}</td>
                  <td className="px-4 py-3">{record.countryCode || "Not selected"}</td>
                  <td className="px-4 py-3">{registrationLabel(record.registrationStatus)}</td>
                </tr>
              ))}
              {records.length === 0 ? <tr><td colSpan={3} className="px-4 py-6 text-muted">No registrations synced yet. Open a configuration and check provider registrations.</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : null}
      {tab === "history" ? (
        <ul className="space-y-2">
          {previews.map((preview) => (
            <li key={preview.id} className="rounded-2xl border bg-white px-4 py-3 text-sm">
              <p className="font-semibold">{preview.ok ? "Preview succeeded" : "Preview failed"} · {subjectLabel(preview.appliesTo)}</p>
              {preview.ok && preview.taxCents != null ? <p className="text-muted">Tax {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(preview.taxCents / 100)}. {preview.reason}</p> : null}
              {!preview.ok ? <p className="text-amber-900">{preview.correction || preview.reason}</p> : null}
              {preview.ok ? <p className="text-xs text-muted">This preview validated the integration response. It does not establish that the legal classification is correct.</p> : null}
            </li>
          ))}
          {previews.length === 0 ? <li className="text-sm text-muted">No tax previews yet.</li> : null}
        </ul>
      ) : null}
      {openId && draftRecord ? (
        <TaxSetupDialog record={openId === "new" ? { ...draftRecord, appliesTo: "subscription" } : draftRecord} catalog={catalog} canEdit={canEdit} onClose={() => setOpenId(null)} />
      ) : null}
    </div>
  );
}
