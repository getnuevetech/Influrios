import { randomBytes } from "crypto";
import { getAppOrigin } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { invalidateDirectoryCache } from "@/lib/directory";
import { decryptSecret, encryptSecret, secretStatus } from "@/lib/provider-secrets";
import {
  SOCIAL_NETWORKS,
  buildAuthorizeUrl,
  interpretSocialProfile,
  isLiveSocialAccount,
  isMetaFacebookDialogUrl,
  prepareSocialProfileUrl,
  normalizeMetaConfigId,
  resolveLockedOAuthEndpoints,
  resolveSocialScopes,
  socialConnectGate,
  socialHostAllowed,
  socialMetricLabels,
  socialNetwork,
  type SocialSyncPlatform,
} from "@/lib/social-sync";

const POLICY_ID = "default";

const DEFAULT_TERMS =
  "I agree to connect this social account to Influrios. Influrios may read the account identity, follower count, and likes, and show those figures on my Influrios profile. Influrios will not post, message, or spend on my behalf. I can disconnect at any time.";

const DEFAULT_POLICY =
  "Influrios connects a social account only after the creator accepts the current integration terms. OAuth success keeps the network Connected even when audience statistics are unavailable. Platform-specific counts (for example YouTube subscribers and views, or Facebook Page followers) are saved when the network returns them. Disconnecting stops further sync and clears synced counts.";

type SocialExtra = {
  authorizeUrl: string;
  tokenUrl: string;
  profileUrl: string;
  scopes: string;
  configId: string;
  configPermissions: string;
  supportsConfigId: boolean;
  /** Legacy Instagram Login (instagram.com) — only for older apps with an Instagram App ID. */
  classicInstagramLogin: boolean;
  scopesLocked: true;
};

let catalogTask: Promise<void> | null = null;

function isUnique(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && String(error.code) === "P2002";
}

/** Read Configuration ID from the dedicated field or recover it from a pasted Meta login URL. */
function storedMetaConfigId(record: Record<string, unknown>, supportsConfigId: boolean) {
  if (!supportsConfigId) return "";
  const direct = record.configId;
  if (typeof direct === "string" && direct.trim()) return normalizeMetaConfigId(direct);
  if (typeof direct === "number" && Number.isFinite(direct)) return normalizeMetaConfigId(String(direct));
  const authorizeUrl = typeof record.authorizeUrl === "string" ? record.authorizeUrl : "";
  return authorizeUrl ? normalizeMetaConfigId(authorizeUrl) : "";
}

function extraOf(value: unknown, fallback: (typeof SOCIAL_NETWORKS)[number]): SocialExtra {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const resolvedConfigId = storedMetaConfigId(record, fallback.supportsConfigId);
  const classicInstagramLogin =
    fallback.code === "instagram" && record.classicInstagramLogin === true && !resolvedConfigId;
  if (fallback.locksOAuthEndpoints) {
    const locked = resolveLockedOAuthEndpoints(fallback.platform, resolvedConfigId) ?? {
      authorizeUrl: fallback.authorizeUrl,
      tokenUrl: fallback.tokenUrl,
      profileUrl: fallback.profileUrl,
    };
    return {
      authorizeUrl: locked.authorizeUrl,
      tokenUrl: locked.tokenUrl,
      profileUrl: locked.profileUrl,
      scopes: fallback.scopes,
      configId: resolvedConfigId,
      configPermissions: fallback.configPermissions,
      supportsConfigId: fallback.supportsConfigId,
      classicInstagramLogin,
      scopesLocked: true,
    };
  }
  const storedProfile =
    typeof record.profileUrl === "string" && record.profileUrl ? record.profileUrl : fallback.profileUrl;
  return {
    authorizeUrl:
      typeof record.authorizeUrl === "string" && record.authorizeUrl ? record.authorizeUrl : fallback.authorizeUrl,
    tokenUrl: typeof record.tokenUrl === "string" && record.tokenUrl ? record.tokenUrl : fallback.tokenUrl,
    profileUrl: prepareSocialProfileUrl(storedProfile, fallback.platform),
    scopes: resolveSocialScopes(fallback.platform),
    configId: resolvedConfigId,
    configPermissions: fallback.configPermissions,
    supportsConfigId: fallback.supportsConfigId,
    classicInstagramLogin,
    scopesLocked: true,
  };
}

