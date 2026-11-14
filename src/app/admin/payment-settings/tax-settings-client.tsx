"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { actionSaveTaxConfiguration } from "@/app/admin/payment-standard/actions";
import { AccountDialog } from "@/components/account-dialog";
import {
  CHARGE_FAMILIES,
  COUNTRY_TAX_FIELDS,
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

function countryName(countries: { code: string; name: string }[], code: string) {
  return countries.find((country) => country.code === code)?.name ?? code;
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
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ListedRule | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function startCreate() {
    setEditing(null);
    setError("");
    setOpen(true);
  }

  function startEdit(rule: ListedRule) {
    setEditing(rule);
    setError("");
    setOpen(true);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted">Payment Settings / Tax</p>
          <h2 className="font-display text-3xl font-bold text-indigo">Tax Settings</h2>
          <p className="mt-1 text-sm text-muted">Choose a country and a product or charge, set the calculation, and save it once.</p>
        </div>
        {canEdit ? (
          <button type="button" onClick={startCreate} className="rounded-full bg-violet px-4 py-2.5 text-sm font-semibold text-white">{COUNTRY_TAX_FIELDS.add}</button>
        ) : null}
      </div>
      {notice ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p> : null}
      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F7F8FC] text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">{COUNTRY_TAX_FIELDS.country}</th>
              <th className="px-4 py-3 font-semibold">{COUNTRY_TAX_FIELDS.productOrCharge}</th>
              <th className="px-4 py-3 font-semibold">{COUNTRY_TAX_FIELDS.taxCalculation}</th>
              <th className="px-4 py-3 font-semibold">{COUNTRY_TAX_FIELDS.edit}</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-t">
                <td className="px-4 py-3 font-semibold">{countryName(catalog.countries, rule.countryCode)}</td>
                <td className="px-4 py-3">{presentCountryCharge({ family: rule.family, linkedIds: rule.linkedIds, plans: catalog.plans, fees: catalog.feeRules })}</td>
                <td className="px-4 py-3">
                  {taxCalculationLabel(rule)}
                  {rule.conflict ? <span className="mt-1 block text-xs font-semibold text-amber-800">Conflicting rule for this country and product.</span> : null}
                </td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => startEdit(rule)} className="rounded-full border px-3 py-1.5 text-xs font-semibold text-violet">{COUNTRY_TAX_FIELDS.edit}</button>
                </td>
              </tr>
            ))}
            {rules.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">No tax rules yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {open ? (
        <RuleDialog
          catalog={catalog}
          rule={editing}
          canEdit={canEdit}
          error={error}
          onClose={() => setOpen(false)}
          onSaved={(summary) => {
            setNotice(`Saved. ${summary}`);
            setOpen(false);
            router.refresh();
          }}
          onError={setError}
        />
      ) : null}
    </div>
  );
}

function RuleDialog({
  catalog,
  rule,
  canEdit,
  error,
  onClose,
  onSaved,
  onError,
}: {
  catalog: Catalog;
  rule: ListedRule | null;
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
  const [countryQuery, setCountryQuery] = useState("");
  const [countryCode, setCountryCode] = useState(rule?.countryCode ?? "");
  const [product, setProduct] = useState(selection.product);
  const [appliesTo, setAppliesTo] = useState(selection.appliesTo);
  const [method, setMethod] = useState(rule?.method ?? "");
  const [rate, setRate] = useState(rule?.ratePercent == null ? "" : String(rule.ratePercent));
  const [pending, setPending] = useState(false);
  const countries = catalog.countries.filter((country) => {
    const query = countryQuery.trim().toLowerCase();
    if (!query) return true;
    return country.name.toLowerCase().includes(query) || country.code.toLowerCase().includes(query);
  });
  const parsed = parseCountryProduct({ product, appliesTo, plans: catalog.plans, fees: catalog.feeRules });
  const subscriptionChoice = parsed.family === "subscription";

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
    <AccountDialog title={rule ? "Edit rule" : "Add rule"} onClose={onClose}>
      <div className="space-y-3">
        {error ? <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{error}</p> : null}
        <label className="block text-sm">{COUNTRY_TAX_FIELDS.country}
          <input value={countryQuery} onChange={(event) => setCountryQuery(event.target.value)} placeholder="Search countries" className="mt-1 w-full rounded-xl border px-3 py-2" />
          <select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2">
            <option value="">Select a country</option>
            {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
          </select>
        </label>
        <label className="block text-sm">{COUNTRY_TAX_FIELDS.productOrCharge}
          <select value={product} onChange={(event) => {
            const value = event.target.value;
            setProduct(value);
            if (value.startsWith("subscription:")) setAppliesTo(value.slice("subscription:".length));
            else if (value === "family:subscription") setAppliesTo("all");
          }} className="mt-1 w-full rounded-xl border px-3 py-2">
            <option value="">Select a product or charge</option>
            {CHARGE_FAMILIES.map((family) => (
              <optgroup key={family.id} label={family.group}>
                <option value={`family:${family.id}`}>{family.label}</option>
                {family.id === "subscription" ? catalog.plans.map((plan) => <option key={plan.id} value={`subscription:${plan.id}`}>{plan.name}</option>) : null}
                {family.id === "other" ? catalog.feeRules.filter((item) => item.purpose !== "business_fee" && item.purpose !== "influencer_fee").map((item) => <option key={item.id} value={`other:${item.id}`}>{item.label}</option>) : null}
              </optgroup>
            ))}
          </select>
        </label>
        {subscriptionChoice ? (
          <label className="block text-sm">{COUNTRY_TAX_FIELDS.appliesTo}
            <select value={appliesTo} onChange={(event) => {
              const value = event.target.value;
              setAppliesTo(value);
              setProduct(value === "all" ? "family:subscription" : `subscription:${value}`);
            }} className="mt-1 w-full rounded-xl border px-3 py-2">
              <option value="all">{COUNTRY_TAX_FIELDS.allPlans}</option>
              {catalog.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
            </select>
          </label>
        ) : (
          <p className="text-sm text-muted">{COUNTRY_TAX_FIELDS.appliesTo}: {parsed.label || "Choose a product or charge."}</p>
        )}
        <label className="block text-sm">{COUNTRY_TAX_FIELDS.taxCalculation}
          <select value={method} onChange={(event) => setMethod(event.target.value === "percentage" || event.target.value === "location" ? event.target.value : "")} className="mt-1 w-full rounded-xl border px-3 py-2">
            <option value="">Select a calculation</option>
            <option value="percentage">{COUNTRY_TAX_FIELDS.percentage}</option>
            <option value="location">{COUNTRY_TAX_FIELDS.location}</option>
          </select>
        </label>
        {method === "percentage" ? (
          <label className="block text-sm">{COUNTRY_TAX_FIELDS.rate}
            <input value={rate} onChange={(event) => setRate(event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="rounded-full border px-4 py-2 text-sm font-semibold" onClick={onClose}>{COUNTRY_TAX_FIELDS.cancel}</button>
          {canEdit ? <button type="button" disabled={pending} className="rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white" onClick={() => void save()}>{COUNTRY_TAX_FIELDS.save}</button> : null}
        </div>
      </div>
    </AccountDialog>
  );
}
