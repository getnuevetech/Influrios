import Link from "next/link";
import { actionLogin } from "@/app/account/actions";
import { safeNextPath } from "@/lib/account-policy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log in" };

type Props = { searchParams: Promise<{ next?: string; error?: string; gate?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Account</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Log in</h1>
      <p className="mt-2 text-sm text-muted">
        {params.gate
          ? "Create an account or log in to continue. We will return you to the page you were opening."
          : "Use the email and password for your Influrios account."}
      </p>
      {params.error ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {params.error}
        </p>
      ) : null}
      <form action={actionLogin} className="card-surface mt-6 space-y-3 p-6">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm font-semibold text-indigo">
          Email
          <input name="email" type="email" required className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
        </label>
        <label className="block text-sm font-semibold text-indigo">
          Password
          <input name="password" type="password" required className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
        </label>
        <button type="submit" className="btn-primary w-full">
          Log in
        </button>
        <p className="text-center text-sm text-muted">
          <Link href="/account/reset" className="font-semibold text-violet">
            Forgot password
          </Link>
        </p>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        New here?{" "}
        <Link href={`/register?next=${encodeURIComponent(next)}`} className="font-semibold text-violet">
          Create an account
        </Link>
      </p>
    </div>
  );
}
