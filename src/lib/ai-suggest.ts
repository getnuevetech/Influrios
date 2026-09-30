export type SpecialtyCandidate = { slug: string; name: string; terms?: string[] };

export type SpecialtySuggestion = { slug: string; name: string; reason: string };

/** Keyword match against the specialty catalog. This is the fallback when no AI provider is assigned. */
export function suggestSpecialties(text: string, catalog: SpecialtyCandidate[], limit = 3): SpecialtySuggestion[] {
  const haystack = text.toLowerCase();
  const found: SpecialtySuggestion[] = [];
  for (const item of catalog) {
    const terms = [item.name, item.slug.replace(/-/g, " "), ...(item.terms ?? [])];
    const hit = terms.find((term) => {
      const needle = term.trim().toLowerCase();
      return needle.length > 2 && haystack.includes(needle);
    });
    if (!hit) continue;
    found.push({
      slug: item.slug,
      name: item.name,
      reason: `The profile text mentions “${hit}”.`,
    });
    if (found.length >= limit) break;
  }
  return found;
}

export function explainMatchFromFactors(factors: { label: string; value: number }[]): string {
  if (!factors.length) return "The published explanation stays the stored factor list.";
  const top = [...factors].sort((a, b) => b.value - a.value)[0];
  return `Strongest signal: ${top.label} at ${top.value}%. The published explanation stays the stored factor list until you confirm a different suggestion.`;
}

/** Keep the creator's checked slugs, capped by the plan's specialty limit. */
export function confirmedSpecialtySlugs(selected: string[], limit: number): string[] {
  const unique: string[] = [];
  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  for (const slug of selected) {
    const cleaned = slug.trim();
    if (!cleaned || unique.includes(cleaned)) continue;
    unique.push(cleaned);
    if (unique.length >= cap) break;
  }
  return unique;
}

export function flattenSpecialtyCatalog(
  tree: { slug: string; name: string; children?: { slug: string; name: string }[] }[],
): SpecialtyCandidate[] {
  const rows: SpecialtyCandidate[] = [];
  for (const parent of tree) {
    rows.push({ slug: parent.slug, name: parent.name });
    for (const child of parent.children ?? []) rows.push({ slug: child.slug, name: child.name });
  }
  return rows;
}
