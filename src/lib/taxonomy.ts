export type SynonymLink = { term: string; slug: string };

/** Map a search token to a specialty slug. Unknown tokens are returned trimmed. */
export function canonicalSpecialty(
  raw: string | undefined,
  synonyms: SynonymLink[],
): string | undefined {
  const key = raw?.toLowerCase().trim();
  if (!key) return undefined;
  const hit = synonyms.find((row) => row.term === key || row.slug === key);
  return hit?.slug ?? key;
}

export function synonymTermsFor(slug: string, synonyms: SynonymLink[]): string[] {
  return synonyms.filter((row) => row.slug === slug).map((row) => row.term);
}
