"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE,
  ADMIN_PERMISSIONS,
  adminCookieOptions,
  createAdminRole,
  createAdminUser,
  loginAdmin,
  requireAdminSession,
  setAdminUserActive,
  type AdminPermission,
  updateAdminUserRole,
} from "@/lib/admin-auth";

export async function actionAdminLogin(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  const result = await loginAdmin(email, password);
  if (!result.ok) {
    redirect(`/admin/login?error=${encodeURIComponent(result.error)}&next=${encodeURIComponent(next)}`);
  }
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
  await requireAdminSession("access.manage_roles");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const permissions = ADMIN_PERMISSIONS.filter((p) => formData.get(`perm_${p}`) === "on");
  if (!name || permissions.length === 0) {
    redirect("/admin/access?error=Role+name+and+at+least+one+feature+permission+required");
  }
  try {
    await createAdminRole({ name, description, permissions: permissions as AdminPermission[] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create role";
    redirect(`/admin/access?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/access?created=role");
}

export async function actionCreateAdminUser(formData: FormData) {
  await requireAdminSession("access.manage_users");
  try {
    await createAdminUser({
      email: String(formData.get("email") ?? ""),
      name: String(formData.get("name") ?? ""),
      password: String(formData.get("password") ?? ""),
      roleId: String(formData.get("roleId") ?? ""),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create admin";
    redirect(`/admin/access?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/access?created=user");
}

export async function actionToggleAdminActive(formData: FormData) {
  await requireAdminSession("access.manage_users");
  const userId = String(formData.get("userId") ?? "");
  const active = String(formData.get("active") ?? "") === "1";
  try {
    await setAdminUserActive(userId, active);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update user";
    redirect(`/admin/access?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/access?updated=1");
}

export async function actionSetAdminRole(formData: FormData) {
  await requireAdminSession("access.manage_users");
  const userId = String(formData.get("userId") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  try {
    await updateAdminUserRole(userId, roleId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update role";
    redirect(`/admin/access?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/access?updated=1");
}
