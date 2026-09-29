import Link from "next/link";
import { actionAdminLogout } from "@/app/admin/actions-auth";
import { canAccessModule, getAdminSession } from "@/lib/admin-auth";

/** Signed-in admin chrome bar (login page stays clean when no session). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  return (
    <div>
      {session ? (
        <div className="border-b border-border bg-white">
          <div className="mx-auto flex w-full max-w-[90rem] flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs sm:px-6 lg:px-10">
            <p className="text-muted">
              Admin · <span className="font-semibold text-indigo">{session.name}</span> ·{" "}
              {session.roleName}
            </p>
            <div className="flex items-center gap-3">
              <Link href="/admin" className="font-semibold text-violet hover:underline">
                Dashboard
              </Link>
              {canAccessModule(session, "access") ? (
                <Link href="/admin/access" className="font-semibold text-violet hover:underline">
                  Access levels
                </Link>
              ) : null}
              <form action={actionAdminLogout}>
                <button type="submit" className="font-semibold text-muted hover:text-indigo">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}
