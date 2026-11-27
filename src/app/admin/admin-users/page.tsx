import { redirect } from "next/navigation";
import { AdminUsersView } from "@/components/admin-users-ui";
import {
  canAccessModule,
  getAdminAuthStore,
  getAdminSession,
  hasPermission,
} from "@/lib/admin-auth";
import { actionSaveAdminMfaMode } from "@/app/admin/mfa-actions";
import { ADMIN_MFA_MODE_LABEL, adminMfaPresentation, adminMfaStatuses, getAdminMfaMode, type AdminMfaMode } from "@/lib/admin-mfa";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin Users · Admin" };

type Props = {
  searchParams: Promise<{
    error?: string;
    created?: string;
    updated?: string;
    setup?: string;
    q?: string;
    status?: string;
    role?: string;
    manage?: string;
    invite?: string;
    notice?: string;
  }>;
};

export default async function AdminUsersPage({ searchParams }: Props) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?next=/admin/admin-users");
  if (!canAccessModule(session, "access")) redirect("/admin?error=forbidden");

  const canManage = hasPermission(session, "access.manage_users");
  const params = await searchParams;
  const store = await getAdminAuthStore();
  const roleById = new Map(store.roles.map((r) => [r.id, r]));

  const [mfaMode, mfaEnrolled] = await Promise.all([getAdminMfaMode(), adminMfaStatuses()]);
  const users = store.users.map((u) => {
    const role = roleById.get(u.roleId);
    const mfa = adminMfaPresentation({ offered: true, enabled: Boolean(mfaEnrolled.get(u.id)), mode: mfaMode });
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      roleId: u.roleId,
      roleName: role?.name || "Unknown",
      permissionCount: role?.permissions.length ?? 0,
      active: u.active,
      mfaLabel: mfa.label,
      mfaDetail: mfa.detail,
      mfaEnrolled: Boolean(mfaEnrolled.get(u.id)),
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  });

  const roles = store.roles.map((r) => ({
    id: r.id,
    name: r.name,
    permissionCount: r.permissions.length,
    system: Boolean(r.system),
  }));

  const activityRows = await prisma.auditLog
    .findMany({
      where: {
        OR: [
          { action: { startsWith: "access." } },
          { action: "admin.login" },
          { action: { startsWith: "admin.mfa" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, action: true, actor: true, objectId: true, createdAt: true },
    })
    .catch(() => []);

  const activity = activityRows.map((row) => ({
    id: row.id,
    title: `${row.action.replace(/\./g, " · ")} · ${row.actor}`,
    at: row.createdAt.toISOString(),
    actor: row.actor,
    objectId: row.objectId || "",
  }));
  const status = params.status === "active" || params.status === "suspended" ? params.status : "all";

  return (
    <>
      {params.notice ? (
        <p role="status" className="mb-4 rounded-xl bg-[#EAF8F2] px-3 py-2 text-sm font-semibold text-[#087B5A]">{params.notice}</p>
      ) : null}
    <AdminUsersView
      users={users}
      roles={roles}
      canManage={canManage}
      activity={activity}
      filters={{ q: params.q || "", status, role: params.role || "all" }}
      manageId={params.manage || null}
      inviteOpen={params.invite === "1"}
      flash={{
        error: params.error,
        created: params.created,
        updated: params.updated,
        setup: params.setup,
      }}
    />
      <section className="card-surface mt-6 space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Sign-in security</h2>
        <p className="max-w-3xl text-sm text-muted">
          A sign-in code is a 6-digit code from an authenticator app on the admin&apos;s phone, asked for after the password. Each admin sets
          theirs up under{" "}
          <a href="/admin/security" className="font-semibold text-violet hover:underline">My sign-in security</a>, or at sign-in when it is
          required. Current setting: <span className="font-semibold text-indigo">{ADMIN_MFA_MODE_LABEL[mfaMode]}</span>.
        </p>
        {canManage ? (
          <form action={actionSaveAdminMfaMode} className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-muted">
              Ask for a sign-in code
              <select name="mode" defaultValue={mfaMode} className="mt-1 block rounded-lg border border-border px-3 py-2 text-sm text-indigo">
                {(Object.keys(ADMIN_MFA_MODE_LABEL) as AdminMfaMode[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {ADMIN_MFA_MODE_LABEL[mode]}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-primary w-fit !py-2 text-sm">
              Save
            </button>
          </form>
        ) : null}
      </section>
    </>
  );
}
