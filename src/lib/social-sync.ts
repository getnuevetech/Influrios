import { createHash, randomBytes } from "crypto";
import { formatFollowers } from "@/lib/seed-data";

/** Current Meta Graph API version used for Instagram / Facebook defaults. */
export const META_GRAPH_VERSION = "v22.0";

/**
 * TikTok `/v2/user/info/` requires `fields`. Limited to scopes we request:
 * user.info.basic (open_id, avatar_url, display_name) + user.info.stats (counts).
 * Do not request username/bio/profile links — those need user.info.profile.
 */
export const TIKTOK_USER_INFO_FIELDS =
  "open_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count";

/** Official authorize and API hosts. Admin URLs must stay on these. */
export const SOCIAL_NETWORKS = [
  {
    code: "instagram",
    platform: "INSTAGRAM",
    name: "Instagram",
    clientIdParam: "client_id",
    tokenStyle: "form" as const,
    /** Endpoints + scopes are code-owned so Admin cannot break Meta OAuth with freeform values. */
    locksOAuthEndpoints: true,
    /**
     * Newer Meta apps have no Instagram App ID (“API setup with Instagram login is not available”).
     * Those apps must use Facebook Login for Business / Unified Login with config_id.
     */
    supportsConfigId: true,
    authorizeHosts: ["www.instagram.com", "api.instagram.com", "www.facebook.com"],
    apiHosts: ["api.instagram.com", "graph.instagram.com", "graph.facebook.com"],
    // Default path: Instagram Login (requires Instagram App ID — not the Meta App ID).
    authorizeUrl: "https://www.instagram.com/oauth/authorize",
    tokenUrl: "https://api.instagram.com/oauth/access_token",
    profileUrl: `https://graph.instagram.com/${META_GRAPH_VERSION}/me?fields=user_id,username,name,account_type,followers_count,media_count`,
    scopes: "instagram_business_basic",
    configPermissions: "instagram_basic,instagram_manage_insights",
  },
  {
    code: "tiktok",
    platform: "TIKTOK",
    name: "TikTok",
    clientIdParam: "client_key",
    tokenStyle: "form" as const,
    locksOAuthEndpoints: true,
    supportsConfigId: false,
    authorizeHosts: ["www.tiktok.com"],
    apiHosts: ["open.tiktokapis.com"],
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    // fields is required by TikTok; keep to user.info.basic + user.info.stats (no user.info.profile).
    profileUrl: `https://open.tiktokapis.com/v2/user/info/?fields=${TIKTOK_USER_INFO_FIELDS}`,
    scopes: "user.info.basic,user.info.stats",
    configPermissions: "user.info.basic,user.info.stats",
  },
  {
    code: "youtube",
    platform: "YOUTUBE",
    name: "YouTube",
    clientIdParam: "client_id",
    tokenStyle: "form" as const,
    locksOAuthEndpoints: true,
    supportsConfigId: false,
    authorizeHosts: ["accounts.google.com"],
    apiHosts: ["oauth2.googleapis.com", "www.googleapis.com"],
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    // channels.list requires part + mine (or id). Bare /channels returns HTTP 400.
    profileUrl: "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    scopes: "https://www.googleapis.com/auth/youtube.readonly",
    configPermissions: "https://www.googleapis.com/auth/youtube.readonly",
  },
  {
    code: "x",
    platform: "X",
    name: "X",
    clientIdParam: "client_id",
    tokenStyle: "form" as const,
    locksOAuthEndpoints: true,
    supportsConfigId: false,
    authorizeHosts: ["twitter.com", "x.com"],
    apiHosts: ["api.twitter.com", "api.x.com"],
    authorizeUrl: "https://x.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    profileUrl: "https://api.twitter.com/2/users/me?user.fields=public_metrics,username,name",
    scopes: "users.read tweet.read",
    configPermissions: "users.read tweet.read",
  },
  {
    code: "facebook",
    platform: "FACEBOOK",
    name: "Facebook",
    clientIdParam: "client_id",
    tokenStyle: "form" as const,
    locksOAuthEndpoints: true,
    /** Newer Meta apps use Facebook Login for Business + config_id instead of freeform scope=. */
    supportsConfigId: true,
    authorizeHosts: ["www.facebook.com"],
    apiHosts: ["graph.facebook.com"],
    authorizeUrl: `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
    // Personal /me never returns audience counts. Page list + fields is required.
    profileUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?fields=id,name,username,followers_count,fan_count`,
    // Classic Facebook Login fallback only. Prefer Admin → Facebook Login config_id for Business apps.
    scopes: "public_profile,pages_show_list,pages_read_engagement",
    configPermissions: "pages_show_list,pages_read_engagement",
  },
  {
    code: "linkedin",
    platform: "LINKEDIN",
    name: "LinkedIn",
    clientIdParam: "client_id",
    tokenStyle: "form" as const,
    locksOAuthEndpoints: true,
    supportsConfigId: false,
    authorizeHosts: ["www.linkedin.com"],
    apiHosts: ["api.linkedin.com", "www.linkedin.com"],
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    profileUrl: "https://api.linkedin.com/v2/userinfo",
    scopes: "openid profile",
    configPermissions: "openid profile",
  },
  {
    code: "pinterest",
    platform: "PINTEREST",
    name: "Pinterest",
    clientIdParam: "client_id",
    tokenStyle: "form" as const,
    locksOAuthEndpoints: true,
    supportsConfigId: false,
    authorizeHosts: ["www.pinterest.com"],
    apiHosts: ["api.pinterest.com"],
    authorizeUrl: "https://www.pinterest.com/oauth/",
    tokenUrl: "https://api.pinterest.com/v5/oauth/token",
    profileUrl: "https://api.pinterest.com/v5/user_account",
    scopes: "user_accounts:read",
    configPermissions: "user_accounts:read",
  },
] as const;

export type SocialNetworkCode = (typeof SOCIAL_NETWORKS)[number]["code"];
export type SocialSyncPlatform = (typeof SOCIAL_NETWORKS)[number]["platform"];

export type SocialMetricLabels = {
  primary: string;
  secondary: string;
};