async function seedSocialCatalog() {
  const policy = await prisma.socialConnectPolicy.findUnique({ where: { id: POLICY_ID } });
  if (!policy) {
    try {
      await prisma.socialConnectPolicy.create({
        data: { id: POLICY_ID, version: "2026-09-30", termsText: DEFAULT_TERMS, policyText: DEFAULT_POLICY },
      });
    } catch (error) {
      if (!isUnique(error)) throw error;
    }
  }
  for (const network of SOCIAL_NETWORKS) {
    const existing = await prisma.integrationProvider.findUnique({
      where: { kind_code: { kind: "social", code: network.code } },
    });
    if (existing) continue;
    try {
      await prisma.integrationProvider.create({
        data: {
          kind: "social",
          code: network.code,
          name: network.name,
          enabled: false,
          extraJson: {
            authorizeUrl: network.authorizeUrl,
            tokenUrl: network.tokenUrl,
            profileUrl: network.profileUrl,
            scopes: network.scopes,
          },
        },
      });
    } catch (error) {
      if (!isUnique(error)) throw error;
    }
  }
}

export function ensureSocialCatalog() {
  if (!catalogTask) {
    catalogTask = seedSocialCatalog().catch((error) => {
      catalogTask = null;
      throw error;
    });
  }
  return catalogTask;
}

export async function getSocialPolicy() {
  await ensureSocialCatalog();
  const row = await prisma.socialConnectPolicy.findUnique({ where: { id: POLICY_ID } });
  if (!row) throw new Error("The social integration terms are unavailable.");
  return row;
}

export async function saveSocialPolicy(input: { version: string; termsText: string; policyText: string }) {
  const current = await getSocialPolicy();
  const version = input.version.trim().slice(0, 40);
  const termsText = input.termsText.trim().slice(0, 4000);
  const policyText = input.policyText.trim().slice(0, 4000);
  if (!version || !termsText || !policyText) throw new Error("Version, terms, and policy are required.");
  const textChanged = termsText !== current.termsText || policyText !== current.policyText;
  if (textChanged && version === current.version) {
    throw new Error("Change the version when the terms or policy change so creators accept the new text.");
  }
  return prisma.socialConnectPolicy.update({
    where: { id: POLICY_ID },
    data: { version, termsText, policyText },
  });
}

export async function listSocialNetworks() {
  await ensureSocialCatalog();
  const rows = await prisma.integrationProvider.findMany({ where: { kind: "social" } });
  return SOCIAL_NETWORKS.map((network) => {
    const row = rows.find((item) => item.code === network.code);
    const extra = extraOf(row?.extraJson, network);
    const ready = Boolean(row?.enabled && row.publicKey && row.secretCipher);
    const locked = resolveLockedOAuthEndpoints(network.platform, extra.configId);
    const loginMode = locked?.mode ?? "default";
    const consentDetail =
      network.code === "instagram" && loginMode === "unified_config"
        ? "Meta Unified Login (Facebook dialog + Configuration ID — required for newer Meta apps)"
        : network.code === "instagram" && loginMode === "instagram_login"
          ? "Instagram Login (instagram_business_basic)"
          : network.code === "facebook" && extra.configId
            ? "Meta Unified Login (Facebook dialog + Configuration ID)"
            : extra.scopes;
    return {
      id: row?.id ?? "",
      code: network.code,
      name: network.name,
      platform: network.platform,
      enabled: Boolean(row?.enabled),
      clientId: row?.publicKey ?? "",
      secret: secretStatus(row?.secretCipher),
      ready,
      loginMode,
      consentDetail,
      ...extra,
    };
  });
}

