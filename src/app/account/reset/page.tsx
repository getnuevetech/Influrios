import { actionRequestReset, actionResetPassword } from "@/app/account/actions";
import { passwordResetUsable } from "@/lib/accounts";
import { resetPasswordScreen } from "@/lib/password-reset";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reset password" };

type Props = { searchParams: Promise<{ token?: string; sent?: string; error?: string }> };

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const policy = await getSiteConfig();
  const token = params.token?.trim() ?? "";
  const usable = token ? await passwordResetUsable(token).catch(() => false) : false;
  const screen = resetPasswordScreen({ hasToken: Boolean(token), usable });
  const expired = Boolean(token) && !usable;
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Account</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Reset password</h1>
      <p className="mt-2 text-sm text-muted">
        {screen === "choose-password"
          ? "Choose a new password. This link came from the reset email."
          : "If that account has a password, the reset link is emailed when SMTP is configured. The link is not shown on this page."}
      </p>
      {expired ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This reset link has expired. Request a new one.
        </p>
      ) : null}
      {params.error && !expired ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{params.error}</p>
      ) : null}
      {screen === "choose-password" ? (
        <form action={actionResetPassword} className="card-surface mt-6 space-y-3 p-6">
          <input type="hidden" name="token" value={token} />
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
            Email reset link
          </button>
          {params.sent ? (
            <p className="text-sm text-muted">
              If that email has a password and SMTP is configured, the reset link was sent.
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}
