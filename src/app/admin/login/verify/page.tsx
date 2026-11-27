import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { actionAdminMfaVerify } from "@/app/admin/mfa-actions";
import { AuthenticatorSetup } from "@/components/admin-authenticator-setup";
import { PageShell } from "@/components/page-shell";
import { ADMIN_MFA_CHALLENGE_COOKIE, adminMfaStep, beginEnrollment, readMfaChallenge } from "@/lib/admin-mfa";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin sign-in code" };

type Props = { searchParams: Promise<{ error?: string }> };

export default async function AdminLoginVerifyPage({ searchParams }: Props) {
  const params = await searchParams;
  const jar = await cookies();
  const challenge = await readMfaChallenge(jar.get(ADMIN_MFA_CHALLENGE_COOKIE)?.value);
  if (!challenge) redirect(`/admin/login?error=${encodeURIComponent("Sign in with your email and password first.")}`);
  const step = await adminMfaStep(challenge.userId);
  const setup = step === "enroll" ? await beginEnrollment(challenge.userId) : null;

  return (
    <div className="bg-[#F7FAFF] py-16">
      <PageShell narrow>
        <div className="card-surface p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Influrios Admin</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-indigo">
            {setup ? "Set up your authenticator" : "Enter your sign-in code"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {setup
              ? "Admin sign-in now needs a second step. Set up an authenticator app once; after that you enter its code when you sign in."
              : "Open your authenticator app and enter the 6-digit code for Influrios Admin."}
          </p>
          {params.error ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{params.error}</div>
          ) : null}
          {setup ? (
            <div className="mt-5">
              <AuthenticatorSetup url={setup.url} secret={setup.secret} />
            </div>
          ) : null}
          <form action={actionAdminMfaVerify} className="mt-6 space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wide text-muted">
              6-digit code
              <input
                name="code"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                autoFocus
                className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-lg font-semibold tracking-[0.3em] text-indigo outline-none focus:ring-2 focus:ring-violet"
              />
            </label>
            <button type="submit" className="btn-primary w-full">
              {setup ? "Confirm and sign in" : "Sign in"}
            </button>
          </form>
          <p className="mt-6 text-xs text-muted">
            Lost your phone? Ask an admin who manages admin users to reset your authenticator.{" "}
            <Link href="/admin/login" className="font-semibold text-violet hover:underline">
              Start over
            </Link>
          </p>
        </div>
      </PageShell>
    </div>
  );
}
