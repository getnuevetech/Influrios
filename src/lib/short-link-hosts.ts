/** Edge-safe host list. Database domains are the source of truth inside the resolver. */
export const DEFAULT_SHORT_HOSTS = ["inflr.me", "www.inflr.me", "links.influrios.com"];

export function shortLinkHosts(): string[] {
  const extra = (process.env.SHORT_LINK_HOSTS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_SHORT_HOSTS, ...extra])];
}

export function isShortLinkHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const name = host.split(":")[0].trim().toLowerCase();
  return shortLinkHosts().includes(name);
}
