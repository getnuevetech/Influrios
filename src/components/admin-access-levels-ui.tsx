"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { actionCreateRole, actionDuplicateRole, actionUpdateRole } from "@/app/admin/actions-auth";
import { useAccountDialogBehavior } from "@/components/account-dialog";
import { IconDots, IconPlus, IconSearch } from "@/components/icons";
import { nextTabIndex } from "@/lib/dialog-behavior";

export type AccessRoleCard = {
  id: string;
  name: string;
  description: string;
  system: boolean;
  permissions: string[];
  permissionLabels: string[];
  assignedCount: number;
  assignees: { name: string; email: string }[];
};

export type AccessModuleGroup = {
  module: string;
  label: string;
  description: string;
  permissions: { id: string; label: string; hint: string }[];
};

const BUCKETS: { id: string; label: string; modules: string[] }[] = [
  { id: "content", label: "Content", modules: ["banners", "cards", "taxonomy", "legal", "intelligence"] },
  { id: "accounts", label: "User accounts", modules: ["accounts", "invitations"] },
  { id: "collaborations", label: "Collaborations", modules: ["collaborations", "matching", "contracts", "signing", "social", "agency"] },
  { id: "finance", label: "Finance", modules: ["billing", "payments", "gateways", "commerce", "marketplace", "collab_finance", "trust"] },
  { id: "settings", label: "Settings", modules: ["plans", "ai", "mail", "jobs", "shortlinks"] },
  { id: "access", label: "Access control", modules: ["access"] },
];

type DialogState = {
  mode: "view" | "edit" | "create";
  roleId: string | null;
  baseRoleId: string | null;
};

function bucketFor(module: string) {
  return BUCKETS.find((bucket) => bucket.modules.includes(module))?.id ?? "settings";
}