/** Customer-facing labels for the two stored counters (followers / likes columns). */
export function socialMetricLabels(platform: string | null | undefined): SocialMetricLabels {
  const key = (platform ?? "").toUpperCase();
  if (key === "YOUTUBE") return { primary: "subscribers", secondary: "views" };
  if (key === "FACEBOOK") return { primary: "followers", secondary: "Page likes" };
  if (key === "INSTAGRAM") return { primary: "followers", secondary: "posts" };
  if (key === "TIKTOK") return { primary: "followers", secondary: "likes" };
  return { primary: "followers", secondary: "likes" };
}

export type SocialIdentity = {
  handle: string | null;
  externalId: string | null;
};

export type SocialAudienceMetrics = {
  /** Stored in SocialAccount.followers */
  primary: number;
  /** Stored in SocialAccount.likes when the platform exposes a second counter */
  secondary: number | null;
};

/**
 * Result of a platform profile fetch after OAuth.
 * Connection can succeed with identity (or even token-only + notice) without full metrics.
 */
export type SocialProfileResult = {
  identity: SocialIdentity | null;
  metrics: SocialAudienceMetrics | null;
  /** Soft customer message — does not mark the connection as failed. */
  metricsNotice: string | null;
};

const FOLLOWER_KEYS = ["followers", "follower_count", "followers_count", "subscribercount", "subscriber_count"];
const LIKE_KEYS = ["likes", "like_count", "likes_count", "total_likes", "like_total", "fan_count", "media_count"];

/** Legacy Admin → Social Facebook rows that cannot sync audience counts. */
export const FACEBOOK_WEAK_SCOPES = new Set(["", "public_profile"]);
export const FACEBOOK_WEAK_PROFILE_PATHS = new Set(["/me", "/v21.0/me", "/v22.0/me"]);

/** Legacy Instagram Admin rows that used Facebook Login instead of Instagram Login. */
export const INSTAGRAM_WEAK_SCOPES = new Set([
  "",
  "instagram_basic",
  "instagram_basic,pages_show_list",
  "instagram_basic,pages_show_list,pages_read_engagement",
]);

/**
 * Decoded TikTok redirect_uri.
 * Login Kit Web (August 4, 2026) registers the callback with a trailing slash.
 * The no-slash form is the same path and is sent with the slash.
 * www is rewritten to the canonical host. Any other host is dropped so an old
 * deployment URL cannot be sent. A different path on this site is kept as saved.
 */
export function tiktokRedirectUri(canonical: string, override?: string | null) {
  const base = exactOAuthRedirect(canonical) ?? canonical.trim().replace(/\/$/, "");
  let canonicalUrl: URL;
  try {
    canonicalUrl = new URL(base);
  } catch {
    return base.endsWith("/") ? base : `${base}/`;
  }
  const canonicalPath = canonicalUrl.pathname.replace(/\/+$/, "") || "/";
  const slashed = `${canonicalUrl.origin}${canonicalPath}/`;
  const saved = exactOAuthRedirect(override ?? "") ?? "";
  if (!saved) return slashed;
  let savedUrl: URL;
  try {
    savedUrl = new URL(saved);
  } catch {
    return slashed;
  }
  const host = savedUrl.hostname.toLowerCase();
  const canonicalHost = canonicalUrl.hostname.toLowerCase();
  const sameSite = host === canonicalHost || host === `www.${canonicalHost}` || canonicalHost === `www.${host}`;
  // TikTok's authorize page is not a callback. A saved copy of it must not be sent.
  if (!sameSite || host.endsWith("tiktok.com") || savedUrl.pathname.includes("/v2/auth/authorize")) return slashed;
  const savedPath = savedUrl.pathname.replace(/\/+$/, "") || "/";
  if (savedPath !== canonicalPath) return `${canonicalUrl.origin}${savedUrl.pathname}`;
  return slashed;
}

/** True when the decoded redirect_uri is Influrios's callback, not TikTok's authorize page. */
export function isInfluriosOAuthCallback(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.search || url.hash) return false;
    const host = url.hostname.toLowerCase();
    if (!host || host === "tiktok.com" || host.endsWith(".tiktok.com")) return false;
    if (url.pathname.includes("/v2/auth/authorize")) return false;
    return url.pathname.replace(/\/+$/, "").endsWith("/api/social/callback");
  } catch {
    return false;
  }
}

/**
 * First URL the browser should open on TikTok. Built with URL and URLSearchParams
 * so the query always starts with "?" and each value is encoded once.
 */
export function describeTikTokAuthorizeUrl(authorizeUrl: string) {
  const questionMarks = authorizeUrl.split("?").length - 1;
  let parsed: URL;
  try {
    parsed = new URL(authorizeUrl);
  } catch {
    return { ok: false as const, error: "The TikTok authorize URL could not be parsed." };
  }
  const redirectUri = parsed.searchParams.get("redirect_uri") ?? "";
  const missing = ["client_key", "response_type", "scope", "redirect_uri", "state"].filter(
    (key) => !parsed.searchParams.get(key),
  );
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "www.tiktok.com" ||
    parsed.pathname !== "/v2/auth/authorize/" ||
    questionMarks !== 1 ||
    !authorizeUrl.includes("?") ||
    missing.length ||
    parsed.searchParams.get("response_type") !== "code" ||
    !isInfluriosOAuthCallback(redirectUri)
  ) {
    return {
      ok: false as const,
      error: "TikTok authorize URL is incomplete. Influrios did not open TikTok.",
      redirectUri,
      missing,
    };
  }
  // Keep the original string. URL#toString encodes scope commas as %2C, and TikTok then reports redirect_uri.
  return { ok: true as const, redirectUri, url: authorizeUrl };
}

