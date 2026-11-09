import Link from "next/link";
import { actionRegister } from "@/app/account/actions";
import { actionCreateDraft } from "@/app/claim/actions";
import { PasswordField } from "@/components/password-field";
import { IconFacebook, IconInstagram, IconTikTok, IconYouTube, IconX } from "@/components/icons";
import { getAccountSession } from "@/lib/accounts";
import { freshExamplePortrait, listExampleCardPortraits } from "@/lib/example-portraits";
import { currentLegalDocument } from "@/lib/legal";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create your Influrios account" };

type Props = { searchParams: Promise<{ error?: string; platform?: string; source?: string; utm_source?: string; utm_campaign?: string }> };

const SOCIAL_HINTS = [
  { platform: "instagram", label: "Instagram", Icon: IconInstagram },
  { platform: "tiktok", label: "TikTok", Icon: IconTikTok },
  { platform: "youtube", label: "YouTube", Icon: IconYouTube },
  { platform: "facebook", label: "Facebook", Icon: IconFacebook },
  { platform: "x", label: "X", Icon: IconX },
] as const;

export default async function ClaimPage({ searchParams }: Props) {
  const params = await searchParams;
  const platformHint = SOCIAL_HINTS.find((item) => item.platform === params.platform) ?? SOCIAL_HINTS[0];
  const source = (params.source || params.utm_source || "").trim();
  const campaign = (params.utm_campaign || "").trim();
  const [account, policy, terms, consent, privacy, portraits] = await Promise.all([
    getAccountSession().catch(() => null),
    getSiteConfig(),
    currentLegalDocument("terms-of-service").catch(() => null),
    currentLegalDocument("electronic-consent").catch(() => null),
    currentLegalDocument("privacy-policy").catch(() => null),
    listExampleCardPortraits(),
  ]);
  const portrait = freshExamplePortrait(portraits);
  const claimQuery = (platform: string) => {
    const query = new URLSearchParams();
    if (platform) query.set("platform", platform);
    if (source) query.set("source", source);
    if (params.utm_source) query.set("utm_source", params.utm_source);
    if (campaign) query.set("utm_campaign", campaign);
    const text = query.toString();
    return text ? `/claim?${text}` : "/claim";
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Link href="/" className="font-display text-xl font-bold text-[#1B1464]">
          <span className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full brand-gradient text-sm text-white">∞</span>
          Influrios
        </Link>
        <p className="text-sm text-[#667085]">
          Already have an account?{" "}
          <Link href="/login?next=/creator" className="font-semibold text-[#6D4AFF]">
            Log in
          </Link>
        </p>
      </header>
      <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 py-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:px-8">
        <div>
          <div className="mx-auto max-w-sm rounded-[28px] bg-gradient-to-br from-[#5B4DFF] to-[#8B5CF6] p-6 text-center text-white shadow-lg">
            <span className="mx-auto inline-flex h-28 w-28 overflow-hidden rounded-full border-4 border-white/70 bg-white/20">
              {portrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={portrait.src} alt="" className="h-full w-full object-cover" />
              ) : null}
            </span>
            <p className="mt-4 font-display text-2xl font-bold">Example card</p>
            <p className="text-sm capitalize text-white/80">{portrait?.gender ?? "Creator"} portrait</p>
            <div className="mt-3 flex justify-center gap-2 text-white/90">
              <IconInstagram size={16} />
              <IconTikTok size={16} />
              <IconYouTube size={16} />
              <IconFacebook size={16} />
              <IconX size={16} />
            </div>
            <p className="mx-auto mt-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">INFLR.me/yourname</p>
          </div>
          <p className="mt-3 text-center text-xs text-[#667085]">Example Influencer Card. The portrait changes on each refresh.</p>

          <h2 className="mt-8 font-display text-2xl font-bold text-[#1B1464]">Preview with your social handle</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {SOCIAL_HINTS.map((item) => (
              <Link
                key={item.platform}
                href={claimQuery(item.platform)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
                  platformHint.platform === item.platform
                    ? "bg-[#6D4AFF] text-white ring-[#6D4AFF]"
                    : "bg-white text-[#1B1464] ring-[#E4E9F5]"
                }`}
              >
                <item.Icon size={14} />
                {item.label}
              </Link>
            ))}
          </div>
          <form action={actionCreateDraft} className="mt-4 space-y-3">
            <input type="hidden" name="platform" value={platformHint.platform} />
            {source ? <input type="hidden" name="source" value={source} /> : null}
            {params.utm_source ? <input type="hidden" name="utm_source" value={params.utm_source} /> : null}
            {campaign ? <input type="hidden" name="utm_campaign" value={campaign} /> : null}
            <label className="block text-sm font-semibold text-[#1B1464]">
              Public handle or profile URL
              <input
                name="handle"
                required
                placeholder="@yourhandle"
                className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-3 text-sm font-normal outline-none focus:border-violet"
              />
            </label>
            <button type="submit" className="w-full rounded-xl border border-[#6D4AFF] py-3 text-sm font-semibold text-[#6D4AFF]">
              Preview my card
            </button>
            <p className="text-center text-xs text-[#667085]">Private preview. Your draft carries over when you sign up.</p>
          </form>
          {params.error ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{params.error}</p> : null}
        </div>

        <div>
          <h1 className="font-display text-4xl font-bold text-[#1B1464]">Create your Influrios account</h1>
          <p className="mt-2 text-sm text-[#667085]">Start with email. Connect your socials anytime.</p>
          {account ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-[#1B1464]">
                You are signed in as <strong>{account.email}</strong>.
              </p>
              <Link href="/creator" className="btn-primary inline-flex">
                Go to your dashboard
              </Link>
            </div>
          ) : (
            <form action={actionRegister} className="mt-6 space-y-4">
              <input type="hidden" name="next" value="/creator?welcome=1" />
              <input type="hidden" name="returnTo" value="/claim" />
              <label className="block text-sm font-semibold text-[#1B1464]">
                Name
                <input name="name" required placeholder="e.g., Sofia Carter" className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-3 text-sm font-normal outline-none focus:border-violet" />
              </label>
              <label className="block text-sm font-semibold text-[#1B1464]">
                Email
                <input name="email" type="email" required autoComplete="email" placeholder="you@influrios.com" className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-3 text-sm font-normal outline-none focus:border-violet" />
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
                  </Link>
                  ,{" "}
                  <Link href="/legal/electronic-consent" className="font-semibold text-[#6D4AFF] underline" target="_blank">
                    {consent?.title ?? "User Registration & Electronic Consent Agreement"}
                  </Link>
                  , and{" "}
                  <Link href="/legal/privacy-policy" className="font-semibold text-[#6D4AFF] underline" target="_blank">
                    {privacy?.title ?? "Privacy Policy"}
                  </Link>
                  .
                </span>
              </label>
              <button type="submit" className="w-full rounded-xl bg-[#6D4AFF] py-3 text-sm font-semibold text-white">
                Create my account
              </button>
            </form>
          )}
          <div className="mt-8">
            <h2 className="font-display text-lg font-bold text-[#1B1464]">After signup</h2>
            <ol className="mt-3 grid gap-3 text-sm text-[#667085] sm:grid-cols-3">
              <li><span className="font-semibold text-[#6D4AFF]">1</span> Verify email</li>
              <li><span className="font-semibold text-[#6D4AFF]">2</span> Build your card</li>
              <li><span className="font-semibold text-[#6D4AFF]">3</span> Connect a channel · Optional</li>
            </ol>
            <p className="mt-2 text-xs text-[#667085]">Connect a channel to verify ownership and sync available metrics.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
