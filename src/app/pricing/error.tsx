"use client";

export default function PricingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-bold text-indigo">Pricing unavailable</h1>
      <p className="mt-2 text-sm text-muted">
        Something went wrong loading plans.
        {error.message ? ` (${error.message})` : null}
      </p>
      <button type="button" onClick={reset} className="btn-primary mt-6 !px-5 !py-2 text-sm">
        Try again
      </button>
    </div>
  );
}
