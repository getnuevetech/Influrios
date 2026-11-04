"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  actionCreateAdminUser,
  actionSetAdminRole,
  actionToggleAdminActive,
} from "@/app/admin/actions-auth";
import { IconDots, IconLink, IconMail, IconPlus, IconSearch, IconUsers } from "@/components/icons";

export type AdminUsersPageRole = {
  id: string;
  name: string;
  permissionCount: number;
  system?: boolean;
};

export type AdminUsersPageUser = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  permissionCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminUsersActivity = {
  id: string;
  title: string;
  at: string;
};

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || "")
      .join("") || "?"
  );
}

function relativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

function LoginSpark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const points = values
    .map((v, i) => {
      const x = values.length === 1 ? 0 : (i / (values.length - 1)) * 100;
      const y = 36 - (v / max) * 28;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 40" className="h-16 w-full" aria-hidden>
      <polyline
        fill="none"
        stroke="#633CFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function AdminUsersView({
  users,
  roles,
  canManage,
  loginSeries,
  loginTotal,
  loginTrendPct,
  activity,
  flash,
}: {
  users: AdminUsersPageUser[];
  roles: AdminUsersPageRole[];
  canManage: boolean;
  loginSeries: number[];
  loginTotal: number;
  loginTrendPct: number | null;
  activity: AdminUsersActivity[];
  flash: { error?: string; created?: string; updated?: string };
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "suspended">("all");
  const [roleId, setRoleId] = useState("all");
  const [notesLen, setNotesLen] = useState(0);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return users.filter((u) => {
      if (status === "active" && !u.active) return false;
      if (status === "suspended" && u.active) return false;
      if (roleId !== "all" && u.roleId !== roleId) return false;
      if (!query) return true;
      return (
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.roleName.toLowerCase().includes(query)
      );
    });
  }, [users, q, status, roleId]);

  const activeCount = users.filter((u) => u.active).length;
  const suspendedCount = users.length - activeCount;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold text-indigo">Admin Users</h1>
            <Link
              href="/admin/access"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E4EBFF] bg-white px-3 py-1.5 text-[12px] font-semibold text-violet shadow-sm hover:border-violet/40"
            >
              <IconLink size={12} /> Go to Access Levels
            </Link>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Invite, assign, and manage admin operators who run Influrios. Roles and permissions are
            managed separately in{" "}
            <Link href="/admin/access" className="font-semibold text-violet hover:underline">
              Access Levels
            </Link>
            .
          </p>
        </div>
      </div>

      {flash.error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {flash.error}
        </p>
      ) : null}
      {flash.created || flash.updated ? (
        <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          {flash.created === "user"
            ? "Admin invite created. Share the temporary password out-of-band if email is not configured."
            : "Admin user updated."}
        </p>
      ) : null}

      <section className="grid gap-3 lg:grid-cols-5">
        <Kpi label="Total Admin Users" value={String(users.length)} detail="All admin accounts" />
        <Kpi label="Active Admins" value={String(activeCount)} detail="With platform access" />
        <Kpi
          label="Suspended"
          value={String(suspendedCount)}
          detail="No platform access"
          alert={suspendedCount > 0}
        />
        <Kpi label="Roles Assigned" value={String(roles.length)} detail="Unique admin roles" />
        <div className="rounded-2xl border border-[#E4EBFF] bg-white p-4 shadow-[0_8px_24px_rgba(17,26,90,0.04)] lg:col-span-1">
          <p className="text-[12px] font-semibold text-muted">Admin Logins (Last 7 Days)</p>
          <div className="mt-1 flex items-end gap-2">
            <p className="font-display text-2xl font-bold text-indigo">{loginTotal}</p>
            <p className={`pb-1 text-[11px] font-semibold ${loginTrendPct != null && loginTrendPct >= 0 ? "text-emerald-600" : "text-muted"}`}>
              {loginTrendPct == null ? "—" : `${loginTrendPct >= 0 ? "+" : ""}${loginTrendPct}%`}
            </p>
          </div>
          <LoginSpark values={loginSeries} />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#E4EBFF] bg-white shadow-[0_8px_24px_rgba(17,26,90,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF2FF] px-4 py-3">
          <h2 className="font-display text-lg font-bold text-indigo">
            Admin Accounts <span className="text-sm font-semibold text-muted">({filtered.length})</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                <IconSearch size={14} />
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search admin users, email..."
                className="rounded-full border border-[#E4EBFF] bg-[#F7F9FF] py-2 pl-9 pr-3 text-[13px] outline-none focus:border-violet focus:bg-white"
              />
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="rounded-full border border-[#E4EBFF] bg-white px-3 py-2 text-[12px] font-semibold text-indigo"
            >
              <option value="all">Status: All</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="rounded-full border border-[#E4EBFF] bg-white px-3 py-2 text-[12px] font-semibold text-indigo"
            >
              <option value="all">All Roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {canManage ? (
              <a
                href="#invite-admin"
                className="inline-flex items-center gap-1.5 rounded-full bg-blue px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-[#1f6aef]"
              >
                <IconPlus size={14} /> Invite Admin
              </a>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead className="bg-[#F7F9FF] text-[11px] font-bold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Assigned Role</th>
                <th className="px-4 py-3">Permissions</th>
                <th className="px-4 py-3">MFA</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">
                    No admin users match these filters.
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id} className="border-t border-[#EEF2FF]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet to-blue text-[11px] font-bold text-white">
                          {initials(user.name)}
                        </span>
                        <p className="font-semibold text-indigo">{user.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-[#EEE8FF] px-2 py-0.5 text-[11px] font-semibold text-violet">
                        {user.roleName}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-indigo">{user.permissionCount}</td>
                    <td className="px-4 py-3 text-muted">—</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          user.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-600"
                        }`}
                      >
                        {user.active ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{relativeTime(user.updatedAt)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {canManage ? (
                        <details className="relative">
                          <summary className="cursor-pointer list-none text-muted">
                            <IconDots size={16} />
                          </summary>
                          <div className="absolute right-0 z-10 mt-1 w-48 rounded-xl border border-[#E4EBFF] bg-white p-2 shadow-lg">
                            <form action={actionSetAdminRole} className="space-y-2">
                              <input type="hidden" name="userId" value={user.id} />
                              <input type="hidden" name="next" value="/admin/admin-users" />
                              <select
                                name="roleId"
                                defaultValue={user.roleId}
                                className="w-full rounded-lg border border-border px-2 py-1.5 text-xs"
                              >
                                {roles.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                              </select>
                              <button type="submit" className="w-full text-left text-xs font-semibold text-violet">
                                Save role
                              </button>
                            </form>
                            <form action={actionToggleAdminActive} className="mt-2 border-t border-[#EEF2FF] pt-2">
                              <input type="hidden" name="userId" value={user.id} />
                              <input type="hidden" name="next" value="/admin/admin-users" />
                              <input type="hidden" name="active" value={user.active ? "0" : "1"} />
                              <button type="submit" className="w-full text-left text-xs font-semibold text-indigo">
                                {user.active ? "Suspend" : "Re-enable"}
                              </button>
                            </form>
                          </div>
                        </details>
                      ) : (
                        <span className="text-muted">
                          <IconDots size={16} />
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div
          id="invite-admin"
          className="rounded-2xl border border-[#E4EBFF] bg-white p-5 shadow-[0_8px_24px_rgba(17,26,90,0.04)]"
        >
          <h2 className="font-display text-lg font-bold text-indigo">Invite New Admin</h2>
          <p className="mt-1 text-[12px] text-muted">
            Send an invitation to add a new admin operator. A temporary password is issued so they can
            sign in and change it.
          </p>
          {canManage ? (
            <form action={actionCreateAdminUser} className="mt-4 space-y-3">
              <input type="hidden" name="next" value="/admin/admin-users" />
              <label className="block text-[11px] font-bold uppercase tracking-wide text-muted">
                Full name
                <input
                  name="name"
                  required
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo"
                />
              </label>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-muted">
                Email address
                <input
                  name="email"
                  type="email"
                  required
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo"
                />
              </label>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-muted">
                Role
                <select
                  name="roleId"
                  required
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-muted">
                Temporary password{" "}
                <span className="font-medium normal-case text-muted">(optional — auto-generated if blank)</span>
                <input
                  name="password"
                  type="text"
                  placeholder="Leave blank to auto-generate"
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo"
                />
              </label>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-muted">
                Notes <span className="font-medium normal-case">({notesLen}/250)</span>
                <textarea
                  name="notes"
                  maxLength={250}
                  rows={3}
                  onChange={(e) => setNotesLen(e.target.value.length)}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo"
                />
              </label>
              <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-violet px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-[#5530e0]">
                <IconMail size={14} /> Send Invite
              </button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-muted">You can view admin users but not invite new ones.</p>
          )}
        </div>

        <div className="rounded-2xl border border-[#E4EBFF] bg-white p-5 shadow-[0_8px_24px_rgba(17,26,90,0.04)]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-indigo">Recent Access Activity</h2>
            <Link href="/admin/jobs" className="text-[12px] font-semibold text-violet hover:underline">
              View full audit log
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {activity.length === 0 ? (
              <li className="text-sm text-muted">No recent access activity yet.</li>
            ) : (
              activity.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEE8FF] text-violet">
                    <IconUsers size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-indigo">{item.title}</p>
                    <p className="text-[11px] text-muted">{relativeTime(item.at)}</p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  detail,
  alert,
}: {
  label: string;
  value: string;
  detail: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#E4EBFF] bg-white p-4 shadow-[0_8px_24px_rgba(17,26,90,0.04)]">
      <p className="text-[12px] font-semibold text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-indigo">{value}</p>
      <p className={`mt-1 text-[11px] font-semibold ${alert ? "text-rose-500" : "text-muted"}`}>{detail}</p>
    </div>
  );
}
