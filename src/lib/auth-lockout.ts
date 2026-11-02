/**
 * Auth attempt lockout (Phase N / W1).
 * Durable in Postgres so multi-instance / restart cannot reset the window.
 * Unit tests force the in-memory store via resetAuthLockoutsForTests().
 */
import { prisma } from "@/lib/db";

export type AuthLockScope =
  | "admin-login"
  | "account-login"
  | "register"
  | "account-verify"
  | "claim-verify"
  | "password-reset"
  | "intelligence-export";

type Bucket = {
  fails: number;
  windowStarted: number;
  lockedUntil: number;
};

const buckets = new Map<string, Bucket>();

export const AUTH_LOCK_MAX_FAILS = 5;
export const AUTH_LOCK_WINDOW_MS = 15 * 60_000;
export const AUTH_LOCK_MS = 15 * 60_000;
/** Intelligence export: 20 downloads / 15 minutes per account. */
export const EXPORT_LOCK_MAX_FAILS = 20;

const GENERIC_FAIL = "Too many attempts. Try again later.";

let forceMemory = false;

function bucketKey(scope: AuthLockScope, ip: string, id: string) {
  return `${scope}:${ip || "unknown"}:${(id || "").trim().toLowerCase().slice(0, 200)}`;
}

function subjectOf(id: string) {
  return (id || "").trim().toLowerCase().slice(0, 200) || "unknown";
}

function ipOf(ip: string) {
  return (ip || "unknown").trim().slice(0, 120) || "unknown";
}

function pruneMemory(now: number) {
  if (buckets.size < 500) return;
  for (const [k, bucket] of buckets) {
    if (bucket.lockedUntil < now && now - bucket.windowStarted > AUTH_LOCK_WINDOW_MS) {
      buckets.delete(k);
    }
  }
}

function maxFailsFor(scope: AuthLockScope) {
  return scope === "intelligence-export" ? EXPORT_LOCK_MAX_FAILS : AUTH_LOCK_MAX_FAILS;
}

function memoryMessage(scope: AuthLockScope, ip: string, id: string, now: number): string | null {
  pruneMemory(now);
  const bucket = buckets.get(bucketKey(scope, ip, id));
  if (!bucket) return null;
  if (bucket.lockedUntil > now) return GENERIC_FAIL;
  return null;
}

function memoryFailure(scope: AuthLockScope, ip: string, id: string, now: number) {
  pruneMemory(now);
  const k = bucketKey(scope, ip, id);
  const current = buckets.get(k);
  const max = maxFailsFor(scope);
  if (!current || now - current.windowStarted > AUTH_LOCK_WINDOW_MS) {
    buckets.set(k, { fails: 1, windowStarted: now, lockedUntil: 0 });
    return;
  }
  current.fails += 1;
  if (current.fails >= max) {
    current.lockedUntil = now + AUTH_LOCK_MS;
  }
}

function memorySuccess(scope: AuthLockScope, ip: string, id: string) {
  buckets.delete(bucketKey(scope, ip, id));
}

async function dbMessage(scope: AuthLockScope, ip: string, id: string, now: number): Promise<string | null> {
  const row = await prisma.authLockout.findUnique({
    where: { scope_ip_subject: { scope, ip: ipOf(ip), subject: subjectOf(id) } },
  });
  if (!row) return null;
  if (row.lockedUntil && row.lockedUntil.getTime() > now) return GENERIC_FAIL;
  return null;
}

async function dbFailure(scope: AuthLockScope, ip: string, id: string, now: number) {
  const key = { scope, ip: ipOf(ip), subject: subjectOf(id) };
  const max = maxFailsFor(scope);
  const existing = await prisma.authLockout.findUnique({ where: { scope_ip_subject: key } });
  if (!existing || now - existing.windowStarted.getTime() > AUTH_LOCK_WINDOW_MS) {
    await prisma.authLockout.upsert({
      where: { scope_ip_subject: key },
      create: {
        scope: key.scope,
        ip: key.ip,
        subject: key.subject,
        fails: 1,
        windowStarted: new Date(now),
        lockedUntil: null,
      },
      update: {
        fails: 1,
        windowStarted: new Date(now),
        lockedUntil: null,
      },
    });
    return;
  }
  const fails = existing.fails + 1;
  const lockedUntil = fails >= max ? new Date(now + AUTH_LOCK_MS) : existing.lockedUntil;
  await prisma.authLockout.update({
    where: { scope_ip_subject: key },
    data: { fails, lockedUntil },
  });
}

async function dbSuccess(scope: AuthLockScope, ip: string, id: string) {
  await prisma.authLockout
    .delete({
      where: { scope_ip_subject: { scope, ip: ipOf(ip), subject: subjectOf(id) } },
    })
    .catch(() => undefined);
}

/** Returns a generic error message when locked; null when allowed. */
export async function lockoutMessage(
  scope: AuthLockScope,
  ip: string,
  id: string,
  now = Date.now(),
): Promise<string | null> {
  if (forceMemory) return memoryMessage(scope, ip, id, now);
  try {
    return await dbMessage(scope, ip, id, now);
  } catch {
    return memoryMessage(scope, ip, id, now);
  }
}

export async function recordAuthFailure(scope: AuthLockScope, ip: string, id: string, now = Date.now()) {
  if (forceMemory) {
    memoryFailure(scope, ip, id, now);
    return;
  }
  try {
    await dbFailure(scope, ip, id, now);
  } catch {
    memoryFailure(scope, ip, id, now);
  }
}

export async function recordAuthSuccess(scope: AuthLockScope, ip: string, id: string) {
  if (forceMemory) {
    memorySuccess(scope, ip, id);
    return;
  }
  try {
    await dbSuccess(scope, ip, id);
  } catch {
    memorySuccess(scope, ip, id);
  }
}

/** Test helper — clears buckets and forces the in-memory store. */
export function resetAuthLockoutsForTests() {
  forceMemory = true;
  buckets.clear();
}

export const AUTH_LOCKOUT_GENERIC_MESSAGE = GENERIC_FAIL;
