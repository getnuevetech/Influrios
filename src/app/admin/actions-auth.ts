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
  try {
    const role = await duplicateAdminRole(roleId);
    await writeAccessAudit(session.email, "access.role_duplicate", role.id, { from: roleId });
    redirect(`${base}?created=role&edit=${role.id}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to duplicate role";
    redirect(`${base}?error=${encodeURIComponent(message)}`);
  }
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

export async function actionCreateAdminUser(formData: FormData) {
  const session = await requireAdminSession("access.manage_users");
  const base = safeAdminPath(String(formData.get("next") ?? ""), "/admin/admin-users");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const roleId = String(formData.get("roleId") ?? "").trim();
  const password = `Tmp-${randomBytes(9).toString("base64url")}!`;
  try {
    const user = await createAdminUser({ email, name, password, roleId });
    const token = issueAdminSetupToken(user.id, 1);
    const setupUrl = `${appOrigin()}/admin/setup?token=${encodeURIComponent(token)}`;
    const mailed = await sendMail({
      to: user.email,
      subject: "Set up your Influrios admin account",
      text: `Hi ${user.name},\n\nAn Influrios admin invited you to the operations console.\n\nSet your password with this link:\n${setupUrl}\n\nThe link expires in 7 days and works once.\n`,
    }).catch(() => ({ ok: false as const, error: "Mail could not be sent" }));
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
    await updateAdminUserRole(userId, roleId);
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