export async function saveSocialNetwork(input: {
  code: string;
  enabled: boolean;
  clientId: string;
  secret: string;
  clearSecret?: boolean;
  authorizeUrl?: string;
  tokenUrl?: string;
  profileUrl?: string;
  /** Ignored — scopes are locked in code. */
  scopes?: string;
  configId?: string;
  clearConfigId?: boolean;
  /** Legacy Instagram Login path for older apps with an Instagram App ID. */
  classicInstagramLogin?: boolean;
}) {
  const network = socialNetwork(input.code);
  if (!network) throw new Error("Unknown social network.");
  const existingExtra =
    (await prisma.integrationProvider.findUnique({
      where: { kind_code: { kind: "social", code: network.code } },
    }))?.extraJson ?? null;
  const previous = extraOf(existingExtra, network);
  const configId = !network.supportsConfigId
    ? ""
    : input.clearConfigId
      ? ""
      : input.configId?.trim()
        ? normalizeMetaConfigId(input.configId)
        : previous.configId;
  const classicInstagramLogin =
    network.code === "instagram" && Boolean(input.classicInstagramLogin) && !configId;
  if (network.code === "instagram" && input.enabled && !configId && !classicInstagramLogin) {
    throw new Error(
      "Instagram needs a Facebook Login for Business Configuration ID (config_id). Meta returns “config_id is required” without it. Paste the Configuration ID from Meta → Facebook Login for Business → Configurations, or enable classic Instagram Login for older apps that still have an Instagram App ID.",
    );
  }
  if (network.code === "facebook" && input.enabled && !configId) {
    throw new Error(
      "Facebook needs a Facebook Login for Business Configuration ID (config_id). Meta returns “Invalid parameter: config_id is required” when Connect opens the Facebook dialog without it.",
    );
  }
  const locked = resolveLockedOAuthEndpoints(network.platform, configId);
  const authorizeUrl = network.locksOAuthEndpoints
    ? (locked?.authorizeUrl ?? network.authorizeUrl)
    : (input.authorizeUrl?.trim() || network.authorizeUrl);
  const tokenUrl = network.locksOAuthEndpoints
    ? (locked?.tokenUrl ?? network.tokenUrl)
    : (input.tokenUrl?.trim() || network.tokenUrl);
  const profileUrl = network.locksOAuthEndpoints
    ? (locked?.profileUrl ?? network.profileUrl)
    : prepareSocialProfileUrl(input.profileUrl?.trim() || network.profileUrl, network.platform);
  const scopes = resolveSocialScopes(network.platform);
  if (!socialHostAllowed(authorizeUrl, network.authorizeHosts)) {
    throw new Error(`${network.name} authorize URL must use an official https host.`);
  }
  if (!socialHostAllowed(tokenUrl, network.apiHosts)) {
    throw new Error(`${network.name} token URL must use an official https host.`);
  }
  if (!socialHostAllowed(profileUrl, network.apiHosts)) {
    throw new Error(`${network.name} profile URL must use an official https host.`);
  }
  await ensureSocialCatalog();
  const existing = await prisma.integrationProvider.findUnique({
    where: { kind_code: { kind: "social", code: network.code } },
  });
  const secretCipher = input.clearSecret
    ? null
    : input.secret.trim()
      ? encryptSecret(input.secret.trim())
      : existing?.secretCipher;
  const data = {
    name: network.name,
    enabled: input.enabled,
    publicKey: input.clientId.trim().slice(0, 200) || null,
    secretCipher: secretCipher ?? null,
    extraJson: {
      authorizeUrl,
      tokenUrl,
      profileUrl,
      scopes,
      ...(network.supportsConfigId ? { configId: configId || null } : {}),
      ...(network.code === "instagram" ? { classicInstagramLogin } : {}),
    },
  };
  if (existing) return prisma.integrationProvider.update({ where: { id: existing.id }, data });
  return prisma.integrationProvider.create({ data: { kind: "social", code: network.code, ...data } });
}