/** One navigation. The repeated TikTok &error=&logid= loop is not produced here. */
export function providerLaunchDocument(authorizeUrl: string) {
  const scriptUrl = JSON.stringify(authorizeUrl).replace(/</g, "\\u003c");
  const href = authorizeUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  let callback = "";
  try {
    callback = new URL(authorizeUrl).searchParams.get("redirect_uri") ?? "";
  } catch {
    callback = "";
  }
  const callbackText = callback.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Continue to the network</title>
</head>
<body>
<p>Influrios opens the network login once and does not retry.</p>
${callbackText ? `<p>Callback: ${callbackText}</p>` : ""}
<p><a href="${href}">Continue</a></p>
<script>location.replace(${scriptUrl});</script>
</body>
</html>`;
}

/** https callback with no query or hash. A trailing slash is kept when the portal saved one. */
export function exactOAuthRedirect(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    if (url.search || url.hash || url.username || url.password) return null;
    if (!url.pathname || url.pathname === "/") return null;
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

export type OAuthAuthorizeReport = {
  authorizeHost: string;
  redirectUri: string;
  redirectEncoding: "missing" | "raw" | "once" | "double";
  scope: string;
  scopeParam: string;
  codeChallenge: boolean;
  codeChallengeMethod: string | null;
  responseType: string | null;
  statePresent: boolean;
  clientIdLength: number;
  clientIdPrefix: string;
};

function rawQueryValue(query: string, key: string) {
  const part = query.split("&").find((item) => item.startsWith(`${key}=`));
  return part ? part.slice(key.length + 1) : "";
}

/** Safe description of an authorize URL. Omits the client id, state, and PKCE verifier. */
export function reportAuthorizeUrl(authorizeUrl: string, clientIdParam: string): OAuthAuthorizeReport {
  const url = new URL(authorizeUrl);
  const query = url.search.startsWith("?") ? url.search.slice(1) : url.search;
  const rawRedirect = rawQueryValue(query, "redirect_uri");
  const redirectEncoding = !rawRedirect
    ? "missing"
    : rawRedirect.includes("%253A") || rawRedirect.includes("%252F")
      ? "double"
      : rawRedirect.includes("%3A") || rawRedirect.includes("%2F")
        ? "once"
        : "raw";
  const clientId = url.searchParams.get(clientIdParam) ?? "";
  return {
    authorizeHost: url.hostname,
    redirectUri: url.searchParams.get("redirect_uri") ?? "",
    redirectEncoding,
    scope: url.searchParams.get("scope") ?? "",
    scopeParam: rawQueryValue(query, "scope"),
    codeChallenge: Boolean(url.searchParams.get("code_challenge")),
    codeChallengeMethod: url.searchParams.get("code_challenge_method"),
    responseType: url.searchParams.get("response_type"),
    statePresent: Boolean(url.searchParams.get("state")),
    clientIdLength: clientId.length,
    clientIdPrefix: clientId.slice(0, 4),
  };
}

export function formatAuthorizeReport(report: OAuthAuthorizeReport) {
  return [
    "Last authorize request",
    `host=${report.authorizeHost}`,
    `redirect_uri=${report.redirectUri}`,
    `redirect_encoding=${report.redirectEncoding}`,
    `scope=${report.scope}`,
    `scope_param=${report.scopeParam}`,
    `code_challenge=${report.codeChallenge ? "yes" : "no"}`,
    report.codeChallengeMethod ? `code_challenge_method=${report.codeChallengeMethod}` : "",
    `response_type=${report.responseType ?? ""}`,
    `state=${report.statePresent ? "yes" : "no"}`,
    `client_id_length=${report.clientIdLength}`,
    `client_id_prefix=${report.clientIdPrefix}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Same request the connect button sends, with secrets reduced to a length and a 4-character prefix. */
export function providerAuthorizePreview(input: {
  code: string;
  authorizeUrl: string;
  authorizeHosts: readonly string[];
  clientIdParam: string;
  clientId: string;
  redirectUri: string;
  scopes: string;
}) {
  if (input.code !== "tiktok" && input.code !== "x") return null;
  if (!input.clientId.trim()) return null;
  const url = buildAuthorizeUrl({
    authorizeUrl: input.authorizeUrl,
    authorizeHosts: input.authorizeHosts,
    clientIdParam: input.clientIdParam,
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    state: "preview",
    scopes: input.scopes,
    tiktokQuery: input.code === "tiktok",
    scopeSpaces: input.code === "x" ? "percent" : undefined,
    extraParams: input.code === "x" ? { code_challenge: "preview", code_challenge_method: "S256" } : undefined,
  });
  if (!url) return null;
  return formatAuthorizeReport(reportAuthorizeUrl(url, input.clientIdParam));
}

/** X OAuth 2.0 requires S256 PKCE. The verifier stays on the server; only the challenge is sent. */
export function createXPkce(verifier = randomBytes(32).toString("base64url")) {
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge, method: "S256" as const };
}

export function socialNetwork(codeOrPlatform: string) {
  const key = codeOrPlatform.trim().toLowerCase();
  return (
    SOCIAL_NETWORKS.find((network) => network.code === key || network.platform.toLowerCase() === key) ?? null
  );
}

export function socialHostAllowed(rawUrl: string, hosts: readonly string[]) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && hosts.includes(url.hostname);
  } catch {
    return false;
  }
}

