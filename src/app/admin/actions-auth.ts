"use server";

import { randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE,
  ADMIN_PERMISSIONS,
  adminCookieOptions,
  createAdminRole,
  createAdminUser,
  duplicateAdminRole,
  loginAdmin,
  requireAdminSession,
  setAdminUserActive,
  type AdminPermission,
  updateAdminRole,
  updateAdminUserRole,
  completeAdminSetup,
  issueAdminSetupToken,
  reissueAdminSetup,
} from "@/lib/admin-auth";
import {
  AUTH_LOCKOUT_GENERIC_MESSAGE,
  lockoutMessage,
  recordAuthFailure,
  recordAuthSuccess,
} from "@/lib/auth-lockout";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";

function clientIp(headerStore: Headers) {
  return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function safeAdminPath(raw: string | null | undefined, fallback: string) {
  const next = String(raw ?? "").trim();
  if (next.startsWith("/admin/admin-users") || next.startsWith("/admin/access")) {
    return next.split("#")[0] || fallback;
  }
  return fallback;
}

async function writeAccessAudit(actor: string, action: string, objectId: string, after?: unknown) {
  await prisma.auditLog
    .create({
      data: {
        actor,
        action,
        objectType: "AdminAccess",
        objectId,
        after: after as never,
      },
    })
    .catch(() => null);
}

export async function actionAdminLogin(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  const headerStore = await headers();
  const ip = clientIp(headerStore);
  const locked = await lockoutMessage("admin-login", ip, email);
  if (locked) {
    redirect(`/admin/login?error=${encodeURIComponent(AUTH_LOCKOUT_GENERIC_MESSAGE)}&next=${encodeURIComponent(next)}`);
  }
  const result = await loginAdmin(email, password);
  if (!result.ok) {
    await recordAuthFailure("admin-login", ip, email);
    redirect(`/admin/login?error=${encodeURIComponent(result.error)}&next=${encodeURIComponent(next)}`);
  }
  await recordAuthSuccess("admin-login", ip, email);
  await writeAccessAudit(email, "admin.login", result.session.userId, { ip });
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, result.token, await adminCookieOptions());
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function actionAdminLogout() {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, "", { ...(await adminCookieOptions(0)), maxAge: 0 });
  redirect("/admin/login");
}

