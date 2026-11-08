import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  META_GRAPH_VERSION,
  buildAuthorizeUrl,
  createXPkce,
  exactOAuthRedirect,
  formatAuthorizeReport,
  reportAuthorizeUrl,
  interpretSocialProfile,
  isLiveSocialAccount,
  isMetaFacebookDialogUrl,
  isMetaGraphTokenUrl,
  metaOAuthErrorMessage,
  metaTokenRedirectMismatch,
  normalizeMetaAppId,
  normalizeMetaConfigId,
  TIKTOK_USER_INFO_FIELDS,
  parseFacebookPageMetrics,
  parseInstagramBusinessMetrics,
  parseInstagramLoginProfile,
  parseSocialMetrics,
  parseTikTokUserInfo,
  parseYoutubeChannelMetrics,
  prepareSocialProfileUrl,
  resolveLockedOAuthEndpoints,
  resolveSocialScopes,
  SOCIAL_NETWORKS,
  socialConnectGate,
  socialHostAllowed,
  socialMetricLabels,
  validateMetaUnifiedLoginIds,
} from "./social-sync";

describe("social consent gate", () => {
  it("requires the current terms before a network can connect", () => {
    const refused = socialConnectGate({
      accepted: false,
      acceptedVersion: null,
      currentVersion: "2026-09-30",
      providerReady: true,
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) assert.match(refused.error, /terms and policy/);
  });

  it("requires a new agreement when the policy version changes", () => {
    const refused = socialConnectGate({
      accepted: true,
      acceptedVersion: "2026-01-01",
      currentVersion: "2026-09-30",
      providerReady: true,
    });
    assert.equal(refused.ok, false);
  });

  it("stops before OAuth when the admin provider is not ready", () => {
    const refused = socialConnectGate({
      accepted: true,
      acceptedVersion: "2026-09-30",
      currentVersion: "2026-09-30",
      providerReady: false,
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) assert.match(refused.error, /not connected yet/);
  });

  it("allows a ready network after the current terms are accepted", () => {
    assert.deepEqual(
      socialConnectGate({
        accepted: true,
        acceptedVersion: "2026-09-30",
        currentVersion: "2026-09-30",
        providerReady: true,
      }),
      { ok: true },
    );
  });
});

describe("live social metrics", () => {
  it("reads followers and optional secondary counts from a provider payload", () => {
    assert.deepEqual(parseSocialMetrics({ data: { follower_count: 1200, likes_count: "45" } }), {
      followers: 1200,
      likes: 45,
    });
    assert.deepEqual(parseSocialMetrics({ followers: 10 }), { followers: 10, likes: null });
  });

  it("maps YouTube channel identity separately from subscriber/view metrics", () => {
    const parsed = parseYoutubeChannelMetrics({
      items: [
        {
          id: "UCabc",
          snippet: { title: "Ada", customUrl: "@ada" },
          statistics: { subscriberCount: "1200", viewCount: "55000", videoCount: "10" },
        },
      ],
    });
    assert.deepEqual(parsed, {
      identity: { handle: "ada", externalId: "UCabc" },
      metrics: { primary: 1200, secondary: 55000 },
      emptyChannel: false,
    });
    assert.equal(parseYoutubeChannelMetrics({ items: [] })?.emptyChannel, true);
    assert.equal(socialMetricLabels("YOUTUBE").secondary, "views");
  });

  it("adds YouTube channels.list query params when the stored URL is bare", () => {
    const prepared = prepareSocialProfileUrl("https://www.googleapis.com/youtube/v3/channels", "YOUTUBE");
    assert.match(prepared, /part=snippet%2Cstatistics|part=snippet,statistics/);
    assert.match(prepared, /mine=true/);
  });

  it("requires TikTok user.info fields aligned to basic + stats scopes", () => {
    const bare = prepareSocialProfileUrl("https://open.tiktokapis.com/v2/user/info/", "TIKTOK");
    assert.match(bare, /fields=/);
    assert.match(bare, /open_id/);
    assert.match(bare, /follower_count/);
    assert.match(bare, /likes_count/);
    assert.equal(bare.includes("username"), false);
    assert.equal(bare.includes("bio_description"), false);
    assert.match(TIKTOK_USER_INFO_FIELDS, /^open_id,/);

    const parsed = parseTikTokUserInfo({
      error: { code: "ok", message: "" },
      data: {
        user: {
          open_id: "tiktok-open-1",
          display_name: "Ada Creates",
          avatar_url: "https://example.com/a.png",
          follower_count: 4200,
          following_count: 12,
          likes_count: 99000,
          video_count: 40,
        },
      },
    });
    assert.deepEqual(parsed, {
      identity: { handle: "Ada Creates", externalId: "tiktok-open-1" },
      metrics: { primary: 4200, secondary: 99000 },
    });

    const interpreted = interpretSocialProfile("TIKTOK", {
      error: { code: "ok" },
      data: { user: { open_id: "x", display_name: "Ada", follower_count: 10, likes_count: 3 } },
    });
    assert.equal(interpreted.identity?.externalId, "x");
    assert.equal(interpreted.metrics?.primary, 10);
    assert.equal(interpreted.metricsNotice, null);
  });

  it("maps Facebook Page identity even when audience counts are missing", () => {
    const withCounts = parseFacebookPageMetrics({
      data: [
        { id: "111", name: "Ada Page", username: "adapage", followers_count: 900, fan_count: 880 },
      ],
    });
    assert.deepEqual(withCounts, {
      identity: { handle: "adapage", externalId: "111" },
      metrics: { primary: 900, secondary: 880 },
      emptyPages: false,
    });
    assert.equal(parseFacebookPageMetrics({ data: [] })?.emptyPages, true);
    const identityOnly = parseFacebookPageMetrics({
      data: [{ id: "1", name: "No counts" }],
    });
    assert.equal(identityOnly?.identity?.externalId, "1");
    assert.equal(identityOnly?.metrics, null);
  });

  it("maps Instagram Login /me Professional profiles", () => {
    const parsed = parseInstagramLoginProfile({
      user_id: "1784",
      username: "ada.creates",
      followers_count: 4200,
      media_count: 88,
    });
    assert.deepEqual(parsed, {
      identity: { handle: "ada.creates", externalId: "1784" },
      metrics: { primary: 4200, secondary: 88 },
    });
    const legacy = parseInstagramBusinessMetrics({
      data: [
        {
          id: "page1",
          name: "Brand",
          instagram_business_account: {
            id: "1784",
            username: "ada.creates",
            followers_count: 4200,
            media_count: 88,
          },
        },
      ],
    });
    assert.equal(legacy?.identity?.handle, "ada.creates");
  });

  it("locks Facebook/Instagram endpoints and scopes in code", () => {
    const facebook = prepareSocialProfileUrl("https://graph.facebook.com/v21.0/me", "FACEBOOK");
    assert.match(facebook, /\/me\/accounts/);
    assert.match(facebook, /followers_count/);
    // Unified Login keeps graph.facebook.com (Facebook user tokens fail on graph.instagram.com).
    const instagramUnified = prepareSocialProfileUrl(
      "https://graph.facebook.com/v22.0/me/accounts?fields=id,name,instagram_business_account{id,username}",
      "INSTAGRAM",
    );
    assert.match(instagramUnified, /graph\.facebook\.com/);
    assert.match(instagramUnified, /instagram_business_account/);
    const instagramWeak = prepareSocialProfileUrl("https://graph.facebook.com/v22.0/me", "INSTAGRAM");
    assert.match(instagramWeak, /graph\.facebook\.com\/v22\.0\/me\/accounts/);
    assert.match(instagramWeak, /instagram_business_account/);
    const instagramClassic = prepareSocialProfileUrl("https://evil.example/x", "INSTAGRAM");
    assert.match(instagramClassic, /graph\.instagram\.com/);
    assert.match(instagramClassic, /user_id,username/);
    assert.equal(resolveSocialScopes("FACEBOOK", "public_profile"), "public_profile,pages_show_list,pages_read_engagement");
    assert.equal(resolveSocialScopes("INSTAGRAM", "instagram_basic,pages_show_list"), "instagram_business_basic");
    assert.match(META_GRAPH_VERSION, /^v\d+\.\d+$/);
  });

  it("uses Meta config_id instead of scope for Facebook Login for Business", () => {
    const withConfig = buildAuthorizeUrl({
      authorizeUrl: "https://www.facebook.com/v22.0/dialog/oauth",
      authorizeHosts: ["www.facebook.com"],
      clientIdParam: "client_id",
      clientId: "app",
      redirectUri: "https://influrios.com/api/social/callback",
      state: "state",
      scopes: "pages_show_list,pages_read_engagement",
      configId: "1234567890",
    });
    assert.ok(withConfig?.includes("config_id=1234567890"));
    assert.ok(withConfig?.includes("override_default_response_type=true"));
    assert.equal(withConfig?.includes("scope="), false);

    const classic = buildAuthorizeUrl({
      authorizeUrl: "https://www.facebook.com/v22.0/dialog/oauth",
      authorizeHosts: ["www.facebook.com"],
      clientIdParam: "client_id",
      clientId: "app",
      redirectUri: "https://influrios.com/api/social/callback",
      state: "state",
      scopes: "public_profile,pages_show_list,pages_read_engagement",
    });
    assert.ok(classic?.includes("scope="));
    assert.equal(classic?.includes("config_id="), false);
  });

  it("switches Instagram to Unified Login endpoints when a config_id is present", () => {
    const login = resolveLockedOAuthEndpoints("INSTAGRAM", null);
    assert.equal(login?.mode, "instagram_login");
    assert.match(login?.authorizeUrl ?? "", /www\.instagram\.com\/oauth\/authorize/);

    const unified = resolveLockedOAuthEndpoints("INSTAGRAM", "998877");
    assert.equal(unified?.mode, "unified_config");
    assert.match(unified?.authorizeUrl ?? "", /facebook\.com\/.*\/dialog\/oauth/);
    assert.match(unified?.profileUrl ?? "", /instagram_business_account/);

    assert.equal(normalizeMetaConfigId("123456789012345"), "123456789012345");
    assert.equal(
      normalizeMetaConfigId(
        "https://www.facebook.com/v22.0/dialog/oauth?client_id=1&config_id=99887766&response_type=code",
      ),
      "99887766",
    );
    assert.equal(normalizeMetaConfigId("Configuration ID: 112233445566"), "112233445566");
    assert.equal(isMetaFacebookDialogUrl("https://www.facebook.com/v22.0/dialog/oauth"), true);
    assert.equal(isMetaFacebookDialogUrl("https://www.instagram.com/oauth/authorize"), false);

    const missingConfig = buildAuthorizeUrl({
      authorizeUrl: "https://www.facebook.com/v22.0/dialog/oauth",
      authorizeHosts: ["www.facebook.com"],
      clientIdParam: "client_id",
      clientId: "app",
      redirectUri: "https://influrios.com/api/social/callback",
      state: "state",
      scopes: "pages_show_list",
      configId: "5544332211",
    });
    assert.ok(missingConfig?.includes("config_id=5544332211"));

    assert.equal(
      normalizeMetaAppId(
        "https://www.facebook.com/v22.0/dialog/oauth?client_id=987654321098765&config_id=112233445566",
      ),
      "987654321098765",
    );
    assert.equal(normalizeMetaAppId("App ID: 987654321098765"), "987654321098765");
    const swapped = validateMetaUnifiedLoginIds({ appId: "112233445566", configId: "112233445566" });
    assert.equal(swapped.ok, false);
    assert.match(swapped.ok ? "" : swapped.error, /same value|Configuration ID/i);
    const badApp = validateMetaUnifiedLoginIds({ appId: "not-an-app-id", configId: "112233445566" });
    assert.equal(badApp.ok, false);
    assert.match(badApp.ok ? "" : badApp.error, /Invalid app ID|numeric App ID/i);
    const good = validateMetaUnifiedLoginIds({ appId: "987654321098765", configId: "112233445566" });
    assert.equal(good.ok, true);

    assert.equal(isMetaGraphTokenUrl("https://graph.facebook.com/v22.0/oauth/access_token"), true);
    assert.equal(isMetaGraphTokenUrl("https://api.instagram.com/oauth/access_token"), false);
    assert.match(
      metaOAuthErrorMessage({ error: { message: "Error validating verification code. redirect_uri" } }),
      /redirect_uri/i,
    );
    assert.equal(metaTokenRedirectMismatch("Error validating verification code. Please make sure your redirect_uri is identical"), true);
  });

  it("keeps OAuth success notices separate from hard metric failure", () => {
    const youtubeEmpty = interpretSocialProfile("YOUTUBE", { items: [] });
    assert.equal(youtubeEmpty.identity, null);
    assert.equal(youtubeEmpty.metrics, null);
    assert.match(youtubeEmpty.metricsNotice ?? "", /no YouTube channel|YouTube Data API/i);
    assert.equal(/Phase M/i.test(youtubeEmpty.metricsNotice ?? ""), false);

    const facebookEmpty = interpretSocialProfile("FACEBOOK", { data: [] });
    assert.match(facebookEmpty.metricsNotice ?? "", /no Facebook Page was shared|Page assets/i);
    assert.equal(/Phase M/i.test(facebookEmpty.metricsNotice ?? ""), false);
  });

  it("counts an account as live after a confirmed primary audience sync", () => {
    assert.equal(
      isLiveSocialAccount({ source: "PROVIDER_SYNCED", refreshedAt: new Date(), followers: 10, likes: 2 }),
      true,
    );
    assert.equal(
      isLiveSocialAccount({ source: "PROVIDER_SYNCED", refreshedAt: new Date(), followers: 10, likes: null }),
      true,
    );
    assert.equal(
      isLiveSocialAccount({ source: "CREATOR_CLAIMED", refreshedAt: new Date(), followers: 10, likes: 2 }),
      false,
    );
    assert.equal(
      isLiveSocialAccount({ source: "PROVIDER_SYNCED", refreshedAt: null, followers: 10, likes: 2 }),
      false,
    );
  });
});

describe("social provider hosts", () => {
  it("keeps authorize URLs on the official host", () => {
    assert.equal(socialHostAllowed("https://www.tiktok.com/v2/auth/authorize/", ["www.tiktok.com"]), true);
    assert.equal(socialHostAllowed("http://www.tiktok.com/v2/auth/authorize/", ["www.tiktok.com"]), false);
    assert.equal(socialHostAllowed("https://evil.example/authorize", ["www.tiktok.com"]), false);
    const url = buildAuthorizeUrl({
      authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
      authorizeHosts: ["www.tiktok.com"],
      clientIdParam: "client_key",
      clientId: "client",
      redirectUri: "https://influrios.com/api/social/callback",
      state: "state",
      scopes: "user.info.stats",
    });
    assert.ok(url?.includes("client_key=client"));
    const tiktok = buildAuthorizeUrl({
      authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
      authorizeHosts: ["www.tiktok.com"],
      clientIdParam: "client_key",
      clientId: "client",
      redirectUri: "https://influrios.com/api/social/callback",
      state: "state",
      scopes: "user.info.basic,user.info.stats",
      tiktokQuery: true,
    });
    assert.match(tiktok ?? "", /^https:\/\/www\.tiktok\.com\/v2\/auth\/authorize\/\?/);
    assert.match(tiktok ?? "", /[?&]scope=user\.info\.basic,user\.info\.stats&/);
    assert.match(tiktok ?? "", /[?&]response_type=code&/);
    assert.match(
      tiktok ?? "",
      /redirect_uri=https%3A%2F%2Finflurios\.com%2Fapi%2Fsocial%2Fcallback(&|$)/,
    );
    assert.equal((tiktok ?? "").includes("redirect_uri=https://"), false);
    assert.equal((tiktok ?? "").includes("scope=user.info.basic%2C"), false);
    const parsed = new URL(tiktok ?? "https://www.tiktok.com/");
    assert.equal(parsed.searchParams.get("redirect_uri"), "https://influrios.com/api/social/callback");
    const slashed = buildAuthorizeUrl({
      authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
      authorizeHosts: ["www.tiktok.com"],
      clientIdParam: "client_key",
      clientId: "sbawexampleclientkey",
      redirectUri: "https://influrios.com/api/social/callback/",
      state: "state",
      scopes: "user.info.basic,user.info.stats",
      tiktokQuery: true,
    });
    const slashedReport = reportAuthorizeUrl(slashed ?? "", "client_key");
    assert.equal(slashedReport.redirectUri, "https://influrios.com/api/social/callback/");
    assert.equal(slashedReport.redirectEncoding, "once");
    assert.equal(parsed.searchParams.get("scope"), "user.info.basic,user.info.stats");
    assert.equal(SOCIAL_NETWORKS.find((network) => network.code === "tiktok")?.tokenStyle, "form");
    const xNetwork = SOCIAL_NETWORKS.find((network) => network.code === "x");
    assert.equal(xNetwork?.authorizeUrl, "https://x.com/i/oauth2/authorize");
    const pkce = createXPkce("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    assert.equal(pkce.challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    assert.equal(pkce.method, "S256");
    const xUrl = buildAuthorizeUrl({
      authorizeUrl: "https://x.com/i/oauth2/authorize",
      authorizeHosts: ["x.com", "twitter.com"],
      clientIdParam: "client_id",
      clientId: "client",
      redirectUri: "https://influrios.com/api/social/callback",
      state: "state",
      scopes: "users.read tweet.read",
      extraParams: { code_challenge: pkce.challenge, code_challenge_method: "S256" },
    });
    const xParsed = new URL(xUrl ?? "https://x.com/");
    assert.equal(xParsed.searchParams.get("code_challenge"), pkce.challenge);
    assert.equal(xParsed.searchParams.get("code_challenge_method"), "S256");
    assert.equal(xParsed.searchParams.get("scope"), "users.read tweet.read");
    const spaced = buildAuthorizeUrl({
      authorizeUrl: "https://x.com/i/oauth2/authorize",
      authorizeHosts: ["x.com"],
      clientIdParam: "client_id",
      clientId: "clientidvalue123456",
      redirectUri: "https://influrios.com/api/social/callback",
      state: "state",
      scopes: "users.read tweet.read",
      scopeSpaces: "percent",
      extraParams: { code_challenge: pkce.challenge, code_challenge_method: "S256" },
    });
    assert.match(spaced ?? "", /scope=users\.read%20tweet\.read/);
    assert.equal((spaced ?? "").includes("scope=users.read+tweet.read"), false);
    const xReport = reportAuthorizeUrl(spaced ?? "", "client_id");
    assert.equal(xReport.redirectUri, "https://influrios.com/api/social/callback");
    assert.equal(xReport.redirectEncoding, "once");
    assert.equal(xReport.codeChallenge, true);
    assert.equal(xReport.codeChallengeMethod, "S256");
    assert.equal(xReport.scope, "users.read tweet.read");
    assert.equal(xReport.clientIdPrefix, "clie");
    assert.equal(xReport.clientIdLength, "clientidvalue123456".length);
    assert.equal(formatAuthorizeReport(xReport).includes("clientidvalue123456"), false);
    assert.equal(exactOAuthRedirect("https://influrios.com/api/social/callback/"), "https://influrios.com/api/social/callback/");
    assert.equal(exactOAuthRedirect("https://influrios.com/api/social/callback?next=1"), null);
    const tiktokReport = reportAuthorizeUrl(tiktok ?? "", "client_key");
    assert.equal(tiktokReport.redirectEncoding, "once");
    assert.equal(tiktokReport.codeChallenge, false);
    assert.match(
      prepareSocialProfileUrl("https://api.twitter.com/2/users/me", "X") ?? "",
      /user\.fields=public_metrics%2Cusername%2Cname|user\.fields=public_metrics,username,name/,
    );
    assert.equal(
      buildAuthorizeUrl({
        authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
        authorizeHosts: ["www.tiktok.com"],
        clientIdParam: "client_key",
        clientId: "client",
        redirectUri: "https://influrios.com/api/social/callback?next=1",
        state: "state",
        scopes: "user.info.basic",
      }),
      null,
    );
    assert.equal(
      buildAuthorizeUrl({
        authorizeUrl: "https://evil.example/authorize",
        authorizeHosts: ["www.tiktok.com"],
        clientIdParam: "client_key",
        clientId: "client",
        redirectUri: "https://influrios.com/api/social/callback",
        state: "state",
        scopes: "user.info.stats",
      }),
      null,
    );
  });
});
