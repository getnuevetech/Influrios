import Link from "next/link";
import { actionRegister } from "@/app/account/actions";
import { actionCreateDraft } from "@/app/claim/actions";
import { IconFacebook, IconInstagram, IconTikTok, IconYouTube, IconX } from "@/components/icons";
import { getAccountSession } from "@/lib/accounts";
import { currentLegalDocument } from "@/lib/legal";
import { getSiteConfig } from "@/lib/site-config";

export const metadata = {
  title: "Create Your Influrios Profile",
};

type Props = { searchParams: Promise<{ error?: string; platform?: string; source?: string; utm_source?: string; utm_campaign?: string }> };

const SOCIAL_HINTS = [
  { platform: "instagram", label: "Instagram", Icon: IconInstagram, placeholder: "instagram.com/you" },
  { platform: "tiktok", label: "TikTok", Icon: IconTikTok, placeholder: "tiktok.com/@you" },
  { platform: "youtube", label: "YouTube", Icon: IconYouTube, placeholder: "youtube.com/@you" },
  { platform: "facebook", label: "Facebook", Icon: IconFacebook, placeholder: "facebook.com/you" },
  { platform: "x", label: "X", Icon: IconX, placeholder: "x.com/you" },
] as const;

export default async function ClaimPage({ searchParams }: Props) {
  const params = await searchParams;
  const platformHint = SOCIAL_HINTS.find((item) => item.platform === params.platform) ?? null;
  const source = (params.source || params.utm_source || "").trim();
  const campaign = (params.utm_campaign || "").trim();
  const [account, policy, terms, consent, privacy] = await Promise.all([
    getAccountSession().catch(() => null),
    getSiteConfig(),
    currentLegalDocument("terms-of-service").catch(() => null),
    currentLegalDocument("electronic-consent").catch(() => null),
    currentLegalDocument("privacy-policy").catch(() => null),
  ]);
  const claimQuery = (platform: string) => {
    const query = new URLSearchParams();
    if (platform) query.set("platform", platform);
    if (source) query.set("source", source);
    if (params.utm_source) query.set("utm_source", params.utm_source);
    if (campaign) query.set("utm_campaign", campaign);
    const text = query.toString();
    return text ? `/claim?${text}#preview` : "/claim#preview";
  };
  const loginHref = "/login?next=/creator";

  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-violet">Join as an Influencer</p>
        <Link href={loginHref} className="text-sm font-semibold text-violet hover:underline">
          Already have an account? Log in
        </Link>
      </div>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo sm:text-4xl">
        Create Your Influrios Profile
      </h1>
      <p className="mt-3 text-muted">
        Sign up with your email and build a private profile first. Connect a social account later, when you want a
        verified badge or synced metrics.
      </p>

      {params.error ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {params.error}
        </div>
      ) : null}

      <section className="card-surface mt-6 space-y-4 p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Sign up with email</h2>
        <p className="text-sm text-muted">
          Create your Influrios account and build your profile. You can connect your socials later.
        </p>
        {account ? (
          <div className="space-y-3">
            <p className="text-sm text-indigo">
              You are signed in as <strong>{account.email}</strong>.
            </p>
            <Link href="/creator" className="btn-primary inline-flex">
              Go to your dashboard
            </Link>
          </div>
        ) : (
          <form action={actionRegister} className="space-y-3">
            <input type="hidden" name="next" value="/creator?welcome=1" />
            <label className="block text-sm font-semibold text-indigo">
              Name
              <input name="name" required className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
            </label>
            <label className="block text-sm font-semibold text-indigo">
              Email
              <input name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
            </label>
            <label className="block text-sm font-semibold text-indigo">
              Password
              <input
                name="password"
                type="password"
                required
                minLength={policy.passwordMinLength}
                autoComplete="new-password"
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
              />
            </label>
            <label className="flex items-start gap-2 text-sm text-indigo">
              <input type="checkbox" name="consent" required className="mt-1 accent-[#633CFF]" />
              <span>
                I agree to the{" "}
                <Link href="/legal/terms-of-service" className="font-semibold text-violet underline" target="_blank">
                  {terms?.title ?? "Terms of Service"}
                </Link>{" "}
                and the{" "}
                <Link href="/legal/electronic-consent" className="font-semibold text-violet underline" target="_blank">
                  {consent?.title ?? "electronic consent"}
                </Link>
                , and I acknowledge the{" "}
                <Link href="/legal/privacy-policy" className="font-semibold text-violet underline" target="_blank">
                  {privacy?.title ?? "Privacy Policy"}
                </Link>
                .
              </span>
            </label>
            <button type="submit" className="btn-primary w-full">
              Create my account
            </button>
            <p className="text-center text-sm text-muted">
              Already registered?{" "}
              <Link href={loginHref} className="font-semibold text-violet">
                Log in
              </Link>
            </p>
          </form>
        )}
      </section>

      <section id="preview" className="mt-8">
        <h2 className="font-display text-xl font-bold text-indigo">Preview my Influencer Card</h2>
        <p className="mt-2 text-sm text-muted">
          Choose a platform and enter your public handle to see a private preview. This does not create an account and
          does not verify the channel. If you sign up afterward, the preview is carried into your account.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {SOCIAL_HINTS.map((item) => (
            <Link
              key={item.platform}
              href={claimQuery(item.platform)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
                platformHint?.platform === item.platform
                  ? "bg-violet text-white ring-violet"
                  : "bg-white text-indigo ring-[#E4E9F5] hover:bg-[#F4F7FF]"
              }`}
            >
              <item.Icon size={14} />
              {item.label}
            </Link>
          ))}
        </div>
        {platformHint ? (
          <form action={actionCreateDraft} className="card-surface mt-4 space-y-4 p-6">
            <input type="hidden" name="platform" value={platformHint.platform} />
            {source ? <input type="hidden" name="source" value={source} /> : null}
            {params.utm_source ? <input type="hidden" name="utm_source" value={params.utm_source} /> : null}
            {campaign ? <input type="hidden" name="utm_campaign" value={campaign} /> : null}
            <label className="block text-sm font-semibold text-indigo">
              {platformHint.label} profile URL or handle
              <input
                name="handle"
                required
                placeholder={platformHint.placeholder}
                className="mt-2 w-full rounded-xl border border-border px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-violet"
              />
            </label>
            <p className="text-xs text-muted">
              The preview keeps this handle as an unverified link. A profile image is added when it can be resolved.
              Follower counts stay empty until a network sync succeeds.
            </p>
            <button type="submit" className="btn-secondary w-full">
              Preview my Influencer Card →
            </button>
          </form>
        ) : (
          <p className="card-surface mt-4 p-6 text-sm text-muted">Choose a platform, then enter the profile URL or handle.</p>
        )}
      </section>

      <ol className="mt-8 space-y-3 text-sm text-muted">
        <li>
          <strong className="text-indigo">1. Create an account</strong> — sign up with email and verify that address. This confirms access to Influrios, not a social channel.
        </li>
        <li>
          <strong className="text-indigo">2. Build your card</strong> — edit a private profile before connecting a social account. A handle preview is optional.
        </li>
        <li>
          <strong className="text-indigo">3. Publish</strong> — a Starter card needs a verified email plus a bio, location, and specialty. Handles you type stay labeled unverified.
        </li>
        <li>
          <strong className="text-indigo">4. Verify a channel</strong> — prove control of a social account before Influrios shows a verified badge or synced metrics.
        </li>
      </ol>
    </div>
  );
}
