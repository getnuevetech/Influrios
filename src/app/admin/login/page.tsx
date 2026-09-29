import Link from "next/link";
import { redirect } from "next/navigation";
import { actionAdminLogin } from "@/app/admin/actions-auth";
import { PageShell } from "@/components/page-shell";
import { getAdminSession } from "@/lib/admin-auth";

export const metadata = { title: "Admin login" };

type Props = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function AdminLoginPage({ searchParams }: Props) {
  const session = await getAdminSession();
  if (session) redirect("/admin");

  const params = await searchParams;

  return (
    <div className="bg-[#F7FAFF] py-16">
      <PageShell narrow>
        <div className="card-surface p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Influrios Admin</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Sign in</h1>
          <p className="mt-2 text-sm text-muted">
            Admin portal is access-controlled. Super admins can create scoped access levels for other
            admins.
          </p>

          {params.error ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {params.error}
            </div>
          ) : null}

          <form action={actionAdminLogin} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={params.next || "/admin"} />
            <label className="block text-xs font-bold uppercase tracking-wide text-muted">
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                defaultValue="admin@influrios.com"
                className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-indigo outline-none focus:ring-2 focus:ring-violet"
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-wide text-muted">
              Password
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-indigo outline-none focus:ring-2 focus:ring-violet"
              />
            </label>
            <button type="submit" className="btn-primary w-full">
              Sign in →
            </button>
          </form>

          <p className="mt-6 text-[11px] leading-relaxed text-muted">
            Default super admin (change via{" "}
            <code className="text-indigo">ADMIN_SUPER_EMAIL</code> /{" "}
            <code className="text-indigo">ADMIN_SUPER_PASSWORD</code>):{" "}
            <span className="font-semibold text-indigo">admin@influrios.com</span> /{" "}
            <span className="font-semibold text-indigo">InfluriosAdmin!2026</span>
          </p>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-violet hover:underline">
            ← Back to site
          </Link>
        </div>
      </PageShell>
    </div>
  );
}