export function socialConnectGate(input: {
  accepted: boolean;
  acceptedVersion: string | null;
  currentVersion: string;
  providerReady: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (!input.accepted || !input.acceptedVersion || input.acceptedVersion !== input.currentVersion) {
    return {
      ok: false,
      error: "Agree to the current Influrios social integration terms and policy before connecting.",
    };
  }
  if (!input.providerReady) {
    return {
      ok: false,
      error: "This network is not connected yet. An admin has to enable it and save the API secret.",
    };
  }
  return { ok: true };
}

/** Live audience requires a confirmed primary count. Secondary is platform-specific and optional. */
export function isLiveSocialAccount(row: {
  source: string;
  refreshedAt: Date | string | null;
  followers: number | null;
  likes?: number | null;
}) {
  return (
    row.source === "PROVIDER_SYNCED" &&
    row.refreshedAt != null &&
    typeof row.followers === "number" &&
    row.followers >= 0
  );
}

/** A network @username. Display names and claim copies with spaces are not handles. */
export function isProviderUsername(handle: string | null | undefined): boolean {
  const name = (handle ?? "").trim().replace(/^@/, "");
  if (!name || /\s/.test(name)) return false;
  return /^[A-Za-z0-9._]{1,64}$/.test(name);
}

export function syncedFollowerTotal(
  socials: ReadonlyArray<{ followers?: number | null; source?: string | null; refreshedAt?: string | Date | null }>,
) {
  return socials.reduce((sum, social) => {
    if (
      !isLiveSocialAccount({
        source: social.source ?? "",
        refreshedAt: social.refreshedAt ?? null,
        followers: social.followers ?? null,
      })
    ) {
      return sum;
    }
    return sum + (social.followers ?? 0);
  }, 0);
}

export function socialAudienceLabel(
  social: { followers: number; likes?: number | null; live?: boolean; platform?: string } | null | undefined,
  options?: { withLikes?: boolean },
) {
  if (!social?.live) return "Not synced";
  const labels = socialMetricLabels(social.platform);
  if (options?.withLikes && social.likes != null) {
    return `${formatFollowers(social.followers)} ${labels.primary} · ${formatFollowers(social.likes)} ${labels.secondary}`;
  }
  return `${formatFollowers(social.followers)} ${labels.primary}`;
}

function asCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.round(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function readCount(record: Record<string, unknown>, keys: string[]) {
  for (const [key, value] of Object.entries(record)) {
    if (keys.includes(key.toLowerCase())) {
      const count = asCount(value);
      if (count != null) return count;
    }
  }
  return null;
}

function walk(value: unknown, depth: number): { followers: number | null; likes: number | null } {
  if (!value || typeof value !== "object" || depth > 4) return { followers: null, likes: null };
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = walk(item, depth + 1);
      if (found.followers != null) return found;
    }
    return { followers: null, likes: null };
  }
  const record = value as Record<string, unknown>;
  let followers = readCount(record, FOLLOWER_KEYS);
  let likes = readCount(record, LIKE_KEYS);
  for (const child of Object.values(record)) {
    if (!child || typeof child !== "object") continue;
    const nested = walk(child, depth + 1);
    followers = followers ?? nested.followers;
    likes = likes ?? nested.likes;
  }
  return { followers, likes };
}

/** Generic fallback: primary audience required; secondary optional. */
export function parseSocialMetrics(payload: unknown): { followers: number; likes: number | null } | null {
  const found = walk(payload, 0);
  if (found.followers == null) return null;
  return { followers: found.followers, likes: found.likes };
}

/**
 * TikTok Login Kit `/v2/user/info/` — identity from display_name/open_id;
 * metrics from follower_count + likes_count (user.info.stats).
 */
export function parseTikTokUserInfo(payload: unknown): {
  identity: SocialIdentity | null;
  metrics: SocialAudienceMetrics | null;
} | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const root = payload as { data?: unknown; error?: unknown };
  const err = root.error;
  if (err && typeof err === "object" && !Array.isArray(err)) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string" && code && code.toLowerCase() !== "ok") return null;
  }
  const data = root.data;
  const user =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as { user?: unknown }).user
      : null;
  if (!user || typeof user !== "object" || Array.isArray(user)) return null;
  const record = user as {
    open_id?: unknown;
    display_name?: unknown;
    follower_count?: unknown;
    likes_count?: unknown;
  };
  const displayName = typeof record.display_name === "string" ? record.display_name.trim() : "";
  const openId = typeof record.open_id === "string" ? record.open_id.trim() : "";
  const handle = displayName || null;
  const externalId = openId || null;
  if (!handle && !externalId) return null;
  const followers = asCount(record.follower_count);
  const likes = asCount(record.likes_count);
  return {
    identity: { handle, externalId },
    metrics: followers != null ? { primary: followers, secondary: likes } : null,
  };
}

/**
 * YouTube channels.list — identity from snippet; metrics are subscribers + views
 * (views stored in the likes column, labeled "views" in the UI).
 */
export function parseYoutubeChannelMetrics(payload: unknown): {
  identity: SocialIdentity;
  metrics: SocialAudienceMetrics | null;
  emptyChannel: boolean;
} | null {
  if (!payload || typeof payload !== "object") return null;
  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  if (items.length === 0) {
    return {
      identity: { handle: null, externalId: null },
      metrics: null,
      emptyChannel: true,
    };
  }
  const channel = items[0];
  if (!channel || typeof channel !== "object") return null;
  const record = channel as {
    id?: unknown;
    snippet?: { title?: unknown; customUrl?: unknown };
    statistics?: { subscriberCount?: unknown; viewCount?: unknown; videoCount?: unknown };
  };
  const customUrl = typeof record.snippet?.customUrl === "string" ? record.snippet.customUrl.trim() : "";
  const handle = customUrl.replace(/^@/, "") || null;
  const externalId = typeof record.id === "string" && record.id.trim() ? record.id.trim() : null;
  const subscribers = asCount(record.statistics?.subscriberCount);
  const views = asCount(record.statistics?.viewCount);
  const metrics =
    subscribers != null ? { primary: subscribers, secondary: views } : null;
  return {
    identity: { handle, externalId },
    metrics,
    emptyChannel: false,
  };
}

/**
 * Facebook Page list from /me/accounts.
 * Personal profiles are not eligible for audience sync.
 */
export function parseFacebookPageMetrics(payload: unknown): {
  identity: SocialIdentity | null;
  metrics: SocialAudienceMetrics | null;
  emptyPages: boolean;
} | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  if (data.length === 0) {
    return { identity: null, metrics: null, emptyPages: true };
  }
  for (const page of data) {
    if (!page || typeof page !== "object" || Array.isArray(page)) continue;
    const record = page as {
      id?: unknown;
      name?: unknown;
      username?: unknown;
      followers_count?: unknown;
      fan_count?: unknown;
    };
    const username = typeof record.username === "string" ? record.username.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const handle = (username || name || "").replace(/^@/, "") || null;
    const externalId = typeof record.id === "string" && record.id.trim() ? record.id.trim() : null;
    if (!handle && !externalId) continue;
    const followersCount = asCount(record.followers_count);
    const fanCount = asCount(record.fan_count);
    const primary = followersCount ?? fanCount;
    const secondary = fanCount ?? null;
    return {
      identity: { handle, externalId },
      metrics: primary != null ? { primary, secondary } : null,
      emptyPages: false,
    };
  }
  return { identity: null, metrics: null, emptyPages: false };
}

