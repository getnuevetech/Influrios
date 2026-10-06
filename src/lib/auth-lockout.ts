/**
 * In-memory auth attempt lockout (Phase N).
 * Resets on process restart — acceptable for single Compose web today.
 */
export type AuthLockScope =
  | "admin-login"
  | "account-login"
  | "register"
  | "account-verify"
  | "claim-verify"
  | "password-reset";

type Bucket = {
  fails: number;
  windowStarted: number;
  lockedUntil: number;
};

const buckets = new Map<string, Bucket>();

export const AUTH_LOCK_MAX_FAILS = 5;
export const AUTH_LOCK_WINDOW_MS = 15 * 60_000;
export const AUTH_LOCK_MS = 15 * 60_000;

const GENERIC_FAIL = "Too many attempts. Try again later.";

function key(scope: AuthLockScope, ip: string, id: string) {
  return `${scope}:${ip || "unknown"}:${(id || "").trim().toLowerCase()}`;
}

function prune(now: number) {
  if (buckets.size < 500) return;
  for (const [k, bucket] of buckets) {
    if (bucket.lockedUntil < now && now - bucket.windowStarted > AUTH_LOCK_WINDOW_MS) {
      buckets.delete(k);
    }
  }
}

/** Returns a generic error message when locked; null when allowed. */
export function lockoutMessage(scope: AuthLockScope, ip: string, id: string, now = Date.now()): string | null {
  prune(now);
  const bucket = buckets.get(key(scope, ip, id));
  if (!bucket) return null;
  if (bucket.lockedUntil > now) return GENERIC_FAIL;
  return null;
}

export function recordAuthFailure(scope: AuthLockScope, ip: string, id: string, now = Date.now()) {
  prune(now);
  const k = key(scope, ip, id);
  const current = buckets.get(k);
  if (!current || now - current.windowStarted > AUTH_LOCK_WINDOW_MS) {
    buckets.set(k, { fails: 1, windowStarted: now, lockedUntil: 0 });
    return;
  }
  current.fails += 1;
  if (current.fails >= AUTH_LOCK_MAX_FAILS) {
    current.lockedUntil = now + AUTH_LOCK_MS;
  }
}

export function recordAuthSuccess(scope: AuthLockScope, ip: string, id: string) {
  buckets.delete(key(scope, ip, id));
}

/** Test helper — clears all buckets. */
export function resetAuthLockoutsForTests() {
  buckets.clear();
}

export const AUTH_LOCKOUT_GENERIC_MESSAGE = GENERIC_FAIL;
