import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { passwordError } from "@/lib/account-policy";
import { getSiteConfig } from "@/lib/site-config";
import { getCreatorSessionDraft } from "@/lib/claim";

const COOKIE = "influrios_account";
const SESSION_DAYS = 14;

export type AccountSession = {
  id: string;
  email: string;
  name: string | null;
  emailVerifiedAt: Date | null;
};

function secret() {
  return process.env.AUTH_SECRET || process.env.ADMIN_SESSION_SECRET || "influrios-account-demo";
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

function demoCode() {
  return String(randomInt(100000, 1000000));
}

async function issueEmailChallenge(userId: string) {
  const code = demoCode();
  await prisma.emailChallenge.deleteMany({ where: { userId, usedAt: null } });
  await prisma.emailChallenge.create({
    data: {
      userId,
      demoCode: code,
      expiresAt: new Date(Date.now() + 1000 * 60 * 30),
    },
  });
  return code;
}

export async function registerAccount(input: {
  email: string;
  name: string;
  password: string;
  source: string;
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
    await issueEmailChallenge(user.id);
    const error = new Error("Verify your email before logging in.");
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
  const challenge = await prisma.emailChallenge.findFirst({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge || challenge.demoCode !== code.trim()) {
    throw new Error("That verification code is not valid.");
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

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user?.passwordHash) return null;
  const token = randomBytes(24).toString("base64url");
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 1000 * 60 * 30),
    },
  });
  return token;
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

export async function latestDemoCode(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { emailChallenges: { where: { usedAt: null }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return user?.emailChallenges[0]?.demoCode ?? null;
}

async function attachOnboarding(userId: string) {
  try {
    const draft = await getCreatorSessionDraft();
    if (!draft) return;
    await prisma.onboardingSession.update({
      where: { id: draft.id },
      data: { userId },
    });
  } catch {
    /* The claim may still be JSON-only if Postgres was down when it was created. */
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
    };
  } catch {
    return null;
  }
}
