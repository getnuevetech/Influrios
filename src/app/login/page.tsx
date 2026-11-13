import Link from "next/link";
import { redirect } from "next/navigation";
import { actionLogin, actionLogout } from "@/app/account/actions";
import { AccountAccessFrame } from "@/components/auth/access-frame";
import { IconInstagram, IconTikTok, IconYouTube } from "@/components/icons";
import { PasswordField } from "@/components/password-field";
import { safeNextPath } from "@/lib/account-policy";
import { getAccountSession, homePathForRole } from "@/lib/accounts";
import { BRAND_AVATARS } from "@/lib/profile-media";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log in" };

type Props = { searchParams: Promise<{ next?: string; error?: string; gate?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const account = await getAccountSession().catch(() => null);
  const requestedNext = Boolean(params.next?.trim());
  if (account && !requestedNext) redirect(homePathForRole(account.role));
  return (
    <AccountAccessFrame actionHref={`/signup?next=${encodeURIComponent(next)}`} actionLabel="Create an account">
      <div className="relative hidden min-h-[28rem] overflow-hidden rounded-[32px] bg-[#F4EFFF] lg:block">
        <p className="px-8 pt-10 font-display text-4xl font-bold leading-tight text-[#1B1464]">
          Welcome back
          <br />
          to your network.
        </p>
        <div className="relative mt-6 h-64">
          <span className="absolute left-16 top-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#6D4AFF] shadow">
            <IconInstagram size={20} />
          </span>
          <span className="absolute left-1/2 top-0 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-[#111] text-white shadow">
            <IconTikTok size={22} />
          </span>
          <span className="absolute right-16 top-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#E11D48] shadow">
            <IconYouTube size={20} />
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND_AVATARS.female} alt="" className="absolute bottom-0 left-1/2 h-44 w-56 -translate-x-1/2 rounded-[28px] object-cover shadow-lg" />
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
