import { actionRequestReset, actionResetPassword } from "@/app/account/actions";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reset password" };

type Props = { searchParams: Promise<{ token?: string; sent?: string; error?: string }> };

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const policy = await getSiteConfig();
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Account</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Reset password</h1>
      <p className="mt-2 text-sm text-muted">
        Email delivery is inactive until SMTP is configured. If the account exists, the one-time link is shown here.
      </p>
      {params.error ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{params.error}</p>
      ) : null}
      {params.token ? (
        <form action={actionResetPassword} className="card-surface mt-6 space-y-3 p-6">
          <input type="hidden" name="token" value={params.token} />
          <p className="text-sm text-muted">Choose a new password for this reset link.</p>
          <input name="password" type="password" required minLength={policy.passwordMinLength} className="w-full rounded-xl border border-border px-3 py-2" />
          <button type="submit" className="btn-primary w-full">
            Save password
          </button>
        </form>
      ) : (
        <form action={actionRequestReset} className="card-surface mt-6 space-y-3 p-6">
          <label className="block text-sm font-semibold text-indigo">
            Email
            <input name="email" type="email" required className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
          </label>
          <button type="submit" className="btn-primary w-full">
            Create reset link
          </button>
          {params.sent ? <p className="text-sm text-muted">If that email has a password, the link is ready above.</p> : null}
        </form>
      )}
    </div>
  );
}
