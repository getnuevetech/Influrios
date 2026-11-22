/**
 * The visitor's IP address for rate limits and lockouts.
 *
 * nginx sets X-Real-IP from the TCP connection, so the client cannot forge it. X-Forwarded-For
 * is appended to by each proxy: its first entry is whatever the client sent, so only the last
 * entry (added by our own proxy) is trusted when X-Real-IP is missing.
 */
export function clientIpFrom(headers: Pick<Headers, "get">): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 120);
  const forwarded = headers.get("x-forwarded-for");
  const last = forwarded?.split(",").map((part) => part.trim()).filter(Boolean).pop();
  return (last || "unknown").slice(0, 120);
}
