import Link from "next/link";

export const metadata = { title: "Page not found" };

/** Branded 404 with the ways forward a visitor most likely wants. */
export default function NotFound() {
  return (
    <div className="bg-[#F7FAFF]">
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet">404</p>
        <h1 className="mt-3 font-display text-4xl font-bold text-indigo sm:text-5xl">We couldn&apos;t find that page</h1>
        <p className="mt-4 text-muted">
          The link may be old, or the profile may no longer be published. Try searching for the influencer or business you were
          looking for.
        </p>
        <form action="/discover" className="mt-8 flex w-full max-w-lg gap-2">
          <input
            name="q"
            placeholder="Search influencers by name, specialty or location"
            className="h-12 min-w-0 flex-1 rounded-full border border-border bg-white px-5 text-sm text-indigo outline-none focus:border-violet"
          />
          <button type="submit" className="btn-primary h-12 !px-5">
            Search
          </button>
        </form>
        <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm font-semibold">
          <Link href="/" className="rounded-full border border-border bg-white px-4 py-2.5 text-indigo hover:border-violet">
            Home
          </Link>
          <Link href="/discover" className="rounded-full border border-border bg-white px-4 py-2.5 text-indigo hover:border-violet">
            Discover influencers
          </Link>
          <Link href="/support" className="rounded-full border border-border bg-white px-4 py-2.5 text-indigo hover:border-violet">
            Contact support
          </Link>
        </div>
      </div>
    </div>
  );
}
