import { actionVerifyEmail } from "@/app/account/actions";
import { safeNextPath } from "@/lib/account-policy";
import { latestDemoCode } from "@/lib/accounts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify email" };

type Props = { searchParams: Promise<{ email?: string; next?: string; error?: string }> };

export default async function VerifyEmailPage({ searchParams }: Props) {
  const params = await searchParams;
  const email = params.email ?? "";
  const next = safeNextPath(params.next);
  const code = email ? await latestDemoCode(email).catch(() => null) : null;
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Verify email</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Confirm {email || "your email"}</h1>
      <p className="mt-2 text-sm text-muted">
        Mail delivery waits on SMTP. This demo code confirms the address. Social accounts stay unverified.
      </p>
      {params.error ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{params.error}</p>
      ) : null}
      {code ? (
        <div className="mt-6 rounded-xl bg-[#EEF4FF] px-4 py-3 text-sm text-indigo">
          <p className="font-semibold">Demo code</p>
          <p className="mt-1 font-display text-2xl font-bold tracking-[0.2em] text-violet">{code}</p>
        </div>
      ) : null}
      <form action={actionVerifyEmail} className="card-surface mt-6 space-y-3 p-6">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm font-semibold text-indigo">
          Code
          <input name="code" required inputMode="numeric" className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal tracking-widest" />
        </label>
        <button type="submit" className="btn-primary w-full">
          Verify and continue
        </button>
      </form>
    </div>
  );
}