export function AdminAccessLevelsView({
  roles,
  groups,
  canManageRoles,
  canManageUsers,
  editRoleId,
  adminCount,
  flash,
  actorPermissions,
}: {
  roles: AccessRoleCard[];
  groups: AccessModuleGroup[];
  canManageRoles: boolean;
  canManageUsers: boolean;
  editRoleId?: string;
  adminCount: number;
  flash: { error?: string; created?: string; updated?: string };
  actorPermissions: string[];
}) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | "system" | "custom">("all");
  const linked = roles.find((role) => role.id === editRoleId) ?? null;
  const [dialog, setDialog] = useState<DialogState | null>(
    linked
      ? { mode: "view", roleId: linked.id, baseRoleId: null }
      : null,
  );
  const [step, setStep] = useState<"basics" | "permissions" | "review">("basics");
  const [bucketId, setBucketId] = useState(BUCKETS[0]!.id);
  const [permQuery, setPermQuery] = useState("");
  const [name, setName] = useState(linked?.name ?? "");
  const [description, setDescription] = useState(linked?.description ?? "");
  const [checked, setChecked] = useState<string[]>(linked ? [...linked.permissions] : []);
  const [confirmClose, setConfirmClose] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return roles.filter((role) => {
      if (type === "system" && !role.system) return false;
      if (type === "custom" && role.system) return false;
      if (!query) return true;
      return (
        role.name.toLowerCase().includes(query) ||
        role.description.toLowerCase().includes(query)
      );
    });
  }, [roles, q, type]);

  const systemCount = roles.filter((role) => role.system).length;
  const customCount = roles.length - systemCount;
  const labelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      for (const perm of group.permissions) map.set(perm.id, perm.label);
    }
    return map;
  }, [groups]);

  const activeRole = roles.find((role) => role.id === dialog?.roleId) ?? null;
  const baseRole = roles.find((role) => role.id === dialog?.baseRoleId) ?? null;
  const readOnly = !dialog || dialog.mode === "view" || !canManageRoles;
  const baseline = new Set(
    (dialog?.mode === "edit" ? activeRole?.permissions : baseRole?.permissions) ?? [],
  );
  const selected = new Set(checked);
  const added = [...selected].filter((id) => !baseline.has(id));
  const removed = [...baseline].filter((id) => !selected.has(id));

  function openDialog(next: DialogState, source?: AccessRoleCard | null) {
    setDialog(next);
    setStep("basics");
    setBucketId(BUCKETS[0]!.id);
    setPermQuery("");
    setName(next.mode === "create" ? (source ? `${source.name} copy` : "") : source?.name ?? "");
    setDescription(next.mode === "view" || next.mode === "edit" ? source?.description ?? "" : source?.description ?? "");
    setChecked(source ? [...source.permissions] : []);
    setConfirmClose(false);
  }

  function requestClose() {
    const dirty =
      Boolean(dialog) &&
      !readOnly &&
      (name.trim() !== (dialog?.mode === "edit" ? activeRole?.name ?? "" : "") ||
        description.trim() !== (activeRole?.description ?? "") ||
        added.length > 0 ||
        removed.length > 0);
    if (dirty && !confirmClose) {
      setConfirmClose(true);
      return;
    }
    setConfirmClose(false);
    setDialog(null);
  }

  useAccountDialogBehavior(panelRef, requestClose, Boolean(dialog));

  function toggle(id: string) {
    setChecked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  const visibleGroups = groups.filter((group) => bucketFor(group.module) === bucketId);
  const query = permQuery.trim().toLowerCase();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-indigo">Access Levels</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Define roles and permissions. Assign roles in{" "}
            <Link href="/admin/admin-users" className="font-semibold text-violet hover:underline">
              Admin Users
            </Link>
            .
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManageUsers ? (
            <Link
              href="/admin/admin-users"
              className="rounded-full border border-[#E4EBFF] bg-white px-3.5 py-2 text-[13px] font-semibold text-indigo"
            >
              Admin Users
            </Link>
          ) : null}
          {canManageRoles ? (
            <button
              type="button"
              onClick={() => openDialog({ mode: "create", roleId: null, baseRoleId: null })}
              className="inline-flex items-center gap-1.5 rounded-full bg-violet px-3.5 py-2 text-[13px] font-semibold text-white"
            >
              <IconPlus size={14} /> Create role
            </button>
          ) : null}
        </div>
      </div>

      {flash.error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{flash.error}</p>
      ) : null}
      {flash.created || flash.updated ? (
        <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          Access level saved.
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total roles" value={String(roles.length)} />
        <Kpi label="System roles" value={String(systemCount)} />
        <Kpi label="Custom roles" value={String(customCount)} />
        <Kpi label="Assigned admins" value={String(adminCount)} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#E4EBFF] bg-white shadow-[0_8px_24px_rgba(17,26,90,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF2FF] px-4 py-3">
          <h2 className="font-display text-lg font-bold text-indigo">Role library</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                <IconSearch size={14} />
              </span>
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search roles..."
                className="w-52 rounded-full border border-[#E4EBFF] bg-[#F7F9FF] py-2 pl-9 pr-3 text-[13px] outline-none focus:border-violet"
              />
            </label>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as typeof type)}
              className="rounded-full border border-[#E4EBFF] bg-white px-3 py-2 text-[12px] font-semibold text-indigo"
            >
              <option value="all">Type: All types</option>
              <option value="system">System</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead className="bg-[#F7F9FF] text-[11px] font-bold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Assigned admins</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">
                    No roles match these filters.
                  </td>
                </tr>
              ) : (
                filtered.map((role) => (
                  <tr key={role.id} className="border-t border-[#EEF2FF]">
                    <td className="px-4 py-3 font-semibold text-indigo">{role.name}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[#EEE8FF] px-2 py-0.5 text-[11px] font-semibold text-violet">
                        {role.system ? "System" : "Custom"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-indigo">{role.assignedCount}</td>
                    <td className="max-w-md px-4 py-3 text-muted">{role.description || "No description"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openDialog({ mode: "view", roleId: role.id, baseRoleId: null }, role)}
                          className="rounded-full border border-[#E4EBFF] px-3 py-1.5 text-[12px] font-semibold text-violet"
                        >
                          View role
                        </button>
                        <details className="relative">
                          <summary className="cursor-pointer list-none rounded-full border border-[#E4EBFF] px-2 py-1 text-muted">
                            <IconDots size={14} />
                          </summary>
                          <div className="absolute right-0 z-10 mt-1 w-48 rounded-xl border border-[#E4EBFF] bg-white p-1 shadow-lg">
                            {canManageRoles ? (
                              <form action={actionDuplicateRole}>
                                <input type="hidden" name="next" value="/admin/access" />
                                <input type="hidden" name="roleId" value={role.id} />
                                <DuplicateRoleButton />
                              </form>
                            ) : null}
                            {canManageRoles && !role.system ? (
                              <button
                                type="button"
                                onClick={() => openDialog({ mode: "edit", roleId: role.id, baseRoleId: null }, role)}
                                className="block w-full rounded-lg px-3 py-2 text-left text-[12px] font-semibold text-indigo hover:bg-[#F7F8FF]"
                              >
                                Edit role
                              </button>
                            ) : null}
                            <Link href="/admin/admin-users" className="block rounded-lg px-3 py-2 text-[12px] font-semibold text-indigo hover:bg-[#F7F8FF]">
                              Assign in Admin Users
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
          {filtered.length} roles · System roles are read-only. Create a custom role by duplicating an existing role.
        </p>
      </section>

      {dialog ? (
        <div data-account-dialog-root className="fixed inset-0 z-50">
          <button type="button" aria-label="Close role" className="absolute inset-0 bg-[#0E1440]/45" onClick={requestClose} />
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-dialog-title"
            className="absolute inset-0 flex flex-col overflow-y-auto bg-white p-5 outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(90vh,820px)] sm:w-[min(920px,calc(100%-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:shadow-[0_24px_80px_rgba(17,26,90,0.18)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="role-dialog-title" className="font-display text-xl font-bold text-indigo">
                  {dialog.mode === "create" ? "Create custom role" : dialog.mode === "edit" ? "Edit role" : activeRole?.name || "Role"}
                </h2>
                <p className="mt-1 text-[13px] text-muted">
                  {activeRole?.system
                    ? "System roles are read-only. Duplicate to create a custom role."
                    : dialog.mode === "create" && baseRole
                      ? `Based on ${baseRole.name}`
                      : "Review changes before saving."}
                </p>
              </div>
              <button type="button" onClick={requestClose} aria-label="Close dialog" className="px-2 text-lg text-muted">
                ×
              </button>
            </div>

            {step === "basics" ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2" id="role-panel-basics" role="tabpanel" aria-labelledby="role-tab-basics">
              <label className="block text-[13px] font-semibold text-indigo">
                Role name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={readOnly}
                  required
                  className="mt-1 w-full rounded-xl border border-[#E4EBFF] px-3 py-2 text-sm font-normal disabled:bg-[#F7F9FF]"
                />
              </label>
              <label className="block text-[13px] font-semibold text-indigo">
                Description
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value.slice(0, 250))}
                  disabled={readOnly}
                  className="mt-1 w-full rounded-xl border border-[#E4EBFF] px-3 py-2 text-sm font-normal disabled:bg-[#F7F9FF]"
                />
              </label>
            </div>
            ) : null}

            <div
              role="tablist"
              aria-label="Role sections"
              className="mt-4 flex gap-4 border-b border-[#EEF2FF]"
              onKeyDown={(event) => {
                const tabs = ["basics", "permissions", "review"] as const;
                const index = tabs.indexOf(step);
                const next = nextTabIndex(tabs.length, index, event.key);
                if (next == null) return;
                event.preventDefault();
                const item = tabs[next];
                if (item) setStep(item);
              }}
            >
              {(["basics", "permissions", "review"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`role-tab-${id}`}
                  aria-controls={`role-panel-${id}`}
                  aria-selected={step === id}
                  tabIndex={step === id ? 0 : -1}
                  onClick={() => setStep(id)}
                  className={`border-b-2 pb-2 text-[13px] font-semibold capitalize ${
                    step === id ? "border-violet text-violet" : "border-transparent text-muted"
                  }`}
                >
                  {id === "basics" ? "Overview" : id === "permissions" ? "Permissions" : "Review changes"}
                </button>
              ))}
            </div>

            {step === "permissions" ? (
              <div id="role-panel-permissions" role="tabpanel" aria-labelledby="role-tab-permissions" className="mt-4 grid min-h-0 gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
                <div className="space-y-1">
                  {BUCKETS.map((bucket) => {
                    const count = groups
                      .filter((group) => bucketFor(group.module) === bucket.id)
                      .reduce(
                        (sum, group) => sum + group.permissions.filter((perm) => selected.has(perm.id)).length,
                        0,
                      );
                    return (
                      <button
                        key={bucket.id}
                        type="button"
                        onClick={() => setBucketId(bucket.id)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] font-semibold ${
                          bucketId === bucket.id ? "bg-[#F1ECFF] text-violet" : "text-indigo hover:bg-[#F7F8FF]"
                        }`}
                      >
                        {bucket.label}
                        <span className="text-[11px] text-muted">{count}</span>
                      </button>
                    );
                  })}
                </div>
                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-bold text-indigo">
                      {BUCKETS.find((bucket) => bucket.id === bucketId)?.label} permissions
                    </p>
                    <p className="text-[12px] text-muted">{checked.length} selected</p>
                  </div>
                  <label className="relative mb-3 block">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                      <IconSearch size={14} />
                    </span>
                    <input
                      value={permQuery}
                      onChange={(event) => setPermQuery(event.target.value)}
                      placeholder="Find a permission"
                      className="w-full rounded-xl border border-[#E4EBFF] py-2 pl-9 pr-3 text-[13px] outline-none focus:border-violet"
                    />
                  </label>
                  <p className="mb-3 text-[12px] text-muted">Only permissions you can delegate are available.</p>
                  <div className="space-y-3">
                    {visibleGroups.map((group) => {
                      const perms = group.permissions.filter((perm) => {
                        const held = actorPermissions.includes(perm.id);
                        const alreadyOnRole = Boolean(activeRole?.permissions.includes(perm.id));
                        if (!held && !(readOnly && alreadyOnRole)) return false;
                        if (!query) return true;
                        return (
                          perm.label.toLowerCase().includes(query) ||
                          perm.hint.toLowerCase().includes(query) ||
                          perm.id.toLowerCase().includes(query)
                        );
                      });
                      if (!perms.length) return null;
                      const groupCount = group.permissions.filter((perm) => selected.has(perm.id)).length;
                      return (
                        <section key={group.module} className="rounded-2xl border border-[#E4EBFF]">
                          <div className="flex items-center justify-between px-3 py-2">
                            <p className="text-[13px] font-bold text-indigo">{group.label}</p>
                            <span className="text-[11px] font-semibold text-muted">{groupCount} selected</span>
                          </div>
                          <p className="px-3 pb-2 text-[11px] text-muted">{group.description}</p>
                          <ul className="space-y-1 px-3 pb-3">
                            {perms.map((perm) => (
                              <li key={perm.id}>
                                <label className="flex items-start gap-2 rounded-lg px-1 py-1.5 text-[13px] text-indigo">
                                  <input
                                    type="checkbox"
                                    checked={selected.has(perm.id)}
                                    disabled={readOnly || !actorPermissions.includes(perm.id)}
                                    onChange={() => {
                                      if (!actorPermissions.includes(perm.id)) return;
                                      toggle(perm.id);
                                    }}
                                    className="mt-0.5 accent-[#633CFF]"
                                  />
                                  <span>
                                    <span className="font-semibold">{perm.label}</span>
                                    <span className="mt-0.5 block text-[11px] text-muted">{perm.hint}</span>
                                  </span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        </section>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : step === "review" ? (
              <div id="role-panel-review" role="tabpanel" aria-labelledby="role-tab-review" className="mt-4 space-y-4 text-[13px]">
                <section className="rounded-2xl border border-[#E4EBFF] p-4">
                  <p className="font-bold text-indigo">Permission changes</p>
                  <p className="mt-2 text-muted">
                    {added.length} added · {removed.length} removed · {checked.length} total
                  </p>
                  {added.length ? (
                    <ul className="mt-2 space-y-1">
                      {added.map((id) => (
                        <li key={id} className="text-emerald-700">+ {labelById.get(id) || id}</li>
                      ))}
                    </ul>
                  ) : null}
                  {removed.length ? (
                    <ul className="mt-2 space-y-1">
                      {removed.map((id) => (
                        <li key={id} className="text-rose-600">− {labelById.get(id) || id}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
                <section className="rounded-2xl border border-[#E4EBFF] p-4">
                  <p className="font-bold text-indigo">Affected admins</p>
                  {dialog.mode === "create" ? (
                    <p className="mt-2 text-muted">No admins yet. Assign this role from Admin Users after it is saved.</p>
                  ) : activeRole && activeRole.assignees.length ? (
                    <ul className="mt-2 space-y-1">
                      {activeRole.assignees.map((admin) => (
                        <li key={admin.email} className="text-indigo">
                          {admin.name} · {admin.email}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-muted">No admins are assigned to this role.</p>
                  )}
                </section>
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#EEF2FF] pt-4">
              <p className="text-[12px] text-muted">
                {confirmClose
                  ? "Discard unsaved changes?"
                  : dialog.mode === "create"
                    ? "Custom role · Not yet saved"
                    : readOnly
                      ? "System roles are read-only. Duplicate to customize."
                      : `Changes: ${added.length} added · ${removed.length} removed · Affects ${activeRole?.assignedCount ?? 0} admins`}
              </p>
              <div className="flex gap-2">
                {confirmClose ? (
                  <>
                    <button type="button" onClick={() => setConfirmClose(false)} className="rounded-full border border-[#E4EBFF] px-4 py-2 text-[13px] font-semibold text-indigo">
                      Keep editing
                    </button>
                    <button type="button" onClick={() => { setConfirmClose(false); setDialog(null); }} className="rounded-full bg-violet px-4 py-2 text-[13px] font-semibold text-white">
                      Discard
                    </button>
                  </>
                ) : null}
                {confirmClose ? null : (
                <button
                  type="button"
                  onClick={() =>
                    step === "review" ? setStep("permissions") : step === "permissions" ? setStep("basics") : requestClose()
                  }
                  className="rounded-full border border-[#E4EBFF] px-4 py-2 text-[13px] font-semibold text-indigo"
                >
                  {step === "basics" ? "Cancel" : "Back"}
                </button>
                )}
                {readOnly && canManageRoles && activeRole && !activeRole.system ? (
                  <button
                    type="button"
                    onClick={() => setDialog({ mode: "edit", roleId: activeRole.id, baseRoleId: null })}
                    className="rounded-full border border-[#E4EBFF] px-4 py-2 text-[13px] font-semibold text-indigo"
                  >
                    Edit role
                  </button>
                ) : null}
                {readOnly && canManageRoles && activeRole ? (
                  <form action={actionDuplicateRole}>
                    <input type="hidden" name="next" value="/admin/access" />
                    <input type="hidden" name="roleId" value={activeRole.id} />
                    <DuplicateRoleButton prominent />
                  </form>
                ) : null}
                {!readOnly && step === "basics" ? (
                  <button type="button" onClick={() => setStep("permissions")} className="rounded-full bg-violet px-4 py-2 text-[13px] font-semibold text-white">
                    Next
                  </button>
                ) : null}
                {!readOnly && step === "permissions" ? (
                  <button
                    type="button"
                    onClick={() => setStep("review")}
                    className="rounded-full bg-violet px-4 py-2 text-[13px] font-semibold text-white"
                  >
                    Review changes
                  </button>
                ) : null}
                {!readOnly && step === "review" && !confirmClose ? (
                  <form action={dialog.mode === "edit" ? actionUpdateRole : actionCreateRole}>
                    <input type="hidden" name="next" value="/admin/access" />
                    {dialog.mode === "edit" && dialog.roleId ? (
                      <input type="hidden" name="roleId" value={dialog.roleId} />
                    ) : null}
                    <input type="hidden" name="name" value={name} />
                    <input type="hidden" name="description" value={description} />
                    {checked.map((id) => (
                      <input key={id} type="hidden" name={`perm_${id}`} value="on" />
                    ))}
                    <button
                      type="submit"
                      disabled={!name.trim() || checked.length === 0 || checked.some((id) => !actorPermissions.includes(id))}
                      className="rounded-full bg-violet px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
                    >
                      {dialog.mode === "edit" ? "Save role" : "Create role"}
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
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

function DuplicateRoleButton({ prominent = false }: { prominent?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        prominent
          ? "rounded-full bg-violet px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
          : "block w-full rounded-lg px-3 py-2 text-left text-[12px] font-semibold text-indigo hover:bg-[#F7F8FF] disabled:opacity-40"
      }
    >
      {pending ? "Duplicating…" : "Duplicate as custom role"}
    </button>
  );
}
