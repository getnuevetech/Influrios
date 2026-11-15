"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { actionDeleteTaxRule, actionSaveTaxConfiguration } from "@/app/admin/payment-standard/actions";
import { useAccountDialogBehavior } from "@/components/account-dialog";
import {
  COUNTRY_TAX_FIELDS,
  countryProductOptions,
  countryRuleSelection,
  dedupeCountryRules,
  flagRuleConflicts,
  mapStoredPolicy,
  parseCountryProduct,
  presentCountryCharge,
  taxCalculationLabel,
  type CountryTaxRule,
} from "@/lib/country-tax";

type Catalog = {
  plans: { id: string; name: string; keys?: string[] }[];
  feeRules: { id: string; label: string; purpose: string }[];
  services: { id: string; label: string }[];
  countries: { code: string; name: string }[];
};

type ListedRule = CountryTaxRule & { linkedIds: string[] };

type RecordRow = {
  id: string;
  version?: number;
  appliesTo: string;
  linkedIds: string[];
  countryCode: string;
  calculationMethod: string;
  rateBps?: number | null;
  ratePercent?: string;
  inclusive?: boolean;
  status?: string;
  name?: string;
};

type Choice = { value: string; label: string; group?: string };

function countryName(countries: { code: string; name: string }[], code: string) {
  return countries.find((country) => country.code === code)?.name ?? code;
}

