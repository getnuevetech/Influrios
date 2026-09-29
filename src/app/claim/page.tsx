import Link from "next/link";
import { actionCreateDraft } from "@/app/claim/actions";

export const metadata = {
  title: "Create Your Influencer Card",
};

type Props = { searchParams: Promise<{ error?: string }> };

export default async function ClaimPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-wider text-violet">
        Phase 8 · Value before signup
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo sm:text-4xl">
        Create your free Influencer Card
      </h1>
      <p className="mt-3 text-muted">
        Start with one social profile URL or handle. We generate a private draft card — then you claim
        it, verify ownership, and publish your Starter card with a shareable link.
      </p>

      {params.error ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {params.error}
        </div>
      ) : null}

      <form action={actionCreateDraft} className="card-surface mt-8 space-y-4 p-6">
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
          No account needed yet. Preview is private until you claim and publish.
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
        Already published?{" "}
        <Link href="/dashboard" className="font-semibold text-violet hover:underline">
          Open creator dashboard
        </Link>
        {" · "}
        <Link href="/discover" className="font-semibold text-violet hover:underline">
          Browse the directory
        </Link>
      </p>
    </div>
  );
}
