import Link from "next/link";
import { actionCompleteAdminSetup } from "@/app/admin/actions-auth";
import { PageShell } from "@/components/page-shell";
import { readAdminSetupToken } from "@/lib/admin-auth";

export const metadata = { title: "Set up admin account" };

type Props = {
  searchParams: Promise<{ token?: string; error?: string }>;
};

export default async function AdminSetupPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = params.token || "";
  const valid = Boolean(readAdminSetupToken(token));

  return (
    <div className="bg-[#F7FAFF] py-16">
      <PageShell narrow>
        <div className="card-surface p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Influrios Admin</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Set up your account</h1>
          <p className="mt-2 text-sm text-muted">
            Choose a password for the admin console. This invitation link works once.
          </p>
          {params.error ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {params.error}
            </div>
          ) : null}
          {valid ? (
            <form action={actionCompleteAdminSetup} className="mt-6 space-y-4">
              <input type="hidden" name="token" value={token} />
              <label className="block text-xs font-bold uppercase tracking-wide text-muted">
                Password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={10}
                  autoComplete="new-password"
                  className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-indigo outline-none focus:ring-2 focus:ring-violet"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-muted">
                Confirm password
                <input
                  name="confirm"
                  type="password"
                  required
                  minLength={10}
                  autoComplete="new-password"
                  className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-indigo outline-none focus:ring-2 focus:ring-violet"
                />
              </label>
              <button type="submit" className="btn-primary w-full">
                Save password
              </button>
            </form>
          ) : (
            <p className="mt-6 text-sm text-muted">This setup link is invalid or expired. Ask an admin to send a new invitation.</p>
          )}
          <Link href="/admin/login" className="mt-6 inline-block text-sm font-semibold text-violet hover:underline">
            Back to sign in
          </Link>
        </div>
      </PageShell>
    </div>
  );
}
