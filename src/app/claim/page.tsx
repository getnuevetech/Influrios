import Link from "next/link";

export const metadata = {
  title: "Create Your Influencer Card",
};

export default function ClaimPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-wider text-violet">Value before signup</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo sm:text-4xl">
        Create your free Influencer Card
      </h1>
      <p className="mt-3 text-muted">
        Start with one social profile URL or handle. We generate a private draft card — then you claim
        it, verify ownership, and publish your Starter card with a shareable link.
      </p>

      <form action="/c/sofia-martinez" className="card-surface mt-8 space-y-4 p-6">
        <label className="block text-sm font-semibold text-indigo">
          Social profile URL or handle
          <input
            name="handle"
            required
            placeholder="instagram.com/you or @you"
            className="mt-2 w-full rounded-xl border border-border px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-violet"
          />
        </label>
        <p className="text-xs text-muted">
          Phase 1 preview: draft generation is stubbed. Submitting opens a sample Starter/Plus card
          experience while auth and verification land next.
        </p>
        <button type="submit" className="btn-primary w-full">
          Preview my card →
        </button>
      </form>

      <ol className="mt-8 space-y-3 text-sm text-muted">
        <li>
          <strong className="text-indigo">1. Preview</strong> — see a draft card before registering
        </li>
        <li>
          <strong className="text-indigo">2. Claim</strong> — create your account and take ownership
        </li>
        <li>
          <strong className="text-indigo">3. Verify</strong> — prove control of at least one channel
        </li>
        <li>
          <strong className="text-indigo">4. Publish</strong> — live Starter card + shareable URL on day one
        </li>
      </ol>

      <p className="mt-8 text-center text-sm">
        Already have a profile?{" "}
        <Link href="/discover" className="font-semibold text-violet hover:underline">
          Browse the directory
        </Link>
      </p>
    </div>
  );
}
