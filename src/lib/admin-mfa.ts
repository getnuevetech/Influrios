/**
 * Admin sign-in second step: a 6-digit code from an authenticator app (TOTP, RFC 6238, SHA-1, 30 s).
 * Mode (Admin users → Sign-in security):
 *   off       — nobody is asked for a code (default).
 *   enrolled  — admins who set up an authenticator are asked for a code; others sign in with a password.
 *   required  — every admin must enter a code; an admin without one sets it up at sign-in.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

export type AdminMfaState = "enabled" | "not_enabled" | "unavailable";
export type AdminMfaMode = "off" | "enrolled" | "required";
export const ADMIN_MFA_KEY = "admin.mfa";
export const ADMIN_MFA_CHALLENGE_COOKIE = "influrios_admin_mfa";
const STEP_SECONDS = 30;
const CHALLENGE_MS = 10 * 60 * 1000;
const ISSUER = "Influrios Admin";

export const ADMIN_MFA_MODE_LABEL: Record<AdminMfaMode, string> = {
  off: "Off — password only",
  enrolled: "On for admins who set up an authenticator",
  required: "Required for every admin",
};

/** How the MFA column reads for one admin. */
export function adminMfaPresentation(input: { offered: boolean; enabled: boolean; mode?: AdminMfaMode }): {
  state: AdminMfaState;
  label: string;
  detail: string;
} {
  if (!input.offered) {
    return { state: "unavailable", label: "Unavailable", detail: "Admin sign-in does not offer a second factor." };
  }
  if (input.enabled) {
    return {
      state: "enabled",
      label: input.mode === "off" ? "Set up (not asked while off)" : "Enabled",
      detail: "This admin has an authenticator app set up.",
    };
  }
  return {
    state: "not_enabled",
    label: input.mode === "required" ? "Set up at next sign-in" : "Not set up",
    detail: "This admin has not set up an authenticator app.",
  };
}

// ---------- TOTP ----------

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string) {
  const clean = text.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function newTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function totpAt(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, "0");
}

export function currentStep(now = Date.now()) {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

/** The matching step (current ±1 for clock drift), or null. A step at or before lastStep is refused (no replay). */
export function matchTotp(secret: string, code: string, lastStep: number | null, now = Date.now()) {
  const given = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(given)) return null;
  const step = currentStep(now);
  for (const candidate of [step - 1, step, step + 1]) {
    if (lastStep != null && candidate <= lastStep) continue;
    const expected = totpAt(secret, candidate);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(given))) return candidate;
  }
  return null;
}

