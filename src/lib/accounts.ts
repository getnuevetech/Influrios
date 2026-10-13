import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { passwordError } from "@/lib/account-policy";
import { requireAuthSecret } from "@/lib/app-secret";
import { getSiteConfig } from "@/lib/site-config";

const COOKIE = "influrios_account";
const SESSION_DAYS = 14;

export type AccountSession = {
  id: string;
  email: string;
  name: string | null;
  emailVerifiedAt: Date | null;
  role: string;
  hasPassword: boolean;
};

/** Post-login / post-verify home by role. Creators land on the dashboard, not edit profile. */
export function homePathForRole(role: string | null | undefined): string {
  if (role === "BUSINESS" || role === "AGENCY") return "/business/home";
  return "/creator";
}

function secret() {
  return requireAuthSecret("account");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function hashAccountPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyAccountPassword(password: string, stored: string) {
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const current = Buffer.from(hash, "hex");
  if (current.length !== next.length) return false;
  return timingSafeEqual(current, next);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function verificationCode() {
  return String(randomInt(100000, 1000000));
}

export function normalizeVerificationCode(code: string) {
  return code.trim().replace(/\s+/g, "");
}

async function activeEmailChallenge(userId: string) {
  return prisma.emailChallenge.findFirst({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
}

/** Stores a code only after SMTP accepts the verification job. The page never reads it. */
async function issueEmailChallenge(userId: string, opts?: { force?: boolean }) {
  const { mailReady } = await import("@/lib/mail");
  if (!(await mailReady())) return null;
  if (!opts?.force) {
    const existing = await activeEmailChallenge(userId);
    if (existing) return existing.demoCode;
  }
  const code = verificationCode();
  await prisma.emailChallenge.deleteMany({ where: { userId, usedAt: null } });
  const challenge = await prisma.emailChallenge.create({
    data: {
      userId,
      demoCode: code,
      expiresAt: new Date(Date.now() + 1000 * 60 * 30),
    },
  });
  try {
    const { enqueueVerificationEmail } = await import("@/lib/jobs");
    const queued = await enqueueVerificationEmail(userId, code);
    if (!queued.queued) {
      await prisma.emailChallenge.delete({ where: { id: challenge.id } });
      return null;
    }
  } catch (error) {
    await prisma.emailChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
    console.error("verification mail skipped", error);
    return null;
  }
  return code;
}

/** Force a new code and email. Used by the verify-page resend control. */
export async function resendAccountVerification(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) throw new Error("Account not found.");
  if (user.emailVerifiedAt) throw new Error("This email is already verified. Log in.");
  const code = await issueEmailChallenge(user.id, { force: true });
  if (!code) throw new Error("Could not send a verification code. Check SMTP and try again.");
  return { sent: true as const };
}

export async function registerAccount(input: {
  email: string;
  name: string;
  password: string;
  source: string;
  ip?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email.includes("@") || !name) throw new Error("Name and a valid email are required.");

  const policy = await getSiteConfig();
  const problem = passwordError(input.password, policy.passwordMinLength);
  if (problem) throw new Error(problem);

  const passwordHash = hashAccountPassword(input.password);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.passwordHash && existing.emailVerifiedAt) {
    throw new Error("An account with that email already exists. Log in.");
  }

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { name, passwordHash, emailVerifiedAt: null },
      })
    : await prisma.user.create({
        data: { email, name, passwordHash, role: "CREATOR", planTier: "STARTER" },
      });

  await prisma.consentRecord.create({
    data: { userId: user.id, version: policy.consentVersion, source: input.source },
  });
  const { recordLegalEvent } = await import("@/lib/legal");
  await recordLegalEvent({
    trigger: "registration",
    context: "registration",
    userId: user.id,
    userRole: user.role,
    ip: input.ip,
  });
  await issueEmailChallenge(user.id);
  return user;
}

export async function loginAccount(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user?.passwordHash || !verifyAccountPassword(password, user.passwordHash)) {
    throw new Error("Email or password is incorrect.");
  }
  if (user.suspendedAt) throw new Error("This account is suspended. Contact Influrios support.");
  if (!user.emailVerifiedAt) {
    // Reuse an unused challenge so the code already in the inbox still works.
    await issueEmailChallenge(user.id);
    const error = new Error("Verify your email before logging in. Use the latest code we emailed you.");
    (error as Error & { code?: string }).code = "unverified";
    throw error;
  }
  await setAccountSession(user.id);
  await attachOnboarding(user.id);
  return user;
}

