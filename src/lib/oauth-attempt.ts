/** How long an account-bound authorize attempt may be redeemed. */
export const OAUTH_ATTEMPT_TTL_MS = 20 * 60 * 1000;

export function oauthAttemptFresh(startedAtMs: number | null | undefined, now = Date.now()): boolean {
  if (!startedAtMs || !Number.isFinite(startedAtMs)) return false;
  return now - startedAtMs <= OAUTH_ATTEMPT_TTL_MS && now >= startedAtMs;
}

export function oauthCallbackError(providerError: string | null | undefined): {
  code: "denied" | "unauthorized";
  message: string;
} {
  const denied = /access_denied|denied|cancel/i.test(providerError ?? "");
  if (denied) {
    return { code: "denied", message: "You declined access on the network. Nothing was connected." };
  }
  return { code: "unauthorized", message: "The network did not authorize the connection." };
}
