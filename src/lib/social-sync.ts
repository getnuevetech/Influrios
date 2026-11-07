import { formatFollowers } from "@/lib/seed-data";

/** Current Meta Graph API version used for Instagram / Facebook defaults. */
export const META_GRAPH_VERSION = "v22.0";

/** Official authorize and API hosts. Admin URLs must stay on these. */
export const SOCIAL_NETWORKS = [
  {
    code: "instagram",
    platform: "INSTAGRAM",
    name: "Instagram",
    clientIdParam: "client_id",
    tokenStyle: "form",
    authorizeHosts: ["www.facebook.com", "api.instagram.com"],
    apiHosts: ["graph.facebook.com", "graph.instagram.com"],
    authorizeUrl: `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
    // Professional IG is linked to a Facebook Page — not a personal IG consumer account.
    profileUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?fields=id,name,instagram_business_account{id,username,name,followers_count,media_count}`,
    scopes: "instagram_basic,pages_show_list,pages_read_engagement",
  },
  {
    code: "tiktok",
    platform: "TIKTOK",
    name: "TikTok",
    clientIdParam: "client_key",
    tokenStyle: "json",
    authorizeHosts: ["www.tiktok.com"],
    apiHosts: ["open.tiktokapis.com"],
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    profileUrl: "https://open.tiktokapis.com/v2/user/info/",
    scopes: "user.info.basic,user.info.stats",
  },
  {
    code: "youtube",
    platform: "YOUTUBE",
    name: "YouTube",
    clientIdParam: "client_id",
    tokenStyle: "form",
    authorizeHosts: ["accounts.google.com"],
    apiHosts: ["oauth2.googleapis.com", "www.googleapis.com"],
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    // channels.list requires part + mine (or id). Bare /channels returns HTTP 400.
    profileUrl: "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    scopes: "https://www.googleapis.com/auth/youtube.readonly",
  },
  {
    code: "x",
    platform: "X",
    name: "X",
    clientIdParam: "client_id",
    tokenStyle: "form",
    authorizeHosts: ["twitter.com", "x.com"],
    apiHosts: ["api.twitter.com", "api.x.com"],
    authorizeUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    profileUrl: "https://api.twitter.com/2/users/me",
    scopes: "users.read tweet.read",
  },
  {
    code: "facebook",
    platform: "FACEBOOK",
    name: "Facebook",
    clientIdParam: "client_id",
    tokenStyle: "form",
    authorizeHosts: ["www.facebook.com"],
    apiHosts: ["graph.facebook.com"],
    authorizeUrl: `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
    // Personal /me never returns audience counts. Page list + fields is required.
    profileUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?fields=id,name,username,followers_count,fan_count`,
    scopes: "public_profile,pages_show_list,pages_read_engagement",
  },
  {
    code: "linkedin",
    platform: "LINKEDIN",
    name: "LinkedIn",
    clientIdParam: "client_id",
    tokenStyle: "form",
    authorizeHosts: ["www.linkedin.com"],
    apiHosts: ["api.linkedin.com", "www.linkedin.com"],
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    profileUrl: "https://api.linkedin.com/v2/userinfo",
    scopes: "openid profile",
  },
  {
    code: "pinterest",
    platform: "PINTEREST",
    name: "Pinterest",
    clientIdParam: "client_id",
    tokenStyle: "form",
    authorizeHosts: ["www.pinterest.com"],
    apiHosts: ["api.pinterest.com"],
    authorizeUrl: "https://www.pinterest.com/oauth/",
    tokenUrl: "https://api.pinterest.com/v5/oauth/token",
    profileUrl: "https://api.pinterest.com/v5/user_account",
    scopes: "user_accounts:read",
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

/** Legacy Instagram Admin rows that never walk Pages → IG Professional. */
export const INSTAGRAM_WEAK_SCOPES = new Set(["", "instagram_basic", "instagram_basic,pages_show_list"]);

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
  const title = typeof record.snippet?.title === "string" ? record.snippet.title.trim() : "";
  const handle = (customUrl || title || "").replace(/^@/, "") || null;
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
 * Instagram Professional accounts linked to Pages the user manages.
 * Consumer/personal Instagram accounts are not supported by Meta's Facebook Login IG APIs.
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

export function interpretSocialProfile(
  platform: SocialSyncPlatform | string | null | undefined,
  payload: unknown,
): SocialProfileResult {
  const key = (platform ?? "").toUpperCase();

  if (key === "YOUTUBE") {
    const youtube = parseYoutubeChannelMetrics(payload);
    if (!youtube) {
      return {
        identity: null,
        metrics: null,
        metricsNotice:
          "Your Google account was authorized, but YouTube did not return a usable channel profile. Try Sync now or another Google account.",
      };
    }
    if (youtube.emptyChannel) {
      return {
        identity: null,
        metrics: null,
        metricsNotice:
          "Your Google account was authorized, but we couldn't find a YouTube channel. Create a channel or choose another Google account, then sync again.",
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
          "Your Facebook login was authorized, but Influrios could not read Page details. Confirm Page permissions and try Sync now.",
      };
    }
    if (facebook.emptyPages) {
      return {
        identity: null,
        metrics: null,
        metricsNotice:
          "Your Facebook account was authorized, but no eligible Facebook Page was found. Connect a Page you manage to display Facebook audience statistics.",
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
    const instagram = parseInstagramBusinessMetrics(payload);
    if (!instagram) {
      return {
        identity: null,
        metrics: null,
        metricsNotice:
          "Your Instagram login was authorized, but Influrios could not read a Professional account. Link an Instagram Business or Creator account to a Facebook Page you manage.",
      };
    }
    if (instagram.emptyAccounts || !instagram.identity) {
      return {
        identity: null,
        metrics: null,
        metricsNotice:
          "Your Instagram login was authorized, but no Instagram Professional account linked to a Facebook Page was found. Personal Instagram accounts cannot sync audience statistics.",
      };
    }
    return {
      identity: instagram.identity,
      metrics: instagram.metrics,
      metricsNotice: instagram.metrics
        ? null
        : "Your Instagram Professional account is connected, but follower statistics were not available yet. Try Sync now later.",
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
  for (const [key, child] of Object.entries(record)) {
    if (!keys.includes(key.toLowerCase())) continue;
    if (typeof child === "string" && child.trim()) return child.trim();
    if (typeof child === "number" && Number.isFinite(child)) return String(child);
  }
  for (const child of Object.values(record)) {
    const found = findProfileString(child, keys, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Upgrade weak Facebook/Instagram Admin rows and ensure YouTube channels.list query params. */
export function prepareSocialProfileUrl(profileUrl: string, platform?: string | null) {
  const network = platform ? socialNetwork(platform) : null;
  const looksYoutube =
    network?.code === "youtube" || /googleapis\.com\/youtube\/v3\/channels/i.test(profileUrl);
  if (looksYoutube) {
    try {
      const url = new URL(profileUrl);
      if (url.hostname !== "www.googleapis.com" && url.hostname !== "googleapis.com") return profileUrl;
      if (!url.searchParams.get("part")) url.searchParams.set("part", "snippet,statistics");
      if (!url.searchParams.get("mine") && !url.searchParams.get("id") && !url.searchParams.get("forHandle")) {
        url.searchParams.set("mine", "true");
      }
      return url.toString();
    } catch {
      return profileUrl;
    }
  }

  const looksMetaGraph =
    network?.code === "facebook" ||
    network?.code === "instagram" ||
    /graph\.facebook\.com/i.test(profileUrl);
  if (!looksMetaGraph) return profileUrl;
  try {
    const url = new URL(profileUrl);
    if (url.hostname !== "graph.facebook.com") return profileUrl;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const versionMatch = path.match(/^\/(v\d+\.\d+)\//);
    const version = versionMatch?.[1] ?? META_GRAPH_VERSION;
    const weakUserPath =
      FACEBOOK_WEAK_PROFILE_PATHS.has(path) || /^\/v\d+\.\d+\/me$/.test(path) || path === "/me";
    const accountsPath = /\/me\/accounts$/i.test(path);

    if (network?.code === "instagram" || (!network && /instagram_business_account/i.test(url.search))) {
      if (weakUserPath || accountsPath) {
        url.pathname = `/${version}/me/accounts`;
        url.searchParams.set(
          "fields",
          "id,name,instagram_business_account{id,username,name,followers_count,media_count}",
        );
        return url.toString();
      }
    }

    if (weakUserPath || accountsPath) {
      url.pathname = `/${version}/me/accounts`;
      if (!url.searchParams.get("fields")) {
        url.searchParams.set("fields", "id,name,username,followers_count,fan_count");
      }
      return url.toString();
    }
    return url.toString();
  } catch {
    return profileUrl;
  }
}

/** Prefer Page / IG Professional scopes when Admin still has a weak default. */
export function resolveSocialScopes(platform: string | null | undefined, scopes: string) {
  const network = platform ? socialNetwork(platform) : null;
  if (!network) return scopes;
  const trimmed = scopes.trim();
  if (network.code === "facebook" && FACEBOOK_WEAK_SCOPES.has(trimmed)) return network.scopes;
  if (network.code === "instagram" && INSTAGRAM_WEAK_SCOPES.has(trimmed)) return network.scopes;
  return trimmed || network.scopes;
}

export function buildAuthorizeUrl(input: {
  authorizeUrl: string;
  authorizeHosts: readonly string[];
  clientIdParam: string;
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string;
  /** Extra query params (e.g. Google access_type=offline). */
  extraParams?: Record<string, string>;
}) {
  if (!socialHostAllowed(input.authorizeUrl, input.authorizeHosts)) return null;
  if (!input.clientId.trim() || !input.state.trim()) return null;
  const url = new URL(input.authorizeUrl);
  url.searchParams.set(input.clientIdParam, input.clientId.trim());
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", input.scopes);
  for (const [key, value] of Object.entries(input.extraParams ?? {})) {
    if (key && value) url.searchParams.set(key, value);
  }
  return url.toString();
}
