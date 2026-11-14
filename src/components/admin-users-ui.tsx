"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAccountDialogBehavior } from "@/components/account-dialog";
import {
  actionCreateAdminUser,
  actionResendAdminSetup,
  actionSetAdminRole,
  actionToggleAdminActive,
} from "@/app/admin/actions-auth";
import { IconDots, IconLink, IconPlus, IconSearch, IconUsers } from "@/components/icons";

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
  mfaLabel: string;
  mfaDetail: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminUsersActivity = {
  id: string;
  title: string;
  at: string;
  actor: string;
  objectId: string;
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
  if (hr < 48) return hr <= 1 ? "1 hour ago" : `${hr} hours ago`;
  const day = Math.round(hr / 24);
  return day === 1 ? "1 day ago" : `${day} days ago`;
}

export function AdminUsersView({
  users,
  roles,
  canManage,
  activity,
  filters,
  manageId,
  inviteOpen,
  flash,
}: {
  users: AdminUsersPageUser[];
  roles: AdminUsersPageRole[];
  canManage: boolean;
  activity: AdminUsersActivity[];
  filters: { q: string; status: "all" | "active" | "suspended"; role: string };
  manageId: string | null;
  inviteOpen: boolean;
  flash: { error?: string; created?: string; updated?: string; setup?: string };
}) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.q);
  const [tab, setTab] = useState<"overview" | "access" | "activity">("access");
  const managed = users.find((user) => user.id === manageId) || null;

  const filtered = useMemo(() => {
    const query = filters.q.trim().toLowerCase();
    return users.filter((user) => {
      if (filters.status === "active" && !user.active) return false;
      if (filters.status === "suspended" && user.active) return false;
      if (filters.role !== "all" && user.roleId !== filters.role) return false;
      if (!query) return true;
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.roleName.toLowerCase().includes(query)
      );
    });
  }, [users, filters]);

  const activeCount = users.filter((user) => user.active).length;
  const suspendedCount = users.length - activeCount;
  const roleTypes = new Set(users.map((user) => user.roleId)).size;
  const userActivity = managed
    ? activity.filter((item) => item.objectId === managed.id || item.actor === managed.email)
    : [];

  function href(patch: Record<string, string | undefined>) {
    const next = {
      q: filters.q || undefined,
      status: filters.status === "all" ? undefined : filters.status,
      role: filters.role === "all" ? undefined : filters.role,
      manage: manageId || undefined,
      invite: inviteOpen ? "1" : undefined,
      ...patch,
    };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `/admin/admin-users?${qs}` : "/admin/admin-users";
  }

  function go(patch: Record<string, string | undefined>) {
    router.push(href(patch), { scroll: false });
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (search.trim() === filters.q) return;
      const params = new URLSearchParams();
      const q = search.trim();
      if (q) params.set("q", q);
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.role !== "all") params.set("role", filters.role);
      if (manageId) params.set("manage", manageId);
      if (inviteOpen) params.set("invite", "1");
      const qs = params.toString();
      router.push(qs ? `/admin/admin-users?${qs}` : "/admin/admin-users", { scroll: false });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [search, filters.q, filters.status, filters.role, manageId, inviteOpen, router]);

  useEffect(() => {
    setTab("overview");
  }, [manageId]);

  useEffect(() => {
    if (!managed && !inviteOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [managed, inviteOpen]);

  const listReturn = href({ manage: undefined, invite: undefined });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-indigo">Admin Users</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Manage your admin team and assigned access. Permissions are defined on{" "}
            <Link href="/admin/access" className="font-semibold text-violet hover:underline">
              Access Levels
            </Link>
            .
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/jobs" className="text-[13px] font-semibold text-violet hover:underline">
            View audit log
          </Link>
          {canManage ? (
            <button
              type="button"
              onClick={() => go({ invite: "1", manage: undefined })}
              className="inline-flex items-center gap-1.5 rounded-full bg-violet px-3.5 py-2 text-[13px] font-semibold text-white"
            >
              <IconPlus size={14} /> Invite admin
            </button>
          ) : null}
        </div>
      </div>

      {flash.error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {flash.error}
        </p>
      ) : null}
      {flash.created || flash.updated ? (
        <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          {flash.created === "link"
            ? "The account was created, and email could not be sent. Copy the setup link below."
            : flash.created === "user"
              ? "Invitation sent. They will use the link to set a password."
              : "Admin user updated."}
        </p>
      ) : null}
      {flash.setup ? (
        <p className="break-all rounded-xl border border-[#E4EBFF] bg-white px-3 py-2 text-[12px] text-indigo">
          Setup link: {flash.setup}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total admins" value={String(users.length)} />
        <Kpi label="Active admins" value={String(activeCount)} />
        <Kpi label="Suspended" value={String(suspendedCount)} />
        <Kpi label="Assigned role types" value={String(roleTypes)} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#E4EBFF] bg-white shadow-[0_8px_24px_rgba(17,26,90,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF2FF] px-4 py-3">
          <h2 className="font-display text-lg font-bold text-indigo">Admin accounts</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                <IconSearch size={14} />
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or email..."
                className="w-56 rounded-full border border-[#E4EBFF] bg-[#F7F9FF] py-2 pl-9 pr-3 text-[13px] outline-none focus:border-violet focus:bg-white"
              />
            </label>
            <select
              value={filters.status}
              onChange={(event) => go({ status: event.target.value === "all" ? undefined : event.target.value })}
              className="rounded-full border border-[#E4EBFF] bg-white px-3 py-2 text-[12px] font-semibold text-indigo"
            >
              <option value="all">Status: All</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            <select
              value={filters.role}
              onChange={(event) => go({ role: event.target.value === "all" ? undefined : event.target.value })}
              className="rounded-full border border-[#E4EBFF] bg-white px-3 py-2 text-[12px] font-semibold text-indigo"
            >
              <option value="all">Role: All</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead className="bg-[#F7F9FF] text-[11px] font-bold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Assigned role</th>
                <th className="px-4 py-3">MFA</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last updated</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
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
                    <td className="px-4 py-3 text-muted">{user.mfaLabel}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          user.active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"
                        }`}
                      >
                        {user.active ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{relativeTime(user.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => go({ manage: user.id, invite: undefined })}
                          className="rounded-full border border-[#E4EBFF] px-3 py-1.5 text-[12px] font-semibold text-violet"
                        >
                          Manage admin
                        </button>
                        <details className="relative">
                          <summary className="cursor-pointer list-none rounded-full border border-[#E4EBFF] px-2 py-1 text-muted">
                            <IconDots size={14} />
                          </summary>
                          <div className="absolute right-0 z-10 mt-1 w-44 rounded-xl border border-[#E4EBFF] bg-white p-1 shadow-lg">
                            <a href={`mailto:${user.email}`} className="block rounded-lg px-3 py-2 text-[12px] font-semibold text-indigo hover:bg-[#F7F8FF]">
                              Email
                            </a>
                            <Link href="/admin/access" className="block rounded-lg px-3 py-2 text-[12px] font-semibold text-indigo hover:bg-[#F7F8FF]">
                              Access Levels
                            </Link>
                          </div>
                        </details>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[#EEF2FF] px-4 py-3 text-[12px] text-muted">
          {filtered.length === 0 ? "0" : `1–${filtered.length}`} of {filtered.length}
        </p>
      </section>

      <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5 shadow-[0_8px_24px_rgba(17,26,90,0.04)]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-indigo">Recent access activity</h2>
          <Link href="/admin/jobs" className="text-[12px] font-semibold text-violet hover:underline">
            View audit log
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
      </section>

      {managed ? (
        <Popup title="Manage admin" onClose={() => go({ manage: undefined })}>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet to-blue text-sm font-bold text-white">
              {initials(managed.name)}
            </span>
            <div>
              <p className="font-display text-lg font-bold text-indigo">{managed.name}</p>
              <p className="text-[12px] text-muted">
                {managed.email} ·{" "}
                <span className={managed.active ? "text-emerald-700" : "text-rose-600"}>
                  {managed.active ? "Active" : "Suspended"}
                </span>
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-4 border-b border-[#EEF2FF]">
            {(
              [
                ["overview", "Overview"],
                ["access", "Access"],
                ["activity", "Activity"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`border-b-2 pb-2 text-[13px] font-semibold ${
                  tab === id ? "border-violet text-violet" : "border-transparent text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            {tab === "overview" ? (
              <dl className="space-y-2 text-[13px]">
                <Row label="Email" value={managed.email} />
                <Row label="Assigned role" value={managed.roleName} />
                <Row label="Status" value={managed.active ? "Active" : "Suspended"} />
                <Row label="MFA" value={managed.mfaLabel} />
                <Row label="Joined" value={managed.createdAt.slice(0, 10)} />
                <Row label="Last updated" value={relativeTime(managed.updatedAt)} />
              </dl>
            ) : null}
            {tab === "access" ? (
              <div className="space-y-4">
                <form id={`admin-role-${managed.id}`} action={actionSetAdminRole} className="space-y-4">
                  <input type="hidden" name="userId" value={managed.id} />
                  <input type="hidden" name="next" value={href({ manage: managed.id, invite: undefined })} />
                  <label className="block text-[13px] font-semibold text-indigo">
                    Assigned role
                    <select
                      name="roleId"
                      defaultValue={managed.roleId}
                      disabled={!canManage}
                      className="mt-1 w-full rounded-xl border border-[#E4EBFF] px-3 py-2 text-sm font-normal"
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-[12px] font-normal text-muted">
                      Permissions are inherited from this role.
                    </span>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <section className="rounded-2xl border border-[#E4EBFF] p-3">
                      <p className="text-[13px] font-bold text-indigo">Role summary</p>
                      <p className="mt-2 text-[13px] text-indigo">{managed.permissionCount} permissions</p>
                      <Link href="/admin/access" className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-violet">
                        <IconLink size={12} /> View in Access Levels
                      </Link>
                    </section>
                    <section className="rounded-2xl border border-[#E4EBFF] p-3">
                      <p className="text-[13px] font-bold text-indigo">Security</p>
                      <p className="mt-2 text-[13px] text-muted">MFA · {managed.mfaLabel}</p>
                      <p className="text-[12px] text-muted">{managed.mfaDetail}</p>
                      <p className="text-[12px] text-muted">Last updated {relativeTime(managed.updatedAt)}</p>
                      {canManage ? (
                        <form action={actionResendAdminSetup} className="mt-3">
                          <input type="hidden" name="userId" value={managed.id} />
                          <input type="hidden" name="next" value={href({ manage: managed.id, invite: undefined })} />
                          <button type="submit" className="text-[12px] font-semibold text-violet">
                            Send a new setup link
                          </button>
                        </form>
                      ) : null}
                    </section>
                  </div>
                  <label className="block text-[13px] font-semibold text-indigo">
                    Reason for change
                    <textarea
                      name="reason"
                      rows={3}
                      placeholder="Explain this access change"
                      className="mt-1 w-full rounded-xl border border-[#E4EBFF] px-3 py-2 text-sm font-normal"
                    />
                  </label>
                  <p className="text-[12px] text-muted">Role changes are recorded in the audit log.</p>
                </form>
                {canManage ? (
                  <form id={`admin-suspend-${managed.id}`} action={actionToggleAdminActive}>
                    <input type="hidden" name="userId" value={managed.id} />
                    <input type="hidden" name="active" value={managed.active ? "0" : "1"} />
                    <input type="hidden" name="next" value={listReturn} />
                  </form>
                ) : null}
              </div>
            ) : null}
            {tab === "activity" ? (
              <ul className="space-y-3">
                {userActivity.length === 0 ? (
                  <li className="rounded-2xl border border-dashed border-[#E4EBFF] px-4 py-8 text-center text-[13px] text-muted">
                    Activity history will appear here.
                  </li>
                ) : (
                  userActivity.map((item) => (
                    <li key={item.id} className="text-[13px]">
                      <p className="font-semibold text-indigo">{item.title}</p>
                      <p className="text-[11px] text-muted">{relativeTime(item.at)}</p>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#EEF2FF] pt-4">
            {tab === "access" && canManage ? (
              <button
                type="submit"
                form={`admin-suspend-${managed.id}`}
                className="text-[13px] font-semibold text-rose-600"
              >
                {managed.active ? "Suspend access" : "Restore access"}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => go({ manage: undefined })}
                className="rounded-full border border-[#E4EBFF] px-4 py-2 text-[13px] font-semibold text-indigo"
              >
                {tab === "access" ? "Cancel" : "Close"}
              </button>
              {tab === "access" && canManage ? (
                <button
                  type="submit"
                  form={`admin-role-${managed.id}`}
                  className="rounded-full bg-violet px-4 py-2 text-[13px] font-semibold text-white"
                >
                  Save changes
                </button>
              ) : null}
            </div>
          </div>
        </Popup>
      ) : null}

      {inviteOpen ? (
        <Popup title="Invite admin" onClose={() => go({ invite: undefined })}>
          <p className="text-[13px] text-muted">Invite a team member and assign their access.</p>
          {canManage ? (
            <form action={actionCreateAdminUser} className="mt-4 space-y-3">
              <input type="hidden" name="next" value={listReturn} />
              <label className="block text-[13px] font-semibold text-indigo">
                Full name
                <input
                  name="name"
                  required
                  placeholder="Enter full name"
                  className="mt-1 w-full rounded-xl border border-[#E4EBFF] px-3 py-2 text-sm font-normal"
                />
              </label>
              <label className="block text-[13px] font-semibold text-indigo">
                Work email
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="name@company.com"
                  className="mt-1 w-full rounded-xl border border-[#E4EBFF] px-3 py-2 text-sm font-normal"
                />
              </label>
              <label className="block text-[13px] font-semibold text-indigo">
                Assigned role
                <select
                  name="roleId"
                  required
                  defaultValue=""
                  className="mt-1 w-full rounded-xl border border-[#E4EBFF] px-3 py-2 text-sm font-normal"
                >
                  <option value="" disabled>
                    Select an access level
                  </option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[12px] text-muted">
                Review permissions in{" "}
                <Link href="/admin/access" className="font-semibold text-violet">
                  Access Levels
                </Link>
                .
              </p>
              <p className="rounded-xl bg-[#F7F9FF] px-3 py-2 text-[12px] text-indigo">
                The recipient will receive a link to set up their account.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => go({ invite: undefined })}
                  className="rounded-full border border-[#E4EBFF] px-4 py-2 text-[13px] font-semibold text-indigo"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-full bg-violet px-4 py-2 text-[13px] font-semibold text-white">
                  Send invitation
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-4 text-sm text-muted">You can view admin users but not invite new ones.</p>
          )}
        </Popup>
      ) : null}
    </div>
  );
}

function Popup({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useAccountDialogBehavior(panelRef, onClose);
  return (
    <div data-account-dialog-root className="fixed inset-0 z-50">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-[#0E1440]/45" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-0 flex flex-col overflow-y-auto bg-white p-5 outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(90vh,760px)] sm:w-[min(560px,calc(100%-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:shadow-[0_24px_80px_rgba(17,26,90,0.18)]"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-indigo">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="px-2 text-lg text-muted">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold text-indigo">{value}</dd>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E4EBFF] bg-white p-4 shadow-[0_8px_24px_rgba(17,26,90,0.04)]">
      <p className="text-[12px] font-semibold text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-indigo">{value}</p>
    </div>
  );
}
