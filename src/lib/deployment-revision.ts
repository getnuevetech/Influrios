/** Git SHA baked into the image at deploy time. Never guessed from the request. */
const REVISION = /^[0-9a-f]{7,40}$/;

export function readDeploymentRevision(value: string | undefined | null): string | null {
  const raw = (value ?? "").trim().toLowerCase();
  if (!REVISION.test(raw)) return null;
  return raw;
}
