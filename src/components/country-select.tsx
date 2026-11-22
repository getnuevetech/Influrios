"use client";

import { COUNTRIES, resolveCountry } from "@/lib/countries";

/**
 * The only country input in the app: a dropdown over the shared country list.
 * `valueKind` decides what is submitted: the ISO code ("US") or the country name ("United States").
 */
export function CountrySelect({
  name,
  defaultValue = "",
  valueKind = "name",
  required = false,
  disabled = false,
  placeholder = "Choose a country",
  className = "mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo",
  id,
  onChange,
  options,
}: {
  name: string;
  defaultValue?: string | null;
  valueKind?: "name" | "code";
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  onChange?: (country: { code: string; name: string } | null) => void;
  /** Limit the list (for example to countries with a payment route). Defaults to every country. */
  options?: { code: string; name: string }[];
}) {
  const list = options ?? COUNTRIES;
  const current = resolveCountry(defaultValue);
  const value = current ? (valueKind === "code" ? current.code : current.name) : "";
  return (
    <select
      id={id}
      name={name}
      defaultValue={value}
      required={required}
      disabled={disabled}
      className={className}
      onChange={(event) => onChange?.(resolveCountry(event.target.value))}
    >
      <option value="">{placeholder}</option>
      {list.map((country) => (
        <option key={country.code} value={valueKind === "code" ? country.code : country.name}>
          {country.name}
        </option>
      ))}
    </select>
  );
}
