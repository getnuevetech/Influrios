import { redirect } from "next/navigation";
import { actionConfirmMyAuthenticator, actionRemoveMyAuthenticator } from "@/app/admin/mfa-actions";
import { AuthenticatorSetup } from "@/components/admin-authenticator-setup";
import { getAdminSession } from "@/lib/admin-auth";
import { ADMIN_MFA_MODE_LABEL, beginEnrollment, getAdminMfaMode } from "@/lib/admin-mfa";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · My sign-in security" };

type Props = { searchParams: Promise<{ error?: string; enrolled?: string; removed?: string; setup?: string }> };

const codeInput = "mt-1 w-40 rounded-lg border border-border px-3 py-2 text-base font-semibold tracking-[0.3em] text-indigo";

export default async function AdminSecurityPage({ searchParams }: Props) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?next=/admin/security");
  const params = await searchParams;
  const [mode, me] = await Promise.all([
    getAdminMfaMode(),
    prisma.adminUser.findUnique({ where: { id: session.userId }, select: { totpSecret: true, totpEnabledAt: true } }),
  ]);
  const enrolled = Boolean(me?.totpSecret);
  const setup = !enrolled && params.setup ? await beginEnrollment(session.userId) : null;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-indigo">My sign-in security</h1>
        <p className="mt-1 text-sm text-muted">
          Sign-in code for all admins: <span className="font-semibold text-indigo">{ADMIN_MFA_MODE_LABEL[mode]}</span>. Admins who manage admin
          users change this on Admin users.
        </p>
      </div>
      {params.error ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{params.error}</p> : null}
      {params.enrolled ? <p className="rounded-xl bg-[#EAF8F2] px-3 py-2 text-sm font-semibold text-[#087B5A]">Authenticator set up.</p> : null}
      {params.removed ? <p className="rounded-xl bg-[#EAF8F2] px-3 py-2 text-sm font-semibold text-[#087B5A]">Authenticator removed.</p> : null}

      <section className="card-surface space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Authenticator app</h2>
        {enrolled ? (
          <>
            <p className="text-sm text-muted">
              Set up
              {me?.totpEnabledAt
                ? ` on ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/Chicago" }).format(me.totpEnabledAt)}`
                : ""}
              . {mode === "off" ? "Codes are not asked for while the sign-in code is off." : "You enter a code from it each time you sign in."}
            </p>
            <form action={actionRemoveMyAuthenticator} className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-semibold text-muted">
                Current code, to remove it
                <input name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={7} className={codeInput} />
              </label>
              <button type="submit" className="btn-secondary !py-2 text-sm">
                Remove authenticator
              </button>
            </form>
          </>
        ) : setup ? (
          <>
            <AuthenticatorSetup url={setup.url} secret={setup.secret} />
            <form action={actionConfirmMyAuthenticator} className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-semibold text-muted">
                6-digit code
                <input name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={7} autoFocus className={codeInput} />
              </label>
              <button type="submit" className="btn-primary !py-2 text-sm">
                Confirm
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">Not set up. Setting it up takes a minute with an authenticator app on your phone.</p>
            <a href="/admin/security?setup=1" className="btn-primary inline-flex w-fit !py-2 text-sm">
              Set up authenticator
            </a>
          </>
        )}
      </section>
    </div>
  );
}