function redirectUri(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/social/callback`;
}

/** Exact OAuth redirect URI Google/Meta/etc must whitelist (full https URL). */
export function socialCallbackUrl(origin = getAppOrigin()) {
  return redirectUri(origin);
}

export async function socialConnectState(slug: string) {
  const policy = await getSocialPolicy();
  const networks = await listSocialNetworks();
  const creator = await prisma.creator.findUnique({
    where: { slug },
    include: { socialAccounts: true, socialConnections: true },
  });
  const accounts = networks.map((network) => {
    const connection = creator?.socialConnections.find((item) => item.platform === network.platform);
    const account = creator?.socialAccounts.find((item) => item.platform === network.platform);
    const live = account ? isLiveSocialAccount(account) : false;
    const labels = socialMetricLabels(network.platform);
    return {
      ...network,
      status: connection?.status ?? "needs_consent",
      lastError: connection?.lastError ?? null,
      consentCurrent: connection?.consentVersion === policy.version && connection.consentedAt != null,
      followers: live ? account?.followers ?? null : null,
      likes: live ? account?.likes ?? null : null,
      metricLabels: labels,
      audienceStatus: live ? ("synced" as const) : connection?.status === "connected" ? ("unavailable" as const) : ("idle" as const),
      live,
      syncedAt: live ? account?.refreshedAt?.toISOString() ?? null : null,
    };
  });
  return { policy, creatorId: creator?.id ?? null, accounts };
}

export async function beginSocialConnect(input: {
  slug: string;
  platform: string;
  accepted: boolean;
  origin: string;
}) {
  const network = socialNetwork(input.platform);
  if (!network) return { ok: false as const, error: "Unknown social network." };
  const policy = await getSocialPolicy();
  const creator = await prisma.creator.findUnique({ where: { slug: input.slug } });
  if (!creator) return { ok: false as const, error: "Publish your card before connecting a network." };
  const networks = await listSocialNetworks();
  const provider = networks.find((item) => item.platform === network.platform);
  const gate = socialConnectGate({
    accepted: input.accepted,
    acceptedVersion: input.accepted ? policy.version : null,
    currentVersion: policy.version,
    providerReady: Boolean(provider?.ready),
  });
  if (!gate.ok) return gate;
  const state = randomBytes(24).toString("base64url");
  await prisma.socialConnection.upsert({
    where: { creatorId_platform: { creatorId: creator.id, platform: network.platform } },
    update: {
      providerId: provider?.id || null,
      status: "consented",
      consentVersion: policy.version,
      consentedAt: new Date(),
      stateToken: state,
      lastError: null,
    },
    create: {
      creatorId: creator.id,
      platform: network.platform,
      providerId: provider?.id || null,
      status: "consented",
      consentVersion: policy.version,
      consentedAt: new Date(),
      stateToken: state,
    },
  });
  if (creator.userId) {
    await prisma.consentRecord.create({
      data: { userId: creator.userId, version: policy.version, source: `social:${network.code}` },
    });
  }
  try {
    const { recordLegalEvent } = await import("@/lib/legal");
    await recordLegalEvent({
      trigger: "social_connect",
      context: `social_connect:${network.code}`,
      userId: creator.userId,
      subjectKey: `creator:${creator.slug}`,
      userRole: "CREATOR",
    });
  } catch {
    return { ok: false as const, error: "The connected-account policy could not be recorded. Try again." };
  }
  // Always use the configured public origin — never request Host / 0.0.0.0 —
  // so the redirect_uri matches Google/Meta console whitelists.
  const configId = resolveConnectConfigId(provider!, networks);
  if (network.code === "instagram" && !configId && !provider!.classicInstagramLogin) {
    return {
      ok: false as const,
      error:
        "Instagram Connect needs a Meta Configuration ID. Admin → Social → Instagram: paste the Facebook Login for Business config_id (Meta error: “config_id is required”).",
    };
  }
  const locked = resolveLockedOAuthEndpoints(network.platform, configId);
  const authorizeBase = locked?.authorizeUrl ?? provider!.authorizeUrl;
  if (isMetaFacebookDialogUrl(authorizeBase) && !configId) {
    return {
      ok: false as const,
      error:
        "Meta requires config_id for this app. Admin → Social: paste the Facebook Login for Business Configuration ID on Instagram/Facebook, then try Connect again.",
    };
  }
  const authorizeUrl = buildAuthorizeUrl({
    authorizeUrl: authorizeBase,
    authorizeHosts: locked?.authorizeHosts ?? network.authorizeHosts,
    clientIdParam: network.clientIdParam,
    clientId: provider!.clientId,
    redirectUri: socialCallbackUrl(),
    state,
    scopes: provider!.scopes,
    // Login for Business / Unified Login: config_id replaces scope=.
    configId,
    extraParams:
      network.code === "youtube"
        ? { access_type: "offline", include_granted_scopes: "true", prompt: "consent" }
        : undefined,
  });
  if (!authorizeUrl) return { ok: false as const, error: "The authorize URL is not on an official host." };
  if (isMetaFacebookDialogUrl(authorizeUrl) && !authorizeUrl.includes("config_id=")) {
    return {
      ok: false as const,
      error:
        "Meta OAuth URL was missing config_id. Save a Configuration ID under Admin → Social and try Connect again.",
    };
  }
  return { ok: true as const, authorizeUrl, redirectUri: socialCallbackUrl() };
}

/** Prefer this network's config_id; fall back to the sibling Meta network when App IDs match. */
function resolveConnectConfigId(
  provider: {
    code: string;
    clientId: string;
    configId: string;
    supportsConfigId: boolean;
  },
  networks: Awaited<ReturnType<typeof listSocialNetworks>>,
) {
  if (!provider.supportsConfigId) return null;
  const own = normalizeMetaConfigId(provider.configId);
  if (own) return own;
  const siblingCode = provider.code === "instagram" ? "facebook" : provider.code === "facebook" ? "instagram" : null;
  if (!siblingCode || !provider.clientId) return null;
  const sibling = networks.find((item) => item.code === siblingCode);
  if (!sibling?.configId || !sibling.clientId || sibling.clientId !== provider.clientId) return null;
  return normalizeMetaConfigId(sibling.configId) || null;
}

async function readProvider(providerId: string | null, platform: SocialSyncPlatform) {
  const network = socialNetwork(platform);
  if (!network || !providerId) return null;
  const row = await prisma.integrationProvider.findFirst({ where: { id: providerId, kind: "social", enabled: true } });
  if (!row?.publicKey || !row.secretCipher) return null;
  const secret = decryptSecret(row.secretCipher);
  if (!secret) return null;
  return { network, row, secret, extra: extraOf(row.extraJson, network), clientId: row.publicKey };
}

async function requestToken(input: {
  tokenUrl: string;
  apiHosts: readonly string[];
  style: "form" | "json";
  clientIdParam: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code?: string;
  refreshToken?: string;
}) {
  if (!socialHostAllowed(input.tokenUrl, input.apiHosts)) return { ok: false as const, error: "The token URL is not on an official host." };
  const grant = input.refreshToken ? "refresh_token" : "authorization_code";
  const fields: Record<string, string> = {
    grant_type: grant,
    [input.clientIdParam]: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
  };
  if (input.code) fields.code = input.code;
  if (input.refreshToken) fields.refresh_token = input.refreshToken;
  const response = await fetch(input.tokenUrl, {
    method: "POST",
    redirect: "error",
    headers: input.style === "json" ? { "content-type": "application/json" } : { "content-type": "application/x-www-form-urlencoded" },
    body: input.style === "json" ? JSON.stringify(fields) : new URLSearchParams(fields),
    signal: AbortSignal.timeout(8000),
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const accessToken = typeof payload?.access_token === "string" ? payload.access_token : "";
  if (!response.ok || !accessToken) {
    return { ok: false as const, error: "The network did not return an access token." };
  }
  const refreshToken = typeof payload?.refresh_token === "string" ? payload.refresh_token : undefined;
  const expiresIn = typeof payload?.expires_in === "number" ? payload.expires_in : null;
  return {
    ok: true as const,
    accessToken,
    refreshToken,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
  };
}

/**
 * Hard failures only (bad host / HTTP reject). Missing audience stats are soft notices
 * so OAuth can still mark the network Connected.
 */
async function fetchSocialProfile(
  profileUrl: string,
  apiHosts: readonly string[],
  accessToken: string,
  platform?: SocialSyncPlatform,
) {
  const requestUrl = prepareSocialProfileUrl(profileUrl, platform ?? null);
  if (!socialHostAllowed(requestUrl, apiHosts)) {
    return { ok: false as const, error: "The profile URL is not on an official host." };
  }
  const response = await fetch(requestUrl, {
    redirect: "error",
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "error" in payload
        ? typeof (payload as { error?: { message?: unknown } }).error?.message === "string"
          ? String((payload as { error: { message: string } }).error.message).slice(0, 120)
          : ""
        : "";
    return {
      ok: false as const,
      error: detail
        ? `The network rejected the profile request (${response.status}: ${detail}).`
        : `The network rejected the profile request (HTTP ${response.status}).`,
    };
  }
  const profile = interpretSocialProfile(platform, payload);
  return { ok: true as const, ...profile };
}

function officialProfileUrl(platform: string, handle: string) {
  const name = handle.replace(/^@/, "");
  if (platform === "TIKTOK") return `https://www.tiktok.com/@${name}`;
  if (platform === "YOUTUBE") return `https://www.youtube.com/@${name}`;
  if (platform === "X") return `https://x.com/${name}`;
  if (platform === "FACEBOOK") return `https://www.facebook.com/${name}`;
  if (platform === "LINKEDIN") return `https://www.linkedin.com/in/${name}`;
  if (platform === "PINTEREST") return `https://www.pinterest.com/${name}`;
  return `https://www.instagram.com/${name}`;
}

