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
  searchParams: Promise<{ error?: string; created?: string; updated?: string }>;
};

function daysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

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

  const since = daysAgo(14);
  const loginEvents = await prisma.auditLog
    .findMany({
      where: { action: "admin.login", createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 500,
    })
    .catch(() => []);

  const dayKeys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = daysAgo(i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const byDay = new Map(dayKeys.map((k) => [k, 0]));
  for (const ev of loginEvents) {
    const key = ev.createdAt.toISOString().slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const loginSeries = dayKeys.map((k) => byDay.get(k) ?? 0);
  const loginTotal = loginSeries.reduce((s, n) => s + n, 0);
  const prevKeys: string[] = [];
  for (let i = 13; i >= 7; i--) prevKeys.push(daysAgo(i).toISOString().slice(0, 10));
  const prevTotal = loginEvents.filter((ev) =>
    prevKeys.includes(ev.createdAt.toISOString().slice(0, 10)),
  ).length;
  const loginTrendPct =
    prevTotal <= 0 && loginTotal <= 0
      ? null
      : prevTotal <= 0
        ? 100
        : Math.round(((loginTotal - prevTotal) / prevTotal) * 1000) / 10;

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
      select: { id: true, action: true, actor: true, after: true, createdAt: true },
    })
    .catch(() => []);

  const activity = activityRows.map((row) => ({
    id: row.id,
    title: `${row.action.replace(/\./g, " · ")} · ${row.actor}`,
    at: row.createdAt.toISOString(),
  }));

  return (
    <AdminUsersView
      users={users}
      roles={roles}
      canManage={canManage}
      loginSeries={loginSeries}
      loginTotal={loginTotal}
      loginTrendPct={loginTrendPct}
      activity={activity}
      flash={{ error: params.error, created: params.created, updated: params.updated }}
    />
  );
}
