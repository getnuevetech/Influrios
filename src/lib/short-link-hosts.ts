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

/** Set on the rewritten request. Node route handlers do not see query params added by a rewrite. */
export const SHORT_RESOLVE_HOST_HEADER = "x-influrios-short-host";
export const SHORT_RESOLVE_PATH_HEADER = "x-influrios-short-path";

/**
 * Rewrite target for a short-link visit.
 * The handle lives in the pathname (`/api/short/resolve/ag`) because a Node
 * route handler drops search params that middleware adds (Next.js #64776).
 * Query-only rewrites made every inflr.me/{handle} render the root page.
 */
export function shortResolveRewriteTarget(pathname: string): string {
  const clean = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (clean === "/api/short/resolve" || clean.startsWith("/api/short/resolve/")) return clean;
  if (clean === "/") return "/api/short/resolve";
  return `/api/short/resolve${clean}`;
}

/** Path the resolver should open. Dynamic segments win, then the middleware header, then a direct query. */
export function shortResolvePath(input: {
  parts?: string[] | null;
  headerPath?: string | null;
  queryPath?: string | null;
}): string {
  if (input.parts?.length) return `/${input.parts.join("/")}`;
  const header = (input.headerPath ?? "").trim();
  if (header.startsWith("/")) return header.split("?")[0] || "/";
  const query = (input.queryPath ?? "").trim();
  if (query.startsWith("/")) return query.split("?")[0] || "/";
  return "/";
}

export function shortResolveHost(input: {
  headerHost?: string | null;
  queryHost?: string | null;
  requestHost?: string | null;
}): string {
  const hinted = input.headerHost || input.queryHost || "";
  if (isShortLinkHost(hinted)) return normalizeShortHost(hinted);
  return input.requestHost || "";
}
