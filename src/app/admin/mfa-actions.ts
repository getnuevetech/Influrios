"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { clientIpFrom } from "@/lib/client-ip";
import { ADMIN_COOKIE, adminCookieOptions, adminSessionTokenFor, getAdminSession } from "@/lib/admin-auth";
import {
  ADMIN_MFA_CHALLENGE_COOKIE,
  adminMfaStep,
  confirmEnrollment,
  readMfaChallenge,
  resetAdminAuthenticator,
  saveAdminMfaMode,
  verifyAdminCode,
  type AdminMfaMode,
} from "@/lib/admin-mfa";
import { lockoutMessage, recordAuthFailure, recordAuthSuccess, AUTH_LOCKOUT_GENERIC_MESSAGE } from "@/lib/auth-lockout";
import { prisma } from "@/lib/db";

async function audit(actor: string, action: string, objectId: string, after?: unknown) {
  await prisma.auditLog.create({ data: { actor, action, objectType: "AdminAccess", objectId, after: after as never } }).catch(() => null);
}

/** Second sign-in step: confirm setup (first time) or check the code, then start the admin session. */
export async function actionAdminMfaVerify(formData: FormData) {
  const jar = await cookies();
  const challenge = await readMfaChallenge(jar.get(ADMIN_MFA_CHALLENGE_COOKIE)?.value);
  if (!challenge) redirect(`/admin/login?error=${encodeURIComponent("Your sign-in took too long. Sign in again.")}`);
  const ip = clientIpFrom(await headers());
  const key = `mfa:${challenge.userId}`;
  if (await lockoutMessage("admin-login", ip, key)) {
    redirect(`/admin/login/verify?error=${encodeURIComponent(AUTH_LOCKOUT_GENERIC_MESSAGE)}`);
  }
  const code = String(formData.get("code") ?? "");
  const step = await adminMfaStep(challenge.userId);
  const result = step === "enroll" ? await confirmEnrollment(challenge.userId, code) : await verifyAdminCode(challenge.userId, code);
  if (!result.ok) {
    await recordAuthFailure("admin-login", ip, key);
    redirect(`/admin/login/verify?error=${encodeURIComponent(result.error)}`);
  }
  await recordAuthSuccess("admin-login", ip, key);
  const issued = await adminSessionTokenFor(challenge.userId, challenge.permissionVersion);
  if (!issued) redirect(`/admin/login?error=${encodeURIComponent("Sign in again.")}`);
  jar.set(ADMIN_MFA_CHALLENGE_COOKIE, "", { ...(await adminCookieOptions(0)), maxAge: 0 });
  jar.set(ADMIN_COOKIE, issued.token, await adminCookieOptions());
  await audit(issued.session.email, step === "enroll" ? "admin.mfa_enrolled" : "admin.login", issued.session.userId, { ip, mfa: true });
  redirect(challenge.next.startsWith("/admin") ? challenge.next : "/admin");
}

/** Signed-in admin sets up their own authenticator. */
export async function actionConfirmMyAuthenticator(formData: FormData) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const result = await confirmEnrollment(session.userId, String(formData.get("code") ?? ""));
  if (!result.ok) redirect(`/admin/security?error=${encodeURIComponent(result.error)}`);
  await audit(session.email, "admin.mfa_enrolled", session.userId);
  redirect("/admin/security?enrolled=1");
}

/** Signed-in admin removes their own authenticator (needs a current code). */
export async function actionRemoveMyAuthenticator(formData: FormData) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const check = await verifyAdminCode(session.userId, String(formData.get("code") ?? ""));
  if (!check.ok) redirect(`/admin/security?error=${encodeURIComponent(check.error)}`);
  await resetAdminAuthenticator(session.userId);
  await audit(session.email, "admin.mfa_removed", session.userId);
  redirect("/admin/security?removed=1");
}

/** An admin who manages users resets another admin's authenticator (lost phone). */
export async function actionResetAdminAuthenticator(formData: FormData) {
  const session = await requireAdminAction("access.security");
  const userId = String(formData.get("userId") ?? "");
  if (!userId) redirect("/admin/admin-users");
  await resetAdminAuthenticator(userId);
  await audit(session.email, "admin.mfa_reset", userId);
  redirect(`/admin/admin-users?notice=${encodeURIComponent("Authenticator reset. That admin sets it up again at their next sign-in, if required.")}`);
}

export async function actionSaveAdminMfaMode(formData: FormData) {
  const session = await requireAdminAction("access.security");
  const raw = String(formData.get("mode") ?? "off");
  const mode: AdminMfaMode = raw === "enrolled" || raw === "required" ? raw : "off";
  await saveAdminMfaMode(mode);
  await audit(session.email, "admin.mfa_mode", "admin.mfa", { mode });
  redirect(`/admin/admin-users?notice=${encodeURIComponent("Sign-in security saved.")}`);
}