/**
 * Instagram Login `/me` payload (graph.instagram.com) for Professional accounts.
 * Prefer this over the legacy Facebook Page → instagram_business_account walk.
 */
export function parseInstagramLoginProfile(payload: unknown): {
  identity: SocialIdentity | null;
  metrics: SocialAudienceMetrics | null;
} | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as {
    user_id?: unknown;
    id?: unknown;
    username?: unknown;
    name?: unknown;
    followers_count?: unknown;
    media_count?: unknown;
    error?: unknown;
  };
  if (record.error) return null;
  const username = typeof record.username === "string" ? record.username.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const handle = (username || name || "").replace(/^@/, "") || null;
  const rawId = record.user_id ?? record.id;
  const externalId =
    typeof rawId === "string" && rawId.trim()
      ? rawId.trim()
      : typeof rawId === "number" && Number.isFinite(rawId)
        ? String(rawId)
        : null;
  if (!handle && !externalId) return null;
  const followers = asCount(record.followers_count);
  const media = asCount(record.media_count);
  return {
    identity: { handle, externalId },
    metrics: followers != null ? { primary: followers, secondary: media } : null,
  };
}

/**
 * Legacy Facebook Login path: Instagram Professional accounts linked to Pages.
 * Kept for interpreting older Admin profile URLs until rows are re-saved.
 */
export function parseInstagramBusinessMetrics(payload: unknown): {
  identity: SocialIdentity | null;
  metrics: SocialAudienceMetrics | null;
  emptyAccounts: boolean;
} | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  const linked: Array<{
    identity: SocialIdentity;
    metrics: SocialAudienceMetrics | null;
  }> = [];
  for (const page of data) {
    if (!page || typeof page !== "object" || Array.isArray(page)) continue;
    const ig = (page as { instagram_business_account?: unknown }).instagram_business_account;
    if (!ig || typeof ig !== "object" || Array.isArray(ig)) continue;
    const record = ig as {
      id?: unknown;
      username?: unknown;
      name?: unknown;
      followers_count?: unknown;
      media_count?: unknown;
    };
    const username = typeof record.username === "string" ? record.username.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const handle = (username || name || "").replace(/^@/, "") || null;
    const externalId = typeof record.id === "string" && record.id.trim() ? record.id.trim() : null;
    if (!handle && !externalId) continue;
    const followers = asCount(record.followers_count);
    const media = asCount(record.media_count);
    linked.push({
      identity: { handle, externalId },
      metrics: followers != null ? { primary: followers, secondary: media } : null,
    });
  }
  if (!linked.length) {
    return { identity: null, metrics: null, emptyAccounts: data.length >= 0 };
  }
  return { ...linked[0]!, emptyAccounts: false };
}

/** X `users/me` — the @handle is `username`. `name` is the display name and is not a handle. */
export function parseXUser(payload: unknown): {
  identity: SocialIdentity | null;
  metrics: SocialAudienceMetrics | null;
} | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const root = payload as { data?: unknown };
  const data = root.data && typeof root.data === "object" && !Array.isArray(root.data) ? root.data : payload;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as {
    id?: unknown;
    name?: unknown;
    username?: unknown;
    public_metrics?: { followers_count?: unknown };
  };
  const username = typeof record.username === "string" ? record.username.trim().replace(/^@/, "") : "";
  const externalId = typeof record.id === "string" && record.id.trim() ? record.id.trim() : null;
  if (!username && !externalId) return null;
  const followers = asCount(record.public_metrics?.followers_count);
  return {
    identity: { handle: username || null, externalId },
    metrics: followers != null ? { primary: followers, secondary: null } : null,
  };
}