async function writeConnectedIdentity(input: {
  creatorId: string;
  platform: SocialSyncPlatform;
  handle?: string | null;
  externalId?: string | null;
}) {
  const existing = await prisma.socialAccount.findUnique({
    where: { creatorId_platform: { creatorId: input.creatorId, platform: input.platform } },
  });
  const handle = input.handle
    ? `@${input.handle.replace(/^@/, "")}`
    : existing?.handle;
  if (!handle) return { ok: false as const, error: "The network did not return an account name." };
  const url = existing?.url || officialProfileUrl(input.platform, handle);
  await prisma.socialAccount.upsert({
    where: { creatorId_platform: { creatorId: input.creatorId, platform: input.platform } },
    update: {
      handle,
      url,
      // Keep prior live counts if this reconnect only refreshed identity.
      source: existing?.source === "PROVIDER_SYNCED" ? "PROVIDER_SYNCED" : "CREATOR_CLAIMED",
    },
    create: {
      creatorId: input.creatorId,
      platform: input.platform,
      handle,
      url,
      followers: null,
      likes: null,
      source: "CREATOR_CLAIMED",
      refreshedAt: null,
    },
  });
  invalidateDirectoryCache();
  return { ok: true as const };
}

async function writeLiveAccount(input: {
  creatorId: string;
  platform: SocialSyncPlatform;
  followers: number;
  likes: number | null;
  handle?: string | null;
  externalId?: string | null;
}) {
  const existing = await prisma.socialAccount.findUnique({
    where: { creatorId_platform: { creatorId: input.creatorId, platform: input.platform } },
  });
  const handle = input.handle
    ? `@${input.handle.replace(/^@/, "")}`
    : existing?.handle;
  if (!handle) {
    return { ok: false as const, error: "The network did not return an account name." };
  }
  const url = existing?.url || officialProfileUrl(input.platform, handle);
  await prisma.socialAccount.upsert({
    where: { creatorId_platform: { creatorId: input.creatorId, platform: input.platform } },
    update: {
      followers: input.followers,
      likes: input.likes,
      source: "PROVIDER_SYNCED",
      refreshedAt: new Date(),
      handle,
      url,
    },
    create: {
      creatorId: input.creatorId,
      platform: input.platform,
      handle,
      url,
      followers: input.followers,
      likes: input.likes,
      source: "PROVIDER_SYNCED",
      refreshedAt: new Date(),
    },
  });
  invalidateDirectoryCache();
  return { ok: true as const };
}

