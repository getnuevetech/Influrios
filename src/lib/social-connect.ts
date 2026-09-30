import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { invalidateDirectoryCache } from "@/lib/directory";
import { decryptSecret, encryptSecret, secretStatus } from "@/lib/provider-secrets";
import {
  SOCIAL_NETWORKS,
  buildAuthorizeUrl,
  isLiveSocialAccount,
  parseSocialMetrics,
  socialConnectGate,
  socialHostAllowed,
  socialNetwork,
  type SocialSyncPlatform,
} from "@/lib/social-sync";

const POLICY_ID = "default";

const DEFAULT_TERMS =
  "I agree to connect this social account to Influrios. Influrios may read the account identity, follower count, and likes, and show those figures on my Influrios profile. Influrios will not post, message, or spend on my behalf. I can disconnect at any time.";

const DEFAULT_POLICY =
  "Influrios connects a social account only after the creator accepts the current integration terms. A follower count and likes are saved only when that network returns both numbers. Until then the profile keeps its current layout and figures. Disconnecting stops further sync and removes the synced counts.";

type SocialExtra = {
  authorizeUrl: string;
  tokenUrl: string;
  profileUrl: string;
  scopes: string;
};

let catalogTask: Promise<void> | null = null;

function isUnique(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && String(error.code) === "P2002";
}

function extraOf(value: unknown, fallback: (typeof SOCIAL_NETWORKS)[number]): SocialExtra {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    authorizeUrl: typeof record.authorizeUrl === "string" && record.authorizeUrl ? record.authorizeUrl : fallback.authorizeUrl,
    tokenUrl: typeof record.tokenUrl === "string" && record.tokenUrl ? record.tokenUrl : fallback.tokenUrl,
    profileUrl: typeof record.profileUrl === "string" && record.profileUrl ? record.profileUrl : fallback.profileUrl,
    scopes: typeof record.scopes === "string" && record.scopes ? record.scopes : fallback.scopes,
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
    return {
      id: row?.id ?? "",
      code: network.code,
      name: network.name,
      platform: network.platform,
      enabled: Boolean(row?.enabled),
      clientId: row?.publicKey ?? "",
      secret: secretStatus(row?.secretCipher),
      ready,
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
  authorizeUrl: string;
  tokenUrl: string;
  profileUrl: string;
  scopes: string;
}) {
  const network = socialNetwork(input.code);
  if (!network) throw new Error("Unknown social network.");
  if (!socialHostAllowed(input.authorizeUrl, network.authorizeHosts)) {
    throw new Error(`${network.name} authorize URL must use an official https host.`);
  }
  if (!socialHostAllowed(input.tokenUrl, network.apiHosts)) {
    throw new Error(`${network.name} token URL must use an official https host.`);
  }
  if (!socialHostAllowed(input.profileUrl, network.apiHosts)) {
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
      authorizeUrl: input.authorizeUrl.trim(),
      tokenUrl: input.tokenUrl.trim(),
      profileUrl: input.profileUrl.trim(),
      scopes: input.scopes.trim().slice(0, 300) || network.scopes,
    },
  };
  if (existing) return prisma.integrationProvider.update({ where: { id: existing.id }, data });
  return prisma.integrationProvider.create({ data: { kind: "social", code: network.code, ...data } });
}

