import Link from "next/link";
import { redirect } from "next/navigation";
import { actionSetPassword } from "@/app/account/actions";
import { safeNextPath } from "@/lib/account-policy";
import { getAccountSession, homePathForRole } from "@/lib/accounts";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set password" };

type Props = { searchParams: Promise<{ next?: string; error?: string; saved?: string }> };

export default async function SetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const session = await getAccountSession();
  if (!session) redirect(`/login?next=${encodeURIComponent("/account/password")}`);
  const home = homePathForRole(session.role);
  const next = safeNextPath(params.next, home);
  if (session.hasPassword && !params.error) {
    redirect(next);
  }
  const policy = await getSiteConfig();

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Account</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Set your password</h1>
      <p className="mt-2 text-sm text-muted">
        Your email is verified on {session.email}. Choose a password so you can log back in. Social signup does not
        create a password by itself.
      </p>
      {params.error ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {params.error}
        </p>
      ) : null}
      <form action={actionSetPassword} className="card-surface mt-6 space-y-3 p-6">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm font-semibold text-indigo">
          New password
          <input
            name="password"
            type="password"
            required
            minLength={policy.passwordMinLength}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
          />
          <span className="mt-1 block text-xs font-normal text-muted">
            At least {policy.passwordMinLength} characters.
          </span>
        </label>
        <label className="block text-sm font-semibold text-indigo">
          Confirm password
          <input
            name="confirm"
            type="password"
            required
            minLength={policy.passwordMinLength}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
          />
        </label>
        <button type="submit" className="btn-primary w-full">
          Save password
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        <Link href={home} className="font-semibold text-violet">
          Back to account
        </Link>
      </p>
    </div>
  );
}
