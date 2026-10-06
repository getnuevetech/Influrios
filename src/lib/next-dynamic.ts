/**
 * `connection()` throws a digest error so Next can skip static prerender.
 * A bare catch around that call swallows the signal, then a database read
 * runs during `docker build` (no Postgres) and fails the image.
 */
export function rethrowIfNextDynamicError(error: unknown): void {
  if (!error || typeof error !== "object" || !("digest" in error)) return;
  if (typeof error.digest === "string" && error.digest.length > 0) throw error;
}
