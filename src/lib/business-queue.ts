/** Gates for requesting managed matching. The flag is edited in admin. */

export function managedMatchGate(input: {
  flagEnabled: boolean;
  planAllows: boolean;
  alreadyQueued: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (!input.flagEnabled) {
    return { ok: false, error: "Managed promotion is turned off." };
  }
  if (!input.planAllows) {
    return { ok: false, error: "Managed matching is an Agency feature." };
  }
  if (input.alreadyQueued) {
    return { ok: false, error: "This brief is already in the managed queue." };
  }
  return { ok: true };
}

export function fitRankingLabel(providerName: string | null): string {
  return providerName
    ? `AI pipeline: ${providerName}`
    : "Platform rule — not an AI provider";
}
