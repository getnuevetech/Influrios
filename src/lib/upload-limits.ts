/** Image uploads per draft and per address: 20 in 15 minutes each. Kept in memory per server process. */
const WINDOW_MS = 15 * 60_000;
const MAX_PER_WINDOW = 20;
const buckets = new Map<string, { count: number; start: number }>();

export function allowMediaUpload(keys: string[], now = Date.now()): boolean {
  if (buckets.size > 10_000) buckets.clear();
  const live = keys.filter(Boolean).map((key) => {
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.start > WINDOW_MS) {
      const fresh = { count: 0, start: now };
      buckets.set(key, fresh);
      return fresh;
    }
    return bucket;
  });
  if (live.some((bucket) => bucket.count >= MAX_PER_WINDOW)) return false;
  for (const bucket of live) bucket.count += 1;
  return true;
}
