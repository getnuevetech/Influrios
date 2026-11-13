/** Public discovery shows a published profile and returns to the same results. */

export function publicProfileAllowed(input: { profileState: string; cardPublished: boolean | null }) {
  if (input.profileState === "RESTRICTED") return false;
  if (input.cardPublished === false) return false;
  return true;
}

export function discoverScrollKey(returnPath: string) {
  const url = new URL(returnPath || "/discover", "http://influrios.local");
  url.searchParams.delete("profile");
  const query = url.searchParams.toString();
  return `discover-scroll:${url.pathname}${query ? `?${query}` : ""}`;
}

/**
 * A paid invitation uses the verified countries. The country typed on the form cannot move the pair.
 * Browsing stays open when a country is not verified yet.
 */
export function domesticInviteDecision(input: {
  businessCountry: string | null;
  influencerCountry: string | null;
  selectedCountry: string;
  crossBorderAllowed: boolean;
}): { ok: true } | { ok: false; error: string } {
  void input.selectedCountry;
  if (!input.businessCountry || !input.influencerCountry) return { ok: true };
  if (input.businessCountry === input.influencerCountry || input.crossBorderAllowed) return { ok: true };
  return {
    ok: false,
    error: "This paid invitation stays in one country. Changing the selected country does not create a cross-border contract.",
  };
}
