"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { actionPreviewTaxConfiguration, actionSaveTaxConfiguration, actionSyncTaxRegistration } from "@/app/admin/payment-standard/actions";
import { actionCountryRegions } from "@/app/billing/actions";
import { AccountDialog } from "@/components/account-dialog";
import {
  CALCULATION_METHODS,
  FILING_ARRANGEMENTS,
  PRICE_DISPLAY,
  RESPONSIBLE_ENTITIES,
  TAX_CATEGORIES,
  TAX_COPY,
  TAX_SUBJECTS,
  accountsFor,
  entityLabel,
  registrationLabel,
  reviewSummary,
  subjectLabel,
} from "@/lib/tax-configuration";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export type TaxDialogRecord = {
  id: string;
  name: string;
  appliesTo: string;
  linkedIds: string[];
  countryCode: string;
  regionCode: string;
  environment: "sandbox" | "live";
  providerCode: string;
  providerAccountId: string;
  accountLabel: string;
  calculationMethod: "" | "automatic" | "manual";
  taxCategory: string;
  inclusive: boolean;
  liableEntity: string;
  registrationStatus: string;
  filingArrangement: string;
  ratePercent: string;
  jurisdiction: string;
  effectiveFrom: string;
  effectiveTo: string;
};

export type TaxDialogCatalog = {
  plans: { id: string; name: string }[];
  feeRules: { id: string; label: string; purpose: "business_fee" | "influencer_fee" }[];
  services: { id: string; label: string }[];
  countries: { code: string; name: string }[];
  integrations: { id: string; label: string }[];
  accounts: { id: string; label: string; providerCode: string; environment: string }[];
};

type Preview = {
  ok: boolean;
  kind?: string;
  customerMessage?: string;
  correction?: string;
  subtotalCents?: number | null;
  taxCents?: number | null;
  totalCents?: number | null;
  reason?: string;
  liableEntityLabel?: string;
  legalNote?: string;
  error?: string;
};

const STEPS = ["Scope", "Calculation", "Test", "Review"] as const;

function optionsFor(appliesTo: string, catalog: TaxDialogCatalog) {
  if (appliesTo === "subscription") return catalog.plans.map((plan) => ({ id: plan.id, label: plan.name }));
  if (appliesTo === "influencer_services") return catalog.services;
  return catalog.feeRules.filter((rule) => rule.purpose === appliesTo).map((rule) => ({ id: rule.id, label: rule.label }));
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const shown = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="text-sm">
      <span className="font-medium text-indigo">{label}</span>
      <div className="mt-1 rounded-xl border border-[#E4E9F5] px-2 py-2">
        <div className="flex flex-wrap gap-1">
          {selected.map((id) => {
            const option = options.find((item) => item.id === id);
            if (!option) return null;
            return (
              <button key={id} type="button" className="rounded-full bg-[#F1ECFF] px-2 py-0.5 text-xs font-semibold text-violet" onClick={() => onChange(selected.filter((item) => item !== id))}>
                {option.label} ×
              </button>
            );
          })}
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" className="mt-1 w-full bg-transparent py-1 text-sm outline-none" />
        <ul className="max-h-32 overflow-auto">
          {shown.map((option) => (
            <li key={option.id}>
              <label className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  checked={selected.includes(option.id)}
                  onChange={() => onChange(selected.includes(option.id) ? selected.filter((item) => item !== option.id) : [...selected, option.id])}
                />
                {option.label}
              </label>
            </li>
          ))}
          {shown.length === 0 ? <li className="py-1 text-xs text-muted">Nothing matches.</li> : null}
        </ul>
      </div>
    </div>
  );
}

