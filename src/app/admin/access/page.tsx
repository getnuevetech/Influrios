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
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Access Levels · Admin" };

type Props = {
  searchParams: Promise<{ error?: string; created?: string; updated?: string; edit?: string }>;
};

function daysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

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
  }));

  const groups = ADMIN_PERMISSION_GROUPS.map((g) => ({
    module: g.module,
    label: g.label,
    description: g.description,
    permissions: g.permissions.map((p) => ({ id: p.id, label: p.label, hint: p.hint })),
  }));

  const since = daysAgo(30);
  const changeEvents = await prisma.auditLog
    .findMany({
      where: {
        action: { in: ["access.role_create", "access.role_update", "access.role_duplicate"] },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, action: true, actor: true, objectId: true, createdAt: true, after: true },
      take: 200,
    })
    .catch(() => []);

  const dayKeys: string[] = [];
  for (let i = 6; i >= 0; i--) dayKeys.push(daysAgo(i).toISOString().slice(0, 10));
  const byDay = new Map(dayKeys.map((k) => [k, 0]));
  for (const ev of changeEvents) {
    const key = ev.createdAt.toISOString().slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const changeSeries = dayKeys.map((k) => byDay.get(k) ?? 0);
  const recentHalf = changeEvents.filter((e) => e.createdAt >= daysAgo(15)).length;
  const olderHalf = changeEvents.length - recentHalf;
  const changeTrendPct =
    olderHalf <= 0 && recentHalf <= 0
      ? null
      : olderHalf <= 0
        ? 100
        : Math.round(((recentHalf - olderHalf) / olderHalf) * 1000) / 10;

  const activity = [...changeEvents]
    .reverse()
    .slice(0, 8)
    .map((ev) => {
      const name =
        ev.after && typeof ev.after === "object" && ev.after !== null && "name" in ev.after
          ? String((ev.after as { name?: unknown }).name ?? "")
          : "";
      return {
        id: ev.id,
        title: name
          ? `${name} — ${ev.action.replace("access.", "").replace(/_/g, " ")}`
          : `${ev.action.replace(/\./g, " · ")} · ${ev.actor}`,
        at: ev.createdAt.toISOString(),
      };
    });

  return (
    <AdminAccessLevelsView
      roles={roles}
      groups={groups}
      canManageRoles={canManageRoles}
      canManageUsers={canManageUsers}
      editRoleId={params.edit}
      activity={activity}
      changeSeries={changeSeries}
      changeTrendPct={changeTrendPct}
      flash={{ error: params.error, created: params.created, updated: params.updated }}
    />
  );
}
