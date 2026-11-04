"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  actionCreateRole,
  actionDuplicateRole,
  actionUpdateRole,
} from "@/app/admin/actions-auth";
import { IconLink, IconPlus, IconSearch, IconUsers } from "@/components/icons";

export type AccessRoleCard = {
  id: string;
  name: string;
  description: string;
  system: boolean;
  permissions: string[];
  permissionLabels: string[];
  assignedCount: number;
};

export type AccessModuleGroup = {
  module: string;
  label: string;
  description: string;
  permissions: { id: string; label: string; hint: string }[];
};

export type AccessActivity = {
  id: string;
  title: string;
  at: string;
};

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

function RoleTrend({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const points = values
    .map((v, i) => {
      const x = values.length === 1 ? 0 : (i / (values.length - 1)) * 100;
      const y = 36 - (v / max) * 28;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 40" className="h-14 w-full" aria-hidden>
      <polyline fill="none" stroke="#633CFF" strokeWidth="2.5" strokeLinecap="round" points={points} />
    </svg>
  );
}

export function AdminAccessLevelsView({
  roles,
  groups,
  canManageRoles,
  canManageUsers,
  editRoleId,
  activity,
  changeSeries,
  changeTrendPct,
  flash,
}: {
  roles: AccessRoleCard[];
  groups: AccessModuleGroup[];
  canManageRoles: boolean;
  canManageUsers: boolean;
  editRoleId?: string;
  activity: AccessActivity[];
  changeSeries: number[];
  changeTrendPct: number | null;
  flash: { error?: string; created?: string; updated?: string };
}) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | "system" | "custom">("all");
  const [selectedId, setSelectedId] = useState<string | null>(editRoleId || null);
  const selected = roles.find((r) => r.id === selectedId) || null;
  const [descLen, setDescLen] = useState(selected?.description.length ?? 0);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return roles.filter((r) => {
      if (type === "system" && !r.system) return false;
      if (type === "custom" && r.system) return false;
      if (!query) return true;
      return (
        r.name.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query) ||
        r.permissionLabels.some((p) => p.toLowerCase().includes(query))
      );
    });
  }, [roles, q, type]);

  const systemCount = roles.filter((r) => r.system).length;
  const customCount = roles.length - systemCount;
  const assignedTotal = roles.reduce((s, r) => s + r.assignedCount, 0);
  const maxAssigned = Math.max(1, ...roles.map((r) => r.assignedCount));

  const selectedPerms = new Set(selected?.permissions ?? []);
  const formKey = selected?.id || "new";

  function setBulk(mode: "all" | "view" | "manage" | "clear") {
    const form = document.getElementById("access-role-form") as HTMLFormElement | null;
    if (!form) return;
    const boxes = form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name^="perm_"]');
    boxes.forEach((box) => {
      const id = box.name.replace(/^perm_/, "");
      if (mode === "all") box.checked = true;
      else if (mode === "clear") box.checked = false;
      else if (mode === "view") box.checked = id.includes(".view");
      else if (mode === "manage")
        box.checked = id.includes(".manage") || id.includes(".edit") || id.includes(".mediate");
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold text-indigo">Access Levels</h1>
            <Link
              href="/admin/admin-users"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E4EBFF] bg-white px-3 py-1.5 text-[12px] font-semibold text-violet shadow-sm hover:border-violet/40"
            >
              <IconLink size={12} /> Go to Admin Users
            </Link>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Build and edit roles here. Assign those roles to operators on{" "}
            <Link href="/admin/admin-users" className="font-semibold text-violet hover:underline">
              Admin Users
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
          Access level saved.
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Total Roles" value={String(roles.length)} detail="All access levels" />
        <Kpi label="System Roles" value={String(systemCount)} detail="Built-in roles" />
        <Kpi label="Custom Roles" value={String(customCount)} detail="User-defined roles" />
        <Kpi label="Admins Assigned" value={String(assignedTotal)} detail="Across all roles" />
        <div className="rounded-2xl border border-[#E4EBFF] bg-white p-4 shadow-[0_8px_24px_rgba(17,26,90,0.04)]">
          <p className="text-[12px] font-semibold text-muted">Role changes (30d)</p>
          <p className={`mt-1 text-[11px] font-semibold ${changeTrendPct != null && changeTrendPct >= 0 ? "text-emerald-600" : "text-muted"}`}>
            {changeTrendPct == null ? "—" : `${changeTrendPct >= 0 ? "+" : ""}${changeTrendPct}%`}
          </p>
          <RoleTrend values={changeSeries} />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-[#E4EBFF] bg-white p-4 shadow-[0_8px_24px_rgba(17,26,90,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-indigo">Role Library</h2>
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                    <IconSearch size={14} />
                  </span>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search roles..."
                    className="rounded-full border border-[#E4EBFF] bg-[#F7F9FF] py-2 pl-9 pr-3 text-[13px] outline-none focus:border-violet"
                  />
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as typeof type)}
                  className="rounded-full border border-[#E4EBFF] bg-white px-3 py-2 text-[12px] font-semibold"
                >
                  <option value="all">All types</option>
                  <option value="system">System</option>
                  <option value="custom">Custom</option>
                </select>
                {canManageRoles ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(null);
                      setDescLen(0);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue px-3.5 py-2 text-[12px] font-semibold text-white"
                  >
                    <IconPlus size={14} /> Create Role
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {filtered.map((role) => (
                <article
                  key={role.id}
                  className={`rounded-2xl border p-4 transition ${
                    selectedId === role.id
                      ? "border-violet bg-[#F8F5FF]"
                      : "border-[#E4EBFF] bg-white hover:border-violet/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display font-bold text-indigo">{role.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            role.system
                              ? "bg-[#EEE8FF] text-violet"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {role.system ? "System" : "Custom"}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted">
                          <IconUsers size={12} /> {role.assignedCount} admins
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[12px] text-muted">{role.description || "No description"}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {role.permissionLabels.slice(0, 4).map((label) => (
                      <span
                        key={label}
                        className="rounded-full bg-[#F3F6FF] px-2 py-0.5 text-[10px] font-semibold text-indigo"
                      >
                        {label}
                      </span>
                    ))}
                    {role.permissionLabels.length > 4 ? (
                      <span className="rounded-full bg-[#F3F6FF] px-2 py-0.5 text-[10px] font-semibold text-muted">
                        +{role.permissionLabels.length - 4}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-[12px] font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(role.id);
                        setDescLen(role.description.length);
                      }}
                      className="text-violet hover:underline"
                    >
                      View details
                    </button>
                    {canManageRoles && !role.system ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(role.id);
                          setDescLen(role.description.length);
                        }}
                        className="text-indigo hover:underline"
                      >
                        Edit
                      </button>
                    ) : null}
                    {canManageRoles ? (
                      <form action={actionDuplicateRole}>
                        <input type="hidden" name="roleId" value={role.id} />
                        <input type="hidden" name="next" value="/admin/access" />
                        <button type="submit" className="text-indigo hover:underline">
                          Duplicate
                        </button>
                      </form>
                    ) : null}
                    {canManageUsers ? (
                      <Link href="/admin/admin-users" className="text-indigo hover:underline">
                        Assign users
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl border border-[#E4EBFF] bg-white p-4 shadow-sm">
              <h3 className="font-display text-base font-bold text-indigo">Recently updated roles</h3>
              <ul className="mt-3 space-y-2">
                {activity.length === 0 ? (
                  <li className="text-[12px] text-muted">No role changes recorded yet.</li>
                ) : (
                  activity.slice(0, 6).map((item) => (
                    <li key={item.id} className="text-[12px]">
                      <p className="font-semibold text-indigo">{item.title}</p>
                      <p className="text-muted">{relativeTime(item.at)}</p>
                    </li>
                  ))
                )}
              </ul>
            </section>
            <section className="rounded-2xl border border-[#E4EBFF] bg-white p-4 shadow-sm">
              <h3 className="font-display text-base font-bold text-indigo">Assignment snapshot</h3>
              <ul className="mt-3 space-y-2">
                {roles.map((role) => (
                  <li key={role.id}>
                    <div className="mb-1 flex items-center justify-between text-[11px] font-semibold">
                      <span className="text-indigo">{role.name}</span>
                      <span className="text-muted">{role.assignedCount}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#F3F6FF]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#4B2AD9] to-[#9B7CFF]"
                        style={{ width: `${(role.assignedCount / maxAssigned) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        <aside className="rounded-2xl border border-[#E4EBFF] bg-white p-5 shadow-[0_8px_24px_rgba(17,26,90,0.04)]">
          <h2 className="font-display text-lg font-bold text-indigo">
            {selected ? (selected.system ? "View access level" : "Edit access level") : "Create access level"}
          </h2>
          <p className="mt-1 text-[12px] text-muted">
            {selected?.system
              ? "System roles are built-in. Duplicate to customize permissions."
              : "Tick every feature this role should see or use."}
          </p>

          <form
            id="access-role-form"
            key={formKey}
            action={selected && !selected.system ? actionUpdateRole : actionCreateRole}
            className="mt-4 space-y-3"
          >
            <input type="hidden" name="next" value="/admin/access" />
            {selected && !selected.system ? (
              <input type="hidden" name="roleId" value={selected.id} />
            ) : null}

            <label className="block text-[11px] font-bold uppercase tracking-wide text-muted">
              Role name
              <input
                name="name"
                required
                defaultValue={selected && !selected.system ? selected.name : ""}
                disabled={Boolean(selected?.system) || !canManageRoles}
                placeholder="e.g. Matching Ops"
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo disabled:bg-[#F7F9FF]"
              />
            </label>

            <label className="block text-[11px] font-bold uppercase tracking-wide text-muted">
              Role type
              <input
                value={selected?.system ? "System role" : "Custom role"}
                disabled
                className="mt-1 w-full rounded-xl border border-border bg-[#F7F9FF] px-3 py-2 text-sm text-indigo"
              />
            </label>

            <label className="block text-[11px] font-bold uppercase tracking-wide text-muted">
              Purpose / Description <span className="font-medium normal-case">({descLen}/250)</span>
              <textarea
                name="description"
                maxLength={250}
                rows={3}
                defaultValue={selected && !selected.system ? selected.description : ""}
                disabled={Boolean(selected?.system) || !canManageRoles}
                onChange={(e) => setDescLen(e.target.value.length)}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo disabled:bg-[#F7F9FF]"
              />
            </label>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  Permissions by module
                </p>
                {canManageRoles && !selected?.system ? (
                  <div className="flex flex-wrap gap-1">
                    {(
                      [
                        ["all", "Select all"],
                        ["view", "View only"],
                        ["manage", "Manage"],
                        ["clear", "Clear"],
                      ] as const
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setBulk(mode)}
                        className="rounded-full border border-[#E4EBFF] px-2 py-0.5 text-[10px] font-semibold text-indigo"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="mt-2 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {groups.map((group) => (
                  <fieldset key={group.module} className="rounded-xl border border-[#E4EBFF] bg-[#F7F9FF] p-3">
                    <legend className="px-1 text-[12px] font-bold text-indigo">{group.label}</legend>
                    <p className="mb-2 text-[10px] text-muted">{group.description}</p>
                    <div className="space-y-1.5">
                      {group.permissions.map((perm) => (
                        <label
                          key={perm.id}
                          className="flex items-start gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[12px] text-indigo ring-1 ring-[#E4EBFF]"
                        >
                          <input
                            type="checkbox"
                            name={`perm_${perm.id}`}
                            defaultChecked={selectedPerms.has(perm.id)}
                            disabled={Boolean(selected?.system) || !canManageRoles}
                            className="mt-0.5 accent-[#633CFF]"
                          />
                          <span>
                            <span className="font-semibold">{perm.label}</span>
                            <span className="mt-0.5 block text-[10px] text-muted">{perm.hint}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            </div>

            {canManageRoles && !selected?.system ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const checked = Array.from(
                      document.querySelectorAll<HTMLInputElement>(
                        '#access-role-form input[type="checkbox"][name^="perm_"]:checked',
                      ),
                    ).map((el) => el.name.replace(/^perm_/, ""));
                    window.alert(
                      checked.length
                        ? `Preview: ${checked.length} permission(s)\n${checked.slice(0, 12).join(", ")}${checked.length > 12 ? "…" : ""}`
                        : "No permissions selected.",
                    );
                  }}
                  className="rounded-full border border-[#E4EBFF] px-4 py-2 text-[12px] font-semibold text-indigo"
                >
                  Preview Access
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-gradient-to-r from-[#4B2AD9] to-[#633CFF] px-4 py-2 text-[12px] font-semibold text-white shadow-sm"
                >
                  Save Role
                </button>
              </div>
            ) : null}
            {selected?.system && canManageRoles ? (
              <form action={actionDuplicateRole} className="pt-1">
                <input type="hidden" name="roleId" value={selected.id} />
                <input type="hidden" name="next" value="/admin/access" />
                <button type="submit" className="rounded-full bg-violet px-4 py-2 text-[12px] font-semibold text-white">
                  Duplicate as custom role
                </button>
              </form>
            ) : null}
          </form>
        </aside>
      </div>
    </div>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-[#E4EBFF] bg-white p-4 shadow-[0_8px_24px_rgba(17,26,90,0.04)]">
      <p className="text-[12px] font-semibold text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-indigo">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{detail}</p>
    </div>
  );
}
