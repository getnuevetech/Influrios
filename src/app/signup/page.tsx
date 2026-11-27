import Link from "next/link";
import { actionRegister } from "@/app/account/actions";
import { AccountAccessFrame } from "@/components/auth/access-frame";
import { CardPreviewDialog } from "@/components/auth/card-preview-dialog";
import { CompactInfluencerCard } from "@/components/creator-card";
import { PasswordField } from "@/components/password-field";
import { safeNextPath } from "@/lib/account-policy";
import { freshExamplePortrait, listExampleCardPortraits } from "@/lib/example-portraits";
import { demoCreators } from "@/lib/presentation-demo";
import { currentLegalDocument } from "@/lib/legal";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create account" };

type Props = {
  searchParams: Promise<{ next?: string; error?: string; role?: string; source?: string; utm_source?: string; utm_campaign?: string }>;
};

export default async function SignupPage({ searchParams }: Props) {
  const params = await searchParams;
  const business = params.role?.toLowerCase() === "business";
  const next = safeNextPath(params.next, business ? "/business/home" : "/creator?welcome=1");
  const policy = await getSiteConfig();
  const [terms, privacy, portraits] = await Promise.all([
    currentLegalDocument("terms-of-service").catch(() => null),
    currentLegalDocument("privacy-policy").catch(() => null),
    listExampleCardPortraits(),
  ]);
  const portrait = freshExamplePortrait(portraits);
  // The sample name matches who the example portrait shows (Admin → Example portraits).
  const samples = demoCreators();
  const base =
    samples.find((row) => row.slug === (portrait?.gender === "male" ? "demo-daniel" : "demo-amara")) ?? samples[0];
  const sampleCreator = base && portrait ? { ...base, image: portrait.src } : base;

  return (
    <AccountAccessFrame>
      <div className="order-2 lg:order-1">
        <h1 className="font-display text-4xl font-bold leading-tight text-[#1B1464]">
          Your influence.
          <br />
          One profile.
        </h1>
        {/* The full Influencer Card, as on the homepage and login page. The photo is one of the admin's example portraits. */}
        <div className="mt-6 flex justify-center lg:justify-start">
          {sampleCreator ? <CompactInfluencerCard creator={sampleCreator} /> : null}
        </div>
        <p className="mt-3 text-xs text-[#667085]">Sample card. Yours stays private until you publish it.</p>
        <div className="mt-4">
          <CardPreviewDialog source={params.source} utmSource={params.utm_source} utmCampaign={params.utm_campaign} />
        </div>
      </div>
      <div className="order-1 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-[#E7ECF5] lg:order-2">
        <h2 className="font-display text-3xl font-bold text-[#1B1464]">Create your account</h2>
        <p className="mt-1 text-sm text-[#667085]">Start with email. Connect your socials during setup.</p>
        {params.error ? <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{params.error}</p> : null}
        <form action={actionRegister} className="mt-5 space-y-4">
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="returnTo" value="/signup" />
          <fieldset className="space-y-2 text-sm">
            <legend className="font-semibold text-[#1B1464]">I am joining as</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="role" value="CREATOR" defaultChecked={!business} className="accent-[#6D4AFF]" />
              Influencer
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="role" value="BUSINESS" defaultChecked={business} className="accent-[#6D4AFF]" />
              Business
            </label>
          </fieldset>
          <label className="block text-sm font-semibold text-[#1B1464]">
            Name
            <input name="name" required placeholder="Your full name" className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-3 text-sm font-normal outline-none focus:border-violet" />
          </label>
          <label className="block text-sm font-semibold text-[#1B1464]">
            Email
            <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-3 text-sm font-normal outline-none focus:border-violet" />
          </label>
          <label className="block text-sm font-semibold text-[#1B1464]">
            Password
            <PasswordField name="password" placeholder="Create a password" minLength={policy.passwordMinLength} autoComplete="new-password" />
          </label>
          <label className="flex items-start gap-2 text-sm text-[#1B1464]">
            <input type="checkbox" name="consent" required className="mt-1 accent-[#6D4AFF]" />
            <span>
              I agree to the{" "}
              <Link href="/legal/terms-of-service" className="font-semibold text-[#6D4AFF] underline" target="_blank">
                {terms?.title ?? "Terms of Service"}
              </Link>{" "}
              and{" "}
              <Link href="/legal/privacy-policy" className="font-semibold text-[#6D4AFF] underline" target="_blank">
                {privacy?.title ?? "Privacy Policy"}
              </Link>
              .
            </span>
          </label>
          <button type="submit" className="w-full rounded-xl bg-[#6D4AFF] py-3 text-sm font-semibold text-white">
            Create account
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-[#667085]">
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-[#6D4AFF]">
            Log in
          </Link>
        </p>
        <ol className="mt-6 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-[#667085]">
          <li><span className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#F3EEFF] text-[#6D4AFF]">1</span>Create account</li>
          <li><span className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#F3EEFF] text-[#6D4AFF]">2</span>Connect socials (optional)</li>
          <li><span className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#F3EEFF] text-[#6D4AFF]">3</span>Review profile</li>
        </ol>
        <p className="mt-4 text-center text-xs text-[#98A2B3]">Your profile stays private until you publish.</p>
      </div>
    </AccountAccessFrame>
  );
}