function redirectUri(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/social/callback`;
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
    return {
      ...network,
      status: connection?.status ?? "needs_consent",
      lastError: connection?.lastError ?? null,
      consentCurrent: connection?.consentVersion === policy.version && connection.consentedAt != null,
      followers: live ? account?.followers ?? null : null,
      likes: live ? account?.likes ?? null : null,
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
  const provider = (await listSocialNetworks()).find((item) => item.platform === network.platform);
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
  const authorizeUrl = buildAuthorizeUrl({
    authorizeUrl: provider!.authorizeUrl,
    authorizeHosts: network.authorizeHosts,
    clientIdParam: network.clientIdParam,
    clientId: provider!.clientId,
    redirectUri: redirectUri(input.origin),
    state,
    scopes: provider!.scopes,
  });
  if (!authorizeUrl) return { ok: false as const, error: "The authorize URL is not on an official host." };
  return { ok: true as const, authorizeUrl };
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

async function fetchMetrics(profileUrl: string, apiHosts: readonly string[], accessToken: string) {
  if (!socialHostAllowed(profileUrl, apiHosts)) return { ok: false as const, error: "The profile URL is not on an official host." };
  const response = await fetch(profileUrl, {
    redirect: "error",
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) return { ok: false as const, error: "The network rejected the profile request." };
  const metrics = parseSocialMetrics(payload);
  if (!metrics) return { ok: false as const, error: "The network did not return a follower count and likes." };
  return { ok: true as const, metrics, handle: findString(payload, ["username", "handle"]), externalId: findString(payload, ["id"]) };
}

function findString(value: unknown, keys: string[], depth = 0): string | undefined {
  if (!value || typeof value !== "object" || depth > 4) return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findString(item, keys, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  const record = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(record)) {
    if (!keys.includes(key.toLowerCase())) continue;
    if (typeof child === "string" && child.trim()) return child.trim();
    if (typeof child === "number" && Number.isFinite(child)) return String(child);
  }
  for (const child of Object.values(record)) {
    const found = findString(child, keys, depth + 1);
    if (found) return found;
  }
  return undefined;
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

async function writeLiveAccount(input: {
  creatorId: string;
  platform: SocialSyncPlatform;
  followers: number;
  likes: number;
  handle?: string;
  externalId?: string;
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
      redirectUri: redirectUri(input.origin),
      code: input.code,
    });
    if (!token.ok) {
      await prisma.socialConnection.update({ where: { id: connection.id }, data: { status: "error", lastError: token.error } });
      return { ok: false as const, error: token.error, slug };
    }
    const metrics = await fetchMetrics(ready.extra.profileUrl, ready.network.apiHosts, token.accessToken);
    if (!metrics.ok) {
      await prisma.socialConnection.update({
        where: { id: connection.id },
        data: {
          status: "error",
          lastError: metrics.error,
          tokenCipher: encryptSecret(token.accessToken),
          refreshCipher: token.refreshToken ? encryptSecret(token.refreshToken) : null,
          tokenExpiresAt: token.expiresAt,
        },
      });
      return { ok: false as const, error: metrics.error, slug };
    }
    const written = await writeLiveAccount({
      creatorId: connection.creatorId,
      platform: connection.platform as SocialSyncPlatform,
      followers: metrics.metrics.followers,
      likes: metrics.metrics.likes,
      handle: metrics.handle,
      externalId: metrics.externalId,
    });
    if (!written.ok) {
      await prisma.socialConnection.update({ where: { id: connection.id }, data: { status: "error", lastError: written.error } });
      return { ok: false as const, error: written.error, slug };
    }
    await prisma.socialConnection.update({
      where: { id: connection.id },
      data: {
        status: "connected",
        lastError: null,
        lastSyncedAt: new Date(),
        externalId: metrics.externalId ?? null,
        tokenCipher: encryptSecret(token.accessToken),
        refreshCipher: token.refreshToken ? encryptSecret(token.refreshToken) : connection.refreshCipher,
        tokenExpiresAt: token.expiresAt,
      },
    });
    return { ok: true as const, slug };
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
        redirectUri: redirectUri(input.origin),
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
    const metrics = await fetchMetrics(ready.extra.profileUrl, ready.network.apiHosts, accessToken);
    if (!metrics.ok) {
      await prisma.socialConnection.update({ where: { id: connection.id }, data: { status: "error", lastError: metrics.error } });
      return { ok: false as const, error: metrics.error };
    }
    const written = await writeLiveAccount({
      creatorId: creator.id,
      platform: network.platform,
      followers: metrics.metrics.followers,
      likes: metrics.metrics.likes,
      handle: metrics.handle,
    });
    if (!written.ok) return written;
    await prisma.socialConnection.update({
      where: { id: connection.id },
      data: { status: "connected", lastError: null, lastSyncedAt: new Date() },
    });
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
  return { ok: true as const };
}

export function callbackPath() {
  return "/api/social/callback";
}
