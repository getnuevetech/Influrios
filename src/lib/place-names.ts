/** Common short names used on existing profiles, matched to the catalog country. */
const ALIASES: Record<string, string> = {
  usa: "united states",
  us: "united states",
  "united states of america": "united states",
  uk: "united kingdom",
  britain: "united kingdom",
  "great britain": "united kingdom",
  "republic of korea": "south korea",
  "korea republic of": "south korea",
};

export function canonicalPlaceName(value: string) {
  const key = value.trim().toLowerCase().replace(/\./g, "");
  return ALIASES[key] ?? value.trim().toLowerCase();
}

export function samePlace(left: string, right: string) {
  return canonicalPlaceName(left) === canonicalPlaceName(right);
}