export async function completeSocialCallback(input: { code?: string; state?: string; error?: string; origin: string }) {
  if (!input.state) return { ok: false as const, error: "The network did not return a connection state." };
  const connection = await prisma.socialConnection.findUnique({
    where: { stateToken: input.state },
    include: { creator: true },
  });
  if (!connection) return { ok: false as const, error: "This connection request has expired." };
  const slug = connection.creator.slug;
  await prisma.socialConnection.update({ where: { id: connection.id }, data: { stateToken: null } });
  if (input.error || !input.code) {
    await prisma.socialConnection.update({
      where: { id: connection.id },
      data: { status: "error", lastError: "The network did not authorize the connection." },
    });
    return { ok: false as const, error: "The network did not authorize the connection.", slug };
  }
  const policy = await getSocialPolicy();
  if (connection.consentVersion !== policy.version) {
    return { ok: false as const, error: "Agree to the current Influrios social integration terms and policy before connecting.", slug };
  }
  const ready = await readProvider(connection.providerId, connection.platform as SocialSyncPlatform);
  if (!ready) return { ok: false as const, error: "This network is not connected yet.", slug };
  try {
    const token = await requestToken({
      tokenUrl: ready.extra.tokenUrl,
      apiHosts: ready.network.apiHosts,
      style: ready.network.tokenStyle,
      clientIdParam: ready.network.clientIdParam,
      clientId: ready.clientId,
      clientSecret: ready.secret,
      // Must match the authorize redirect_uri exactly (configured public origin).
      redirectUri: socialCallbackUrl(),
      code: input.code,
    });
    if (!token.ok) {
      await prisma.socialConnection.update({ where: { id: connection.id }, data: { status: "error", lastError: token.error } });
      return { ok: false as const, error: token.error, slug };
    }
    const profile = await fetchSocialProfile(
      ready.extra.profileUrl,
      ready.network.apiHosts,
      token.accessToken,
      connection.platform as SocialSyncPlatform,
    );
    const tokenFields = {
      tokenCipher: encryptSecret(token.accessToken),
      refreshCipher: token.refreshToken ? encryptSecret(token.refreshToken) : null,
      tokenExpiresAt: token.expiresAt,
    };
    if (!profile.ok) {
      // OAuth succeeded — keep Connected and surface the profile fetch as a soft notice.
      await prisma.socialConnection.update({
        where: { id: connection.id },
        data: {
          status: "connected",
          lastError: profile.error,
          lastSyncedAt: null,
          ...tokenFields,
        },
      });
      return { ok: true as const, slug, metricsSynced: false as const, notice: profile.error };
    }

    let metricsSynced = false;
    if (profile.identity?.handle || profile.identity?.externalId) {
      if (profile.metrics) {
        const written = await writeLiveAccount({
          creatorId: connection.creatorId,
          platform: connection.platform as SocialSyncPlatform,
          followers: profile.metrics.primary,
          likes: profile.metrics.secondary,
          handle: profile.identity.handle,
          externalId: profile.identity.externalId,
        });
        if (!written.ok) {
          await writeConnectedIdentity({
            creatorId: connection.creatorId,
            platform: connection.platform as SocialSyncPlatform,
            handle: profile.identity.handle,
            externalId: profile.identity.externalId,
          }).catch(() => null);
        } else {
          metricsSynced = true;
        }
      } else if (profile.identity.handle) {
        await writeConnectedIdentity({
          creatorId: connection.creatorId,
          platform: connection.platform as SocialSyncPlatform,
          handle: profile.identity.handle,
          externalId: profile.identity.externalId,
        });
      }
    }

    await prisma.socialConnection.update({
      where: { id: connection.id },
      data: {
        status: "connected",
        lastError: profile.metricsNotice,
        lastSyncedAt: metricsSynced ? new Date() : null,
        externalId: profile.identity?.externalId ?? null,
        ...tokenFields,
      },
    });
    const { syncCreatorSearch } = await import("@/lib/creator-search");
    await syncCreatorSearch(slug);
    return {
      ok: true as const,
      slug,
      metricsSynced,
      notice: profile.metricsNotice,
    };
  } catch {
    await prisma.socialConnection.update({
      where: { id: connection.id },
      data: { status: "error", lastError: "The network could not be reached." },
    });
    return { ok: false as const, error: "The network could not be reached.", slug };
  }
}