export function TaxSetupDialog({
  record,
  catalog,
  canEdit,
  onClose,
}: {
  record: TaxDialogRecord | null;
  catalog: TaxDialogCatalog;
  canEdit: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState(record?.appliesTo && !record.calculationMethod ? 1 : 0);
  const [appliesTo, setAppliesTo] = useState(record?.appliesTo || "subscription");
  const initialOptions = optionsFor(record?.appliesTo || "subscription", catalog);
  const [linkedIds, setLinkedIds] = useState((record?.linkedIds ?? []).filter((id) => initialOptions.some((option) => option.id === id)));
  const [countryCode, setCountryCode] = useState(record?.countryCode || "US");
  const [regionCode, setRegionCode] = useState(record?.regionCode ?? "");
  const [regions, setRegions] = useState<{ code: string; name: string }[]>([]);
  const [previewRegions, setPreviewRegions] = useState<{ code: string; name: string }[]>([]);
  const [environment, setEnvironment] = useState<"sandbox" | "live">(record?.environment ?? "sandbox");
  const [providerCode, setProviderCode] = useState(record?.providerCode ?? "");
  const [providerAccountId, setProviderAccountId] = useState(record?.providerAccountId ?? "");
  const [calculationMethod, setCalculationMethod] = useState(record?.calculationMethod ?? "");
  const [taxCategory, setTaxCategory] = useState(record?.taxCategory ?? "");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [priceDisplay, setPriceDisplay] = useState(record?.inclusive ? "inclusive" : "exclusive");
  const [liableEntity, setLiableEntity] = useState(record?.liableEntity ?? "");
  const [registrationStatus, setRegistrationStatus] = useState(record?.registrationStatus || "not_synced");
  const [filingArrangement, setFilingArrangement] = useState(record?.filingArrangement ?? "");
  const [ratePercent, setRatePercent] = useState(record?.ratePercent ?? "");
  const [jurisdiction, setJurisdiction] = useState(record?.jurisdiction ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(record?.effectiveFrom ?? "");
  const [effectiveTo, setEffectiveTo] = useState(record?.effectiveTo ?? "");
  const [previewSubject, setPreviewSubject] = useState((record?.linkedIds ?? []).find((id) => initialOptions.some((option) => option.id === id)) ?? "");
  const [previewAmount, setPreviewAmount] = useState("19.00");
  const [previewCountry, setPreviewCountry] = useState(record?.countryCode || "US");
  const [previewRegion, setPreviewRegion] = useState(record?.regionCode ?? "");
  const [previewPostal, setPreviewPostal] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    void actionCountryRegions(countryCode).then(setRegions).catch(() => setRegions([]));
  }, [countryCode]);

  const scopeOptions = optionsFor(appliesTo, catalog);
  const accountOptions = accountsFor(catalog.accounts, providerCode, environment);
  const categories = TAX_CATEGORIES.filter((item) => item.label.toLowerCase().includes(categoryQuery.trim().toLowerCase()));
  const countryName = catalog.countries.find((country) => country.code === countryCode)?.name ?? countryCode;
  const summary = useMemo(() => reviewSummary({
    appliesTo,
    countryName,
    method: calculationMethod,
    providerLabel: catalog.integrations.find((item) => item.id === providerCode)?.label ?? "",
    accountLabel: accountOptions.find((account) => account.id === providerAccountId)?.label ?? record?.accountLabel ?? "",
    environment,
    entity: liableEntity,
    priceDisplay,
    category: taxCategory,
    gaps: [],
    registrationStatus,
  }), [accountOptions, appliesTo, calculationMethod, catalog.integrations, countryName, environment, liableEntity, priceDisplay, providerAccountId, providerCode, record?.accountLabel, registrationStatus, taxCategory]);

  async function loadRegions(next: string, which: "scope" | "preview") {
    const rows = await actionCountryRegions(next).catch(() => []);
    if (which === "scope") {
      setCountryCode(next);
      setRegionCode("");
      setRegions(rows);
    } else {
      setPreviewCountry(next);
      setPreviewRegion("");
      setPreviewRegions(rows);
    }
  }

  function formData(intent: "draft" | "activate") {
    const data = new FormData();
    data.set("seriesName", record?.name ?? "");
    data.set("intent", intent);
    data.set("appliesTo", appliesTo);
    for (const id of linkedIds) data.append("linkedId", id);
    data.set("countryCode", countryCode);
    data.set("regionCode", regionCode);
    data.set("environment", environment);
    data.set("providerCode", providerCode);
    data.set("providerAccountId", providerAccountId);
    data.set("calculationMethod", calculationMethod);
    data.set("taxCategory", taxCategory);
    data.set("priceDisplay", priceDisplay);
    data.set("liableEntity", liableEntity);
    data.set("registrationStatus", registrationStatus);
    data.set("filingArrangement", filingArrangement);
    if (calculationMethod === "manual") data.set("ratePercent", ratePercent);
    data.set("jurisdiction", jurisdiction);
    data.set("effectiveFrom", effectiveFrom);
    data.set("effectiveTo", effectiveTo);
    data.set("previewSubject", previewSubject);
    data.set("previewAmount", previewAmount);
    data.set("previewCountry", previewCountry);
    data.set("previewRegion", previewRegion);
    data.set("previewPostal", previewPostal);
    return data;
  }

  async function save(intent: "draft" | "activate") {
    setPending(true);
    setError("");
    const result = await actionSaveTaxConfiguration(formData(intent));
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  async function runPreview() {
    setPending(true);
    setError("");
    const result = await actionPreviewTaxConfiguration(formData("draft"));
    setPreview(result);
    setPending(false);
    if ("error" in result && result.error && !("kind" in result)) setError(result.error);
  }

  async function syncRegistration() {
    const data = new FormData();
    if (record?.id && !record.id.startsWith("missing:")) data.set("policyId", record.id);
    const result = await actionSyncTaxRegistration(data);
    setRegistrationStatus(result.status);
    router.refresh();
  }

  const scopeNote = appliesTo === "influencer_services"
    ? "This covers tax on the influencer’s services. It does not change tax on Influrios fees."
    : appliesTo === "subscription"
      ? "This covers the selected subscription products only."
      : "This covers the Influrios fee. It does not set tax on the influencer’s services.";

  return (
    <AccountDialog title="Configure tax" onClose={onClose}>
      <ol className="mb-4 flex items-center gap-2 text-xs font-semibold text-muted">
        {STEPS.map((label, index) => (
          <li key={label} className="flex items-center gap-2">
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${index === step ? "bg-violet text-white" : "bg-[#F1ECFF] text-violet"}`}>{index + 1}</span>
            <span className={index === step ? "text-indigo" : ""}>{label}</span>
            {index < STEPS.length - 1 ? <span className="mx-1 h-px w-4 bg-[#E4E9F5]" /> : null}
          </li>
        ))}
      </ol>
      {error ? <p className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{error}</p> : null}
      {step === 0 ? (
        <div className="space-y-3">
          <h3 className="font-display text-lg font-bold">Choose what this covers</h3>
          <label className="block text-sm">Applies to
            <select value={appliesTo} onChange={(event) => { setAppliesTo(event.target.value); setLinkedIds([]); }} className="mt-1 w-full rounded-xl border px-3 py-2">
              {TAX_SUBJECTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <MultiSelect label={appliesTo === "subscription" ? "Products" : appliesTo === "influencer_services" ? "Services" : "Fee rules"} options={scopeOptions} selected={linkedIds} onChange={setLinkedIds} />
          <label className="block text-sm">Country
            <select value={countryCode} onChange={(event) => void loadRegions(event.target.value, "scope")} className="mt-1 w-full rounded-xl border px-3 py-2">
              {catalog.countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
            </select>
          </label>
          <label className="block text-sm">State or region
            <select value={regionCode} onChange={(event) => setRegionCode(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
              <option value="">Select state or region</option>
              {regions.map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}
            </select>
          </label>
          <label className="block text-sm">Payment integration
            <select value={providerCode} onChange={(event) => { setProviderCode(event.target.value); setProviderAccountId(""); }} className="mt-1 w-full rounded-xl border px-3 py-2">
              <option value="">Select an integration</option>
              {catalog.integrations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">Provider account
            <select value={providerAccountId} onChange={(event) => setProviderAccountId(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
              <option value="">Select an account</option>
              {accountOptions.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">Environment
            <select value={environment} onChange={(event) => { setEnvironment(event.target.value === "live" ? "live" : "sandbox"); setProviderAccountId(""); }} className="mt-1 w-full rounded-xl border px-3 py-2">
              <option value="sandbox">Sandbox</option>
              <option value="live">Live</option>
            </select>
          </label>
          <p className="rounded-2xl bg-[#F6F7FB] px-3 py-2 text-xs text-muted">Only compatible accounts are listed. {scopeNote}</p>
        </div>
      ) : null}
      {step === 1 ? (
        <div className="space-y-3">
          <h3 className="font-display text-lg font-bold">{calculationMethod === "manual" ? "Set up an approved manual rate" : "Set up automatic calculation"}</h3>
          <label className="block text-sm">Calculation method
            <select value={calculationMethod} onChange={(event) => setCalculationMethod(event.target.value === "manual" ? "manual" : event.target.value === "automatic" ? "automatic" : "")} className="mt-1 w-full rounded-xl border px-3 py-2">
              <option value="">Select a method</option>
              {CALCULATION_METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <div className="text-sm">
            <span>Product tax category</span>
            <input value={categoryQuery} onChange={(event) => setCategoryQuery(event.target.value)} placeholder="Search categories" className="mt-1 w-full rounded-xl border px-3 py-2" />
            <select value={taxCategory} onChange={(event) => setTaxCategory(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2">
              <option value="">Select a category</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          <label className="block text-sm">Price display
            <select value={priceDisplay} onChange={(event) => setPriceDisplay(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
              {PRICE_DISPLAY.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">Tax-responsible entity
            <select value={liableEntity} onChange={(event) => setLiableEntity(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
              <option value="">Select approved legal entity</option>
              {RESPONSIBLE_ENTITIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <p className="text-xs text-muted">This records whether the platform or the connected account has the collection and reporting obligation. It cannot be typed in just to make checkout work.</p>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <p className="font-semibold">Review required</p>
            <p>Registration status: {registrationLabel(registrationStatus)}.</p>
            {canEdit ? <button type="button" className="mt-1 font-semibold text-violet underline" onClick={() => void syncRegistration()}>Check provider registrations</button> : null}
          </div>
          <details className="rounded-xl border px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium">Filing arrangement (optional)</summary>
            <select value={filingArrangement} onChange={(event) => setFilingArrangement(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2">
              <option value="">Not selected</option>
              {FILING_ARRANGEMENTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </details>
          {calculationMethod === "manual" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">Tax rate (%)
                <input value={ratePercent} onChange={(event) => setRatePercent(event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border px-3 py-2" />
              </label>
              <label className="text-sm">Jurisdiction
                <select value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
                  <option value="">Select a jurisdiction</option>
                  {countryCode ? <option value={countryCode}>{countryName}</option> : null}
                  {regionCode ? <option value={`${countryCode}-${regionCode}`}>{countryCode}-{regionCode}</option> : null}
                </select>
              </label>
              <label className="text-sm">Effective date
                <input type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
              </label>
              <label className="text-sm">End date
                <input type="date" value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
              </label>
            </div>
          ) : (
            <p className="text-xs text-muted">Automatic calculation uses the product category, registrations, and the customer location. A manual rate stays hidden.</p>
          )}
        </div>
      ) : null}
      {step === 2 ? (
        <div className="space-y-3">
          <h3 className="font-display text-lg font-bold">Run tax preview</h3>
          <label className="block text-sm">Product or fee rule
            <select value={previewSubject} onChange={(event) => setPreviewSubject(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
              <option value="">Select</option>
              {scopeOptions.filter((option) => linkedIds.includes(option.id)).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">Example amount
            <input value={previewAmount} onChange={(event) => setPreviewAmount(event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Customer country
              <select value={previewCountry} onChange={(event) => void loadRegions(event.target.value, "preview")} className="mt-1 w-full rounded-xl border px-3 py-2">
                {catalog.countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
              </select>
            </label>
            <label className="text-sm">State
              <select value={previewRegion} onChange={(event) => setPreviewRegion(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
                <option value="">Select state</option>
                {previewRegions.map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-sm">Postal code
            <input value={previewPostal} onChange={(event) => setPreviewPostal(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          {preview?.kind === "calculated" && preview.taxCents != null && preview.subtotalCents != null && preview.totalCents != null ? (
            <dl className="rounded-2xl bg-[#F6F7FB] px-4 py-3 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(preview.subtotalCents)}</dd></div>
              <div className="flex justify-between"><dt>Tax</dt><dd>{money(preview.taxCents)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{money(preview.totalCents)}</dd></div>
              <p className="mt-2 text-xs text-muted">Responsible entity: {preview.liableEntityLabel || entityLabel(liableEntity)}</p>
              {preview.taxCents === 0 ? <p className="mt-1 text-xs text-indigo">{preview.reason}</p> : null}
              <p className="mt-2 text-xs text-muted">{preview.legalNote || TAX_COPY.legalNote}</p>
            </dl>
          ) : preview && preview.ok === false ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{preview.correction || preview.customerMessage}</p>
          ) : (
            <p className="rounded-2xl border border-dashed px-3 py-6 text-center text-sm text-muted">Run a preview to see subtotal, tax, and total.</p>
          )}
          <button type="button" disabled={!canEdit || pending} onClick={() => void runPreview()} className="w-full rounded-full bg-violet py-2.5 text-sm font-semibold text-white disabled:opacity-50">Run tax preview</button>
        </div>
      ) : null}
      {step === 3 ? (
        <div className="space-y-3">
          <h3 className="font-display text-lg font-bold">Ready to activate</h3>
          <dl className="divide-y rounded-2xl border text-sm">
            {summary.lines.map((line) => (
              <div key={line.label} className="flex justify-between gap-3 px-3 py-2">
                <dt className="text-muted">{line.label}</dt>
                <dd className="text-right font-medium">{line.value}</dd>
              </div>
            ))}
          </dl>
          <ul className="space-y-1 text-sm">
            {summary.notes.map((note) => <li key={note} className="text-muted">{note}</li>)}
          </ul>
          {preview?.ok ? <p className="text-sm text-emerald-800">Test passed. {TAX_COPY.legalNote}</p> : <p className="text-sm text-amber-900">Outstanding: run a successful tax preview before activation.</p>}
          <p className="text-xs text-muted">{subjectLabel(appliesTo)} · {entityLabel(liableEntity)}</p>
        </div>
      ) : null}
      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <button type="button" className="rounded-full border px-4 py-2 text-sm font-semibold" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>Back</button>
        <div className="flex gap-2">
          {canEdit ? <button type="button" disabled={pending} className="rounded-full border px-4 py-2 text-sm font-semibold" onClick={() => void save("draft")}>Save draft</button> : null}
          {step < 3 ? (
            <button type="button" className="rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white" onClick={() => setStep(step + 1)}>Continue</button>
          ) : canEdit ? (
            <button type="button" disabled={pending} className="rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white" onClick={() => void save("activate")}>Activate configuration</button>
          ) : null}
        </div>
      </div>
    </AccountDialog>
  );
}
