import { City, Country } from "country-state-city";
import { canonicalPlaceName, samePlace } from "@/lib/place-names";

export type PlaceHit = { name: string; country: string };

type IndexedCity = { name: string; country: string; key: string };

let cityIndex: IndexedCity[] | null = null;

function cities(): IndexedCity[] {
  if (cityIndex) return cityIndex;
  const names = new Map(Country.getAllCountries().map((country) => [country.isoCode, country.name]));
  cityIndex = City.getAllCities().map((city) => ({
    name: city.name,
    country: names.get(city.countryCode) ?? city.countryCode,
    key: city.name.toLowerCase(),
  }));
  return cityIndex;
}

export function countryCount() {
  return Country.getAllCountries().length;
}

export function searchCountries(query: string, limit = 8): PlaceHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits = Country.getAllCountries()
    .filter((country) => country.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const aStart = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStart = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return aStart - bStart || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
  return hits.map((country) => ({ name: country.name, country: country.name }));
}

function rankName(name: string, query: string) {
  const key = name.toLowerCase();
  if (key === query) return 0;
  if (key.startsWith(query)) return 1;
  return 2;
}

export function searchCities(query: string, country = "", limit = 8): PlaceHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];
  if (!country && q.length < 2) return [];
  const seen = new Set<string>();
  const hits: PlaceHit[] = [];
  for (const city of cities()) {
    if (country && !samePlace(city.country, country)) continue;
    if (!city.key.includes(q)) continue;
    const id = `${city.key}|${canonicalPlaceName(city.country)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    hits.push({ name: city.name, country: city.country });
  }
  hits.sort(
    (a, b) =>
      rankName(a.name, q) - rankName(b.name, q) ||
      a.name.length - b.name.length ||
      a.name.localeCompare(b.name) ||
      a.country.localeCompare(b.country),
  );
  return hits.slice(0, limit);
}
