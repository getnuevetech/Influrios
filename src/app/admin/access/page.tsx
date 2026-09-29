import Link from "next/link";
import { redirect } from "next/navigation";
import {
  actionCreateAdminUser,
  actionCreateRole,
  actionSetAdminRole,
  actionToggleAdminActive,
} from "@/app/admin/actions-auth";
import { PageShell } from "@/components/page-shell";
import {
  ADMIN_PERMISSIONS,
  getAdminAuthStore,
  getAdminSession,
  permissionLabel,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Access levels" };

type Props = {
  searchParams: Promise<{ error?: string; created?: string; updated?: string }>;
};

export default async function AdminAccessPage({ searchParams }: Props) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?next=/admin/access");
  if (!session.permissions.includes("access")) redirect("/admin?error=forbidden");

  const params = await searchParams;
  const store = await getAdminAuthStore();

  return (
    <PageShell className="space-y-8 py-10">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Access levels</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Super admins create roles with scoped permissions, then assign them to admin users. Not
          every admin should see every console.
        </p>
      </div>

      {params.error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {params.error}
        </div>
      ) : null}
      {params.created || params.updated ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Saved{params.created ? ` · ${params.created} created` : ""}
          {params.updated ? " · updated" : ""}.
        </div>
      ) : null}

      <section className="card-surface p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Roles</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {store.roles.map((role) => (
            <div key={role.id} className="rounded-2xl border border-border bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display font-bold text-indigo">{role.name}</p>
                {role.system ? (
                  <span className="rounded-full bg-lavender px-2 py-0.5 text-[10px] font-bold text-violet">
                    System
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted">{role.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {role.permissions.map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-semibold text-indigo"
                  >
                    {permissionLabel(p)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <form action={actionCreateRole} className="mt-6 space-y-3 rounded-2xl border border-dashed border-border p-4">
          <h3 className="font-display font-bold text-indigo">Create access level</h3>
          <input
            name="name"
            required
            placeholder="Role name"
            className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet"
          />
          <input
            name="description"
            placeholder="What this admin can do"
            className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {ADMIN_PERMISSIONS.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm text-indigo">
                <input type="checkbox" name={`perm_${p}`} className="accent-[#633CFF]" />
                {permissionLabel(p)}
              </label>
            ))}
          </div>
          <button type="submit" className="btn-primary !py-2 text-sm">
            Create role
          </button>
        </form>
      </section>

      <section className="card-surface p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Admin users</h2>
        <ul className="mt-4 divide-y divide-border">
          {store.users.map((user) => {
            const role = store.roles.find((r) => r.id === user.roleId);
            return (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold text-indigo">
                    {user.name}{" "}
                    <span className="text-xs font-medium text-muted">({user.email})</span>
                  </p>
                  <p className="text-xs text-muted">
                    {role?.name ?? "Unknown role"} · {user.active ? "Active" : "Disabled"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={actionSetAdminRole} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={user.id} />
                    <select
                      name="roleId"
                      defaultValue={user.roleId}
                      className="rounded-lg border border-border px-2 py-1.5 text-xs"
                    >
                      {store.roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="text-xs font-semibold text-violet hover:underline">
                      Set role
                    </button>
                  </form>
                  <form action={actionToggleAdminActive}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="active" value={user.active ? "0" : "1"} />
                    <button type="submit" className="text-xs font-semibold text-muted hover:text-violet">
                      {user.active ? "Disable" : "Enable"}
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>

        <form action={actionCreateAdminUser} className="mt-6 grid gap-3 rounded-2xl border border-dashed border-border p-4 md:grid-cols-2">
          <h3 className="font-display font-bold text-indigo md:col-span-2">Invite admin user</h3>
          <input
            name="name"
            required
            placeholder="Full name"
            className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Temporary password"
            className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet"
          />
          <select
            name="roleId"
            required
            className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet"
          >
            {store.roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary md:col-span-2 !py-2 text-sm">
            Create admin user
          </button>
        </form>
      </section>
    </PageShell>
  );
}