function CenteredPopup({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useAccountDialogBehavior(panelRef, onClose);
  useEffect(() => {
    const y = window.scrollY;
    return () => {
      requestAnimationFrame(() => window.scrollTo(0, y));
    };
  }, []);

  return (
    <div data-account-dialog-root className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-[#111a5a]/45" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(90vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(17,26,90,0.28)] outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F7] px-5 py-4">
          <h2 id={titleId} className="font-display text-xl font-bold text-indigo">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none text-indigo hover:bg-lavender">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function SearchableSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: Choice[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const needle = query.trim().toLowerCase();
  const shown = options.filter((option) => {
    if (!needle) return true;
    return option.label.toLowerCase().includes(needle) || (option.group ?? "").toLowerCase().includes(needle);
  });
  const groups = [...new Set(shown.map((option) => option.group ?? ""))];

  return (
    <label className="relative block text-sm font-semibold text-indigo">
      {label}
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={open ? query : (selected?.label ?? "")}
        placeholder={selected ? selected.label : placeholder}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        className="mt-1 w-full rounded-xl border border-[#E6ECF7] bg-white px-3 py-2 font-medium"
      />
      {open ? (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-[#E6ECF7] bg-white py-1 shadow-lg">
          {groups.map((group) => (
            <li key={group || "items"}>
              {group ? <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{group}</p> : null}
              <ul>
                {shown.filter((option) => (option.group ?? "") === group).map((option) => (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={option.value === value}
                      className="block w-full px-3 py-2 text-left text-sm font-medium hover:bg-lavender"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        onChange(option.value);
                        setQuery("");
                        setOpen(false);
                      }}
                    >
                      {option.label}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {shown.length === 0 ? <li className="px-3 py-2 text-sm text-muted">No matches</li> : null}
        </ul>
      ) : null}
    </label>
  );
}

export function TaxSettingsClient({
  records,
  catalog,
  canEdit,
}: {
  records: RecordRow[];
  catalog: Catalog;
  canEdit: boolean;
}) {
  const router = useRouter();
  const rules = useMemo(() => {
    const mapped = records
      .filter((record) => record.status !== "replaced")
      .map((record) => {
        const rule = mapStoredPolicy(record);
        if (!rule) return null;
        return { ...rule, linkedIds: record.linkedIds };
      })
      .filter((rule): rule is ListedRule => Boolean(rule));
    const linkedById = new Map(mapped.map((rule) => [rule.id, rule.linkedIds]));
    return flagRuleConflicts(dedupeCountryRules(mapped)).map((rule) => ({
      ...rule,
      linkedIds: linkedById.get(rule.id) ?? [],
    }));
  }, [records]);
  const [countryFilter, setCountryFilter] = useState(() => {
    if (catalog.countries.some((country) => country.code === "US")) return "US";
    return catalog.countries[0]?.code ?? "";
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ListedRule | null>(null);
  const [confirming, setConfirming] = useState<ListedRule | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState(false);
  const deleting = useRef(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const visible = rules.filter((rule) => !hiddenIds.includes(rule.id) && rule.countryCode === countryFilter);

  function startCreate() {
    setEditing(null);
    setError("");
    setOpen(true);
  }

  function startEdit(rule: ListedRule) {
    setEditing(rule);
    setConfirming(null);
    setError("");
    setOpen(true);
  }

  function closeEditor() {
    setOpen(false);
    setError("");
  }

  function askDelete(rule: ListedRule) {
    setConfirming(rule);
    setError("");
  }

  function ruleSummary(rule: ListedRule) {
    const country = countryName(catalog.countries, rule.countryCode);
    const product = presentCountryCharge({ family: rule.family, linkedIds: rule.linkedIds, plans: catalog.plans, fees: catalog.feeRules });
    return `${country} · ${product} · ${taxCalculationLabel(rule)}`;
  }

  async function removeRule(id: string) {
    if (deleting.current) return;
    deleting.current = true;
    setPendingDelete(true);
    setError("");
    try {
      const data = new FormData();
      data.set("policyId", id);
      const result = await actionDeleteTaxRule(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setHiddenIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
      setNotice("Deleted. This rule will not apply to new calculations.");
      setConfirming(null);
      setOpen(false);
      setEditing(null);
      router.refresh();
    } catch {
      setError("That tax rule could not be deleted.");
    } finally {
      deleting.current = false;
      setPendingDelete(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted">Payment settings / Tax</p>
          <h2 className="font-display text-3xl font-bold text-indigo">Country tax rules</h2>
        </div>
        {canEdit ? (
          <button type="button" onClick={startCreate} className="rounded-full bg-violet px-4 py-2.5 text-sm font-semibold text-white">+ {COUNTRY_TAX_FIELDS.add}</button>
        ) : null}
      </div>
      {notice ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p> : null}
      <label className="flex items-center gap-3 text-sm font-semibold text-indigo">
        {COUNTRY_TAX_FIELDS.country}
        <select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)} className="rounded-xl border border-[#E6ECF7] bg-white px-3 py-2 font-medium">
          {catalog.countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
        </select>
      </label>
      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F4F1FF] text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Charge</th>
              <th className="px-4 py-3 font-semibold">Calculation</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((rule) => (
              <tr key={rule.id} className="border-t">
                <td className="px-4 py-3 font-medium">{presentCountryCharge({ family: rule.family, linkedIds: rule.linkedIds, plans: catalog.plans, fees: catalog.feeRules })}</td>
                <td className="px-4 py-3">
                  {taxCalculationLabel(rule)}
                  {rule.conflict ? <span className="mt-1 block text-xs font-semibold text-amber-800">Conflicting rule for this country and product.</span> : null}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => startEdit(rule)} className="rounded-lg bg-[#F3EEFF] px-3 py-1.5 text-xs font-semibold text-violet">{COUNTRY_TAX_FIELDS.edit}</button>
                    {canEdit ? <button type="button" onClick={() => askDelete(rule)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-700">{COUNTRY_TAX_FIELDS.delete}</button> : null}
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 ? <tr><td colSpan={3} className="px-4 py-8 text-center text-muted">No tax rules for this country.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {open ? (
        <RuleDialog
          catalog={catalog}
          rule={editing}
          defaultCountry={countryFilter}
          canEdit={canEdit}
          error={error}
          onClose={closeEditor}
          onSaved={(summary) => {
            setNotice(`Saved. ${summary}`);
            setOpen(false);
            router.refresh();
          }}
          onError={setError}
        />
      ) : null}
      {confirming ? (
        <DeleteRuleConfirm
          summary={ruleSummary(confirming)}
          error={error}
          pending={pendingDelete}
          onCancel={() => { setConfirming(null); setError(""); }}
          onConfirm={() => void removeRule(confirming.id)}
        />
      ) : null}
    </div>
  );
}

function DeleteRuleConfirm({
  summary,
  error,
  pending,
  onCancel,
  onConfirm,
}: {
  summary: string;
  error: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <CenteredPopup title={COUNTRY_TAX_FIELDS.deleteRule} onClose={onCancel}>
      <div className="space-y-3">
        <p className="text-sm">{COUNTRY_TAX_FIELDS.confirmDelete}</p>
        <p className="text-sm font-semibold">{summary}</p>
        <p className="text-sm text-muted">{COUNTRY_TAX_FIELDS.confirmDeleteDetail}</p>
        {error ? <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" disabled={pending} className="rounded-full border px-4 py-2 text-sm font-semibold" onClick={onCancel}>{COUNTRY_TAX_FIELDS.cancel}</button>
          <button type="button" disabled={pending} className="rounded-full bg-rose-700 px-4 py-2 text-sm font-semibold text-white" onClick={onConfirm}>{COUNTRY_TAX_FIELDS.deleteRule}</button>
        </div>
      </div>
    </CenteredPopup>
  );
}

function RuleDialog({
  catalog,
  rule,
  defaultCountry,
  canEdit,
  error,
  onClose,
  onSaved,
  onError,
}: {
  catalog: Catalog;
  rule: ListedRule | null;
  defaultCountry: string;
  canEdit: boolean;
  error: string;
  onClose: () => void;
  onSaved: (summary: string) => void;
  onError: (message: string) => void;
}) {
  const selection = countryRuleSelection({
    family: rule?.family ?? "",
    linkedIds: rule?.linkedIds?.length ? rule.linkedIds : (rule?.chargeId ? [rule.chargeId] : []),
    plans: catalog.plans,
  });
  const [countryCode, setCountryCode] = useState(rule?.countryCode || defaultCountry);
  const [product, setProduct] = useState(selection.product);
  const [method, setMethod] = useState(rule?.method ?? "");
  const [rate, setRate] = useState(rule?.ratePercent == null ? "" : String(rule.ratePercent));
  const [pending, setPending] = useState(false);
  const countries = catalog.countries.map((country) => ({ value: country.code, label: country.name }));
  const products = countryProductOptions({ plans: catalog.plans, fees: catalog.feeRules });
  const parsed = parseCountryProduct({ product, plans: catalog.plans, fees: catalog.feeRules });

  async function save() {
    setPending(true);
    onError("");
    const data = new FormData();
    data.set("ruleModel", "country");
    data.set("policyId", rule?.id ?? "");
    data.set("countryCode", countryCode);
    data.set("family", parsed.family);
    data.set("chargeId", parsed.chargeId);
    data.set("chargeLabel", parsed.label);
    data.set("calculationMethod", method);
    data.set("ratePercent", method === "percentage" ? rate : "");
    const result = await actionSaveTaxConfiguration(data);
    setPending(false);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    onSaved(result.summary ?? parsed.label);
  }

  return (
    <CenteredPopup title={rule ? "Edit tax rule" : "Add tax rule"} onClose={onClose}>
      <div className="space-y-3">
        {error ? <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{error}</p> : null}
        <SearchableSelect label={COUNTRY_TAX_FIELDS.country} value={countryCode} options={countries} placeholder="Select a country" onChange={setCountryCode} />
        <SearchableSelect label={COUNTRY_TAX_FIELDS.productOrCharge} value={product} options={products} placeholder="Select a product or charge" onChange={setProduct} />
        <label className="block text-sm font-semibold text-indigo">{COUNTRY_TAX_FIELDS.taxCalculation}
          <select value={method} onChange={(event) => setMethod(event.target.value === "percentage" || event.target.value === "location" ? event.target.value : "")} className="mt-1 w-full rounded-xl border border-[#E6ECF7] px-3 py-2 font-medium">
            <option value="">Select a calculation</option>
            <option value="percentage">{COUNTRY_TAX_FIELDS.percentage}</option>
            <option value="location">{COUNTRY_TAX_FIELDS.location}</option>
          </select>
        </label>
        {method === "percentage" ? (
          <label className="block text-sm font-semibold text-indigo">{COUNTRY_TAX_FIELDS.rate}
            <input value={rate} onChange={(event) => setRate(event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-[#E6ECF7] px-3 py-2 font-medium" />
          </label>
        ) : null}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" className="rounded-full border px-4 py-2 text-sm font-semibold" onClick={onClose}>{COUNTRY_TAX_FIELDS.cancel}</button>
          {canEdit ? <button type="button" disabled={pending} className="rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white" onClick={() => void save()}>{COUNTRY_TAX_FIELDS.save}</button> : null}
        </div>
      </div>
    </CenteredPopup>
  );
}
