import { Country } from "country-state-city";

export type CorridorCountry = {
  code: string;
  name: string;
  currency: string;
};

let cached: CorridorCountry[] | null = null;

/** Every ISO country, with its name and currency letters. */
export function corridorCountries(): CorridorCountry[] {
  if (cached) return cached;
  cached = Country.getAllCountries()
    .map((row) => ({
      code: row.isoCode.trim().toUpperCase(),
      name: row.name.trim(),
      currency: row.currency.trim().toUpperCase(),
    }))
    .filter((row) => /^[A-Z]{2}$/.test(row.code) && /^[A-Z]{3}$/.test(row.currency) && row.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  return cached;
}

export function corridorCountryByCode(code: string | null | undefined): CorridorCountry | null {
  const key = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(key)) return null;
  return corridorCountries().find((row) => row.code === key) ?? null;
}

export function requireCorridorCountry(code: string): CorridorCountry {
  const country = corridorCountryByCode(code);
  if (!country) throw new Error("Choose a country.");
  return country;
}

/** Full country name plus the currency letters stored for a new corridor. */
export function corridorCountryLabel(country: Pick<CorridorCountry, "name" | "currency">): string {
  return `${country.name} — ${country.currency}`;
}

export function countriesAvailableForCorridor(existingCodes: string[]): CorridorCountry[] {
  const taken = new Set(existingCodes.map((code) => code.trim().toUpperCase()));
  return corridorCountries().filter((country) => !taken.has(country.code));
}

/** Currency letters an admin can choose. Includes a stored code that is not on the catalog. */
export function corridorCurrencyOptions(extra?: string | null): string[] {
  const codes = new Set(corridorCountries().map((row) => row.currency));
  const more = (extra ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(more)) codes.add(more);
  return [...codes].sort();
}
