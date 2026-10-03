import Link from "next/link";
import { actionCreateDraft } from "@/app/claim/actions";
import { IconInstagram, IconTikTok, IconYouTube, IconX } from "@/components/icons";

export const metadata = {
  title: "Create Your Influrios Profile",
};

type Props = { searchParams: Promise<{ error?: string; platform?: string }> };

const SOCIAL_HINTS = [
  { platform: "instagram", label: "Instagram", Icon: IconInstagram, placeholder: "instagram.com/you" },
  { platform: "tiktok", label: "TikTok", Icon: IconTikTok, placeholder: "tiktok.com/@you" },
  { platform: "youtube", label: "YouTube", Icon: IconYouTube, placeholder: "youtube.com/@you" },
  { platform: "x", label: "X", Icon: IconX, placeholder: "x.com/you" },
] as const;

export default async function ClaimPage({ searchParams }: Props) {
  const params = await searchParams;
  const platformHint = SOCIAL_HINTS.find((item) => item.platform === params.platform) ?? SOCIAL_HINTS[0];

  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-wider text-violet">Join as an Influencer</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo sm:text-4xl">
        Create Your Influrios Profile
      </h1>
      <p className="mt-3 text-muted">
        Your social platforms are where you create influence. Influrios is where that influence becomes
        discoverable, collaborative, and commercially useful — without rebuilding your audience here.
      </p>

      {params.error ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {params.error}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        {SOCIAL_HINTS.map((item) => (
          <Link
            key={item.platform}
            href={`/claim?platform=${item.platform}`}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
              platformHint.platform === item.platform
                ? "bg-violet text-white ring-violet"
                : "bg-white text-indigo ring-[#E4E9F5] hover:bg-[#F4F7FF]"
            }`}
          >
            <item.Icon size={14} />
            {item.label}
          </Link>
        ))}
      </div>

      <form action={actionCreateDraft} className="card-surface mt-6 space-y-4 p-6">
        <input type="hidden" name="platform" value={platformHint.platform} />
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
          We build a private temporary Influencer Card from your social presence — including your profile
          image when we can resolve it. Preview is private until you claim and publish.
        </p>
        <button type="submit" className="btn-primary w-full">
          Preview my Influencer Card →
        </button>
      </form>

      <ol className="mt-8 space-y-3 text-sm text-muted">
        <li>
          <strong className="text-indigo">1. Preview</strong> — see a full temporary card before registering
        </li>
        <li>
          <strong className="text-indigo">2. Claim</strong> — create your Influrios account and take ownership
        </li>
        <li>
          <strong className="text-indigo">3. Verify</strong> — prove control of at least one social channel
        </li>
        <li>
          <strong className="text-indigo">4. Publish</strong> — live Starter card + shareable URL on day one
        </li>
      </ol>

      <p className="mt-8 text-center text-sm">
        Already published?{" "}
        <Link href="/dashboard" className="font-semibold text-violet hover:underline">
          Open influencer dashboard
        </Link>
        {" · "}
        <Link href="/discover" className="font-semibold text-violet hover:underline">
          Find Influencers
        </Link>
      </p>
    </div>
  );
}