export async function verifyAccountEmail(email: string, code: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) throw new Error("Account not found.");
  const challenge = await activeEmailChallenge(user.id);
  if (!challenge) throw new Error("Nothing was sent. Nothing was verified. Use Resend code if you need a new email.");
  if (challenge.demoCode !== normalizeVerificationCode(code)) {
    throw new Error("That verification code is not valid. Check the latest email, or resend a new code.");
  }
  await prisma.emailChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } });
  const verified = await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date() },
  });
  await setAccountSession(verified.id);
  await attachOnboarding(verified.id);
  return verified;
}

/**
 * Email a reset/setup link. Works for claim users with no password yet so they can set one.
 * Returns sent:false when mail is unavailable or the address is unknown.
 */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return { sent: false };
  const { mailReady } = await import("@/lib/mail");
  if (!(await mailReady())) return { sent: false };
  const token = randomBytes(24).toString("base64url");
  const row = await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 1000 * 60 * 30),
    },
  });
  try {
    const { enqueuePasswordResetEmail } = await import("@/lib/jobs");
    const queued = await enqueuePasswordResetEmail(user.email, token);
    if (!queued.queued) {
      await prisma.passwordReset.delete({ where: { id: row.id } });
      return { sent: false };
    }
  } catch (error) {
    await prisma.passwordReset.delete({ where: { id: row.id } }).catch(() => undefined);
    console.error("password reset mail skipped", error);
    return { sent: false };
  }
  return { sent: true };
}

/** Set or replace the member password while already signed in (claim users after email verify). */
export async function setAccountPassword(userId: string, password: string) {
  const policy = await getSiteConfig();
  const problem = passwordError(password, policy.passwordMinLength);
  if (problem) throw new Error(problem);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashAccountPassword(password) },
  });
}

/**
 * After claim email verification: create/link the member User, mark email verified permanently,
 * and open the account session so nav no longer bounces to login.
 */
export async function ensureAccountFromClaimDraft(input: {
  draftId: string;
  email: string;
  name?: string | null;
  verifiedAt?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("A valid email is required.");
  const verifiedAt = input.verifiedAt ? new Date(input.verifiedAt) : new Date();
  const existing = await prisma.user.findUnique({ where: { email } });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: input.name?.trim() || existing.name,
          emailVerifiedAt: existing.emailVerifiedAt ?? verifiedAt,
          role: existing.role === "ADMIN" ? existing.role : "CREATOR",
        },
      })
    : await prisma.user.create({
        data: {
          email,
          name: input.name?.trim() || null,
          role: "CREATOR",
          planTier: "STARTER",
          emailVerifiedAt: verifiedAt,
        },
      });
  await prisma.onboardingSession.update({
    where: { id: input.draftId },
    data: { userId: user.id },
  });
  await setAccountSession(user.id);
  await attachOnboarding(user.id);
  return user;
}

export async function resetPassword(token: string, password: string) {
  const policy = await getSiteConfig();
  const problem = passwordError(password, policy.passwordMinLength);
  if (problem) throw new Error(problem);
  const row = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw new Error("This reset link has expired.");
  await prisma.user.update({
    where: { id: row.userId },
    data: { passwordHash: hashAccountPassword(password), emailVerifiedAt: new Date() },
  });
  await prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  await setAccountSession(row.userId);
  await attachOnboarding(row.userId);
}

async function attachOnboarding(userId: string) {
  try {
    const { attachClaimToUser } = await import("@/lib/claim");
    await attachClaimToUser(userId);
  } catch (error) {
    console.error("onboarding attach skipped", error);
  }
}

export async function setAccountSession(userId: string) {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  const body = Buffer.from(JSON.stringify({ userId, exp }), "utf8").toString("base64url");
  const token = `${body}.${sign(body)}`;
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function clearAccountSession() {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function getAccountSession(): Promise<AccountSession | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      userId: string;
      exp: number;
    };
    if (parsed.exp < Date.now()) return null;
    const user = await prisma.user.findUnique({ where: { id: parsed.userId } });
    if (!user?.emailVerifiedAt || user.suspendedAt) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerifiedAt: user.emailVerifiedAt,
      role: user.role,
      hasPassword: Boolean(user.passwordHash),
    };
  } catch {
    return null;
  }
}
