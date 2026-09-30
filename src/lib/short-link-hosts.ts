/** Edge-safe host list. Database domains are the source of truth inside the resolver. */
export const DEFAULT_SHORT_HOSTS = ["inflr.me", "www.inflr.me", "links.influrios.com"];

export function shortLinkHosts(): string[] {
  const extra = (process.env.SHORT_LINK_HOSTS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_SHORT_HOSTS, ...extra])];
}

/**
 * First forwarded value, without a trailing dot or port.
 * "inflr.me, inflr.me" and "INFLR.ME:443" both become "inflr.me".
 */
export function normalizeShortHost(host: string | null | undefined): string {
  if (!host) return "";
  const first = host.split(",")[0]?.trim().toLowerCase() ?? "";
  const withoutDot = first.endsWith(".") ? first.slice(0, -1) : first;
  if (withoutDot.startsWith("[")) {
    const end = withoutDot.indexOf("]");
    return end === -1 ? withoutDot : withoutDot.slice(0, end + 1);
  }
  return withoutDot.split(":")[0].trim();
}

export function isShortLinkHost(host: string | null | undefined): boolean {
  const name = normalizeShortHost(host);
  if (!name) return false;
  return shortLinkHosts().includes(name);
}
