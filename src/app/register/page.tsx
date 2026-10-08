import Link from "next/link";
import { actionRegister } from "@/app/account/actions";
import { safeNextPath } from "@/lib/account-policy";
import { currentLegalDocument } from "@/lib/legal";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create account" };

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function RegisterPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const policy = await getSiteConfig();
  const [terms, consent, privacy] = await Promise.all([
    currentLegalDocument("terms-of-service").catch(() => null),
    currentLegalDocument("electronic-consent").catch(() => null),
    currentLegalDocument("privacy-policy").catch(() => null),
  ]);
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Account</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Create your account</h1>
      <p className="mt-2 text-sm text-muted">
        Email and password. We email a confirmation code when SMTP is configured, then send you back to {next}.
      </p>
      {params.error ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {params.error}
        </p>
      ) : null}
      <form action={actionRegister} className="card-surface mt-6 space-y-3 p-6">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm font-semibold text-indigo">
          Name
          <input name="name" required className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
        </label>
        <label className="block text-sm font-semibold text-indigo">
          Email
          <input name="email" type="email" required className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
        </label>
        <label className="block text-sm font-semibold text-indigo">
          Password
          <input name="password" type="password" required minLength={policy.passwordMinLength} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
        </label>
        <label className="flex items-start gap-2 text-sm text-indigo">
          <input type="checkbox" name="consent" required className="mt-1 accent-[#633CFF]" />
          <span>
            By creating an account, I agree to the{" "}
            <Link href="/legal/terms-of-service" className="font-semibold text-violet underline" target="_blank">
              {terms?.title ?? "Terms of Service"}
            </Link>{" "}
            and the{" "}
            <Link href="/legal/electronic-consent" className="font-semibold text-violet underline" target="_blank">
              {consent?.title ?? "User Registration & Electronic Consent Agreement"}
            </Link>
            , and I acknowledge the{" "}
            <Link href="/legal/privacy-policy" className="font-semibold text-violet underline" target="_blank">
              {privacy?.title ?? "Privacy Policy"}
            </Link>
            .
          </span>
        </label>
        <button type="submit" className="btn-primary w-full">
          Create account
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        Already registered?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-violet">
          Log in
        </Link>
      </p>
    </div>
  );
}