export async function actionCreateRole(formData: FormData) {
  const session = await requireAdminSession("access.manage_roles");
  const base = safeAdminPath(String(formData.get("next") ?? ""), "/admin/access");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const permissions = ADMIN_PERMISSIONS.filter((p) => formData.get(`perm_${p}`) === "on");
  if (!name || permissions.length === 0) {
    redirect(`${base}?error=${encodeURIComponent("Role name and at least one feature permission required")}`);
  }
  try {
    const role = await createAdminRole({
      name,
      description,
      permissions: permissions as AdminPermission[],
      actorPermissions: session.permissions,
    });
    await writeAccessAudit(session.email, "access.role_create", role.id, { name, permissions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create role";
    redirect(`${base}?error=${encodeURIComponent(message)}`);
  }
  redirect(`${base}?created=role`);
}

export async function actionUpdateRole(formData: FormData) {
  const session = await requireAdminSession("access.manage_roles");
  const base = safeAdminPath(String(formData.get("next") ?? ""), "/admin/access");
  const roleId = String(formData.get("roleId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const permissions = ADMIN_PERMISSIONS.filter((p) => formData.get(`perm_${p}`) === "on");
  if (!roleId || !name || permissions.length === 0) {
    redirect(`${base}?error=${encodeURIComponent("Role name and at least one feature permission required")}&edit=${roleId}`);
  }
  try {
    await updateAdminRole({
      roleId,
      name,
      description,
      permissions: permissions as AdminPermission[],
      actorPermissions: session.permissions,
    });
    await writeAccessAudit(session.email, "access.role_update", roleId, { name, permissions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update role";
    redirect(`${base}?error=${encodeURIComponent(message)}&edit=${roleId}`);
  }
  redirect(`${base}?updated=role&edit=${roleId}`);
}

export async function actionDuplicateRole(formData: FormData) {
  const session = await requireAdminSession("access.manage_roles");
  const base = safeAdminPath(String(formData.get("next") ?? ""), "/admin/access");
  const roleId = String(formData.get("roleId") ?? "").trim();
  let role: { id: string };
  try {
    role = await duplicateAdminRole(roleId, session.permissions);
    await writeAccessAudit(session.email, "access.role_duplicate", role.id, { from: roleId });
  } catch (err) {
    if (isNavigationError(err)) throw err;
    const message = err instanceof Error ? err.message : "Failed to duplicate role";
    redirect(`${base}?error=${encodeURIComponent(message)}`);
  }
  redirect(`${base}?created=role&edit=${role.id}`);
}

function isNavigationError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

function appOrigin() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function withQuery(path: string, patch: Record<string, string | undefined>) {
  const [pathname, existing] = path.split("?");
  const params = new URLSearchParams(existing || "");
  for (const [key, value] of Object.entries(patch)) {
    if (!value) params.delete(key);
    else params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

async function mailAdminSetup(input: {
  to: string;
  name: string;
  inviter: string;
  roleName: string;
  setupUrl: string;
}) {
  const { deliverCatalogEmail } = await import("@/lib/email-live");
  const catalog = await deliverCatalogEmail({
    templateId: "account.admin_setup",
    to: input.to,
    vars: {
      first_name: input.name.split(/\s+/)[0] || input.name,
      inviter_name: input.inviter,
      role_name: input.roleName || "Admin",
      expires_at: "7 days",
      action_url: input.setupUrl,
    },
  }).catch(() => ({ sent: false as const, reason: "render" as const }));
  if (catalog.sent) return { ok: true as const };
  if (!catalog.sent && catalog.reason === "paused") {
    return { ok: false as const, error: "Admin setup email is paused" };
  }
  return sendMail({
    to: input.to,
    subject: "Set up your Influrios admin account",
    text: `Hi ${input.name},\n\nAn Influrios admin invited you to the operations console.\n\nSet your password with this link:\n${input.setupUrl}\n\nThe link expires in 7 days and works once. A newer invitation replaces this one.\n`,
  }).catch(() => ({ ok: false as const, error: "Mail could not be sent" }));
}

export async function actionCreateAdminUser(formData: FormData) {
  const session = await requireAdminSession("access.manage_users");
  const base = safeAdminPath(String(formData.get("next") ?? ""), "/admin/admin-users");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const roleId = String(formData.get("roleId") ?? "").trim();
  const password = `Tmp-${randomBytes(9).toString("base64url")}!`;
  try {
    const user = await createAdminUser({
      email,
      name,
      password,
      roleId,
      actorPermissions: session.permissions,
    });
    const token = issueAdminSetupToken(user.id, user.permissionVersion, Date.now(), user.setupNonce);
    const setupUrl = `${appOrigin()}/admin/setup?token=${encodeURIComponent(token)}`;
    const mailed = await mailAdminSetup({
      to: user.email,
      name: user.name,
      inviter: session.email,
      roleName: roleId,
      setupUrl,
    });
    await writeAccessAudit(session.email, "access.admin_invite", user.id, {
      email: user.email,
      roleId,
      setupLinkIssued: true,
      mailed: mailed.ok,
    });
    if (!mailed.ok) {
      redirect(withQuery(base, { created: "link", setup: setupUrl }));
    }
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    const message = err instanceof Error ? err.message : "Failed to create admin";
    redirect(withQuery(base, { error: message }));
  }
  redirect(withQuery(base, { created: "user" }));
}

export async function actionResendAdminSetup(formData: FormData) {
  const session = await requireAdminSession("access.manage_users");
  const base = safeAdminPath(String(formData.get("next") ?? ""), "/admin/admin-users");
  const userId = String(formData.get("userId") ?? "").trim();
  try {
    const user = await reissueAdminSetup(userId);
    const setupUrl = `${appOrigin()}/admin/setup?token=${encodeURIComponent(user.token)}`;
    const mailed = await mailAdminSetup({
      to: user.email,
      name: user.name,
      inviter: session.email,
      roleName: user.roleId,
      setupUrl,
    });
    await writeAccessAudit(session.email, "access.admin_invite_resend", user.id, {
      email: user.email,
      setupLinkIssued: true,
      mailed: mailed.ok,
    });
    if (!mailed.ok) {
      redirect(withQuery(base, { created: "link", setup: setupUrl, manage: user.id }));
    }
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    const message = err instanceof Error ? err.message : "Could not send a new setup link";
    redirect(withQuery(base, { error: message, manage: userId }));
  }
  redirect(withQuery(base, { updated: "setup", manage: userId }));
}

export async function actionCompleteAdminSetup(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) {
    redirect(`/admin/setup?token=${encodeURIComponent(token)}&error=${encodeURIComponent("Passwords do not match")}`);
  }
  try {
    await completeAdminSetup(token, password);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save that password";
    redirect(`/admin/setup?token=${encodeURIComponent(token)}&error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/login?setup=done");
}

export async function actionToggleAdminActive(formData: FormData) {
  const session = await requireAdminSession("access.manage_users");
  const base = safeAdminPath(String(formData.get("next") ?? ""), "/admin/admin-users");
  const userId = String(formData.get("userId") ?? "");
  const active = String(formData.get("active") ?? "") === "1";
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  try {
    await setAdminUserActive(userId, active);
    await writeAccessAudit(
      session.email,
      active ? "access.admin_enable" : "access.admin_suspend",
      userId,
      { active, reason: reason || undefined },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update user";
    redirect(withQuery(base, { error: message }));
  }
  redirect(withQuery(base, { updated: "1" }));
}

export async function actionSetAdminRole(formData: FormData) {
  const session = await requireAdminSession("access.manage_users");
  const base = safeAdminPath(String(formData.get("next") ?? ""), "/admin/admin-users");
  const userId = String(formData.get("userId") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  try {
    await updateAdminUserRole(userId, roleId, session.permissions);
    await writeAccessAudit(session.email, "access.admin_role_change", userId, {
      roleId,
      reason: reason || undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update role";
    redirect(withQuery(base, { error: message, manage: userId }));
  }
  redirect(withQuery(base, { updated: "1", manage: userId }));
}
