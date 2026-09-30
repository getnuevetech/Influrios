import { formatFollowers } from "@/lib/seed-data";

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
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    profileUrl: "https://graph.facebook.com/v21.0/me",
    scopes: "instagram_basic,pages_show_list",
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
    profileUrl: "https://www.googleapis.com/youtube/v3/channels",
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
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    profileUrl: "https://graph.facebook.com/v21.0/me",
    scopes: "public_profile",
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

const FOLLOWER_KEYS = ["followers", "follower_count", "followers_count", "subscribercount", "subscriber_count"];
const LIKE_KEYS = ["likes", "like_count", "likes_count", "total_likes", "like_total"];

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

export function isLiveSocialAccount(row: {
  source: string;
  refreshedAt: Date | string | null;
  followers: number | null;
  likes: number | null;
}) {
  return (
    row.source === "PROVIDER_SYNCED" &&
    row.refreshedAt != null &&
    typeof row.followers === "number" &&
    row.followers >= 0 &&
    typeof row.likes === "number" &&
    row.likes >= 0
  );
}

export function socialAudienceLabel(
  social: { followers: number; likes?: number | null; live?: boolean } | null | undefined,
  options?: { withLikes?: boolean },
) {
  if (!social?.live) return "Not synced";
  if (options?.withLikes && social.likes != null) {
    return `${formatFollowers(social.followers)} · ${formatFollowers(social.likes)} likes`;
  }
  return formatFollowers(social.followers);
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
      if (found.followers != null && found.likes != null) return found;
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

/** Both numbers must be present. A missing field is not a successful sync. */
export function parseSocialMetrics(payload: unknown): { followers: number; likes: number } | null {
  const found = walk(payload, 0);
  if (found.followers == null || found.likes == null) return null;
  return { followers: found.followers, likes: found.likes };
}

export function buildAuthorizeUrl(input: {
  authorizeUrl: string;
  authorizeHosts: readonly string[];
  clientIdParam: string;
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string;
}) {
  if (!socialHostAllowed(input.authorizeUrl, input.authorizeHosts)) return null;
  if (!input.clientId.trim() || !input.state.trim()) return null;
  const url = new URL(input.authorizeUrl);
  url.searchParams.set(input.clientIdParam, input.clientId.trim());
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", input.scopes);
  return url.toString();
}
