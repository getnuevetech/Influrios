"use client";

function discoverErrorMessage(error: Error) {
  const text = error.message || "";
  if (/Nothing was searched|Meilisearch/i.test(text)) return text;
  return "The directory could not be read.";
}

export default function DiscoverError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-bold text-indigo">Discover unavailable</h1>
      <p className="mt-2 text-sm text-muted">
        Something went wrong loading creators. {discoverErrorMessage(error)}
      </p>
      <button type="button" onClick={reset} className="btn-primary mt-6 !px-5 !py-2 text-sm">
        Try again
      </button>
    </div>
  );
}