export function interpretSocialProfile(
  platform: SocialSyncPlatform | string | null | undefined,
  payload: unknown,
): SocialProfileResult {
  const key = (platform ?? "").toUpperCase();

  if (key === "TIKTOK") {
    const tiktok = parseTikTokUserInfo(payload);
    if (!tiktok) {
      return {
        identity: null,
        metrics: null,
        metricsNotice:
          "Connected without audience stats: TikTok did not return a usable user profile. Confirm user.info.basic and user.info.stats are approved, then Sync now.",
      };
    }
    return {
      identity: tiktok.identity,
      metrics: tiktok.metrics,
      metricsNotice: tiktok.metrics
        ? null
        : "Your TikTok account is connected, but follower statistics were not available yet. Confirm user.info.stats and try Sync now.",
    };
  }

  if (key === "X") {
    const x = parseXUser(payload);
    if (!x) {
      return {
        identity: null,
        metrics: null,
        metricsNotice:
          "This account is connected, but X did not return a username. Try Sync now later.",
      };
    }
    return {
      identity: x.identity,
      metrics: x.metrics,
      metricsNotice: x.identity?.handle
        ? x.metrics
          ? null
          : "Your X account is connected, but follower statistics were not available yet. Try Sync now later."
        : "Your X account is connected, but X did not return a username. Try Sync now later.",
    };
  }

  if (key === "YOUTUBE") {
    const youtube = parseYoutubeChannelMetrics(payload);
    if (!youtube) {
      return {
        identity: null,
        metrics: null,
        metricsNotice:
          "Connected without audience stats: YouTube did not return a usable channel profile. Use a Google account that owns a YouTube channel, then Sync now.",
      };
    }
    if (youtube.emptyChannel) {
      return {
        identity: null,
        metrics: null,
        metricsNotice:
          "Connected without audience stats: this Google account has no YouTube channel (or YouTube Data API returned none). Create a channel on that Google account, enable YouTube Data API v3 on the Google Cloud project, then Sync now.",
      };
    }
    return {
      identity: youtube.identity.handle || youtube.identity.externalId ? youtube.identity : null,
      metrics: youtube.metrics,
      metricsNotice: youtube.metrics
        ? null
        : "Your YouTube channel is connected, but subscriber statistics were not available yet. Try Sync now later.",
    };
  }

  if (key === "FACEBOOK") {
    const facebook = parseFacebookPageMetrics(payload);
    if (!facebook) {
      return {
        identity: null,
        metrics: null,
        metricsNotice:
          "Connected without audience stats: Facebook login worked, but Page details were not readable. Confirm the Login configuration includes pages_show_list / pages_read_engagement, then Sync now.",
      };
    }
    if (facebook.emptyPages) {
      return {
        identity: null,
        metrics: null,
        metricsNotice:
          "Connected without audience stats: no Facebook Page was shared. In Meta’s dialog pick a Page you manage, and use a Configuration that includes Page assets (pages_show_list).",
      };
    }
    return {
      identity: facebook.identity,
      metrics: facebook.metrics,
      metricsNotice: facebook.metrics
        ? null
        : "Your Facebook Page is connected, but audience statistics were not available yet. Confirm pages_read_engagement and try Sync now.",
    };
  }

  if (key === "INSTAGRAM") {
    const direct = parseInstagramLoginProfile(payload);
    if (direct?.identity) {
      return {
        identity: direct.identity,
        metrics: direct.metrics,
        metricsNotice: direct.metrics
          ? null
          : "Your Instagram Professional account is connected, but follower statistics were not available yet. Try Sync now later.",
      };
    }
    const legacy = parseInstagramBusinessMetrics(payload);
    if (legacy?.identity) {
      return {
        identity: legacy.identity,
        metrics: legacy.metrics,
        metricsNotice: legacy.metrics
          ? null
          : "Your Instagram Professional account is connected, but follower statistics were not available yet. Try Sync now later.",
      };
    }
    return {
      identity: null,
      metrics: null,
      metricsNotice:
        "Your Instagram login was authorized, but Influrios could not read a Professional account. Use an Instagram Business or Creator account with Instagram Login enabled for this app.",
    };
  }

  const generic = parseSocialMetrics(payload);
  const handle = findProfileString(payload, ["username", "handle", "customurl", "title", "name"]);
  const externalId = findProfileString(payload, ["id"]);
  if (!generic) {
    return {
      identity: handle || externalId ? { handle, externalId } : null,
      metrics: null,
      metricsNotice:
        "This account is connected, but audience statistics were not returned. You can keep it connected and try Sync now later.",
    };
  }
  return {
    identity: handle || externalId ? { handle, externalId } : { handle: null, externalId: null },
    metrics: { primary: generic.followers, secondary: generic.likes },
    metricsNotice: null,
  };
}

function findProfileString(value: unknown, keys: string[], depth = 0): string | null {
  if (!value || typeof value !== "object" || depth > 4) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findProfileString(item, keys, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const wanted of keys) {
    for (const [key, child] of Object.entries(record)) {
      if (key.toLowerCase() !== wanted) continue;
      if (typeof child === "string" && child.trim()) return child.trim();
      if (typeof child === "number" && Number.isFinite(child)) return String(child);
    }
  }
  for (const child of Object.values(record)) {
    const found = findProfileString(child, keys, depth + 1);
    if (found) return found;
  }
  return null;
}

/**
 * Upgrade weak Admin/profile URLs while preserving Instagram Unified Login’s
 * graph.facebook.com profile path (Facebook user tokens are invalid on graph.instagram.com).
 */
