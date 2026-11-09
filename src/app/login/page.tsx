import Link from "next/link";
import { redirect } from "next/navigation";
import { actionLogin, actionLogout } from "@/app/account/actions";
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
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Link href="/" className="font-display text-xl font-bold text-[#1B1464]">
          <span className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full brand-gradient text-sm text-white">∞</span>
          Influrios
        </Link>
        <Link href="/claim" className="rounded-full border border-[#D9D6FF] px-4 py-2 text-sm font-semibold text-[#6D4AFF]">
          Create an account
        </Link>
      </header>
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-6 lg:grid-cols-2 lg:px-8">
        <div className="relative hidden min-h-[28rem] overflow-hidden rounded-[32px] bg-[#F4EFFF] lg:block" aria-hidden>
          <div className="absolute left-8 top-16 w-40 rotate-[-8deg] rounded-[28px] border-4 border-white bg-[#EDE7FF] p-3 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND_AVATARS.female} alt="" className="h-40 w-full rounded-2xl object-cover" />
          </div>
          <div className="absolute right-10 top-10 w-36 rotate-[7deg] rounded-[28px] border-4 border-white bg-[#E7F0FF] p-3 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND_AVATARS.male} alt="" className="h-36 w-full rounded-2xl object-cover" />
          </div>
          <div className="absolute bottom-10 left-24 w-44 rounded-[28px] border-4 border-white bg-white p-3 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND_AVATARS.female} alt="" className="h-28 w-full rounded-2xl object-cover" />
          </div>
        </div>
        <div>
          <h1 className="font-display text-4xl font-bold text-[#1B1464]">Welcome back</h1>
          <p className="mt-2 text-sm text-[#667085]">Log in to Influrios. The email you enter is the only account that will be signed in.</p>
          {account && requestedNext ? (
            <div className="mt-6 space-y-3 rounded-2xl border border-[#E7ECF5] p-4">
              <p className="text-sm text-[#1B1464]">
                You are signed in as <strong>{account.email}</strong>. Continuing keeps this account. Signing in below with a different email opens only that email’s account.
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
                placeholder="Enter your email"
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
            <Link href="/account/reset" className="font-semibold text-[#6D4AFF]">
              Need to set up your password?
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
