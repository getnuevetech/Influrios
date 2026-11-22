import { COUNTRY_LIST } from "@/lib/country-list";

export type CountryOption = { code: string; name: string };

export const COUNTRIES: CountryOption[] = COUNTRY_LIST.map(([code, name]) => ({ code, name }));

const BY_CODE = new Map(COUNTRIES.map((row) => [row.code, row]));

/** Spellings already stored on profiles and forms before every country field became a dropdown. */
const ALIASES: Record<string, string> = {
  usa: "US",
  "u s a": "US",
  "u s": "US",
  "united states of america": "US",
  america: "US",
  uk: "GB",
  "u k": "GB",
  britain: "GB",
  "great britain": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  "republic of korea": "KR",
  "korea republic of": "KR",
  "korea, republic of": "KR",
  "south korea": "KR",
  uae: "AE",
  "u a e": "AE",
  "ivory coast": "CI",
  "cote divoire": "CI",
  "czechia": "CZ",
  "russia": "RU",
  "viet nam": "VN",
  "the netherlands": "NL",
  holland: "NL",
  "turkiye": "TR",
  "drc": "CD",
  "dr congo": "CD",
};

function key(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const BY_NAME = new Map(COUNTRIES.map((row) => [key(row.name), row]));

/**
 * The one way to read a country, whatever was stored: an ISO code ("US"), the catalog name
 * ("United States"), or a known alias ("USA", "UK"). Unknown text returns null — it is never guessed.
 */
export function resolveCountry(value: string | null | undefined): CountryOption | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const k = key(raw);
  // Aliases first: "UK" is two letters but not an ISO code (Britain is GB).
  const alias = ALIASES[k];
  if (alias) return BY_CODE.get(alias) ?? null;
  if (/^[A-Za-z]{2}$/.test(raw)) return BY_CODE.get(raw.toUpperCase()) ?? null;
  return BY_NAME.get(k) ?? null;
}

export function countryByCode(code: string | null | undefined): CountryOption | null {
  return BY_CODE.get((code ?? "").trim().toUpperCase()) ?? null;
}

/** Server-side guard for any submitted country: the canonical row, or a clear error. */
export function requireCountry(value: string | null | undefined, label = "country"):
  | { ok: true; country: CountryOption }
  | { ok: false; error: string } {
  const country = resolveCountry(value);
  if (!country) return { ok: false, error: `Choose the ${label} from the list.` };
  return { ok: true, country };
}