export function otpauthUrl(secret: string, email: string) {
  const label = encodeURIComponent(`${ISSUER}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}

// ---------- Settings ----------

export function readAdminMfaMode(value: unknown): AdminMfaMode {
  const mode = value && typeof value === "object" ? (value as { mode?: unknown }).mode : null;
  return mode === "enrolled" || mode === "required" ? mode : "off";
}

export async function getAdminMfaMode(): Promise<AdminMfaMode> {
  const row = await prisma.platformSetting.findUnique({ where: { key: ADMIN_MFA_KEY } }).catch(() => null);
  return readAdminMfaMode(row?.value);
}

export async function saveAdminMfaMode(mode: AdminMfaMode) {
  const value = { mode };
  await prisma.platformSetting.upsert({ where: { key: ADMIN_MFA_KEY }, create: { key: ADMIN_MFA_KEY, value }, update: { value } });
}

/** What sign-in needs after a correct password. */
export function mfaStepFor(mode: AdminMfaMode, enrolled: boolean): "none" | "verify" | "enroll" {
  if (mode === "off") return "none";
  if (enrolled) return "verify";
  return mode === "required" ? "enroll" : "none";
}

export async function adminMfaStep(userId: string) {
  const [mode, user] = await Promise.all([
    getAdminMfaMode(),
    prisma.adminUser.findUnique({ where: { id: userId }, select: { totpSecret: true } }),
  ]);
  return mfaStepFor(mode, Boolean(user?.totpSecret));
}

// ---------- Sign-in challenge (signed, short-lived cookie between password and code) ----------

export async function issueMfaChallenge(userId: string, permissionVersion: number, next: string, now = Date.now()) {
  const { signAdminPayload } = await import("@/lib/admin-auth");
  const payload = Buffer.from(JSON.stringify({ purpose: "admin-mfa", userId, permissionVersion, next, exp: now + CHALLENGE_MS })).toString("base64url");
  return `${payload}.${signAdminPayload(payload)}`;
}

export async function readMfaChallenge(token: string | null | undefined, now = Date.now()) {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const { signAdminPayload } = await import("@/lib/admin-auth");
  const expected = Buffer.from(signAdminPayload(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      purpose?: string;
      userId?: string;
      permissionVersion?: number;
      next?: string;
      exp?: number;
    };
    if (data.purpose !== "admin-mfa" || !data.userId || typeof data.permissionVersion !== "number") return null;
    if (!data.exp || now > data.exp) return null;
    return { userId: data.userId, permissionVersion: data.permissionVersion, next: typeof data.next === "string" ? data.next : "/admin" };
  } catch {
    return null;
  }
}

// ---------- Enrollment and verification ----------

async function secrets() {
  return import("@/lib/provider-secrets");
}

/** Start (or continue) setup: returns the secret to show as a QR code. */
export async function beginEnrollment(userId: string) {
  const { decryptSecret, encryptSecret } = await secrets();
  const user = await prisma.adminUser.findUnique({ where: { id: userId }, select: { email: true, totpPendingSecret: true } });
  if (!user) return null;
  let secret = user.totpPendingSecret ? decryptSecret(user.totpPendingSecret) : null;
  if (!secret) {
    secret = newTotpSecret();
    await prisma.adminUser.update({ where: { id: userId }, data: { totpPendingSecret: encryptSecret(secret) } });
  }
  return { secret, email: user.email, url: otpauthUrl(secret, user.email) };
}

/** Confirm setup with the first code; the pending secret becomes the active one. */
export async function confirmEnrollment(userId: string, code: string) {
  const { decryptSecret } = await secrets();
  const user = await prisma.adminUser.findUnique({ where: { id: userId }, select: { totpPendingSecret: true } });
  const secret = user?.totpPendingSecret ? decryptSecret(user.totpPendingSecret) : null;
  if (!secret) return { ok: false as const, error: "Setup expired. Start again." };
  const step = matchTotp(secret, code, null);
  if (step == null) return { ok: false as const, error: "That code did not match. Check the app and try the newest code." };
  await prisma.adminUser.update({
    where: { id: userId },
    data: { totpSecret: user!.totpPendingSecret, totpPendingSecret: null, totpEnabledAt: new Date(), totpLastStep: step },
  });
  return { ok: true as const };
}

export async function verifyAdminCode(userId: string, code: string) {
  const { decryptSecret } = await secrets();
  const user = await prisma.adminUser.findUnique({ where: { id: userId }, select: { totpSecret: true, totpLastStep: true } });
  const secret = user?.totpSecret ? decryptSecret(user.totpSecret) : null;
  if (!secret) return { ok: false as const, error: "No authenticator is set up for this admin." };
  const step = matchTotp(secret, code, user!.totpLastStep ?? null);
  if (step == null) return { ok: false as const, error: "That code did not match. Use the newest code from your authenticator app." };
  await prisma.adminUser.update({ where: { id: userId }, data: { totpLastStep: step } });
  return { ok: true as const };
}

export async function resetAdminAuthenticator(userId: string) {
  await prisma.adminUser.update({
    where: { id: userId },
    data: { totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null },
  });
}

export async function adminMfaStatuses() {
  const rows = await prisma.adminUser.findMany({ select: { id: true, totpSecret: true } }).catch(() => []);
  return new Map(rows.map((row) => [row.id, Boolean(row.totpSecret)]));
}
