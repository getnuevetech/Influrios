import Link from "next/link";
import { actionRegister } from "@/app/account/actions";
import { PasswordField } from "@/components/password-field";
import { safeNextPath } from "@/lib/account-policy";
import { currentLegalDocument } from "@/lib/legal";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create account" };

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function RegisterPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeNextPath(params.next, "/creator?welcome=1");
  const policy = await getSiteConfig();
  const [terms, consent, privacy] = await Promise.all([
    currentLegalDocument("terms-of-service").catch(() => null),
    currentLegalDocument("electronic-consent").catch(() => null),
    currentLegalDocument("privacy-policy").catch(() => null),
  ]);
  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Link href="/" className="font-display text-xl font-bold text-[#1B1464]">
          <span className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full brand-gradient text-sm text-white">∞</span>
          Influrios
        </Link>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-sm font-semibold text-[#6D4AFF]">
          Log in
        </Link>
      </header>
      <div className="mx-auto max-w-lg px-4 py-8">
        <h1 className="font-display text-4xl font-bold text-[#1B1464]">Create your Influrios account</h1>
        <p className="mt-2 text-sm text-[#667085]">Start with email. Connect your socials anytime.</p>
        {params.error ? <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{params.error}</p> : null}
        <form action={actionRegister} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="returnTo" value="/register" />
          <label className="block text-sm font-semibold text-[#1B1464]">
            Name
            <input name="name" required placeholder="e.g., Sofia Carter" className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-3 text-sm font-normal" />
          </label>
          <label className="block text-sm font-semibold text-[#1B1464]">
            Email
            <input name="email" type="email" required autoComplete="email" placeholder="you@influrios.com" className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-3 text-sm font-normal" />
          </label>
          <label className="block text-sm font-semibold text-[#1B1464]">
            Password
            <PasswordField name="password" placeholder="Create a password" minLength={policy.passwordMinLength} autoComplete="new-password" />
          </label>
          <label className="flex items-start gap-2 text-sm text-[#1B1464]">
            <input type="checkbox" name="consent" required className="mt-1 accent-[#6D4AFF]" />
            <span>
              I agree to the{" "}
              <Link href="/legal/terms-of-service" className="font-semibold text-[#6D4AFF] underline" target="_blank">{terms?.title ?? "Terms of Service"}</Link>
              ,{" "}
              <Link href="/legal/electronic-consent" className="font-semibold text-[#6D4AFF] underline" target="_blank">{consent?.title ?? "User Registration & Electronic Consent Agreement"}</Link>
              , and{" "}
              <Link href="/legal/privacy-policy" className="font-semibold text-[#6D4AFF] underline" target="_blank">{privacy?.title ?? "Privacy Policy"}</Link>
              .
            </span>
          </label>
          <button type="submit" className="w-full rounded-xl bg-[#6D4AFF] py-3 text-sm font-semibold text-white">
            Create my account
          </button>
        </form>
        <p className="mt-4 text-sm text-[#667085]">
          Want the card preview too?{" "}
          <Link href="/claim" className="font-semibold text-[#6D4AFF]">Create an influencer account</Link>
        </p>
      </div>
    </div>
  );
}