export async function refreshSocialConnection(input: { slug: string; platform: string; origin: string }) {
  const network = socialNetwork(input.platform);
  if (!network) return { ok: false as const, error: "Unknown social network." };
  const creator = await prisma.creator.findUnique({ where: { slug: input.slug } });
  if (!creator) return { ok: false as const, error: "Publish your card before connecting a network." };
  const connection = await prisma.socialConnection.findUnique({
    where: { creatorId_platform: { creatorId: creator.id, platform: network.platform } },
  });
  const policy = await getSocialPolicy();
  const { legalFeatureBlock } = await import("@/lib/legal");
  const legalBlock = await legalFeatureBlock({
    trigger: "social_connect",
    userId: creator.userId,
    subjectKey: `creator:${creator.slug}`,
  }).catch(() => null);
  if (legalBlock) return { ok: false as const, error: legalBlock };
  if (!connection?.consentedAt || connection.consentVersion !== policy.version) {
    return { ok: false as const, error: "Agree to the current Influrios social integration terms and policy before syncing." };
  }
  const ready = await readProvider(connection.providerId, network.platform);
  if (!ready || !connection.tokenCipher) {
    return { ok: false as const, error: "This network is not connected yet." };
  }
  let accessToken = decryptSecret(connection.tokenCipher);
  if (!accessToken) return { ok: false as const, error: "The saved network token cannot be read." };
  try {
    if (connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() < Date.now() && connection.refreshCipher) {
      const refreshToken = decryptSecret(connection.refreshCipher);
      if (!refreshToken) return { ok: false as const, error: "The saved network token cannot be read." };
      const refreshed = await requestToken({
        tokenUrl: ready.extra.tokenUrl,
        apiHosts: ready.network.apiHosts,
        style: ready.network.tokenStyle,
        clientIdParam: ready.network.clientIdParam,
        clientId: ready.clientId,
        clientSecret: ready.secret,
        redirectUri: socialCallbackUrl(),
        refreshToken,
      });
      if (!refreshed.ok) {
        await prisma.socialConnection.update({ where: { id: connection.id }, data: { status: "error", lastError: refreshed.error } });
        return refreshed;
      }
      accessToken = refreshed.accessToken;
      await prisma.socialConnection.update({
        where: { id: connection.id },
        data: {
          tokenCipher: encryptSecret(refreshed.accessToken),
          refreshCipher: refreshed.refreshToken ? encryptSecret(refreshed.refreshToken) : connection.refreshCipher,
          tokenExpiresAt: refreshed.expiresAt,
        },
      });
    }
    const profile = await fetchSocialProfile(
      ready.extra.profileUrl,
      ready.network.apiHosts,
      accessToken,
      network.platform,
    );
    if (!profile.ok) {
      await prisma.socialConnection.update({
        where: { id: connection.id },
        data: { status: "connected", lastError: profile.error },
      });
      return { ok: false as const, error: profile.error };
    }
    if (profile.metrics && (profile.identity?.handle || connection.externalId)) {
      const written = await writeLiveAccount({
        creatorId: creator.id,
        platform: network.platform,
        followers: profile.metrics.primary,
        likes: profile.metrics.secondary,
        handle: profile.identity?.handle,
        externalId: profile.identity?.externalId,
      });
      if (!written.ok) return written;
      await prisma.socialConnection.update({
        where: { id: connection.id },
        data: {
          status: "connected",
          lastError: null,
          lastSyncedAt: new Date(),
          externalId: profile.identity?.externalId ?? connection.externalId,
        },
      });
    } else {
      if (profile.identity?.handle) {
        await writeConnectedIdentity({
          creatorId: creator.id,
          platform: network.platform,
          handle: profile.identity.handle,
          externalId: profile.identity.externalId,
        });
      }
      await prisma.socialConnection.update({
        where: { id: connection.id },
        data: {
          status: "connected",
          lastError: profile.metricsNotice,
          externalId: profile.identity?.externalId ?? connection.externalId,
        },
      });
      return {
        ok: false as const,
        error:
          profile.metricsNotice ??
          "This account is connected, but audience statistics were not available yet.",
      };
    }
    const { syncCreatorSearch } = await import("@/lib/creator-search");
    await syncCreatorSearch(input.slug);
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "The network could not be reached." };
  }
}

export async function disconnectSocial(input: { slug: string; platform: string }) {
  const network = socialNetwork(input.platform);
  if (!network) return { ok: false as const, error: "Unknown social network." };
  const creator = await prisma.creator.findUnique({ where: { slug: input.slug } });
  if (!creator) return { ok: false as const, error: "Publish your card before connecting a network." };
  await prisma.socialConnection.deleteMany({ where: { creatorId: creator.id, platform: network.platform } });
  await prisma.socialAccount.updateMany({
    where: { creatorId: creator.id, platform: network.platform, source: "PROVIDER_SYNCED" },
    data: { source: "CREATOR_CLAIMED", followers: null, likes: null, refreshedAt: null },
  });
  invalidateDirectoryCache();
  const { syncCreatorSearch } = await import("@/lib/creator-search");
  await syncCreatorSearch(input.slug);
  return { ok: true as const };
}

export function callbackPath() {
  return "/api/social/callback";
}

/** Full callback URL shown in Admin → Social and provider consoles. */
export function callbackAbsoluteUrl() {
  return socialCallbackUrl();
}
