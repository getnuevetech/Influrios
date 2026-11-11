import { redirect } from "next/navigation";
import { AdminAccessLevelsView } from "@/components/admin-access-levels-ui";
import {
  ADMIN_PERMISSION_GROUPS,
  canAccessModule,
  getAdminAuthStore,
  getAdminSession,
  hasPermission,
  permissionLabel,
} from "@/lib/admin-auth";
export const dynamic = "force-dynamic";
export const metadata = { title: "Access Levels · Admin" };

type Props = {
  searchParams: Promise<{ error?: string; created?: string; updated?: string; edit?: string }>;
};

export default async function AdminAccessPage({ searchParams }: Props) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?next=/admin/access");
  if (!canAccessModule(session, "access")) redirect("/admin?error=forbidden");

  const canManageRoles = hasPermission(session, "access.manage_roles");
  const canManageUsers = hasPermission(session, "access.manage_users");
  const params = await searchParams;
  const store = await getAdminAuthStore();

  const assigned = new Map<string, number>();
  for (const user of store.users) {
    assigned.set(user.roleId, (assigned.get(user.roleId) ?? 0) + 1);
  }

  const roles = store.roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    system: Boolean(role.system),
    permissions: role.permissions,
    permissionLabels: role.permissions.map((p) => permissionLabel(p)),
    assignedCount: assigned.get(role.id) ?? 0,
    assignees: store.users
      .filter((user) => user.roleId === role.id)
      .map((user) => ({ name: user.name, email: user.email })),
  }));

  const groups = ADMIN_PERMISSION_GROUPS.map((g) => ({
    module: g.module,
    label: g.label,
    description: g.description,
    permissions: g.permissions.map((p) => ({ id: p.id, label: p.label, hint: p.hint })),
  }));

  return (
    <AdminAccessLevelsView
      roles={roles}
      groups={groups}
      canManageRoles={canManageRoles}
      canManageUsers={canManageUsers}
      editRoleId={params.edit}
      adminCount={store.users.length}
      flash={{ error: params.error, created: params.created, updated: params.updated }}
    />
  );
}
