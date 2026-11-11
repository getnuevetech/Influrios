import { redirect } from "next/navigation";
import { AdminUsersView } from "@/components/admin-users-ui";
import {
  canAccessModule,
  getAdminAuthStore,
  getAdminSession,
  hasPermission,
} from "@/lib/admin-auth";
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

  const users = store.users.map((u) => {
    const role = roleById.get(u.roleId);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      roleId: u.roleId,
      roleName: role?.name || "Unknown",
      permissionCount: role?.permissions.length ?? 0,
      active: u.active,
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
  );
}
