"use client";

export default function CollaborationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-bold text-indigo">Collaboration unavailable</h1>
      <p className="mt-2 text-sm text-muted">
        Collaboration data is unavailable. This is not an empty list.
        {error.digest ? ` Reference ${error.digest}.` : null}
      </p>
      <button type="button" onClick={reset} className="btn-primary mt-6 !px-5 !py-2 text-sm">
        Retry
      </button>
    </div>
  );
}