export function prepareSocialProfileUrl(profileUrl: string, platform?: string | null) {
  const network = platform ? socialNetwork(platform) : null;
  const candidate =
    network?.locksOAuthEndpoints && profileUrl && !socialHostAllowed(profileUrl, network.apiHosts)
      ? network.profileUrl
      : profileUrl || network?.profileUrl || "";

  const looksYoutube =
    network?.code === "youtube" || /googleapis\.com\/youtube\/v3\/channels/i.test(candidate);
  if (looksYoutube) {
    try {
      const url = new URL(candidate);
      if (url.hostname !== "www.googleapis.com" && url.hostname !== "googleapis.com") return candidate;
      if (!url.searchParams.get("part")) url.searchParams.set("part", "snippet,statistics");
      if (!url.searchParams.get("mine") && !url.searchParams.get("id") && !url.searchParams.get("forHandle")) {
        url.searchParams.set("mine", "true");
      }
      return url.toString();
    } catch {
      return candidate;
    }
  }

  const looksX = network?.code === "x" || /api\.(twitter|x)\.com\/2\/users\/me/i.test(candidate);
  if (looksX) {
    try {
      const url = new URL(candidate);
      if (url.hostname !== "api.twitter.com" && url.hostname !== "api.x.com") return candidate;
      url.pathname = "/2/users/me";
      if (!url.searchParams.get("user.fields")) {
        url.searchParams.set("user.fields", "public_metrics,username,name");
      }
      return url.toString();
    } catch {
      return candidate;
    }
  }

  const looksTikTok =
    network?.code === "tiktok" || /open\.tiktokapis\.com\/v2\/user\/info/i.test(candidate);
  if (looksTikTok) {
    try {
      const url = new URL(candidate);
      if (url.hostname !== "open.tiktokapis.com") return candidate;
      url.pathname = "/v2/user/info/";
      url.searchParams.set("fields", TIKTOK_USER_INFO_FIELDS);
      return url.toString();
    } catch {
      return candidate;
    }
  }

  if (network?.code === "instagram" || /graph\.(instagram|facebook)\.com/i.test(candidate)) {
    try {
      const url = new URL(candidate);
      if (url.hostname === "graph.instagram.com") {
        const path = url.pathname.replace(/\/+$/, "") || "/";
        if (path === "/me" || /^\/v\d+\.\d+\/me$/.test(path)) {
          if (!url.searchParams.get("fields")) {
            url.searchParams.set(
              "fields",
              "user_id,username,name,account_type,followers_count,media_count",
            );
          }
          return url.toString();
        }
      }
      if (network?.code === "instagram" && url.hostname === "graph.facebook.com") {
        const path = url.pathname.replace(/\/+$/, "") || "/";
        const versionMatch = path.match(/^\/(v\d+\.\d+)\//);
        const version = versionMatch?.[1] ?? META_GRAPH_VERSION;
        const weakUserPath =
          FACEBOOK_WEAK_PROFILE_PATHS.has(path) || /^\/v\d+\.\d+\/me$/.test(path) || path === "/me";
        const accountsPath = /\/me\/accounts$/i.test(path);
        if (weakUserPath || accountsPath) {
          url.pathname = `/${version}/me/accounts`;
          url.searchParams.set(
            "fields",
            "id,name,instagram_business_account{id,username,name,followers_count,media_count}",
          );
          return url.toString();
        }
        return url.toString();
      }
    } catch {
      return candidate;
    }
  }

  const looksFacebook =
    network?.code === "facebook" || /graph\.facebook\.com/i.test(candidate);
  if (!looksFacebook) return candidate;
  try {
    const url = new URL(candidate);
    if (url.hostname !== "graph.facebook.com") return candidate;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const versionMatch = path.match(/^\/(v\d+\.\d+)\//);
    const version = versionMatch?.[1] ?? META_GRAPH_VERSION;
    const weakUserPath =
      FACEBOOK_WEAK_PROFILE_PATHS.has(path) || /^\/v\d+\.\d+\/me$/.test(path) || path === "/me";
    const accountsPath = /\/me\/accounts$/i.test(path);
    if (weakUserPath || accountsPath) {
      url.pathname = `/${version}/me/accounts`;
      if (!url.searchParams.get("fields")) {
        url.searchParams.set("fields", "id,name,username,followers_count,fan_count");
      }
      return url.toString();
    }
    return url.toString();
  } catch {
    return candidate;
  }
}

/** Scopes are always owned by code — Admin freeform values are ignored. */
export function resolveSocialScopes(platform: string | null | undefined, _scopes?: string) {
  const network = platform ? socialNetwork(platform) : null;
  return network?.scopes ?? "";
}

/** Accept a bare Configuration ID or a full Meta login URL that contains config_id=. */
export function normalizeMetaConfigId(raw: string | null | undefined) {
  const value = (raw ?? "").trim();
  if (!value) return "";
  if (/^\d{6,}$/.test(value)) return value.slice(0, 120);
  try {
    const url = new URL(value);
    const fromQuery = url.searchParams.get("config_id")?.trim();
    if (fromQuery) return fromQuery.replace(/\D/g, "").slice(0, 120) || fromQuery.slice(0, 120);
  } catch {
    // not a URL
  }
  const match = value.match(/config_id=([^&\s#]+)/i);
  if (match?.[1]) {
    const decoded = decodeURIComponent(match[1]).trim();
    return decoded.replace(/\D/g, "").slice(0, 120) || decoded.slice(0, 120);
  }
  const labeled = value.match(/(?:config(?:uration)?[\s_-]*id)\s*[:=#-]?\s*(\d{6,})/i);
  if (labeled?.[1]) return labeled[1].slice(0, 120);
  const digits = value.match(/\b(\d{10,})\b/);
  if (digits?.[1]) return digits[1].slice(0, 120);
  return value.slice(0, 120);
}

/**
 * Meta App ID for Facebook dialog / Unified Login (`client_id`).
 * Accepts a bare App ID or a full Meta login URL that contains client_id=.
 * Do not confuse with Configuration ID (config_id) or Instagram App ID.
 */
export function normalizeMetaAppId(raw: string | null | undefined) {
  const value = (raw ?? "").trim();
  if (!value) return "";
  if (/^\d{6,}$/.test(value)) return value.slice(0, 120);
  try {
    const url = new URL(value);
    const fromQuery = url.searchParams.get("client_id")?.trim() || url.searchParams.get("app_id")?.trim();
    if (fromQuery) return fromQuery.replace(/\D/g, "").slice(0, 120) || fromQuery.slice(0, 120);
  } catch {
    // not a URL
  }
  const match = value.match(/(?:client_id|app_id)=([^&\s#]+)/i);
  if (match?.[1]) {
    const decoded = decodeURIComponent(match[1]).trim();
    return decoded.replace(/\D/g, "").slice(0, 120) || decoded.slice(0, 120);
  }
  const labeled = value.match(/(?:(?:meta|facebook)\s+)?app\s*id\s*[:=#-]?\s*(\d{6,})/i);
  if (labeled?.[1]) return labeled[1].slice(0, 120);
  const digits = value.match(/\b(\d{10,})\b/);
  if (digits?.[1]) return digits[1].slice(0, 120);
  return value.slice(0, 120);
}

/** Facebook dialog client_id must be the numeric Meta App ID from App settings → Basic. */
export function isLikelyMetaAppId(value: string | null | undefined) {
  return /^\d{6,20}$/.test((value ?? "").trim());
}

/**
 * Validate Meta Unified Login credentials before hitting Facebook's dialog.
 * Returns an error message when App ID / Configuration ID are swapped or malformed.
 */
export function validateMetaUnifiedLoginIds(input: {
  appId: string | null | undefined;
  configId: string | null | undefined;
}) {
  const appId = normalizeMetaAppId(input.appId);
  const configId = normalizeMetaConfigId(input.configId);
  if (!configId) {
    return { ok: false as const, error: "Configuration ID (config_id) is required for Meta Unified Login.", appId, configId };
  }
  if (!appId) {
    return {
      ok: false as const,
      error:
        "Meta App ID is required for Unified Login. Use App settings → Basic → App ID (not the Configuration ID, not an Instagram App ID).",
      appId,
      configId,
    };
  }
  if (!isLikelyMetaAppId(appId)) {
    return {
      ok: false as const,
      error:
        "Meta App ID must be the numeric App ID from App settings → Basic. Meta returns “Invalid app ID” when client_id is a Configuration ID, secret, or login URL.",
      appId,
      configId,
    };
  }
  if (appId === configId) {
    return {
      ok: false as const,
      error:
        "Meta App ID and Configuration ID are the same value. client_id must be the App ID; config_id must be the Facebook Login for Business Configuration ID.",
      appId,
      configId,
    };
  }
  if (!/^\d{6,20}$/.test(configId)) {
    return {
      ok: false as const,
      error: "Configuration ID must be the numeric config_id from Facebook Login for Business → Configurations.",
      appId,
      configId,
    };
  }
  return { ok: true as const, appId, configId };
}

/** True when the authorize URL will open Meta's Facebook Login dialog. */
export function isMetaFacebookDialogUrl(authorizeUrl: string | null | undefined) {
  if (!authorizeUrl) return false;
  try {
    const host = new URL(authorizeUrl).hostname.toLowerCase();
    return host === "www.facebook.com" || host === "facebook.com" || host.endsWith(".facebook.com");
  } catch {
    return /facebook\.com/i.test(authorizeUrl);
  }
}

/** Meta Graph OAuth token endpoint (Facebook + Instagram Unified Login). */
export function isMetaGraphTokenUrl(tokenUrl: string | null | undefined) {
  if (!tokenUrl) return false;
  try {
    const url = new URL(tokenUrl);
    const host = url.hostname.toLowerCase();
    return (
      (host === "graph.facebook.com" || host === "graph.instagram.com") &&
      /\/oauth\/access_token\/?$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

/** Pull a human-readable message from a Meta token or Graph error payload. */
export function metaOAuthErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  if (typeof record.error_description === "string" && record.error_description.trim()) {
    return record.error_description.trim().slice(0, 240);
  }
  if (typeof record.error_message === "string" && record.error_message.trim()) {
    return record.error_message.trim().slice(0, 240);
  }
  const nested = record.error;
  if (typeof nested === "string" && nested.trim()) return nested.trim().slice(0, 240);
  if (nested && typeof nested === "object") {
    const err = nested as Record<string, unknown>;
    if (typeof err.message === "string" && err.message.trim()) return err.message.trim().slice(0, 240);
    if (typeof err.error_user_msg === "string" && err.error_user_msg.trim()) {
      return err.error_user_msg.trim().slice(0, 240);
    }
  }
  return "";
}

export function metaTokenRedirectMismatch(message: string) {
  const blob = message.toLowerCase();
  return blob.includes("redirect_uri") || blob.includes("36007") || blob.includes("36008");
}

/**
 * Instagram has two Meta-supported login surfaces:
 * - Instagram Login (legacy apps with a dedicated Instagram App ID)
 * - Unified Login / Facebook Login for Business (newer apps → config_id only)
 *
 * Using the Meta App ID on www.instagram.com/oauth/authorize yields
 * “Invalid platform app”.
 */
export function resolveLockedOAuthEndpoints(
  platform: string | null | undefined,
  configId?: string | null,
): {
  authorizeUrl: string;
  tokenUrl: string;
  profileUrl: string;
  authorizeHosts: readonly string[];
  apiHosts: readonly string[];
  mode: "instagram_login" | "unified_config" | "default";
} | null {
  const network = platform ? socialNetwork(platform) : null;
  if (!network) return null;
  const hasConfig = Boolean(configId?.trim()) && network.supportsConfigId;

  if (network.code === "instagram" && hasConfig) {
    return {
      mode: "unified_config",
      authorizeUrl: `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`,
      tokenUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
      profileUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?fields=id,name,instagram_business_account{id,username,name,followers_count,media_count}`,
      authorizeHosts: network.authorizeHosts,
      apiHosts: network.apiHosts,
    };
  }

  return {
    mode: network.code === "instagram" ? "instagram_login" : "default",
    authorizeUrl: network.authorizeUrl,
    tokenUrl: network.tokenUrl,
    profileUrl: network.profileUrl,
    authorizeHosts: network.authorizeHosts,
    apiHosts: network.apiHosts,
  };
}

export function buildAuthorizeUrl(input: {
  authorizeUrl: string;
  authorizeHosts: readonly string[];
  clientIdParam: string;
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string;
  /**
   * Facebook Login for Business / Unified Login configuration id.
   * When set, Meta rejects freeform `scope=` — send config_id instead and omit scope.
   */
  configId?: string | null;
  /** Extra query params (e.g. Google access_type=offline). */
  extraParams?: Record<string, string>;
  /** X requires spaces in scope as %20. URLSearchParams writes them as +. */
  scopeSpaces?: "percent";
  /**
   * TikTok Login Kit requires application/x-www-form-urlencoded query parameters.
   * redirect_uri is encoded once. Scope commas stay raw.
   */
  tiktokQuery?: boolean;
}) {
  if (!socialHostAllowed(input.authorizeUrl, input.authorizeHosts)) return null;
  if (!input.clientId.trim() || !input.state.trim()) return null;
  const redirectUri = input.redirectUri.trim();
  if (!redirectUri || redirectUri.includes("#") || redirectUri.includes("?")) return null;
  const url = new URL(input.authorizeUrl);
  url.searchParams.set(input.clientIdParam, input.clientId.trim());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", input.state);
  const configId = input.configId?.trim() ?? "";
  if (configId) {
    url.searchParams.set("config_id", configId);
    // Required for some Login for Business / system-user configurations.
    url.searchParams.set("override_default_response_type", "true");
  } else if (input.scopes.trim()) {
    url.searchParams.set("scope", input.scopes.trim());
  }
  for (const [key, value] of Object.entries(input.extraParams ?? {})) {
    if (key && value) url.searchParams.set(key, value);
  }
  let built = url.toString();
  if (input.scopeSpaces === "percent") {
    built = built.replace(/([?&]scope=)([^&]*)/i, (_, prefix: string, value: string) => {
      return prefix + value.replace(/\+/g, "%20");
    });
  }
  if (!input.tiktokQuery) return built;
  const clientKey = input.clientId.trim().replace(/^['"]|['"]$/g, "");
  const scopes = input.scopes
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean)
    .join(",");
  if (!clientKey || !scopes) return null;
  // URLSearchParams writes "?" and encodes each value once, including scope commas.
  const authorize = new URL("https://www.tiktok.com/v2/auth/authorize/");
  authorize.searchParams.set("client_key", clientKey);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", scopes);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("state", input.state.trim());
  // Scope commas must stay commas. %2C makes TikTok report the request as a bad redirect_uri.
  return authorize.toString().replace(/([?&]scope=)([^&]*)/i, (_, prefix: string, value: string) => {
    return prefix + value.replace(/%2C/gi, ",");
  });
}
