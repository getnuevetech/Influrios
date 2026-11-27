import Link from "next/link";
import { redirect } from "next/navigation";
import { actionLogin, actionLogout } from "@/app/account/actions";
import { AccountAccessFrame } from "@/components/auth/access-frame";
import { CompactInfluencerCard } from "@/components/creator-card";
import { PasswordField } from "@/components/password-field";
import { safeNextPath } from "@/lib/account-policy";
import { getAccountSession, homePathForRole } from "@/lib/accounts";
import { demoCreators } from "@/lib/presentation-demo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log in" };

type Props = { searchParams: Promise<{ next?: string; error?: string; gate?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const account = await getAccountSession().catch(() => null);
  const requestedNext = Boolean(params.next?.trim());
  if (account && !requestedNext) redirect(homePathForRole(account.role));
  const sampleCreator = demoCreators()[0];
  return (
    <AccountAccessFrame>
      <div className="relative hidden overflow-hidden rounded-[32px] bg-[#F4EFFF] px-8 pb-8 pt-10 lg:block">
        <p className="font-display text-4xl font-bold leading-tight text-[#1B1464]">
          Welcome back
          <br />
          to your network.
        </p>
        {/* The full Influencer Card, as on the homepage: what members share and what brands see. */}
        <div className="mt-8 flex flex-col items-center gap-2">
          {sampleCreator ? <CompactInfluencerCard creator={sampleCreator} /> : null}
          <p className="text-xs font-semibold text-violet">Sample card</p>
        </div>
      </div>
      <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-[#E7ECF5]">
        <h1 className="font-display text-4xl font-bold text-[#1B1464] lg:hidden">Welcome back</h1>
        <h2 className="font-display text-3xl font-bold text-[#1B1464]">Log in to Influrios</h2>
        <p className="mt-2 text-sm text-[#667085]">Email and password. Connecting a social account is a separate step after you are signed in.</p>
        {account && requestedNext ? (
          <div className="mt-6 space-y-3 rounded-2xl border border-[#E7ECF5] p-4">
            <p className="text-sm text-[#1B1464]">
              You are signed in as <strong>{account.email}</strong>. Continuing keeps this account.
            </p>
            <Link href={next} className="btn-primary inline-flex w-full justify-center">
              Continue as {account.email}
            </Link>
            <form action={actionLogout}>
              <input type="hidden" name="next" value={next} />
              <button type="submit" className="w-full text-sm font-semibold text-[#6D4AFF]">
                Sign out and use a different login
              </button>
            </form>
          </div>
        ) : null}
        {params.error ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{params.error}</p>
        ) : null}
        <form action={actionLogin} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <label className="block text-sm font-semibold text-[#1B1464]">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-3 text-sm font-normal outline-none focus:border-violet"
            />
          </label>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#1B1464]">Password</span>
              <Link href="/account/reset" className="text-xs font-semibold text-[#6D4AFF]">
                Forgot password?
              </Link>
            </div>
            <PasswordField />
          </div>
          <button type="submit" className="w-full rounded-xl bg-[#6D4AFF] py-3 text-sm font-semibold text-white">
            Log in
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-[#667085]">
          New here?{" "}
          <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-[#6D4AFF]">
            Create an account
          </Link>
        </p>
      </div>
    </AccountAccessFrame>
  );
}
