"use client";

import { useState } from "react";
import { COUNTRY_TAX_FIELDS, calculateCountryTax, subscriptionPricePreview, type CountryTaxRule } from "@/lib/country-tax";

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function PlanPricePreview({
  planId,
  defaultCents,
  currency,
  countries,
  rules,
  disabled,
}: {
  planId: string;
  defaultCents: number;
  currency: string;
  countries: { code: string; name: string }[];
  rules: CountryTaxRule[];
  disabled: boolean;
}) {
  const [cents, setCents] = useState(String(defaultCents));
  const [country, setCountry] = useState(countries.find((item) => item.code === "US")?.code ?? countries[0]?.code ?? "");
  const [address, setAddress] = useState(false);
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const baseCents = Number(cents);
  const valid = Number.isInteger(baseCents) && baseCents >= 0;
  const matched = rules.find((rule) => rule.effective && rule.countryCode === country && rule.family === "subscription" && (!rule.chargeId || rule.chargeId === planId));
  const location = matched?.method === "location";
  const percentage = valid && matched?.method === "percentage"
    ? subscriptionPricePreview({ rules, planId, countryCode: country, baseCents, currency })
    : null;
  const located = location && valid
    ? calculateCountryTax({
        rules,
        chargeId: planId,
        family: "subscription",
        countryCode: country,
        baseCents,
        currency,
        at: new Date().toISOString(),
        location: address ? { country, region, postalCode } : { country },
        providerResult: null,
      })
    : null;

  return (
    <div className="space-y-2 sm:col-span-4">
      <label className="block text-xs font-semibold text-indigo">
        Cents
        <input name="amountCents" type="number" min={0} value={cents} disabled={disabled} onChange={(event) => setCents(event.target.value)} className="mt-1 w-full rounded-lg border border-[#E4EBFF] px-2 py-1 text-sm font-normal" />
      </label>
      <label className="block text-xs font-semibold text-indigo">
        {COUNTRY_TAX_FIELDS.previewCountry}
        <select value={country} onChange={(event) => setCountry(event.target.value)} className="mt-1 w-full rounded-lg border border-[#E4EBFF] px-2 py-1 text-sm font-normal">
          {countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
        </select>
      </label>
      <dl className="grid gap-1 rounded-xl bg-[#F6F7FB] px-3 py-2 text-sm sm:grid-cols-3">
        <div><dt className="text-xs text-muted">{COUNTRY_TAX_FIELDS.basePrice}</dt><dd className="font-semibold">{valid ? money(baseCents, currency) : "—"}</dd></div>
        <div><dt className="text-xs text-muted">{COUNTRY_TAX_FIELDS.estimatedTax}</dt><dd className="font-semibold">{percentage?.taxCents != null ? money(percentage.taxCents, currency) : "—"}</dd></div>
        <div><dt className="text-xs text-muted">{COUNTRY_TAX_FIELDS.estimatedTotal}</dt><dd className="font-semibold">{percentage?.totalCents != null ? money(percentage.totalCents, currency) : "—"}</dd></div>
      </dl>
      {percentage?.status === "missing_rule" ? <p className="text-xs font-semibold text-amber-800">{COUNTRY_TAX_FIELDS.missingRule}</p> : null}
      {location ? (
        <div className="space-y-2">
          <button type="button" className="text-xs font-semibold text-violet underline" onClick={() => setAddress((open) => !open)}>{COUNTRY_TAX_FIELDS.enterPreviewAddress}</button>
          {address ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="State or region" className="rounded-lg border px-2 py-1 text-sm" />
              <input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} placeholder="Postal code" className="rounded-lg border px-2 py-1 text-sm" />
            </div>
          ) : null}
          {located && !located.ok ? <p className="text-xs text-muted">{located.reason}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
